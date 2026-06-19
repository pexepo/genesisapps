/**
 * Google Apps Script для отправки ответов формы в Discord-бота.
 *
 * Установка:
 *  1. Открой свою Google Форму -> правый верхний угол "⋮" -> "Script editor"
 *     (или https://script.google.com -> привяжи к форме).
 *  2. Вставь этот код, замени значения BOT_URL и SHARED_SECRET ниже.
 *  3. Слева "Triggers" (часики) -> Add Trigger:
 *        - функция: onFormSubmit
 *        - источник события: From form
 *        - тип события: On form submit
 *  4. Сохрани, разреши доступ. Готово — каждая отправка летит в бота.
 *
 *  ВАЖНО: BOT_URL должен быть ПУБЛИЧНО доступен из интернета
 *  (VPS с белым IP, или туннель ngrok / cloudflared — см. README).
 */

// === НАСТРОЙКИ ===
var BOT_URL = "https://ducktail-ditto-mumbling.ngrok-free.dev/submit"; // адрес эндпоинта бота
var SHARED_SECRET = "sukagena"; // тот же, что в .env бота

// Чтобы бот мог ВЫДАТЬ роль заявителю, в форме должно быть поле, куда он впишет
// свой Discord-ЮЗЕРНЕЙМ (хэндл, напр. "ivan" — он уникален) или числовой ID.
// Впиши сюда часть названия этого поля (без учёта регистра). Например, если
// вопрос называется "Ваш Discord" — достаточно "discord".
// Оставь пустым, если роль выдавать не нужно.
var APPLICANT_QUESTION = "discord username";
// =================

function onFormSubmit(e) {
  var response = e.response;
  var itemResponses = response.getItemResponses();

  var responses = [];
  var applicant = "";
  var needle = (APPLICANT_QUESTION || "").toLowerCase().trim();

  for (var i = 0; i < itemResponses.length; i++) {
    var ir = itemResponses[i];
    var answer = ir.getResponse();
    if (Array.isArray(answer)) {
      answer = answer.join(", ");
    }
    var title = ir.getItem().getTitle();
    responses.push({
      question: title,
      answer: String(answer)
    });
    if (needle && title.toLowerCase().indexOf(needle) !== -1) {
      // отдаём как есть (юзернейм или ID); резолвинг — на стороне бота
      applicant = String(answer).trim();
    }
  }

  var responderEmail = "";
  try {
    responderEmail = response.getRespondentEmail() || "";
  } catch (err) {
    responderEmail = "";
  }

  var payload = {
    response_id: response.getId(),
    form_title: FormApp.getActiveForm().getTitle(),
    timestamp: response.getTimestamp().toISOString(),
    responder: responderEmail || "Аноним",
    applicant: applicant,
    responses: responses
  };

  var options = {
    method: "post",
    contentType: "application/json",
    headers: { "X-Auth-Token": SHARED_SECRET },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  var res = UrlFetchApp.fetch(BOT_URL, options);
  Logger.log("Discord bot responded: " + res.getResponseCode() + " " + res.getContentText());
}
