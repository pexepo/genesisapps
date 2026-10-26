/* Seasonal theme switch. Runs in <head> before paint so there is no flash.
   Halloween is on from Oct 20 to Nov 2 (visitor's local time); ?theme=halloween|base overrides. */
(function () {
  "use strict";
  var forced = /[?&]theme=(halloween|base)\b/.exec(location.search);
  var now = new Date();
  var m = now.getMonth(), d = now.getDate();
  var season = (m === 9 && d >= 20) || (m === 10 && d <= 2);
  var theme = forced ? forced[1] : (season ? "halloween" : "base");
  if (theme !== "base") document.documentElement.setAttribute("data-theme", theme);
})();
