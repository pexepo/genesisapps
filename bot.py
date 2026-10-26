"""
Discord-бот: принимает заявки из Google Forms (через Apps Script), создаёт пост в
форум-канале с кнопками Accept/Decline и ведёт review-флоу.

Поток данных:
  Google Forms --(onFormSubmit)--> Apps Script --(HTTP POST /submit)--> бот --> форум-канал

Review-флоу:
  [пост] -> ревьюер жмёт Accept/Decline (только роль REVIEWER_ROLE_ID)
    Decline -> статус ветки = Declined
    Accept  -> ревьюеру приходит приватное (ephemeral) сообщение с 4 кнопками ролей
               -> выбор роли выдаёт её заявителю и ставит статус Accepted — <роль>
"""

import os
import json
import hmac
import base64
import binascii
import hashlib
import secrets
import time
import uuid
import asyncio
import logging
from pathlib import Path
from datetime import datetime, timezone
from urllib.parse import urlencode

# --- TLS / корневые сертификаты (ВАЖНО: до импорта aiohttp/discord) ---
# Python с python.org на macOS часто ставится без корневых сертификатов, из-за чего
# подключение к discord.com падает с CERTIFICATE_VERIFY_FAILED. Пакет certifi (в
# requirements.txt) содержит актуальный CA-бандл. Переменную нужно выставить ДО
# импорта aiohttp/discord: aiohttp фиксирует SSL-контекст по умолчанию уже при
# импорте, и более поздняя установка SSL_CERT_FILE на него не повлияет.
try:
    import certifi
    os.environ.setdefault("SSL_CERT_FILE", certifi.where())
except Exception:
    pass

import discord
from aiohttp import web, BasicAuth, ClientSession
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s  %(name)s  %(message)s",
)
log = logging.getLogger("forms-bot")

DISCORD_TOKEN = os.environ["DISCORD_TOKEN"]
FORUM_CHANNEL_ID = int(os.environ["FORUM_CHANNEL_ID"])
SHARED_SECRET = os.environ["SHARED_SECRET"]
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8080"))

# --- Веб-сайт заявки (раздаётся этим же сервером) ---
WEB_DIR = Path(__file__).resolve().parent / "web"
ASSETS_DIR = WEB_DIR / "assets"
INDEX_FILE = WEB_DIR / "index.html"

# Антиспам для публичного эндпоинта /apply: не более APPLY_RATE_MAX заявок
# с одного IP за APPLY_RATE_WINDOW секунд.
APPLY_RATE_MAX = int(os.getenv("APPLY_RATE_MAX", "5"))
APPLY_RATE_WINDOW = int(os.getenv("APPLY_RATE_WINDOW", "600"))
# Заголовок поста для веб-заявок (если в самом запросе не пришёл свой).
APPLY_FORM_TITLE = os.getenv("APPLY_FORM_TITLE", "Genesis application").strip() or "Genesis application"
APPLY_MAX_FIELDS = 25
APPLICATION_COOLDOWN = int(os.getenv("APPLICATION_COOLDOWN", "86400"))
TRUST_PROXY = os.getenv("TRUST_PROXY", "0").strip().lower() in ("1", "true", "yes")

# Discord OAuth2. Website applications require a verified Discord identity when
# these values are configured.
DISCORD_CLIENT_ID = os.getenv("DISCORD_CLIENT_ID", "").strip()
DISCORD_CLIENT_SECRET = os.getenv("DISCORD_CLIENT_SECRET", "").strip()
DISCORD_REDIRECT_URI = os.getenv("DISCORD_REDIRECT_URI", "").strip()
if any((DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_REDIRECT_URI)) and not all(
    (DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_REDIRECT_URI)
):
    raise RuntimeError(
        "Discord OAuth is only partially configured. Set DISCORD_CLIENT_ID, "
        "DISCORD_CLIENT_SECRET and DISCORD_REDIRECT_URI together."
    )
OAUTH_ENABLED = bool(DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET and DISCORD_REDIRECT_URI)
SESSION_SECRET = os.getenv("SESSION_SECRET", SHARED_SECRET).encode("utf-8")
SESSION_COOKIE = "genesis_session"
SESSION_MAX_AGE = int(os.getenv("SESSION_MAX_AGE", "604800"))

# Optional outbound HTTP(S) proxy for Discord's gateway, REST API and OAuth.
OUTBOUND_PROXY = os.getenv("OUTBOUND_PROXY", "").strip() or None
PROXY_USERNAME = os.getenv("PROXY_USERNAME", "").strip()
PROXY_PASSWORD = os.getenv("PROXY_PASSWORD", "")
PROXY_AUTH = BasicAuth(PROXY_USERNAME, PROXY_PASSWORD) if PROXY_USERNAME else None

# Роль, которой разрешено жать Accept/Decline и кнопки выбора роли.
REVIEWER_ROLE_ID = int(os.environ["REVIEWER_ROLE_ID"])
APPLICANT_ROLE_ID = int(os.getenv("APPLICANT_ROLE_ID") or 0) or None
CORE_MEMBER_ROLE_ID = int(os.getenv("CORE_MEMBER_ROLE_ID") or 0) or None

# Пинговать ли роль ревьюеров (судей) в новом посте-заявке (1/0).
PING_REVIEWER = os.getenv("PING_REVIEWER", "1").strip() not in ("0", "false", "False", "")

DEFAULT_TAG_IDS = [
    int(t) for t in os.getenv("DEFAULT_TAG_IDS", "").replace(" ", "").split(",") if t
]
# Теги статуса (необязательно). Если заданы — вешаются при решении.
ACCEPTED_TAG_ID = int(os.getenv("ACCEPTED_TAG_ID") or 0) or None
DECLINED_TAG_ID = int(os.getenv("DECLINED_TAG_ID") or 0) or None

# Файл состояния заявок (для persistent views после рестарта).
STATE_FILE = Path(os.getenv("STATE_FILE", "submissions.json"))
STATE_MAX = 5000


def _load_role_choices() -> list[dict]:
    """Читает ROLE_CHOICE_1..4 (_ID и _NAME) из окружения."""
    choices = []
    for i in range(1, 5):
        rid = os.getenv(f"ROLE_CHOICE_{i}_ID", "").strip()
        if not rid:
            continue
        name = os.getenv(f"ROLE_CHOICE_{i}_NAME", "").strip() or f"Role {i}"
        choices.append({"id": int(rid), "name": name, "grants_core_role": i <= 3})
    return choices


ROLE_CHOICES = _load_role_choices()


# ----------------------------------------------------------------------------
# Кастомизация embed (всё читается из .env, код менять не нужно)
# ----------------------------------------------------------------------------

def _parse_color(raw: str) -> discord.Color:
    """Цвет из hex (#5865F2 / 5865F2 / 0x5865F2). По умолчанию blurple."""
    raw = (raw or "").strip().lstrip("#")
    if raw.lower().startswith("0x"):
        raw = raw[2:]
    try:
        return discord.Color(int(raw, 16))
    except (ValueError, TypeError):
        return discord.Color.blurple()


EMBED_COLOR = _parse_color(os.getenv("EMBED_COLOR", ""))
# {form_title} и {responder} подставляются в title/footer.
EMBED_TITLE = os.getenv("EMBED_TITLE", "").strip()          # пусто = брать form_title из формы
EMBED_FOOTER = os.getenv("EMBED_FOOTER", "Genesis application").strip()
EMBED_FOOTER_ICON = os.getenv("EMBED_FOOTER_ICON", "").strip()   # URL иконки футера
EMBED_THUMBNAIL = os.getenv("EMBED_THUMBNAIL", "").strip()       # URL картинки справа-вверху
EMBED_IMAGE = os.getenv("EMBED_IMAGE", "").strip()              # URL большой картинки внизу
EMBED_AUTHOR_ICON = os.getenv("EMBED_AUTHOR_ICON", "").strip()  # URL иконки рядом с автором
# Показывать ли email/имя отправителя как автора эмбеда (1/0).
EMBED_SHOW_AUTHOR = os.getenv("EMBED_SHOW_AUTHOR", "1").strip() not in ("0", "false", "False", "")
# Показывать ли время заявки (1/0).
EMBED_SHOW_TIMESTAMP = os.getenv("EMBED_SHOW_TIMESTAMP", "1").strip() not in ("0", "false", "False", "")

# Лимиты Discord
THREAD_NAME_MAX = 100
FIELD_VALUE_MAX = 1024
EMBED_FIELDS_MAX = 25

def _truncate(text: str, limit: int) -> str:
    text = (text or "").strip()
    return text if len(text) <= limit else text[: limit - 1] + "…"


# ----------------------------------------------------------------------------
# Хранилище состояния заявок
# ----------------------------------------------------------------------------

class SubmissionStore:
    """
    Хранит состояние по thread_id (стартовое сообщение поста имеет тот же id, что и ветка).
      { thread_id: {applicant_id, response_id, status, role_name} }
    Используется для дедупа и для persistent views после рестарта бота.
    """

    def __init__(self, path: Path) -> None:
        self._path = path
        self._lock = asyncio.Lock()
        self._data: dict[str, dict] = {}
        self._seen_responses: set[str] = set()
        self._daily_claims: list[dict] = []
        self._load()

    def _load(self) -> None:
        try:
            raw = json.loads(self._path.read_text(encoding="utf-8"))
            self._data = dict(raw.get("submissions", {}))
            self._daily_claims = list(raw.get("daily_claims", []))
            self._seen_responses = {
                str(v.get("response_id")) for v in self._data.values() if v.get("response_id")
            }
        except (FileNotFoundError, json.JSONDecodeError, ValueError, AttributeError):
            self._data, self._seen_responses, self._daily_claims = {}, set(), []

    def _flush(self) -> None:
        # Подрезаем до STATE_MAX последних записей.
        if len(self._data) > STATE_MAX:
            keys = list(self._data)[-STATE_MAX:]
            self._data = {k: self._data[k] for k in keys}
        tmp = self._path.with_suffix(self._path.suffix + ".tmp")
        tmp.write_text(
            json.dumps(
                {"submissions": self._data, "daily_claims": self._daily_claims},
                ensure_ascii=False,
                indent=0,
            ),
            encoding="utf-8",
        )
        tmp.replace(self._path)

    def has_response(self, response_id: str) -> bool:
        return bool(response_id) and response_id in self._seen_responses

    async def create(
        self,
        thread_id: int,
        applicant: str,
        response_id: str,
        applicant_id: str | None = None,
    ) -> None:
        async with self._lock:
            self._data[str(thread_id)] = {
                "applicant": applicant,  # юзернейм ИЛИ числовой Discord ID
                "applicant_id": applicant_id,
                "response_id": response_id,
                "submitted_at": datetime.now(timezone.utc).isoformat(),
                "status": "pending",
                "role_name": None,
            }
            if response_id:
                self._seen_responses.add(response_id)
            self._flush()

    async def claim_daily(self, applicant_id: str, ip_hash: str) -> str | None:
        """Atomically reserve one daily application slot for both identifiers."""
        async with self._lock:
            now = time.time()
            cutoff = now - APPLICATION_COOLDOWN
            self._daily_claims = [c for c in self._daily_claims if c.get("at", 0) > cutoff]
            if any(
                c.get("applicant_id") == applicant_id or c.get("ip_hash") == ip_hash
                for c in self._daily_claims
            ):
                self._flush()
                return None
            claim_id = uuid.uuid4().hex
            self._daily_claims.append({
                "id": claim_id,
                "applicant_id": applicant_id,
                "ip_hash": ip_hash,
                "at": now,
            })
            self._flush()
            return claim_id

    async def release_claim(self, claim_id: str) -> None:
        async with self._lock:
            self._daily_claims = [c for c in self._daily_claims if c.get("id") != claim_id]
            self._flush()

    def get(self, thread_id: int) -> dict | None:
        return self._data.get(str(thread_id))

    async def set_status(self, thread_id: int, status: str, role_name: str | None = None) -> None:
        async with self._lock:
            rec = self._data.get(str(thread_id))
            if rec is None:
                rec = {"applicant": None, "response_id": None}
                self._data[str(thread_id)] = rec
            rec["status"] = status
            rec["role_name"] = role_name
            self._flush()


# ----------------------------------------------------------------------------
# Построение embed / имени ветки
# ----------------------------------------------------------------------------

def build_embed(payload: dict) -> discord.Embed:
    form_title = payload.get("form_title") or "New application"
    responder = payload.get("responder") or "—"
    responses = payload.get("responses") or []

    # Заголовок: EMBED_TITLE с подстановками или, если пусто, — название формы.
    title = EMBED_TITLE or form_title
    title = title.replace("{form_title}", form_title).replace("{responder}", responder)

    embed = discord.Embed(
        title=_truncate(title, 256),
        color=EMBED_COLOR,
    )
    if EMBED_SHOW_TIMESTAMP:
        embed.timestamp = datetime.now(timezone.utc)

    if EMBED_SHOW_AUTHOR and responder and responder != "—":
        embed.set_author(
            name=_truncate(responder, 256),
            icon_url=EMBED_AUTHOR_ICON or None,
        )

    if EMBED_THUMBNAIL:
        embed.set_thumbnail(url=EMBED_THUMBNAIL)
    if EMBED_IMAGE:
        embed.set_image(url=EMBED_IMAGE)

    for item in responses[:EMBED_FIELDS_MAX]:
        question = _truncate(str(item.get("question", "—")), 256) or "—"
        answer = _truncate(str(item.get("answer", "")), FIELD_VALUE_MAX) or "—"
        embed.add_field(name=question, value=answer, inline=False)

    if EMBED_FOOTER:
        footer = EMBED_FOOTER.replace("{form_title}", form_title).replace("{responder}", responder)
        embed.set_footer(text=_truncate(footer, 2048), icon_url=EMBED_FOOTER_ICON or None)
    return embed


def build_thread_name(payload: dict) -> str:
    base = payload.get("form_title") or "Application"
    first_answer = ""
    for item in payload.get("responses") or []:
        ans = str(item.get("answer", "")).strip()
        if ans:
            first_answer = ans
            break
    name = f"{base} — {first_answer}" if first_answer else base
    return _truncate(name, THREAD_NAME_MAX)


# ----------------------------------------------------------------------------
# UI: кнопки выбора роли (ephemeral, создаётся вживую при Accept)
# ----------------------------------------------------------------------------

class RoleChoiceView(discord.ui.View):
    def __init__(self, bot: "FormsBot", thread_id: int) -> None:
        super().__init__(timeout=600)
        self.bot = bot
        self.thread_id = thread_id
        for idx, choice in enumerate(ROLE_CHOICES):
            self.add_item(self._make_button(idx, choice))

    def _make_button(self, idx: int, choice: dict) -> discord.ui.Button:
        button = discord.ui.Button(
            label=_truncate(choice["name"], 80),
            style=discord.ButtonStyle.primary,
            custom_id=f"rolechoice:{idx}",
        )

        async def callback(interaction: discord.Interaction) -> None:
            await self.bot.on_role_choice(interaction, self.thread_id, choice)

        button.callback = callback
        return button


# ----------------------------------------------------------------------------
# UI: persistent Accept / Decline
# ----------------------------------------------------------------------------

class ReviewView(discord.ui.View):
    """Persistent view на стартовом сообщении поста. custom_id фиксированы."""

    def __init__(self, bot: "FormsBot") -> None:
        super().__init__(timeout=None)
        self.bot = bot

    @discord.ui.button(label="Accept", style=discord.ButtonStyle.success, custom_id="review:accept")
    async def accept(self, interaction: discord.Interaction, button: discord.ui.Button) -> None:
        await self.bot.on_accept(interaction)

    @discord.ui.button(label="Decline", style=discord.ButtonStyle.danger, custom_id="review:decline")
    async def decline(self, interaction: discord.Interaction, button: discord.ui.Button) -> None:
        await self.bot.on_decline(interaction)


# ----------------------------------------------------------------------------
# Перевод сообщений (контекстное меню «Translate / Перевести»)
# ----------------------------------------------------------------------------

# shortcut: неофициальный бесключевой эндпоинт Google (translate.googleapis.com
# отвечает 429 на HTTP/1.1 от aiohttp), может начать отдавать капчу при большом объёме; если перестанет работать — перейти на DeepL API Free по ключу.
TRANSLATE_URL = "https://clients5.google.com/translate_a/t"
TRANSLATE_MAX_INPUT = 4000


def translation_target(text: str) -> str:
    """Русский текст переводим на английский, всё остальное — на русский."""
    letters = [ch for ch in text if ch.isalpha()]
    if not letters:
        return "ru"
    cyrillic = sum(1 for ch in letters if "а" <= ch.lower() <= "я" or ch.lower() == "ё")
    return "en" if cyrillic / len(letters) > 0.5 else "ru"


def message_text(message: discord.Message) -> str:
    parts = [message.content or ""]
    for embed in message.embeds:
        parts += [embed.title or "", embed.description or ""]
        parts += [f"{f.name}\n{f.value}" for f in embed.fields]
    return "\n\n".join(p for p in parts if p.strip()).strip()


def parse_translation(data) -> str:
    # Ответ: [["перевод", "исходный_язык"]] (или ["перевод"], если язык задан явно)
    first = data[0]
    return first[0] if isinstance(first, list) else first


async def translate_text(text: str, target: str) -> str:
    async with ClientSession() as session:
        async with session.post(
            TRANSLATE_URL,
            params={"client": "dict-chrome-ex", "sl": "auto", "tl": target},
            data={"q": text[:TRANSLATE_MAX_INPUT]},
            proxy=OUTBOUND_PROXY,
            proxy_auth=PROXY_AUTH,
        ) as response:
            response.raise_for_status()
            return parse_translation(await response.json(content_type=None))


async def translate_message(interaction: discord.Interaction, message: discord.Message) -> None:
    text = message_text(message)
    if not text:
        await interaction.response.send_message("Nothing to translate / Нечего переводить", ephemeral=True)
        return
    await interaction.response.defer(ephemeral=True, thinking=True)
    target = translation_target(text)
    try:
        translated = await translate_text(text, target)
    except Exception:
        log.exception("Translation failed")
        await interaction.followup.send(
            "Translation is unavailable right now / Перевод сейчас недоступен", ephemeral=True
        )
        return
    flag = "🇷🇺" if target == "ru" else "🇬🇧"
    await interaction.followup.send(
        f"{flag} {_truncate(translated, 1900)}\n-# {message.jump_url}",
        ephemeral=True,
        allowed_mentions=discord.AllowedMentions.none(),
    )


def _disabled_review_view() -> discord.ui.View:
    """Версия с отключёнными кнопками (после вынесения решения)."""
    view = discord.ui.View(timeout=None)
    view.add_item(discord.ui.Button(label="Accept", style=discord.ButtonStyle.success,
                                     custom_id="review:accept", disabled=True))
    view.add_item(discord.ui.Button(label="Decline", style=discord.ButtonStyle.danger,
                                     custom_id="review:decline", disabled=True))
    return view


# ----------------------------------------------------------------------------
# Бот
# ----------------------------------------------------------------------------

class FormsBot(discord.Client):
    def __init__(self) -> None:
        intents = discord.Intents.default()
        intents.members = True  # нужно для выдачи ролей участникам
        super().__init__(intents=intents, proxy=OUTBOUND_PROXY, proxy_auth=PROXY_AUTH)
        self._runner: web.AppRunner | None = None
        self.store = SubmissionStore(STATE_FILE)
        # IP -> список monotonic-времён последних заявок (для рейт-лимита /apply)
        self._apply_hits: dict[str, list[float]] = {}
        self._review_locks: dict[int, asyncio.Lock] = {}
        self.tree = discord.app_commands.CommandTree(self)
        self.tree.add_command(discord.app_commands.ContextMenu(
            name="Translate / Перевести", callback=translate_message
        ))

    async def setup_hook(self) -> None:
        # Регистрируем persistent view, чтобы кнопки работали после рестарта.
        self.add_view(ReviewView(self))
        try:
            await self.tree.sync()
        except discord.HTTPException:
            log.exception("Slash command sync failed; the Translate menu may be missing")

        app = web.Application(client_max_size=256 * 1024, middlewares=[self.security_headers])
        app.router.add_get("/", self.handle_index)          # сайт с формой заявки
        app.router.add_get("/health", self.handle_health)   # health-check
        app.router.add_get("/auth/discord", self.handle_discord_login)
        app.router.add_get("/auth/callback", self.handle_discord_callback)
        app.router.add_get("/auth/me", self.handle_auth_me)
        app.router.add_post("/auth/logout", self.handle_logout)
        app.router.add_post("/apply", self.handle_apply)    # заявки с сайта (публичный)
        app.router.add_post("/submit", self.handle_submit)  # заявки из Google Forms (с секретом)
        if ASSETS_DIR.is_dir():
            app.router.add_static("/assets/", path=ASSETS_DIR, name="assets")
        self._runner = web.AppRunner(app)
        await self._runner.setup()
        site = web.TCPSite(self._runner, HOST, PORT)
        await site.start()
        site_state = "available" if INDEX_FILE.exists() else "missing web/index.html"
        log.info("HTTP server listening on http://%s:%s (website: %s, POST /apply, POST /submit)",
                 HOST, PORT, site_state)

    async def on_ready(self) -> None:
        log.info("Bot connected as %s (id=%s)", self.user, self.user.id)
        if not ROLE_CHOICES:
            log.warning("ROLE_CHOICE_* is not configured; role choices will be empty")
        ch = self.get_channel(FORUM_CHANNEL_ID)
        if ch is None:
            log.warning("Channel %s is not cached; verify the ID and bot membership", FORUM_CHANNEL_ID)
        elif not isinstance(ch, discord.ForumChannel):
            log.warning("Channel %s is not a forum channel (%s)", FORUM_CHANNEL_ID, type(ch).__name__)
        else:
            log.info("Forum channel found: #%s", ch.name)

    async def close(self) -> None:
        if self._runner is not None:
            await self._runner.cleanup()
        await super().close()

    # ---------- HTTP ----------

    async def handle_health(self, request: web.Request) -> web.Response:
        status = "ready" if self.is_ready() else "starting"
        return web.json_response({
            "status": status,
            "bot": str(self.user) if self.user else None,
            "oauth_enabled": OAUTH_ENABLED,
        })

    @web.middleware
    async def security_headers(
        self, request: web.Request, handler
    ) -> web.StreamResponse:
        response = await handler(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "same-origin")
        response.headers.setdefault(
            "Permissions-Policy", "camera=(), microphone=(), geolocation=()"
        )
        response.headers.setdefault(
            "Content-Security-Policy",
            "default-src 'self'; script-src 'self'; "
            "style-src 'self' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com data:; "
            "img-src 'self' https://cdn.discordapp.com data:; "
            "media-src 'self'; connect-src 'self'; object-src 'none'; "
            "base-uri 'self'; frame-ancestors 'none'",
        )
        if request.path.startswith("/assets/"):
            response.headers.setdefault("Cache-Control", "public, max-age=86400")
        return response

    def _sign_session(self, user: dict) -> str:
        payload = json.dumps(user, separators=(",", ":")).encode("utf-8")
        encoded = base64.urlsafe_b64encode(payload).rstrip(b"=")
        signature = hmac.new(SESSION_SECRET, encoded, hashlib.sha256).digest()
        return f"{encoded.decode()}.{base64.urlsafe_b64encode(signature).rstrip(b'=').decode()}"

    def _read_session(self, request: web.Request) -> dict | None:
        raw = request.cookies.get(SESSION_COOKIE, "")
        try:
            encoded, supplied = raw.split(".", 1)
            expected = hmac.new(SESSION_SECRET, encoded.encode(), hashlib.sha256).digest()
            supplied_bytes = base64.urlsafe_b64decode(supplied + "=" * (-len(supplied) % 4))
            if not hmac.compare_digest(expected, supplied_bytes):
                return None
            data = json.loads(base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4)))
            if time.time() - float(data.get("iat", 0)) > SESSION_MAX_AGE:
                return None
            return data
        except (ValueError, TypeError, AttributeError, binascii.Error, json.JSONDecodeError):
            return None

    async def handle_discord_login(self, request: web.Request) -> web.Response:
        if not OAUTH_ENABLED:
            return web.json_response({"error": "Discord login is not configured"}, status=503)
        state = secrets.token_urlsafe(32)
        query = urlencode({
            "client_id": DISCORD_CLIENT_ID,
            "redirect_uri": DISCORD_REDIRECT_URI,
            "response_type": "code",
            "scope": "identify",
            "state": state,
        })
        response = web.HTTPFound(f"https://discord.com/oauth2/authorize?{query}")
        response.set_cookie(
            "genesis_oauth_state",
            state,
            max_age=600,
            httponly=True,
            secure=DISCORD_REDIRECT_URI.startswith("https://"),
            samesite="Lax",
            path="/",
        )
        raise response

    async def handle_discord_callback(self, request: web.Request) -> web.Response:
        code = request.query.get("code", "")
        state = request.query.get("state", "")
        state_cookie = request.cookies.get("genesis_oauth_state", "")
        if not code or not state or not hmac.compare_digest(state, state_cookie):
            raise web.HTTPFound("/?auth=failed")

        data = {
            "client_id": DISCORD_CLIENT_ID,
            "client_secret": DISCORD_CLIENT_SECRET,
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": DISCORD_REDIRECT_URI,
        }
        try:
            async with ClientSession() as session:
                async with session.post(
                    "https://discord.com/api/v10/oauth2/token",
                    data=data,
                    proxy=OUTBOUND_PROXY,
                    proxy_auth=PROXY_AUTH,
                ) as token_response:
                    token_data = await token_response.json()
                    access_token = token_data["access_token"]
                async with session.get(
                    "https://discord.com/api/v10/users/@me",
                    headers={"Authorization": f"Bearer {access_token}"},
                    proxy=OUTBOUND_PROXY,
                    proxy_auth=PROXY_AUTH,
                ) as user_response:
                    user = await user_response.json()
                    if user_response.status != 200 or not user.get("id"):
                        raise RuntimeError("Discord user lookup failed")
        except Exception:
            log.exception("Discord OAuth callback failed")
            raise web.HTTPFound("/?auth=failed")

        session = {
            "id": str(user["id"]),
            "username": str(user.get("username") or "Discord user"),
            "global_name": str(user.get("global_name") or ""),
            "avatar": str(user.get("avatar") or ""),
            "iat": int(time.time()),
        }
        response = web.HTTPFound("/?auth=success")
        response.del_cookie("genesis_oauth_state", path="/")
        response.set_cookie(
            SESSION_COOKIE,
            self._sign_session(session),
            max_age=SESSION_MAX_AGE,
            httponly=True,
            secure=DISCORD_REDIRECT_URI.startswith("https://"),
            samesite="Lax",
            path="/",
        )
        raise response

    async def handle_auth_me(self, request: web.Request) -> web.Response:
        user = self._read_session(request)
        public_user = None
        if user:
            public_user = {k: user.get(k) for k in ("id", "username", "global_name", "avatar")}
        return web.json_response(
            {"enabled": OAUTH_ENABLED, "user": public_user},
            headers={"Cache-Control": "no-store"},
        )

    async def handle_logout(self, request: web.Request) -> web.Response:
        response = web.json_response({"ok": True})
        response.del_cookie(SESSION_COOKIE, path="/")
        return response

    async def handle_submit(self, request: web.Request) -> web.Response:
        provided = request.headers.get("X-Auth-Token", "")
        # Сравниваем в байтах: compare_digest со str падает на не-ASCII символах.
        if not hmac.compare_digest(provided.encode("utf-8"), SHARED_SECRET.encode("utf-8")):
            log.warning("Rejected request with an invalid secret from %s", request.remote)
            return web.json_response({"error": "unauthorized"}, status=401)

        try:
            payload = await request.json()
        except Exception:
            return web.json_response({"error": "invalid json"}, status=400)
        if not isinstance(payload, dict):
            return web.json_response({"error": "expected json object"}, status=400)

        response_id = str(payload.get("response_id") or "").strip()
        if response_id and self.store.has_response(response_id):
            log.info("Skipping duplicate response_id=%s", response_id)
            return web.json_response({"ok": True, "duplicate": True}, status=200)

        try:
            thread = await self.create_forum_post(payload)
        except Exception as exc:
            log.exception("Could not create a forum post")
            return web.json_response({"error": str(exc)}, status=500)

        # Поддерживаем оба варианта: applicant (юзернейм) и applicant_discord_id (числовой ID).
        applicant = str(
            payload.get("applicant") or payload.get("applicant_discord_id") or ""
        ).strip()
        await self.store.create(thread.id, applicant, response_id)

        log.info("Created post: %s (id=%s)", thread.name, thread.id)
        return web.json_response({"ok": True, "thread_id": str(thread.id), "thread_name": thread.name})

    # ---------- сайт + публичный приём заявок ----------

    async def handle_index(self, request: web.Request) -> web.StreamResponse:
        """Отдаёт страницу с формой заявки."""
        if INDEX_FILE.exists():
            return web.FileResponse(INDEX_FILE, headers={"Cache-Control": "no-cache"})
        return web.Response(
            text="Application website is not installed: web/index.html is missing",
            status=404,
        )

    def _client_ip(self, request: web.Request) -> str:
        """Реальный IP клиента (за туннелем ngrok/cloudflared — в X-Forwarded-For)."""
        if TRUST_PROXY:
            cloudflare_ip = request.headers.get("CF-Connecting-IP", "").strip()
            if cloudflare_ip:
                return cloudflare_ip
        xff = request.headers.get("X-Forwarded-For", "") if TRUST_PROXY else ""
        if xff:
            return xff.split(",")[0].strip()
        return request.remote or "?"

    def _rate_limited(self, ip: str) -> bool:
        """Скользящее окно по IP. True = заявок слишком много, отклонить."""
        now = time.monotonic()
        hits = [t for t in self._apply_hits.get(ip, []) if now - t < APPLY_RATE_WINDOW]
        if len(hits) >= APPLY_RATE_MAX:
            self._apply_hits[ip] = hits
            return True
        hits.append(now)
        self._apply_hits[ip] = hits
        # Периодическая чистка, чтобы словарь не рос бесконечно.
        if len(self._apply_hits) > 5000:
            self._apply_hits = {
                k: v for k, v in self._apply_hits.items() if v and now - v[-1] < APPLY_RATE_WINDOW
            }
        return False

    async def handle_apply(self, request: web.Request) -> web.Response:
        """
        Публичный эндпоинт для сайта-формы. Без общего секрета (форма открыта всем),
        поэтому защищён honeypot-полем, рейт-лимитом по IP и валидацией размеров.
        Ожидает JSON: {applicant, responses:[{question,answer}], form_title?, hp?, lang?}.
        """
        try:
            payload = await request.json()
        except Exception:
            return web.json_response({"ok": False, "error": "invalid json"}, status=400)
        if not isinstance(payload, dict):
            return web.json_response({"ok": False, "error": "expected json object"}, status=400)

        # honeypot: ботам показываем «успех», но ничего не создаём.
        if str(payload.get("hp") or "").strip():
            log.info("Honeypot triggered; application discarded (ip=%s)", self._client_ip(request))
            return web.json_response({"ok": True})

        ip = self._client_ip(request)
        if self._rate_limited(ip):
            log.warning("Rate limit reached on /apply for ip=%s", ip)
            return web.json_response({"ok": False, "error": "rate_limited"}, status=429)

        session = self._read_session(request)
        if OAUTH_ENABLED and not session:
            return web.json_response({"ok": False, "error": "authentication_required"}, status=401)

        applicant_id = str(session.get("id") if session else payload.get("applicant") or "").strip()
        applicant = applicant_id if session else str(payload.get("applicant") or "").strip().lstrip("@")[:100]
        raw = payload.get("responses")
        if not applicant or not isinstance(raw, list) or not raw:
            return web.json_response({"ok": False, "error": "missing fields"}, status=400)

        responses = []
        for item in raw[:APPLY_MAX_FIELDS]:
            if not isinstance(item, dict):
                continue
            question = _truncate(str(item.get("question", "")), 256)
            answer = _truncate(str(item.get("answer", "")), FIELD_VALUE_MAX)
            if question and answer:
                responses.append({"question": question, "answer": answer})
        if not responses:
            return web.json_response({"ok": False, "error": "empty responses"}, status=400)

        # The browser holds the verified numeric ID, but reviewers should see the
        # readable Discord username. Keep the ID separately for role assignment.
        if session:
            discord_username = str(session.get("username") or "Discord user").strip()
            for response in responses:
                if response["question"] == "Discord account":
                    response["answer"] = f"@{discord_username}"
                    break

        if not self.is_ready():
            return web.json_response({"ok": False, "error": "bot not ready"}, status=503)

        ip_hash = hmac.new(SESSION_SECRET, ip.encode("utf-8"), hashlib.sha256).hexdigest()
        claim_id = await self.store.claim_daily(applicant_id, ip_hash)
        if claim_id is None:
            return web.json_response({"ok": False, "error": "daily_limit"}, status=429)

        post = {
            "response_id": uuid.uuid4().hex,
            "form_title": _truncate(str(payload.get("form_title") or APPLY_FORM_TITLE), 256),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "responder": session.get("username") if session else applicant,
            "applicant": applicant,
            "applicant_discord_id": applicant_id if session else None,
            "responses": responses,
        }
        try:
            thread = await self.create_forum_post(post)
        except Exception:
            await self.store.release_claim(claim_id)
            log.exception("Could not create a post from the website application")
            return web.json_response({"ok": False, "error": "server error"}, status=500)

        await self.store.create(thread.id, applicant, post["response_id"], applicant_id)
        if session and APPLICANT_ROLE_ID:
            await self._assign_applicant_role(thread.guild, applicant_id)
        log.info("Website application accepted: applicant=%s (ip=%s, thread=%s)", applicant, ip, thread.id)
        return web.json_response({"ok": True, "thread_id": str(thread.id)})

    # ---------- создание поста ----------

    async def create_forum_post(self, payload: dict) -> discord.Thread:
        channel = self.get_channel(FORUM_CHANNEL_ID) or await self.fetch_channel(FORUM_CHANNEL_ID)
        if not isinstance(channel, discord.ForumChannel):
            raise RuntimeError(f"Channel {FORUM_CHANNEL_ID} is not a forum channel")

        applied_tags = [t for t in channel.available_tags if t.id in DEFAULT_TAG_IDS] if DEFAULT_TAG_IDS else []

        embed = build_embed(payload)

        # Аватарка заявителя в thumbnail эмбеда — если удаётся найти его на сервере.
        applicant = str(
            payload.get("applicant") or payload.get("applicant_discord_id") or ""
        ).strip()
        if applicant:
            try:
                member = await self._resolve_member(channel.guild, applicant)
                if member is not None:
                    embed.set_thumbnail(url=member.display_avatar.url)
            except Exception:
                log.debug("Could not load applicant avatar for %s", applicant, exc_info=True)

        # Пингуем роль судей в стартовом сообщении, чтобы они увидели новую заявку.
        if PING_REVIEWER:
            content = f"<@&{REVIEWER_ROLE_ID}>"
            allowed = discord.AllowedMentions(
                roles=[discord.Object(id=REVIEWER_ROLE_ID)], users=False, everyone=False
            )
        else:
            content = None
            allowed = discord.AllowedMentions.none()

        result = await channel.create_thread(
            name=build_thread_name(payload),
            content=content,
            embed=embed,
            view=ReviewView(self),
            applied_tags=applied_tags,
            allowed_mentions=allowed,
            reason="New application",
        )
        return result.thread

    # ---------- проверка прав ----------

    def _is_reviewer(self, interaction: discord.Interaction) -> bool:
        member = interaction.user
        if not isinstance(member, discord.Member):
            return False
        return any(r.id == REVIEWER_ROLE_ID for r in member.roles)

    async def _deny_if_not_reviewer(self, interaction: discord.Interaction) -> bool:
        if self._is_reviewer(interaction):
            return False
        await interaction.response.send_message(
            "You do not have permission to perform this action.", ephemeral=True
        )
        return True

    # ---------- обработчики кнопок ----------

    async def on_decline(self, interaction: discord.Interaction) -> None:
        if await self._deny_if_not_reviewer(interaction):
            return
        thread = interaction.channel
        if not isinstance(thread, discord.Thread):
            await interaction.response.send_message("This is not a forum thread.", ephemeral=True)
            return

        rec = self.store.get(thread.id) or {}
        if rec.get("status") != "pending":
            await interaction.response.send_message("This application has already been reviewed.", ephemeral=True)
            return

        await interaction.response.defer()
        lock = self._review_locks.setdefault(thread.id, asyncio.Lock())
        async with lock:
            rec = self.store.get(thread.id) or {}
            if rec.get("status") != "pending":
                await interaction.followup.send(
                    "This application has already been reviewed.", ephemeral=True
                )
                return
            await self._apply_status(thread, accepted=False, role_name=None)
            await self.store.set_status(thread.id, "declined", None)
            await self._disable_buttons(interaction)
            await thread.send("Application declined.")

    async def on_accept(self, interaction: discord.Interaction) -> None:
        if await self._deny_if_not_reviewer(interaction):
            return
        thread = interaction.channel
        if not isinstance(thread, discord.Thread):
            await interaction.response.send_message("This is not a forum thread.", ephemeral=True)
            return
        rec = self.store.get(thread.id) or {}
        if rec.get("status") != "pending":
            await interaction.response.send_message("This application has already been reviewed.", ephemeral=True)
            return
        if not ROLE_CHOICES:
            await interaction.response.send_message(
                "Assignable roles are not configured (ROLE_CHOICE_*).", ephemeral=True
            )
            return
        # Приватное сообщение только нажавшему ревьюеру с кнопками выбора роли.
        await interaction.response.send_message(
            "Choose the role to assign to the applicant:",
            view=RoleChoiceView(self, thread.id),
            ephemeral=True,
        )

    async def on_role_choice(self, interaction: discord.Interaction, thread_id: int, choice: dict) -> None:
        if await self._deny_if_not_reviewer(interaction):
            return
        await interaction.response.defer(ephemeral=True)

        lock = self._review_locks.setdefault(thread_id, asyncio.Lock())
        async with lock:
            await self._complete_role_choice(interaction, thread_id, choice)

    async def _complete_role_choice(
        self, interaction: discord.Interaction, thread_id: int, choice: dict
    ) -> None:
        rec = self.store.get(thread_id) or {}
        if rec.get("status") != "pending":
            await interaction.followup.send(
                "This application has already been reviewed.", ephemeral=True
            )
            return

        guild = interaction.guild
        role = guild.get_role(choice["id"]) if guild else None
        if role is None:
            await interaction.followup.send(
                f"Role ID {choice['id']} was not found on this server.", ephemeral=True
            )
            return

        applicant = rec.get("applicant_id") or rec.get("applicant")

        # Резолвим заявителя по юзернейму или ID и пытаемся выдать роль.
        assign_note = ""
        member = await self._resolve_member(guild, applicant)
        if member is not None:
            roles = [role]
            core_role = None
            if choice.get("grants_core_role"):
                core_role = guild.get_role(CORE_MEMBER_ROLE_ID) if CORE_MEMBER_ROLE_ID else None
                if core_role is None:
                    await interaction.followup.send(
                        "CORE_MEMBER_ROLE_ID is not configured or the role was not found. "
                        "No roles were assigned.",
                        ephemeral=True,
                    )
                    return
                roles.append(core_role)
            try:
                await member.add_roles(*roles, reason="Application accepted")
                assigned = " and ".join(r.mention for r in roles)
                assign_note = f" {assigned} assigned to {member.mention}."
            except discord.HTTPException:
                assign_note = (
                    " Could not assign the role(s): the bot needs Manage Roles and "
                    "its role must be above every target role."
                )
        else:
            assign_note = (
                f" Applicant `{applicant or 'not provided'}` was not found on the server. "
                f"Assign **{choice['name']}** manually."
            )

        # Обновляем статус ветки.
        thread = interaction.channel
        if isinstance(thread, discord.Thread) and thread.id == thread_id:
            target_thread = thread
        else:
            target_thread = self.get_channel(thread_id) or await self.fetch_channel(thread_id)

        if isinstance(target_thread, discord.Thread):
            await self._apply_status(target_thread, accepted=True, role_name=choice["name"])
            await self._disable_buttons_on_thread(target_thread)
            await target_thread.send(
                f"Application accepted. Assigned role: **{choice['name']}**.{assign_note}",
                allowed_mentions=discord.AllowedMentions.none(),
            )

        await self.store.set_status(thread_id, "accepted", choice["name"])
        await interaction.followup.send(
            f"Complete. Status: Accepted - {choice['name']}.{assign_note}", ephemeral=True
        )

    async def _assign_applicant_role(self, guild: discord.Guild, applicant_id: str) -> None:
        role = guild.get_role(APPLICANT_ROLE_ID) if APPLICANT_ROLE_ID else None
        if role is None:
            log.warning("APPLICANT_ROLE_ID=%s was not found", APPLICANT_ROLE_ID)
            return
        member = await self._resolve_member(guild, applicant_id)
        if member is None:
            log.warning("Applicant %s is not a member of guild %s", applicant_id, guild.id)
            return
        try:
            await member.add_roles(role, reason="Application submitted")
        except discord.HTTPException:
            log.exception("Could not assign the applicant role to %s", applicant_id)

    # ---------- вспомогательное ----------

    async def _resolve_member(self, guild: discord.Guild, raw: str | None) -> discord.Member | None:
        """
        Находит участника сервера по строке из формы.
        Поддерживает: числовой ID, <@id>, юзернейм (@name / name), display name.
        """
        if not raw:
            return None
        raw = raw.strip()

        # 1) Числовой ID (или упоминание <@id>)
        digits = "".join(ch for ch in raw if ch.isdigit())
        if digits and (raw.isdigit() or raw.startswith("<@")):
            member = guild.get_member(int(digits))
            if member:
                return member
            try:
                return await guild.fetch_member(int(digits))
            except (discord.NotFound, discord.HTTPException):
                pass

        # Нормализуем юзернейм: убираем ведущий @ и пробелы
        name = raw.lstrip("@").strip()
        low = name.lower()

        # 2) Точный матч по юзернейму-хэндлу (уникален) — самый надёжный путь
        for m in guild.members:
            if m.name.lower() == low:
                return m

        # 3) Матч по global display name / нику на сервере (НЕ уникальны)
        for m in guild.members:
            if (m.global_name and m.global_name.lower() == low) or m.display_name.lower() == low:
                return m

        # 4) Запрос к API (если кэш участников неполный)
        try:
            found = await guild.query_members(query=name, limit=5)
        except discord.HTTPException:
            found = []
        for m in found:
            if m.name.lower() == low:
                return m
        if len(found) == 1:
            return found[0]

        return None

    async def _apply_status(self, thread: discord.Thread, accepted: bool, role_name: str | None) -> None:
        status_tag_id = ACCEPTED_TAG_ID if accepted else DECLINED_TAG_ID

        kwargs: dict = {}
        parent = thread.parent
        if isinstance(parent, discord.ForumChannel) and (ACCEPTED_TAG_ID or DECLINED_TAG_ID):
            available = {t.id: t for t in parent.available_tags}
            # снимаем оба статус-тега, ставим нужный
            tags = [t for t in thread.applied_tags if t.id not in (ACCEPTED_TAG_ID, DECLINED_TAG_ID)]
            if status_tag_id and status_tag_id in available:
                tags.append(available[status_tag_id])
            kwargs["applied_tags"] = tags[:5]  # форум допускает максимум 5 тегов

        if kwargs:
            await thread.edit(**kwargs)

    async def _disable_buttons(self, interaction: discord.Interaction) -> None:
        try:
            await interaction.message.edit(view=_disabled_review_view())
        except (discord.NotFound, discord.HTTPException, AttributeError):
            pass

    async def _disable_buttons_on_thread(self, thread: discord.Thread) -> None:
        # Стартовое сообщение поста имеет id, равный id ветки.
        try:
            msg = await thread.fetch_message(thread.id)
            await msg.edit(view=_disabled_review_view())
        except (discord.NotFound, discord.HTTPException):
            pass


def main() -> None:
    bot = FormsBot()
    try:
        bot.run(DISCORD_TOKEN, log_handler=None)
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
