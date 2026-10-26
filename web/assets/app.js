/* ============================================================
   Genesis: application form logic
   ============================================================ */
(function () {
  "use strict";

  /* ---------------- i18n ---------------- */

  const I18N = {
    ru: {
      "nav.owners": "Владельцы",
      "owners.title": "Кто стоит за юнитом",
      "owners.owner": "Owner",
      "owners.coowner": "Co-owner",
      "up.title": "Или загрузи файл с эдитом",
      "up.hint": "MP4, MOV или WEBM до 200 МБ. Файл хранится 14 дней, потом удаляется.",
      "up.loading": "Загружаем",
      "up.done": "Загружено. Ссылка вставлена в поле выше. Удалится",
      "up.err.auth": "Сначала войди через Discord на первом шаге.",
      "up.err.size": "Файл больше 200 МБ. Сожми его или дай ссылку.",
      "up.err.type": "Нужен видеофайл MP4, MOV или WEBM.",
      "up.err.limit": "Лимит загрузок на сегодня исчерпан. Дай ссылку на видео.",
      "up.err.generic": "Не удалось загрузить. Попробуй ещё раз или дай ссылку.",
      "nav.faq": "FAQ",
      "check.title": "Проверь себя перед заявкой",
      "check.1": "Эдит длиннее 7 секунд",
      "check.2": "Работа моя, не ремейк и не копия чужого стиля",
      "check.3": "Сделана за последние 3 месяца",
      "check.go": "Отметь пункты выше",
      "check.ready": "Подать заявку",
      "draft.saved": "Черновик сохранён",
      "more.title": "Дополнительные заявки",
      "more.1.title": "Джадж, лого-мейкер и другие роли",
      "more.1.text": "Хочешь помогать юниту не только эдитами? Отдельная анкета на роли в команде.",
      "faq.title": "Частые вопросы",
      "faq.1.q": "Нужно ли быть на Discord-сервере?",
      "faq.1.a": "Да. При одобрении бот выдаёт роль на сервере Genesis. Если тебя там нет, роль выдать не получится. Зайди заранее.",
      "faq.2.q": "Как я узнаю результат?",
      "faq.2.a": "Если заявку примут, у тебя появится роль юнита на сервере. Заявки смотрят вручную, поэтому точного срока нет.",
      "faq.3.q": "Можно подать заявку ещё раз?",
      "faq.3.a": "Да, но не чаще одного раза в 24 часа с одного Discord-аккаунта или IP. Лучше вернуться с новой, более сильной работой.",
      "faq.4.q": "Что значит «реапп»?",
      "faq.4.a": "Это не отказ навсегда: тебя просят подать заявку позже, когда вырастет уровень или появится новый эдит.",
      "faq.5.q": "Какую ссылку на работу присылать?",
      "faq.5.a": "Прямую ссылку на один лучший эдит: TikTok, YouTube, Instagram, Google Drive. Проверь, что видео открывается без входа в аккаунт.",
      "nav.skip": "К заявке",
      "nav.how": "Отбор",
      "nav.rules": "Правила",
      "nav.apply": "Заявка",
      "hero.cta": "Подать заявку",
      "how.title": "Как попасть в юнит",
      "how.1.title": "Войди через Discord",
      "how.1.text": "Подтверждаем аккаунт, чтобы роль пришла именно тебе, без ручного ввода ника.",
      "how.2.title": "Покажи лучший эдит",
      "how.2.text": "Одна сильная работа скажет больше десяти средних. Свежая, твоя, от 7 секунд.",
      "how.3.title": "Джаджи решают",
      "how.3.text": "Заявка падает в закрытый канал. При одобрении бот сам выдаст роль на сервере.",
      "apply.title": "Подать заявку",
      "hero.eyebrow": "PRIVATE APPLICATIONS / 2026",
      "hero.status": "Приём заявок открыт",
      "tagline": "Независимый юнит визуальных авторов. Покажи не тренд, а свой почерк.",
      "aside.foot": "Заявки проверяются вручную",
      "steps.1": "Личность",
      "steps.2": "Творчество",
      "steps.3": "Портфолио",
      "steps.4": "Проверка",
      "s1.title": "Знакомство",
      "s1.sub": "Как тебя найти и в чём ты работаешь.",
      "s2.title": "Твоё творчество",
      "s2.sub": "Расскажи о своём подходе к монтажу.",
      "s3.title": "Портфолио",
      "s3.sub": "Дай нам взглянуть на твои работы.",
      "s4.title": "Почти готово",
      "s4.sub": "Проверь данные перед отправкой.",
      "f.discord.label": "Discord-аккаунт",
      "f.discord.hint": "Подтверди аккаунт через Discord: без ручного ввода и ошибок.",
      "auth.checking": "Проверяем подключение Discord",
      "auth.title": "Discord не подключён",
      "auth.sub": "Безопасный вход только для подтверждения твоего ID.",
      "auth.button": "Войти через Discord",
      "auth.connected": "Подключено как",
      "f.software.label": "Программа для эдитинга",
      "f.software.hint": "Выбери одну или две, или укажи свою.",
      "f.software.other": "Другое",
      "f.software.otherLabel": "Своя программа",
      "f.extra.label": "Доп. программа (3D / пост-обработка)",
      "f.extra.hint": "Например Blender или Cinema 4D. Можно пропустить.",
      "f.experience.label": "Сколько ты посвятил эдитингу?",
      "f.experience.hint": "Например: 2 года, 8 месяцев, полгода.",
      "f.goal.label": "Цель вступления",
      "f.goal.hint": "Зачем ты идёшь в Genesis?",
      "f.best.label": "Ссылка на лучшую работу",
      "f.best.hint": "Прямая ссылка на видео или пост, которым гордишься.",
      "f.social.label": "Соцсеть с работами",
      "f.social.hint": "TikTok, Instagram, YouTube, Telegram: где ты выкладываешь эдиты.",
      "f.optional": "необяз.",
      "nav.back": "Назад",
      "nav.next": "Далее",
      "nav.submit": "Отправить заявку",
      "nav.submitting": "Отправляем…",
      "done.kicker": "GENESIS // RECEIVED",
      "done.title": "Заявка отправлена!",
      "done.sub": "Команда получила твою работу. Новую заявку можно будет отправить через 24 часа.",
      "failure.kicker": "GENESIS // ERROR",
      "failure.close": "Вернуться к заявке",
      "failure.auth.title": "Подключи Discord",
      "failure.auth.text": "Сессия истекла или аккаунт не подключён. Войди через Discord и повтори отправку.",
      "failure.limit.title": "Заявка уже подана",
      "failure.limit.text": "С одного Discord-аккаунта или IP можно отправить только одну заявку за 24 часа.",
      "failure.spam.title": "Слишком много попыток",
      "failure.spam.text": "За короткое время пришло слишком много запросов с этого IP. Подожди несколько минут и повтори.",
      "failure.network.title": "Нет связи с сервером",
      "failure.network.text": "Проверь интернет-соединение и попробуй отправить заявку ещё раз.",
      "failure.generic.title": "Не удалось отправить",
      "failure.generic.text": "Что-то пошло не так. Проверь соединение и попробуй снова.",
      "legal": "Отправляя заявку, ты соглашаешься, что указанные данные будут переданы команде джаджей Genesis для рассмотрения.",
      "foot.server": "Discord-сервер юнита",
      "foot.styles": "Правила заявок",
      "foot.contactHtml": "Связь · Discord: <b>pexepo</b>",
      "styles.title": "Правила подачи заявок",
      "styles.bodyHtml": "<ol class=\"rules\"><li>Минимальная длина эдита: 7 секунд.</li><li>Ремейки чужих работ и сильное вдохновение другими авторами не допускаются.</li><li>Эдит должен быть новым или сделанным в течение последних 3 месяцев.</li><li>Не расстраивайся, если получил деклайн или реапп!</li></ol>",
      "review.edit": "Изменить",
      "review.empty": "не указано",
      "err.required": "Заполни это поле",
      "err.url": "Укажи корректную ссылку (https://…)",
      "err.discord": "Похоже на некорректный юзернейм",
      "error.generic": "Не удалось отправить. Попробуй ещё раз.",
      "error.network": "Нет связи с сервером. Проверь интернет и попробуй снова.",
      "error.rate": "Слишком много заявок. Подожди немного и попробуй позже."
    },
    en: {
      "nav.owners": "Owners",
      "owners.title": "Who runs the unit",
      "owners.owner": "Owner",
      "owners.coowner": "Co-owner",
      "up.title": "Or upload your edit",
      "up.hint": "MP4, MOV or WEBM up to 200 MB. Stored for 14 days, then deleted.",
      "up.loading": "Uploading",
      "up.done": "Uploaded. The link is in the field above. Deleted on",
      "up.err.auth": "Sign in with Discord on the first step first.",
      "up.err.size": "The file is over 200 MB. Compress it or share a link.",
      "up.err.type": "Use an MP4, MOV or WEBM video.",
      "up.err.limit": "Daily upload limit reached. Share a link instead.",
      "up.err.generic": "Upload failed. Try again or share a link.",
      "nav.faq": "FAQ",
      "check.title": "Check yourself before applying",
      "check.1": "The edit is longer than 7 seconds",
      "check.2": "It's my own work, not a remake or a copied style",
      "check.3": "Made within the last 3 months",
      "check.go": "Tick the boxes above",
      "check.ready": "Apply now",
      "draft.saved": "Draft saved",
      "more.title": "Additional applications",
      "more.1.title": "Judge, logo maker and other roles",
      "more.1.text": "Want to help the unit beyond edits? A separate form for team roles.",
      "faq.title": "FAQ",
      "faq.1.q": "Do I need to be on the Discord server?",
      "faq.1.a": "Yes. When you're accepted, the bot gives you a role on the Genesis server. It can't if you're not there. Join beforehand.",
      "faq.2.q": "How will I know the result?",
      "faq.2.a": "If you're accepted, the unit role appears on your profile on the server. Applications are reviewed by hand, so there's no fixed deadline.",
      "faq.3.q": "Can I apply again?",
      "faq.3.a": "Yes, but at most once every 24 hours per Discord account or IP. It's better to come back with a new, stronger edit.",
      "faq.4.q": "What does \u201creapp\u201d mean?",
      "faq.4.a": "It's not a permanent no: you're asked to apply again later, once your level grows or you have a new edit.",
      "faq.5.q": "What link should I send?",
      "faq.5.a": "A direct link to your single best edit: TikTok, YouTube, Instagram, Google Drive. Make sure it opens without signing in.",
      "nav.skip": "Skip to application",
      "nav.how": "Selection",
      "nav.rules": "Rules",
      "nav.apply": "Apply",
      "hero.cta": "Apply now",
      "how.title": "How to get in",
      "how.1.title": "Sign in with Discord",
      "how.1.text": "We verify your account so the role lands on you, no typing usernames.",
      "how.2.title": "Show your best edit",
      "how.2.text": "One strong piece says more than ten average ones. Fresh, yours, 7 seconds or longer.",
      "how.3.title": "Judges decide",
      "how.3.text": "Your application goes to a private channel. If accepted, the bot gives you the role.",
      "apply.title": "Apply to Genesis",
      "hero.eyebrow": "PRIVATE APPLICATIONS / 2026",
      "hero.status": "Applications are open",
      "tagline": "An independent unit of visual artists. Show us your signature, not a trend.",
      "aside.foot": "Every application is reviewed by hand",
      "steps.1": "Identity",
      "steps.2": "Craft",
      "steps.3": "Portfolio",
      "steps.4": "Review",
      "s1.title": "Introduce yourself",
      "s1.sub": "How to reach you and what you create in.",
      "s2.title": "Your craft",
      "s2.sub": "Tell us about your editing approach.",
      "s3.title": "Portfolio",
      "s3.sub": "Let us see what you make.",
      "s4.title": "Almost there",
      "s4.sub": "Check your details before sending.",
      "f.discord.label": "Discord account",
      "f.discord.hint": "Verify with Discord: no manual entry and no identity mistakes.",
      "auth.checking": "Checking Discord connection",
      "auth.title": "Discord not connected",
      "auth.sub": "Secure sign-in used only to verify your account ID.",
      "auth.button": "Continue with Discord",
      "auth.connected": "Connected as",
      "f.software.label": "Editing software",
      "f.software.hint": "Pick one or two, or enter your own.",
      "f.software.other": "Other",
      "f.software.otherLabel": "Your software",
      "f.extra.label": "Extra software (3D / post)",
      "f.extra.hint": "e.g. Blender or Cinema 4D. Optional.",
      "f.experience.label": "How long have you been editing?",
      "f.experience.hint": "e.g. 2 years, 8 months, half a year.",
      "f.goal.label": "Goal for joining",
      "f.goal.hint": "Why do you want to join Genesis?",
      "f.best.label": "Link to your best work",
      "f.best.hint": "A direct link to a video or post you're proud of.",
      "f.social.label": "Portfolio / socials",
      "f.social.hint": "TikTok, Instagram, YouTube, Telegram: where you post edits.",
      "f.optional": "optional",
      "nav.back": "Back",
      "nav.next": "Next",
      "nav.submit": "Submit application",
      "nav.submitting": "Sending…",
      "done.kicker": "GENESIS // RECEIVED",
      "done.title": "Application sent!",
      "done.sub": "The team has received your work. You can submit a new application in 24 hours.",
      "failure.kicker": "GENESIS // ERROR",
      "failure.close": "Return to application",
      "failure.auth.title": "Connect Discord",
      "failure.auth.text": "Your session expired or Discord is not connected. Sign in and submit again.",
      "failure.limit.title": "Already submitted",
      "failure.limit.text": "Only one application per Discord account or IP address is allowed every 24 hours.",
      "failure.spam.title": "Too many attempts",
      "failure.spam.text": "This IP sent too many requests in a short period. Wait a few minutes and try again.",
      "failure.network.title": "Server unreachable",
      "failure.network.text": "Check your internet connection and try to submit the application again.",
      "failure.generic.title": "Submission failed",
      "failure.generic.text": "Something went wrong. Check your connection and try again.",
      "legal": "By submitting, you agree that the information above will be shared with the Genesis judges team for review.",
      "foot.server": "Unit Discord server",
      "foot.styles": "Application rules",
      "foot.contactHtml": "Contact · Discord: <b>pexepo</b>",
      "styles.title": "Application rules",
      "styles.bodyHtml": "<ol class=\"rules\"><li>The minimum edit length is 7 seconds.</li><li>Remakes of others' work and heavy inspiration from other authors are not allowed.</li><li>The edit must be new or made within the last 3 months.</li><li>Don't be upset if you get a decline or a reapp!</li></ol>",
      "review.edit": "Edit",
      "review.empty": "not provided",
      "err.required": "This field is required",
      "err.url": "Enter a valid link (https://…)",
      "err.discord": "That doesn't look like a valid username",
      "error.generic": "Couldn't send. Please try again.",
      "error.network": "No connection to the server. Check your internet and retry.",
      "error.rate": "Too many applications. Please wait a bit and try later."
    }
  };

  const RU_TZ = /Europe\/(Moscow|Kaliningrad|Samara|Volgograd|Saratov|Kirov|Astrakhan|Ulyanovsk|Simferopol|Minsk|Kiev|Kyiv)|Asia\/(Yekaterinburg|Omsk|Novosibirsk|Krasnoyarsk|Irkutsk|Yakutsk|Vladivostok|Magadan|Almaty|Tashkent|Bishkek|Tbilisi|Yerevan|Baku)/;

  function detectLang() {
    try {
      const saved = localStorage.getItem("genesis_lang");
      if (saved === "ru" || saved === "en") return saved;
    } catch (e) {}
    const langs = (navigator.languages && navigator.languages.length)
      ? navigator.languages
      : [navigator.language || ""];
    if (langs.some(function (l) { return /^(ru|uk|be|kk)\b/i.test(l || ""); })) return "ru";
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
      if (RU_TZ.test(tz)) return "ru";
    } catch (e) {}
    return "en";
  }

  let lang = detectLang();
  function t(key) {
    return (I18N[lang] && I18N[lang][key]) != null ? I18N[lang][key] : key;
  }

  /* ---------------- DOM refs ---------------- */

  const $ = function (s, r) { return (r || document).querySelector(s); };
  const $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  const form = $("#form");
  const panels = $$(".panel");
  const stepsEls = $$("#steps .step");
  const stepsFill = $("#stepsFill");
  const pmFill = $("#pmFill");
  const backBtn = $('[data-action="back"]');
  const nextBtn = $('[data-action="next"]');
  const submitBtn = $('[data-action="submit"]');
  const formError = $("#formError");
  const doneEl = $("#done");
  const reviewEl = $("#review");
  const TOTAL = 4;
  // Ссылка на дополнительную анкету в Google Forms; пусто: блок скрыт.
  const EXTRA_FORM_URL = "https://forms.gle/U79PM5t4L83gVRup8";

  const FIELDS = [
    { key: "discord", el: "#discord", required: true, type: "discord" },
    { key: "software", el: "#software", required: true, type: "text", chips: true },
    { key: "extra", el: "#extra", required: false, type: "text", chips: true },
    { key: "experience", el: "#experience", required: true, type: "text" },
    { key: "goal", el: "#goal", required: true, type: "text" },
    { key: "best", el: "#best", required: true, type: "url" },
    { key: "social", el: "#social", required: false, type: "url" }
  ];
  const STEP_OF = { discord: 1, software: 1, extra: 1, experience: 2, goal: 2, best: 3, social: 3 };

  let current = 1;
  let authUser = null;
  let oauthEnabled = null;
  const reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------- language ---------------- */

  function applyLang(next, persist) {
    lang = next;
    document.documentElement.lang = lang;
    if (persist) { try { localStorage.setItem("genesis_lang", lang); } catch (e) {} }

    $$(".lang-switch").forEach(function (s) { s.setAttribute("data-active", lang); });
    $$(".lang-opt").forEach(function (b) {
      b.classList.toggle("is-active", b.getAttribute("data-lang") === lang);
    });
    $$("[data-i18n]").forEach(function (el) {
      el.textContent = t(el.getAttribute("data-i18n"));
    });

    // only our own static strings from I18N go through innerHTML
    $$("[data-i18n-html]").forEach(function (el) {
      el.innerHTML = t(el.getAttribute("data-i18n-html"));
    });

    const other = $("#software_other");
    if (other) other.placeholder = t("f.software.otherLabel");
    paintAuth();
    paintCheck();

    updateNav();
    if (current === TOTAL) buildReview();
  }

  $$(".lang-opt").forEach(function (b) {
    b.addEventListener("click", function () { applyLang(b.getAttribute("data-lang"), true); });
  });

  function paintAuth() {
    const input = $("#discord");
    const card = $("#authCard");
    const title = $("#authTitle");
    const subtitle = $("#authSubtitle");
    const login = $("#discordLogin");
    const profile = $("#discordProfile");
    const avatar = $("#authAvatar");
    const glyph = $("#authGlyph");
    if (!input || !card) return;
    if (oauthEnabled === null) {
      card.hidden = false;
      card.classList.add("is-pending");
      input.type = "hidden";
      login.hidden = true;
      title.textContent = t("auth.checking");
      subtitle.textContent = t("auth.sub");
      return;
    }
    card.classList.remove("is-pending");
    if (!oauthEnabled) {
      card.hidden = true;
      input.type = "text";
      input.className = "control auth-fallback";
      input.placeholder = "Discord username";
      profile.hidden = true;
      return;
    }
    input.type = "hidden";
    input.className = "";
    card.hidden = false;
    if (authUser) {
      input.value = authUser.id;
      title.textContent = t("auth.connected") + " " + (authUser.global_name || authUser.username);
      subtitle.textContent = "@" + authUser.username;
      login.hidden = true;
      card.classList.add("is-connected");
      profile.textContent = "@" + authUser.username;
      profile.setAttribute("aria-label", "Disconnect @" + authUser.username);
      profile.hidden = false;
      if (avatar && authUser.avatar) {
        avatar.src = "https://cdn.discordapp.com/avatars/" + authUser.id + "/" + authUser.avatar + ".webp?size=128";
        avatar.hidden = false;
        if (glyph) glyph.hidden = true;
      } else {
        if (avatar) { avatar.hidden = true; avatar.removeAttribute("src"); }
        if (glyph) glyph.hidden = false;
      }
    } else {
      input.value = "";
      title.textContent = t("auth.title");
      subtitle.textContent = t("auth.sub");
      login.textContent = t("auth.button");
      login.hidden = false;
      card.classList.remove("is-connected");
      profile.hidden = true;
      if (avatar) { avatar.hidden = true; avatar.removeAttribute("src"); }
      if (glyph) glyph.hidden = false;
    }
  }

  fetch("/auth/me", { credentials: "same-origin" })
    .then(function (res) { return res.json(); })
    .then(function (data) {
      oauthEnabled = !!data.enabled;
      authUser = data.user || null;
      paintAuth();
      if (new URLSearchParams(window.location.search).get("auth") === "success") {
        window.history.replaceState({}, "", window.location.pathname);
      }
    })
    // Fail closed: keep verified Discord login visible when auth status cannot
    // be loaded. Manual usernames are only allowed when the backend explicitly
    // reports that OAuth is disabled.
    .catch(function () { oauthEnabled = true; paintAuth(); });

  $("#discordProfile").addEventListener("click", function () {
    fetch("/auth/logout", { method: "POST", credentials: "same-origin" })
      .then(function () { authUser = null; paintAuth(); });
  });

  /* ---------------- readiness checklist ---------------- */

  const checkBoxes = $$("#check input[type=checkbox]");
  function paintCheck() {
    const done = checkBoxes.filter(function (c) { return c.checked; }).length;
    const all = done === checkBoxes.length;
    const count = $("#checkCount");
    const go = $("#checkGo");
    if (count) count.textContent = done + " / " + checkBoxes.length;
    if (go) {
      go.textContent = t(all ? "check.ready" : "check.go");
      go.classList.toggle("is-ready", all);
    }
    const box = $("#check");
    if (box) box.classList.toggle("is-ready", all);
  }
  checkBoxes.forEach(function (c) { c.addEventListener("change", paintCheck); });

  /* ---------------- draft autosave ---------------- */

  const DRAFT_KEY = "genesis_draft";
  const DRAFT_INPUTS = ["experience", "goal", "best", "social", "software_other", "extra_other"];
  const DRAFT_CHIPS = ["software", "extra"];
  let draftTimer = null;

  function saveDraft() {
    const data = { inputs: {}, chips: {} };
    DRAFT_INPUTS.forEach(function (id) { const el = $("#" + id); if (el) data.inputs[id] = el.value; });
    DRAFT_CHIPS.forEach(function (name) {
      data.chips[name] = $$('[data-chips="' + name + '"] .chip.is-active').map(function (c) {
        return c.getAttribute("data-val");
      });
    });
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(data)); } catch (e) { return; }
    const note = $("#draftNote");
    if (note) {
      const d = new Date();
      note.textContent = t("draft.saved") + " · " + d.toTimeString().slice(0, 5);
      note.hidden = false;
    }
  }
  function scheduleDraft() {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(saveDraft, 400);
  }
  function restoreDraft() {
    let data;
    try { data = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null"); } catch (e) { data = null; }
    if (!data) return;
    DRAFT_INPUTS.forEach(function (id) {
      const el = $("#" + id);
      if (el && typeof (data.inputs || {})[id] === "string") el.value = data.inputs[id];
    });
    DRAFT_CHIPS.forEach(function (name) {
      const vals = (data.chips || {})[name] || [];
      $$('[data-chips="' + name + '"] .chip').forEach(function (c) {
        const on = vals.indexOf(c.getAttribute("data-val")) !== -1;
        c.classList.toggle("is-active", on);
        if (c.getAttribute("data-val") === "__other") {
          const other = $("#" + name + "_other");
          if (other) other.hidden = !on;
        }
      });
    });
  }
  function clearDraft() {
    try { localStorage.removeItem(DRAFT_KEY); } catch (e) {}
  }
  form.addEventListener("input", scheduleDraft);
  form.addEventListener("click", function (e) {
    if (e.target && e.target.closest && e.target.closest(".chip")) scheduleDraft();
  });

  /* ---------------- chips: multi-select groups (software / extra) ---------------- */

  function setupChips(name) {
    const wrap = $('[data-chips="' + name + '"]');
    if (!wrap) return;
    const max = parseInt(wrap.getAttribute("data-max"), 10) || 1;
    const chips = $$(".chip", wrap);
    const hidden = $("#" + name);
    const other = $("#" + name + "_other");

    function activeCount() {
      return chips.filter(function (c) { return c.classList.contains("is-active"); }).length;
    }
    function rebuild() {
      const vals = [];
      chips.forEach(function (c) {
        if (!c.classList.contains("is-active")) return;
        if (c.getAttribute("data-val") === "__other") {
          const ov = other ? (other.value || "").trim() : "";
          if (ov) vals.push(ov);
        } else {
          vals.push(c.getAttribute("data-val"));
        }
      });
      if (hidden) hidden.value = vals.join(", ");
      clearError(name);
    }

    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        const turningOn = !chip.classList.contains("is-active");
        if (turningOn && activeCount() >= max) {
          wrap.classList.remove("at-limit");
          void wrap.offsetWidth; // restart limit pulse
          wrap.classList.add("at-limit");
          return;
        }
        chip.classList.toggle("is-active");
        if (chip.getAttribute("data-val") === "__other" && other) {
          other.hidden = !chip.classList.contains("is-active");
          if (other.hidden) other.value = "";
          else { try { other.focus(); } catch (e) {} }
        }
        rebuild();
      });
    });
    if (other) other.addEventListener("input", rebuild);
    rebuild();
  }
  restoreDraft();
  setupChips("software");
  setupChips("extra");

  /* ---------------- validation ---------------- */

  function fieldByKey(k) { return FIELDS.filter(function (f) { return f.key === k; })[0]; }
  function wrapOf(k) { return $('[data-field="' + k + '"]'); }

  function rawValue(k) {
    const el = $(fieldByKey(k).el);
    return el ? (el.value || "").trim() : "";
  }

  function normalizeUrl(v) {
    if (!v) return "";
    if (/^https?:\/\//i.test(v)) return v;
    return "https://" + v.replace(/^\/+/, "");
  }
  function looksLikeUrl(v) {
    return /^(https?:\/\/)?([\w-]+\.)+[a-z]{2,}(\/[^\s]*)?$/i.test(v);
  }

  function setError(k, msgKey) {
    const w = wrapOf(k);
    if (!w) return;
    w.classList.remove("invalid");
    void w.offsetWidth; // restart shake
    w.classList.add("invalid");
    const e = $('[data-err="' + k + '"]', w);
    if (e) e.textContent = t(msgKey);
  }
  function clearError(k) {
    const w = wrapOf(k);
    if (w) w.classList.remove("invalid");
  }

  function validateField(k) {
    const f = fieldByKey(k);
    let v = rawValue(k);
    if (!v) {
      if (f.required) { setError(k, "err.required"); return false; }
      clearError(k); return true;
    }
    if (f.type === "discord") {
      v = v.replace(/^@+/, "");
      if (v.length < 2 || (/\s/.test(v) && v.length > 40)) { setError(k, "err.discord"); return false; }
    }
    if (f.type === "url" && !looksLikeUrl(v)) { setError(k, "err.url"); return false; }
    clearError(k);
    return true;
  }

  function focusField(k) {
    const f = fieldByKey(k);
    if (!f) return;
    const wrap = wrapOf(k);
    if (wrap && wrap.scrollIntoView) {
      try { wrap.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" }); } catch (e) {}
    }
    if (f.chips) {
      const other = $("#" + k + "_other");
      if (other && !other.hidden) { try { other.focus({ preventScroll: true }); } catch (e) {} return; }
      const chip = $('[data-chips="' + k + '"] .chip');
      if (chip && chip.focus) { try { chip.focus({ preventScroll: true }); } catch (e) {} }
      return;
    }
    const el = $(f.el);
    if (el && el.type !== "hidden" && el.focus) {
      try { el.focus({ preventScroll: true }); } catch (e) {}
    }
  }

  function validateStep(n) {
    let ok = true, firstBad = null;
    FIELDS.forEach(function (f) {
      if (STEP_OF[f.key] !== n) return;
      if (!validateField(f.key)) { ok = false; if (!firstBad) firstBad = f.key; }
    });
    if (firstBad) focusField(firstBad);
    return ok;
  }

  // live clear-on-input
  FIELDS.forEach(function (f) {
    if (f.chips) return;
    const el = $(f.el);
    if (el) el.addEventListener("input", function () { clearError(f.key); });
  });

  /* ---------------- step navigation ---------------- */

  function updateNav() {
    backBtn.hidden = current === 1;
    nextBtn.hidden = current === TOTAL;
    submitBtn.hidden = current !== TOTAL;
  }

  function paintSteps() {
    stepsEls.forEach(function (li) {
      const n = parseInt(li.getAttribute("data-step"), 10);
      li.classList.toggle("is-active", n === current);
      li.classList.toggle("is-done", n < current);
    });
    stepsFill.style.height = ((current - 1) / (TOTAL - 1)) * 100 + "%";
    stepsFill.classList.toggle("flowing", current > 1);
    pmFill.style.width = (current / TOTAL) * 100 + "%";
  }

  function showStep(n, dir) {
    current = Math.max(1, Math.min(TOTAL, n));
    panels.forEach(function (p) {
      const pn = parseInt(p.getAttribute("data-panel"), 10);
      const active = pn === current;
      p.hidden = !active;
      p.classList.remove("anim", "anim-back");
      if (active) {
        void p.offsetWidth;
        p.classList.add(dir === "back" ? "anim-back" : "anim");
      }
    });
    if (current === TOTAL) buildReview();
    paintSteps();
    updateNav();
    hideFormError();
    const first = panels[current - 1].querySelector(".control:not([hidden]), .chip");
    if (dir !== "init" && first && first.focus) { try { first.focus({ preventScroll: true }); } catch (e) {} }
  }

  nextBtn.addEventListener("click", function () { if (validateStep(current)) showStep(current + 1, "fwd"); });
  backBtn.addEventListener("click", function () { showStep(current - 1, "back"); });

  // Enter advances instead of submitting (except on textarea / review step)
  form.addEventListener("keydown", function (e) {
    if (e.key !== "Enter") return;
    if (e.target && e.target.tagName === "TEXTAREA") return;
    if (current < TOTAL) {
      e.preventDefault();
      if (validateStep(current)) showStep(current + 1, "fwd");
    }
  });

  /* ---------------- review ---------------- */

  function displayValue(k) {
    let v = rawValue(k);
    if ((k === "best" || k === "social") && v) v = normalizeUrl(v);
    if (k === "discord") v = v.replace(/^@+/, "");
    return v;
  }

  function buildReview() {
    reviewEl.innerHTML = "";
    FIELDS.forEach(function (f) {
      if (!f.required && !rawValue(f.key)) return;
      const v = displayValue(f.key);
      const row = document.createElement("div");
      row.className = "row";
      const dt = document.createElement("dt");
      dt.textContent = t("f." + f.key + ".label");
      const dd = document.createElement("dd");
      if (v) {
        if (f.type === "url") {
          const a = document.createElement("a");
          a.href = v; a.target = "_blank"; a.rel = "noopener noreferrer";
          a.textContent = v;
          dd.appendChild(a);
        } else { dd.textContent = v; }
      } else { dd.className = "empty"; dd.textContent = t("review.empty"); }
      const edit = document.createElement("button");
      edit.type = "button"; edit.className = "edit"; edit.textContent = t("review.edit");
      edit.addEventListener("click", function () {
        showStep(STEP_OF[f.key], "back");
        const el = $(f.el);
        if (el && el.focus) setTimeout(function () { el.focus(); }, 120);
      });
      const left = document.createElement("div");
      left.appendChild(dt); left.appendChild(dd);
      row.appendChild(left); row.appendChild(edit);
      reviewEl.appendChild(row);
    });
  }

  /* ---------------- submit ---------------- */

  function showFormError(msgKey) {
    formError.textContent = t(msgKey);
    formError.hidden = false;
  }
  function hideFormError() { formError.hidden = true; }

  function gatherResponses() {
    const out = [];
    FIELDS.forEach(function (f) {
      const v = displayValue(f.key);
      if (!v) return;
      // Discord's review interface is always English, independently of the site locale.
      out.push({ question: I18N.en["f." + f.key + ".label"], answer: v });
    });
    return out;
  }

  let sending = false;
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (sending) return;

    // validate all data steps; jump to first problem
    for (let n = 1; n <= TOTAL - 1; n++) {
      if (!validateStep(n)) { showStep(n, "back"); return; }
    }

    const payload = {
      hp: (form.querySelector('[name="website"]') || {}).value || "",
      lang: lang,
      applicant: displayValue("discord"),
      form_title: "Genesis unit application",
      responses: gatherResponses()
    };

    sending = true;
    submitBtn.classList.add("is-loading");
    submitBtn.querySelector(".btn-label").textContent = t("nav.submitting");
    hideFormError();

    fetch("/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (res.ok) return data;
        if (res.status === 401) throw { kind: "auth" };
        if (res.status === 429 && data.error === "daily_limit") throw { kind: "limit" };
        if (res.status === 429) throw { kind: "spam" };
        throw { kind: "generic" };
      });
    }).then(function (data) {
      if (data && data.ok === false) throw { kind: "generic" };
      succeed();
    }).catch(function (err) {
      sending = false;
      submitBtn.classList.remove("is-loading");
      submitBtn.querySelector(".btn-label").textContent = t("nav.submit");
      if (err && err.kind === "auth") showFailure("auth");
      else if (err && err.kind === "limit") showFailure("limit");
      else if (err && err.kind === "spam") showFailure("spam");
      else if (err instanceof TypeError) showFailure("network");
      else showFailure("generic");
    });
  });

  let resultRevealTimer = null;

  function revealResult(overlay) {
    const card = $(".result-card", overlay);
    if (!card) return;
    card.classList.remove("is-revealed");
    if (resultRevealTimer) clearTimeout(resultRevealTimer);
    resultRevealTimer = setTimeout(function () {
      card.classList.add("is-revealed");
    }, reducedMotion ? 0 : 2000);
  }

  function succeed() {
    clearDraft();
    form.hidden = true;
    doneEl.hidden = false;
    document.body.style.overflow = "hidden";
    stepsEls.forEach(function (li) { li.classList.add("is-done"); li.classList.remove("is-active"); });
    stepsFill.style.height = "100%";
    stepsFill.classList.add("flowing");
    pmFill.style.width = "100%";
    const media = $("#successMedia");
    if (media) { media.currentTime = 0; media.play().catch(function () {}); }
    revealResult(doneEl);
  }

  function showFailure(kind) {
    const overlay = $("#failure");
    $("#failureTitle").textContent = t("failure." + kind + ".title");
    $("#failureText").textContent = t("failure." + kind + ".text");
    overlay.hidden = false;
    document.body.style.overflow = "hidden";
    const media = $("#failureMedia");
    if (media) { media.currentTime = 0; media.play().catch(function () {}); }
    revealResult(overlay);
  }
  $("#failureClose").addEventListener("click", function () {
    const overlay = $("#failure");
    if (resultRevealTimer) clearTimeout(resultRevealTimer);
    const card = $(".result-card", overlay);
    if (card) card.classList.remove("is-revealed");
    overlay.hidden = true;
    document.body.style.overflow = "";
  });
  if (new URLSearchParams(window.location.search).get("auth") === "failed") {
    showFailure("auth");
    window.history.replaceState({}, "", window.location.pathname);
  }

  /* ---------------- counters ---------------- */

  $$("[data-counter]").forEach(function (c) {
    const el = $("#" + c.getAttribute("data-counter"));
    if (!el) return;
    const max = el.getAttribute("maxlength") || "";
    function upd() { c.textContent = (el.value.length) + " / " + max; }
    el.addEventListener("input", upd); upd();
  });

  /* ---------------- init (рендерим контент ДО декоративных эффектов) ---------------- */

  applyLang(lang, false);
  showStep(1, "init");

  /* ---------------- video upload ---------------- */

  (function initUpload() {
    const input = $("#uploadInput");
    if (!input) return;
    const box = $("#upload");
    const bar = $("#uploadBar");
    const progress = $("#uploadProgress");
    const status = $("#uploadStatus");
    const MAX = 200 * 1024 * 1024;

    function say(key, extra, isError) {
      status.textContent = t(key) + (extra ? " " + extra : "");
      box.classList.toggle("is-error", !!isError);
    }

    input.addEventListener("change", function () {
      const file = input.files && input.files[0];
      if (!file) return;
      if (file.size > MAX) { say("up.err.size", "", true); input.value = ""; return; }
      if (!/\.(mp4|m4v|mov|webm)$/i.test(file.name)) { say("up.err.type", "", true); input.value = ""; return; }

      const data = new FormData();
      data.append("file", file);
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/upload");
      xhr.withCredentials = true;
      box.classList.add("is-busy");
      progress.hidden = false;
      bar.style.width = "0%";
      say("up.loading", file.name, false);

      xhr.upload.addEventListener("progress", function (e) {
        if (!e.lengthComputable) return;
        const pct = Math.round((e.loaded / e.total) * 100);
        bar.style.width = pct + "%";
        say("up.loading", file.name + " · " + pct + "%", false);
      });
      xhr.addEventListener("loadend", function () {
        box.classList.remove("is-busy");
        input.value = "";
        let body = {};
        try { body = JSON.parse(xhr.responseText || "{}"); } catch (e) {}
        if (xhr.status === 200 && body.url) {
          const best = $("#best");
          best.value = body.url;
          best.dispatchEvent(new Event("input", { bubbles: true }));
          const until = new Date(body.expires_at).toLocaleDateString(lang === "ru" ? "ru-RU" : "en-GB");
          say("up.done", until + ".", false);
          box.classList.add("is-done");
          return;
        }
        progress.hidden = true;
        const map = { 401: "up.err.auth", 413: "up.err.size", 415: "up.err.type", 429: "up.err.limit" };
        say(map[xhr.status] || "up.err.generic", "", true);
      });
      xhr.send(data);
    });
  })();

  /* ---------------- owners (live Discord profiles) ---------------- */

  (function initOwners() {
    const cards = $$("[data-owner]");
    if (!cards.length) return;
    fetch("/api/owners")
      .then(function (res) { return res.ok ? res.json() : []; })
      .then(function (list) {
        list.forEach(function (o) {
          const card = $('[data-owner="' + o.id + '"]');
          if (!card) return;
          if (o.name) $(".owner-name", card).textContent = o.name;
          if (o.username) $(".owner-user", card).textContent = "@" + o.username;
          const img = $(".owner-avatar img", card);
          if (o.avatar && img) {
            img.src = o.avatar;
            img.alt = o.name || "";
            img.hidden = false;
          }
          const banner = $(".owner-banner", card);
          if (o.banner) {
            banner.style.backgroundImage = "url(\"" + o.banner + "\")";
            card.classList.add("has-banner");
          } else if (o.accent) {
            banner.style.backgroundColor = o.accent;
          }
        });
      })
      .catch(function () {});
  })();

  /* ---------------- extra applications (Google Forms) ---------------- */

  (function initExtraForm() {
    const link = $("#extraForm");
    const section = $("#more");
    if (!link || !section || !EXTRA_FORM_URL) return;
    link.href = EXTRA_FORM_URL;
    section.hidden = false;
  })();

  /* ---------------- hero timecode ---------------- */

  (function initTimecode() {
    const el = $("#timecode");
    if (!el || reducedMotion) return;
    const start = Date.now();
    function pad(n) { return n < 10 ? "0" + n : String(n); }
    setInterval(function () {
      if (document.hidden) return;
      const ms = Date.now() - start;
      const s = Math.floor(ms / 1000);
      el.textContent = pad(Math.floor(s / 3600)) + ":" + pad(Math.floor(s / 60) % 60) + ":" +
        pad(s % 60) + ":" + pad(Math.floor((ms % 1000) / (1000 / 24)));
    }, 1000 / 24);
  })();
})();
