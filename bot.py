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
import time
import uuid
import asyncio
import logging
from pathlib import Path
from datetime import datetime, timezone

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
from aiohttp import web
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
APPLY_FORM_TITLE = os.getenv("APPLY_FORM_TITLE", "Заявка в Genesis").strip() or "Заявка в Genesis"
APPLY_MAX_FIELDS = 25

# Роль, которой разрешено жать Accept/Decline и кнопки выбора роли.
REVIEWER_ROLE_ID = int(os.environ["REVIEWER_ROLE_ID"])

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
        name = os.getenv(f"ROLE_CHOICE_{i}_NAME", "").strip() or f"Роль {i}"
        choices.append({"id": int(rid), "name": name})
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
EMBED_FOOTER = os.getenv("EMBED_FOOTER", "Заявка из Google Forms").strip()
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

STATUS_PREFIXES = ("✅ Accepted", "⛔ Declined")


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
        self._load()

    def _load(self) -> None:
        try:
            raw = json.loads(self._path.read_text(encoding="utf-8"))
            self._data = dict(raw.get("submissions", {}))
            self._seen_responses = {
                str(v.get("response_id")) for v in self._data.values() if v.get("response_id")
            }
        except (FileNotFoundError, json.JSONDecodeError, ValueError, AttributeError):
            self._data, self._seen_responses = {}, set()

    def _flush(self) -> None:
        # Подрезаем до STATE_MAX последних записей.
        if len(self._data) > STATE_MAX:
            keys = list(self._data)[-STATE_MAX:]
            self._data = {k: self._data[k] for k in keys}
        tmp = self._path.with_suffix(self._path.suffix + ".tmp")
        tmp.write_text(
            json.dumps({"submissions": self._data}, ensure_ascii=False, indent=0),
            encoding="utf-8",
        )
        tmp.replace(self._path)

    def has_response(self, response_id: str) -> bool:
        return bool(response_id) and response_id in self._seen_responses

    async def create(self, thread_id: int, applicant: str, response_id: str) -> None:
        async with self._lock:
            self._data[str(thread_id)] = {
                "applicant": applicant,  # юзернейм ИЛИ числовой Discord ID
                "response_id": response_id,
                "status": "pending",
                "role_name": None,
            }
            if response_id:
                self._seen_responses.add(response_id)
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
    form_title = payload.get("form_title") or "Новая заявка"
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
    base = payload.get("form_title") or "Заявка"
    first_answer = ""
    for item in payload.get("responses") or []:
        ans = str(item.get("answer", "")).strip()
        if ans:
            first_answer = ans
            break
    name = f"{base} — {first_answer}" if first_answer else base
    return _truncate(name, THREAD_NAME_MAX)


def _strip_status_prefix(name: str) -> str:
    for p in STATUS_PREFIXES:
        if name.startswith(p):
            # отрезаем "<префикс> — <возможная роль> — "
            rest = name[len(p):].lstrip(" —")
            # если за статусом шла роль (для accepted) — её тоже могли вписать; оставляем как есть,
            # т.к. ниже всё равно переименуем целиком из базового. Для простоты режем по разделителю.
            return rest
    return name


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
        super().__init__(intents=intents)
        self._runner: web.AppRunner | None = None
        self.store = SubmissionStore(STATE_FILE)
        # IP -> список monotonic-времён последних заявок (для рейт-лимита /apply)
        self._apply_hits: dict[str, list[float]] = {}

    async def setup_hook(self) -> None:
        # Регистрируем persistent view, чтобы кнопки работали после рестарта.
        self.add_view(ReviewView(self))

        app = web.Application(client_max_size=256 * 1024)
        app.router.add_get("/", self.handle_index)          # сайт с формой заявки
        app.router.add_get("/health", self.handle_health)   # health-check
        app.router.add_post("/apply", self.handle_apply)    # заявки с сайта (публичный)
        app.router.add_post("/submit", self.handle_submit)  # заявки из Google Forms (с секретом)
        if ASSETS_DIR.is_dir():
            app.router.add_static("/assets/", path=ASSETS_DIR, name="assets")
        self._runner = web.AppRunner(app)
        await self._runner.setup()
        site = web.TCPSite(self._runner, HOST, PORT)
        await site.start()
        site_state = "есть" if INDEX_FILE.exists() else "НЕТ (web/index.html не найден)"
        log.info("HTTP-сервер слушает http://%s:%s  (сайт: %s, POST /apply, POST /submit)",
                 HOST, PORT, site_state)

    async def on_ready(self) -> None:
        log.info("Бот вошёл как %s (id=%s)", self.user, self.user.id)
        if not ROLE_CHOICES:
            log.warning("ROLE_CHOICE_* не заданы — кнопки выбора роли будут пустыми.")
        ch = self.get_channel(FORUM_CHANNEL_ID)
        if ch is None:
            log.warning("Канал %s не в кэше — проверь ID и что бот на сервере.", FORUM_CHANNEL_ID)
        elif not isinstance(ch, discord.ForumChannel):
            log.warning("Канал %s НЕ форум-канал (%s).", FORUM_CHANNEL_ID, type(ch).__name__)
        else:
            log.info("Форум-канал найден: #%s", ch.name)

    async def close(self) -> None:
        if self._runner is not None:
            await self._runner.cleanup()
        await super().close()

    # ---------- HTTP ----------

    async def handle_health(self, request: web.Request) -> web.Response:
        status = "ready" if self.is_ready() else "starting"
        return web.json_response({"status": status, "bot": str(self.user) if self.user else None})

    async def handle_submit(self, request: web.Request) -> web.Response:
        provided = request.headers.get("X-Auth-Token", "")
        # Сравниваем в байтах: compare_digest со str падает на не-ASCII символах.
        if not hmac.compare_digest(provided.encode("utf-8"), SHARED_SECRET.encode("utf-8")):
            log.warning("Отклонён запрос с неверным секретом от %s", request.remote)
            return web.json_response({"error": "unauthorized"}, status=401)

        try:
            payload = await request.json()
        except Exception:
            return web.json_response({"error": "invalid json"}, status=400)
        if not isinstance(payload, dict):
            return web.json_response({"error": "expected json object"}, status=400)

        response_id = str(payload.get("response_id") or "").strip()
        if response_id and self.store.has_response(response_id):
            log.info("Пропуск дубликата response_id=%s", response_id)
            return web.json_response({"ok": True, "duplicate": True}, status=200)

        try:
            thread = await self.create_forum_post(payload)
        except Exception as exc:
            log.exception("Не удалось создать пост в форуме")
            return web.json_response({"error": str(exc)}, status=500)

        # Поддерживаем оба варианта: applicant (юзернейм) и applicant_discord_id (числовой ID).
        applicant = str(
            payload.get("applicant") or payload.get("applicant_discord_id") or ""
        ).strip()
        await self.store.create(thread.id, applicant, response_id)

        log.info("Создан пост: %s (id=%s)", thread.name, thread.id)
        return web.json_response({"ok": True, "thread_id": str(thread.id), "thread_name": thread.name})

    # ---------- сайт + публичный приём заявок ----------

    async def handle_index(self, request: web.Request) -> web.StreamResponse:
        """Отдаёт страницу с формой заявки."""
        if INDEX_FILE.exists():
            return web.FileResponse(INDEX_FILE, headers={"Cache-Control": "no-cache"})
        return web.Response(
            text="Сайт заявки не установлен: нет файла web/index.html",
            status=404,
        )

    def _client_ip(self, request: web.Request) -> str:
        """Реальный IP клиента (за туннелем ngrok/cloudflared — в X-Forwarded-For)."""
        xff = request.headers.get("X-Forwarded-For", "")
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
            log.info("Honeypot сработал, заявка отброшена (ip=%s)", self._client_ip(request))
            return web.json_response({"ok": True})

        ip = self._client_ip(request)
        if self._rate_limited(ip):
            log.warning("Рейт-лимит /apply для ip=%s", ip)
            return web.json_response({"ok": False, "error": "rate_limited"}, status=429)

        applicant = str(payload.get("applicant") or "").strip().lstrip("@")[:100]
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

        if not self.is_ready():
            return web.json_response({"ok": False, "error": "bot not ready"}, status=503)

        post = {
            "response_id": uuid.uuid4().hex,
            "form_title": _truncate(str(payload.get("form_title") or APPLY_FORM_TITLE), 256),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "responder": applicant,
            "applicant": applicant,
            "responses": responses,
        }
        try:
            thread = await self.create_forum_post(post)
        except Exception:
            log.exception("Не удалось создать пост из веб-заявки")
            return web.json_response({"ok": False, "error": "server error"}, status=500)

        await self.store.create(thread.id, applicant, post["response_id"])
        log.info("Веб-заявка принята: applicant=%s (ip=%s, thread=%s)", applicant, ip, thread.id)
        return web.json_response({"ok": True, "thread_id": str(thread.id)})

    # ---------- создание поста ----------

    async def create_forum_post(self, payload: dict) -> discord.Thread:
        channel = self.get_channel(FORUM_CHANNEL_ID) or await self.fetch_channel(FORUM_CHANNEL_ID)
        if not isinstance(channel, discord.ForumChannel):
            raise RuntimeError(f"Канал {FORUM_CHANNEL_ID} не является форум-каналом")

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
                log.debug("Не удалось получить аватар заявителя %s", applicant, exc_info=True)

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
            reason="Новая заявка",
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
            "У тебя нет прав для этого действия.", ephemeral=True
        )
        return True

    # ---------- обработчики кнопок ----------

    async def on_decline(self, interaction: discord.Interaction) -> None:
        if await self._deny_if_not_reviewer(interaction):
            return
        thread = interaction.channel
        if not isinstance(thread, discord.Thread):
            await interaction.response.send_message("Это не ветка форума.", ephemeral=True)
            return

        await interaction.response.defer()
        await self._apply_status(thread, accepted=False, role_name=None)
        await self.store.set_status(thread.id, "declined", None)
        await self._disable_buttons(interaction)
        await thread.send(f"⛔ Заявка отклонена ревьюером {interaction.user.mention}.")

    async def on_accept(self, interaction: discord.Interaction) -> None:
        if await self._deny_if_not_reviewer(interaction):
            return
        thread = interaction.channel
        if not isinstance(thread, discord.Thread):
            await interaction.response.send_message("Это не ветка форума.", ephemeral=True)
            return
        if not ROLE_CHOICES:
            await interaction.response.send_message(
                "Роли для выдачи не настроены (ROLE_CHOICE_*).", ephemeral=True
            )
            return
        # Приватное сообщение только нажавшему ревьюеру с кнопками выбора роли.
        await interaction.response.send_message(
            "Выбери роль, которую выдать заявителю:",
            view=RoleChoiceView(self, thread.id),
            ephemeral=True,
        )

    async def on_role_choice(self, interaction: discord.Interaction, thread_id: int, choice: dict) -> None:
        if await self._deny_if_not_reviewer(interaction):
            return
        await interaction.response.defer(ephemeral=True)

        guild = interaction.guild
        role = guild.get_role(choice["id"]) if guild else None
        if role is None:
            await interaction.followup.send(
                f"Роль с ID {choice['id']} не найдена на сервере.", ephemeral=True
            )
            return

        rec = self.store.get(thread_id) or {}
        applicant = rec.get("applicant")

        # Резолвим заявителя по юзернейму или ID и пытаемся выдать роль.
        assign_note = ""
        member = await self._resolve_member(guild, applicant)
        if member is not None:
            try:
                await member.add_roles(role, reason="Заявка одобрена")
                assign_note = f" Роль {role.mention} выдана {member.mention}."
            except discord.Forbidden:
                assign_note = (
                    f" ⚠️ Не удалось выдать роль {role.name}: у бота нет прав "
                    f"(нужно Manage Roles и роль бота выше выдаваемой)."
                )
        else:
            assign_note = (
                f" ⚠️ Заявитель не найден на сервере (из формы: "
                f"`{applicant or 'не указан'}`). Роль **{choice['name']}** "
                f"зафиксирована в статусе, выдай вручную."
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
                f"✅ Заявка одобрена ревьюером {interaction.user.mention}. "
                f"Назначенная роль: **{choice['name']}**.{assign_note}"
            )

        await self.store.set_status(thread_id, "accepted", choice["name"])
        await interaction.followup.send(
            f"Готово. Статус: Accepted — {choice['name']}.{assign_note}", ephemeral=True
        )

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
        # При Accept имя ветки НЕ меняем — только вешаем тег статуса.
        # При Decline по-прежнему помечаем статус в названии ветки.
        if not accepted:
            base = _strip_status_prefix(thread.name)
            kwargs["name"] = _truncate(f"⛔ Declined — {base}", THREAD_NAME_MAX)

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
