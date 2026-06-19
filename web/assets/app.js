/* ============================================================
   Genesis — application form logic
   ============================================================ */
(function () {
  "use strict";

  /* ---------------- i18n ---------------- */

  const I18N = {
    ru: {
      "tagline": "Юнит эдиторов. Покажи свой стиль — и присоединяйся к новому поколению.",
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
      "f.discord.label": "Discord-юзернейм",
      "f.discord.hint": "Твой хэндл, например kqunix — по нему мы выдаём роль.",
      "f.software.label": "Программа для эдитинга",
      "f.software.hint": "Выбери одну или две — или укажи свою.",
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
      "f.social.hint": "TikTok, Instagram, YouTube, Telegram — где ты выкладываешь эдиты.",
      "f.optional": "необяз.",
      "nav.back": "Назад",
      "nav.next": "Далее",
      "nav.submit": "Отправить заявку",
      "nav.submitting": "Отправляем…",
      "done.title": "Заявка отправлена!",
      "done.sub": "Мы получили твою анкету. Ревьюеры свяжутся с тобой в Discord.",
      "done.again": "Отправить ещё одну",
      "legal": "Отправляя заявку, ты соглашаешься, что указанные данные будут переданы команде джаджей Genesis для рассмотрения.",
      "foot.server": "Discord-сервер юнита",
      "foot.styles": "Правила заявок",
      "foot.contactHtml": "Связь · Discord: <b>pexepo</b>",
      "styles.title": "Правила подачи заявок",
      "styles.kicker": "GENESIS // RULES",
      "styles.bodyHtml": "<ol class=\"rules\"><li>Минимальная длина эдита — не менее 7 секунд.</li><li>Ремейки чужих работ и сильное вдохновение другими авторами не допускаются.</li><li>Эдит должен быть новым или сделанным в течение последних 3 месяцев.</li><li>Не расстраивайся, если получил деклайн или реапп!</li></ol><img class=\"modal-gif\" src=\"/assets/notes.gif\" alt=\"\" loading=\"lazy\" />",
      "review.edit": "Изменить",
      "review.empty": "— не указано —",
      "err.required": "Заполни это поле",
      "err.url": "Укажи корректную ссылку (https://…)",
      "err.discord": "Похоже на некорректный юзернейм",
      "error.generic": "Не удалось отправить. Попробуй ещё раз.",
      "error.network": "Нет связи с сервером. Проверь интернет и попробуй снова.",
      "error.rate": "Слишком много заявок. Подожди немного и попробуй позже."
    },
    en: {
      "tagline": "An editors' unit. Show us your style — and join the new generation.",
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
      "f.discord.label": "Discord username",
      "f.discord.hint": "Your handle, e.g. kqunix — used to assign your role.",
      "f.software.label": "Editing software",
      "f.software.hint": "Pick one or two — or enter your own.",
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
      "f.social.hint": "TikTok, Instagram, YouTube, Telegram — where you post edits.",
      "f.optional": "optional",
      "nav.back": "Back",
      "nav.next": "Next",
      "nav.submit": "Submit application",
      "nav.submitting": "Sending…",
      "done.title": "Application sent!",
      "done.sub": "We've received your form. Reviewers will reach out on Discord.",
      "done.again": "Submit another",
      "legal": "By submitting, you agree that the information above will be shared with the Genesis judges team for review.",
      "foot.server": "Unit Discord server",
      "foot.styles": "Application rules",
      "foot.contactHtml": "Contact · Discord: <b>pexepo</b>",
      "styles.title": "Application rules",
      "styles.kicker": "GENESIS // RULES",
      "styles.bodyHtml": "<ol class=\"rules\"><li>The minimum edit length is 7 seconds.</li><li>Remakes of others' work and heavy inspiration from other authors are not allowed.</li><li>The edit must be new — or made within the last 3 months.</li><li>Don't be upset if you get a decline or a reapp!</li></ol><img class=\"modal-gif\" src=\"/assets/notes.gif\" alt=\"\" loading=\"lazy\" />",
      "review.edit": "Edit",
      "review.empty": "— not provided —",
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

    const other = $("#software_other");
    if (other) other.placeholder = t("f.software.otherLabel");

    const fc = $("#footContact");
    if (fc) fc.innerHTML = t("foot.contactHtml");
    refreshModalIfOpen();

    updateNav();
    if (current === TOTAL) buildReview();
  }

  $$(".lang-opt").forEach(function (b) {
    b.addEventListener("click", function () { applyLang(b.getAttribute("data-lang"), true); });
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
  }
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
    if (f.chips) {
      const other = $("#" + k + "_other");
      if (other && !other.hidden) { try { other.focus({ preventScroll: true }); } catch (e) {} return; }
      const chip = $('[data-chips="' + k + '"] .chip');
      if (chip && chip.focus) { try { chip.focus({ preventScroll: true }); } catch (e) {} }
      return;
    }
    const el = $(f.el);
    if (el && el.focus) { try { el.focus({ preventScroll: true }); } catch (e) {} }
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
    if (first && first.focus) { try { first.focus({ preventScroll: true }); } catch (e) {} }
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
      out.push({ question: t("f." + f.key + ".label"), answer: v });
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
      form_title: "Genesis — " + (lang === "ru" ? "заявка в юнит" : "unit application"),
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
      if (res.ok) return res.json().catch(function () { return { ok: true }; });
      if (res.status === 429) throw { kind: "rate" };
      throw { kind: "generic" };
    }).then(function (data) {
      if (data && data.ok === false) throw { kind: "generic" };
      succeed();
    }).catch(function (err) {
      sending = false;
      submitBtn.classList.remove("is-loading");
      submitBtn.querySelector(".btn-label").textContent = t("nav.submit");
      if (err && err.kind === "rate") showFormError("error.rate");
      else if (err instanceof TypeError) showFormError("error.network");
      else showFormError("error.generic");
    });
  });

  function succeed() {
    form.hidden = true;
    doneEl.hidden = false;
    stepsEls.forEach(function (li) { li.classList.add("is-done"); li.classList.remove("is-active"); });
    stepsFill.style.height = "100%";
    stepsFill.classList.add("flowing");
    pmFill.style.width = "100%";
  }

  $("#againBtn").addEventListener("click", function () {
    form.reset();
    $$(".chip.is-active").forEach(function (c) { c.classList.remove("is-active"); });
    $$(".control-inline").forEach(function (i) { i.hidden = true; });
    $$("[data-chips]").forEach(function (w) {
      const h = $("#" + w.getAttribute("data-chips"));
      if (h) h.value = "";
    });
    $$(".field.invalid").forEach(function (w) { w.classList.remove("invalid"); });
    sending = false;
    submitBtn.classList.remove("is-loading");
    submitBtn.querySelector(".btn-label").textContent = t("nav.submit");
    doneEl.hidden = true;
    form.hidden = false;
    showStep(1, "back");
  });

  /* ---------------- counters ---------------- */

  $$("[data-counter]").forEach(function (c) {
    const el = $("#" + c.getAttribute("data-counter"));
    if (!el) return;
    const max = el.getAttribute("maxlength") || "";
    function upd() { c.textContent = (el.value.length) + " / " + max; }
    el.addEventListener("input", upd); upd();
  });

  /* ---------------- modal (application rules) ---------------- */

  const modal = $("#modal");
  let modalKey = null;

  function setModalContent(key) {
    $("#modalKicker").textContent = t(key + ".kicker");
    $("#modalTitle").textContent = t(key + ".title");
    $("#modalBody").innerHTML = t(key + ".bodyHtml");
  }
  function openModal(key) {
    modalKey = key;
    setModalContent(key);
    modal.hidden = false;
    document.body.style.overflow = "hidden";
  }
  function closeModal() {
    modal.hidden = true;
    modalKey = null;
    document.body.style.overflow = "";
  }
  function refreshModalIfOpen() {
    if (modal && modalKey && !modal.hidden) setModalContent(modalKey);
  }
  $$("[data-modal]").forEach(function (b) {
    b.addEventListener("click", function () { openModal(b.getAttribute("data-modal")); });
  });
  $$("[data-close]").forEach(function (el) { el.addEventListener("click", closeModal); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && modal && !modal.hidden) closeModal();
  });

  /* ---------------- init (рендерим контент ДО декоративных эффектов) ---------------- */

  applyLang(lang, false);
  showStep(1, "fwd");

  /* ---------------- boot splash ---------------- */

  (function boot() {
    const el = $("#boot");
    if (!el) return;
    const sub = $("#bootSub");
    if (sub) sub.textContent = (lang === "ru") ? "установка соединения" : "establishing uplink";
    let hidden = false;
    function hide() {
      if (hidden) return;
      hidden = true;
      el.classList.add("is-done");
      setTimeout(function () { el.style.display = "none"; }, 750);
    }
    if (document.readyState === "complete") setTimeout(hide, 480);
    else window.addEventListener("load", function () { setTimeout(hide, 440); });
    setTimeout(hide, 3500); // safety net, на случай если load не наступит
  })();

  /* ---------------- starfield ---------------- */

  (function starfield() {
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const canvas = $("#stars");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let w = 0, h = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
    let stars = [];
    let mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    let shooting = null, lastShot = 0;

    function resize() {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(240, Math.floor((w * h) / 7000));
      stars = [];
      for (let i = 0; i < count; i++) {
        const depth = Math.random();
        stars.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: depth * 1.5 + 0.3,
          depth: depth,
          a: Math.random() * 0.5 + 0.2,
          tw: Math.random() * 0.02 + 0.004,
          ph: Math.random() * Math.PI * 2,
          hue: Math.random() < 0.22 ? "212" : null
        });
      }
    }

    function drawStatic() {
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        ctx.globalAlpha = s.a;
        ctx.fillStyle = s.hue ? "hsl(" + s.hue + ",36%,82%)" : "#eef2f8";
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    function frame(ts) {
      ctx.clearRect(0, 0, w, h);
      mouse.x += (mouse.tx - mouse.x) * 0.05;
      mouse.y += (mouse.ty - mouse.y) * 0.05;
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        s.ph += s.tw;
        const alpha = s.a + Math.sin(s.ph) * 0.25;
        const ox = mouse.x * s.depth * 22;
        const oy = mouse.y * s.depth * 22;
        ctx.globalAlpha = Math.max(0, alpha);
        if (s.hue) {
          ctx.shadowBlur = 6; ctx.shadowColor = "hsl(" + s.hue + ",42%,74%)";
          ctx.fillStyle = "hsl(" + s.hue + ",38%,84%)";
        } else { ctx.shadowBlur = 0; ctx.fillStyle = "#eef2f8"; }
        ctx.beginPath();
        ctx.arc(s.x + ox, s.y + oy, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;

      // occasional shooting star
      if (!shooting && ts - lastShot > 6000 && Math.random() < 0.012) {
        shooting = { x: Math.random() * w * 0.6, y: Math.random() * h * 0.4, len: 0, life: 0 };
        lastShot = ts;
      }
      if (shooting) {
        shooting.life += 1;
        shooting.x += 9; shooting.y += 4.2;
        shooting.len = Math.min(160, shooting.len + 14);
        const g = ctx.createLinearGradient(shooting.x - shooting.len, shooting.y - shooting.len * 0.46, shooting.x, shooting.y);
        g.addColorStop(0, "rgba(200,214,235,0)");
        g.addColorStop(1, "rgba(222,231,245,0.92)");
        ctx.strokeStyle = g; ctx.lineWidth = 2; ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(shooting.x - shooting.len, shooting.y - shooting.len * 0.46);
        ctx.lineTo(shooting.x, shooting.y);
        ctx.stroke();
        if (shooting.life > 60 || shooting.x > w || shooting.y > h) shooting = null;
      }
      requestAnimationFrame(frame);
    }

    window.addEventListener("resize", resize, { passive: true });
    resize();
    if (reduce) { drawStatic(); return; }
    window.addEventListener("mousemove", function (e) {
      mouse.tx = (e.clientX / w - 0.5) * 2;
      mouse.ty = (e.clientY / h - 0.5) * 2;
    }, { passive: true });
    requestAnimationFrame(frame);
  })();
})();
