/* ============================================================
   Genesis: UI sound effects, synthesised with Web Audio.
   No audio files: every sound is a few oscillators and a noise click.
   window.GenesisSFX(name) plays a sound; muted state lives in localStorage.
   ============================================================ */
(function () {
  "use strict";

  const KEY = "genesis_sfx";
  let ctx = null, master = null, noise = null;
  let enabled = true;
  try { enabled = localStorage.getItem(KEY) !== "off"; } catch (e) {}

  function audio() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.16;
    master.connect(ctx.destination);
    noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.05), ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return ctx;
  }

  function tone(freq, at, dur, type, gain, slideTo, vibrato) {
    const t0 = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type || "sine";
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    if (vibrato) {
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = 6;
      depth.gain.value = vibrato;
      lfo.connect(depth).connect(osc.frequency);
      lfo.start(t0);
      lfo.stop(t0 + dur + 0.05);
    }
    amp.gain.setValueAtTime(0.0001, t0);
    amp.gain.exponentialRampToValueAtTime(gain || 0.5, t0 + 0.008);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(amp).connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  // Short filtered noise burst: the "cut" of a splice or a shutter.
  function click(at, gain, freq) {
    const t0 = ctx.currentTime + at;
    const src = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const amp = ctx.createGain();
    src.buffer = noise;
    filter.type = "highpass";
    filter.frequency.value = freq || 2500;
    amp.gain.setValueAtTime(gain || 0.4, t0);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.035);
    src.connect(filter).connect(amp).connect(master);
    src.start(t0);
    src.stop(t0 + 0.05);
  }

  function spooky() {
    return document.documentElement.getAttribute("data-theme") === "halloween";
  }

  const SOUNDS = {
    tap: function () { click(0, 0.3); },
    next: function () { click(0, 0.35); tone(660, 0.01, 0.09, "triangle", 0.35, 880); },
    back: function () { click(0, 0.3); tone(520, 0.01, 0.09, "triangle", 0.3, 390); },
    on: function () { tone(990, 0, 0.06, "triangle", 0.35); },
    off: function () { tone(700, 0, 0.06, "triangle", 0.25); },
    deny: function () { tone(180, 0, 0.09, "square", 0.12); tone(150, 0.08, 0.12, "square", 0.12); },
    check: function () { click(0, 0.2, 4000); tone(1250, 0, 0.05, "sine", 0.3); },
    ready: function () {
      [660, 880, 1320].forEach(function (f, i) { tone(f, i * 0.06, 0.16, "triangle", 0.3); });
    },
    lang: function () { tone(1400, 0, 0.04, "sine", 0.25); },
    open: function () { click(0, 0.25, 1500); tone(330, 0, 0.18, "sine", 0.3, 660); },
    uploaded: function () { tone(880, 0, 0.1, "triangle", 0.35); tone(1320, 0.08, 0.16, "triangle", 0.35); },
    success: function () {
      if (spooky()) {
        // Minor arpeggio and a theremin glide for the Halloween theme.
        [440, 523.25, 659.25, 880].forEach(function (f, i) { tone(f, i * 0.12, 0.5, "triangle", 0.3); });
        tone(440, 0.45, 1.1, "sine", 0.22, 990, 9);
        return;
      }
      [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) {
        tone(f, i * 0.09, 0.45, "triangle", 0.32);
        tone(f * 2, i * 0.09 + 0.02, 0.25, "sine", 0.06);
      });
      tone(1046.5, 0.42, 0.9, "sine", 0.18);
    },
    error: function () {
      tone(233, 0, 0.18, "sawtooth", 0.14, 196);
      tone(175, 0.17, 0.32, "sawtooth", 0.14, 131);
      click(0, 0.15, 800);
    }
  };

  function play(name) {
    if (!enabled || !SOUNDS[name]) return;
    const c = audio();
    if (!c) return;
    if (c.state === "suspended") c.resume();
    try { SOUNDS[name](); } catch (e) {}
  }

  play.enabled = function () { return enabled; };
  play.setEnabled = function (on) {
    enabled = !!on;
    try { localStorage.setItem(KEY, enabled ? "on" : "off"); } catch (e) {}
    if (enabled) play("on");
  };

  window.GenesisSFX = play;
})();
