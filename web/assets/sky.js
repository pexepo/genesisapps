/* ============================================================
   Genesis — hero sky: stars, four-point sparkles and orbit arcs
   (motifs of the Genesis logo), drawn on a single canvas.
   ============================================================ */
(function () {
  "use strict";

  const canvas = document.getElementById("sky");
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext("2d");
  const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const PAPER = "236, 235, 230";
  const VIOLET = "157, 140, 255";

  let w = 0, h = 0, dpr = 1;
  let stars = [], sparkles = [], orbits = [];
  let px = 0, py = 0, tx = 0, ty = 0; // pointer parallax, smoothed
  let running = false, visible = true, raf = 0;
  let meteor = null, nextMeteor = 4000;

  // Deterministic PRNG so the sky looks the same on every resize.
  function rng(seed) {
    return function () {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  }

  function build() {
    const r = rng(7);
    const count = Math.round((w * h) / 2600);
    stars = [];
    for (let i = 0; i < count; i++) {
      const depth = r();
      stars.push({
        x: r() * w, y: r() * h,
        size: depth > 0.92 ? 1.6 : depth > 0.6 ? 1.1 : 0.7,
        depth: 0.15 + depth * 0.85,
        base: 0.25 + r() * 0.55,
        speed: 0.4 + r() * 1.6,
        phase: r() * Math.PI * 2
      });
    }

    // Sparkles echo the logo: a small cluster on the right, a stray one left.
    const s = Math.min(w, h);
    const narrow = w < 700 && h > w;
    sparkles = [
      { x: 0.78, y: 0.30, r: 0.042, phase: 0.0, violet: true },
      { x: 0.70, y: 0.46, r: 0.030, phase: 1.7, violet: false },
      { x: 0.86, y: 0.52, r: 0.022, phase: 3.1, violet: true },
      { x: 0.62, y: 0.20, r: 0.014, phase: 4.4, violet: false },
      { x: 0.16, y: 0.24, r: 0.012, phase: 2.2, violet: false }
    ].map(function (p) {
      // Portrait phones: lift the cluster above the headline and shrink it.
      return {
        x: p.x * w, y: p.y * h * (narrow ? 0.42 : 1),
        r: p.r * s * (narrow ? 1.1 : 1.6), phase: p.phase, violet: p.violet
      };
    });

    // Orbits: tilted ellipses around the cluster, each with a travelling comet.
    const cx = w * 0.76, cy = h * (narrow ? 0.17 : 0.40);
    orbits = [
      { rx: s * 0.62, ry: s * 0.20, tilt: -0.42, speed: 0.045, phase: 0.6 },
      { rx: s * 0.88, ry: s * 0.30, tilt: -0.38, speed: -0.028, phase: 2.4 },
      { rx: s * 0.40, ry: s * 0.13, tilt: -0.50, speed: 0.07, phase: 4.0 }
    ].map(function (o) { o.cx = cx; o.cy = cy; return o; });
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = Math.max(1, rect.width);
    h = Math.max(1, rect.height);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    build();
    if (!running) draw(0);
  }

  function sparkle(x, y, r, alpha, color, rot) {
    // Four-point star with concave sides, like the logo's sparkles.
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 2.6);
    g.addColorStop(0, "rgba(" + color + "," + (alpha * 0.22) + ")");
    g.addColorStop(1, "rgba(" + color + ",0)");
    ctx.fillStyle = g;
    ctx.fillRect(-r * 2.6, -r * 2.6, r * 5.2, r * 5.2);
    const k = r * 0.16;
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.quadraticCurveTo(k, -k, r, 0);
    ctx.quadraticCurveTo(k, k, 0, r);
    ctx.quadraticCurveTo(-k, k, -r, 0);
    ctx.quadraticCurveTo(-k, -k, 0, -r);
    ctx.fillStyle = "rgba(" + color + "," + alpha + ")";
    ctx.fill();
    ctx.restore();
  }

  function orbitPoint(o, a) {
    const x = Math.cos(a) * o.rx, y = Math.sin(a) * o.ry;
    const c = Math.cos(o.tilt), s = Math.sin(o.tilt);
    return [o.cx + x * c - y * s, o.cy + x * s + y * c];
  }

  function draw(t) {
    const sec = t / 1000;
    tx += (px - tx) * 0.05;
    ty += (py - ty) * 0.05;
    ctx.clearRect(0, 0, w, h);

    // Stars with gentle twinkle and depth-based parallax.
    for (let i = 0; i < stars.length; i++) {
      const st = stars[i];
      const a = st.base * (0.65 + 0.35 * Math.sin(sec * st.speed + st.phase));
      const x = st.x + tx * 18 * st.depth, y = st.y + ty * 12 * st.depth;
      ctx.fillStyle = "rgba(" + PAPER + "," + a.toFixed(3) + ")";
      ctx.fillRect(x, y, st.size, st.size);
    }

    // Orbit arcs: hairline ellipse plus a comet with a fading tail.
    ctx.lineWidth = 1;
    for (let i = 0; i < orbits.length; i++) {
      const o = orbits[i];
      ctx.save();
      ctx.translate(tx * 26, ty * 16);
      ctx.beginPath();
      ctx.ellipse(o.cx, o.cy, o.rx, o.ry, o.tilt, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(" + PAPER + ",0.07)";
      ctx.stroke();
      const head = o.phase + sec * o.speed * Math.PI * 2;
      const dir = o.speed > 0 ? -1 : 1;
      for (let j = 0; j < 36; j++) {
        const p = orbitPoint(o, head + dir * j * 0.018);
        const fade = 1 - j / 36;
        ctx.fillStyle = "rgba(" + PAPER + "," + (fade * fade * 0.55).toFixed(3) + ")";
        ctx.fillRect(p[0], p[1], 1.5, 1.5);
      }
      const hp = orbitPoint(o, head);
      sparkle(hp[0], hp[1], 5, 0.9, PAPER, 0);
      ctx.restore();
    }

    // Logo-like sparkles: slow breathing and rotation.
    for (let i = 0; i < sparkles.length; i++) {
      const sp = sparkles[i];
      const pulse = 0.82 + 0.18 * Math.sin(sec * 0.9 + sp.phase);
      sparkle(
        sp.x + tx * 34, sp.y + ty * 22,
        sp.r * pulse, 0.92,
        sp.violet ? VIOLET : PAPER,
        Math.sin(sec * 0.15 + sp.phase) * 0.12
      );
    }

    // Occasional meteor.
    if (!reduced) {
      if (!meteor && t > nextMeteor) {
        meteor = { x: w * (0.2 + Math.random() * 0.6), y: -20, born: t };
        nextMeteor = t + 7000 + Math.random() * 9000;
      }
      if (meteor) {
        const life = (t - meteor.born) / 900;
        if (life >= 1) meteor = null;
        else {
          const mx = meteor.x - life * w * 0.35, my = meteor.y + life * h * 0.55;
          const grad = ctx.createLinearGradient(mx, my, mx + 120, my - 190);
          grad.addColorStop(0, "rgba(" + PAPER + "," + (0.8 * (1 - life)) + ")");
          grad.addColorStop(1, "rgba(" + PAPER + ",0)");
          ctx.strokeStyle = grad;
          ctx.beginPath();
          ctx.moveTo(mx, my);
          ctx.lineTo(mx + 120, my - 190);
          ctx.stroke();
        }
      }
    }
  }

  function loop(t) {
    draw(t);
    raf = requestAnimationFrame(loop);
  }

  function setRunning(on) {
    if (reduced) on = false;
    if (on === running) return;
    running = on;
    if (on) raf = requestAnimationFrame(loop);
    else cancelAnimationFrame(raf);
  }

  function sync() { setRunning(visible && !document.hidden); }

  window.addEventListener("resize", resize, { passive: true });
  document.addEventListener("visibilitychange", sync);
  window.addEventListener("pointermove", function (e) {
    px = e.clientX / window.innerWidth - 0.5;
    py = e.clientY / window.innerHeight - 0.5;
  }, { passive: true });
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      sync();
    }).observe(canvas);
  }

  resize();
  sync();
})();
