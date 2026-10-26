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
  const EMBER = "255, 122, 26";
  const HALLOWEEN = document.documentElement.getAttribute("data-theme") === "halloween";

  let w = 0, h = 0, dpr = 1;
  let stars = [], sparkles = [], orbits = [];
  let px = 0, py = 0, tx = 0, ty = 0; // pointer parallax, smoothed
  let running = false, visible = true, raf = 0;
  let meteor = null, nextMeteor = 4000;
  let moon = null, bats = [], clouds = [], embers = [], craters = [], lastT = 0;

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

    if (HALLOWEEN) buildHalloween(r, s, narrow);
  }

  function buildHalloween(r, s, narrow) {
    moon = {
      x: w * (narrow ? 0.72 : 0.74),
      y: h * (narrow ? 0.27 : 0.34),
      r: s * (narrow ? 0.15 : 0.17)
    };
    craters = [];
    for (let i = 0; i < 9; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.72;
      craters.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, r: 0.05 + r() * 0.13 });
    }
    bats = [];
    for (let i = 0; i < 7; i++) {
      bats.push({
        offset: r() * (w + 200),
        speed: 26 + r() * 40,
        base: moon.y + (r() - 0.5) * moon.r * 3.2,
        amp: 10 + r() * 26,
        phase: r() * Math.PI * 2,
        flap: 7 + r() * 5,
        size: 0.8 + r() * 0.9
      });
    }
    clouds = [];
    for (let i = 0; i < 4; i++) {
      clouds.push({
        offset: r() * (w + 600),
        speed: 6 + r() * 10,
        y: moon.y + (r() - 0.35) * moon.r * 1.8,
        rx: moon.r * (1.6 + r() * 1.8),
        ry: moon.r * (0.16 + r() * 0.14)
      });
    }
    embers = [];
    const n = Math.round(w / 28);
    for (let i = 0; i < n; i++) embers.push(newEmber(r, true));
  }

  function newEmber(rand, anywhere) {
    rand = rand || Math.random;
    return {
      x: rand() * w,
      y: anywhere ? h * (0.35 + rand() * 0.65) : h + 10,
      vy: 14 + rand() * 30,
      sway: rand() * Math.PI * 2,
      size: 0.8 + rand() * 1.8,
      life: 0.4 + rand() * 0.6
    };
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

  function drawMoon(ox, oy) {
    const x = moon.x + ox, y = moon.y + oy, R = moon.r;
    const haze = ctx.createRadialGradient(x, y, R * 0.8, x, y, R * 3.4);
    haze.addColorStop(0, "rgba(" + EMBER + ",0.20)");
    haze.addColorStop(0.45, "rgba(" + EMBER + ",0.06)");
    haze.addColorStop(1, "rgba(" + EMBER + ",0)");
    ctx.fillStyle = haze;
    ctx.fillRect(x - R * 3.4, y - R * 3.4, R * 6.8, R * 6.8);

    const body = ctx.createRadialGradient(x - R * 0.35, y - R * 0.35, R * 0.1, x, y, R);
    body.addColorStop(0, "#f6efdc");
    body.addColorStop(0.7, "#e2d6b6");
    body.addColorStop(1, "#c9a978");
    ctx.beginPath();
    ctx.arc(x, y, R, 0, Math.PI * 2);
    ctx.fillStyle = body;
    ctx.fill();
    ctx.save();
    ctx.clip();
    for (let i = 0; i < craters.length; i++) {
      const c = craters[i];
      ctx.beginPath();
      ctx.arc(x + c.x * R, y + c.y * R, c.r * R, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(120, 96, 60, 0.09)";
      ctx.fill();
    }
    ctx.restore();
  }

  function bat(x, y, size, flap) {
    const wy = flap * 7;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size, size);
    ctx.beginPath();
    ctx.moveTo(0, -3);
    ctx.quadraticCurveTo(-7, -7 + wy * 0.3, -16, -5 + wy);
    ctx.quadraticCurveTo(-13, -1 + wy * 0.6, -12, 2 + wy * 0.5);
    ctx.quadraticCurveTo(-8, 0, -6, 3);
    ctx.quadraticCurveTo(-3, 1, 0, 5);
    ctx.quadraticCurveTo(3, 1, 6, 3);
    ctx.quadraticCurveTo(8, 0, 12, 2 + wy * 0.5);
    ctx.quadraticCurveTo(13, -1 + wy * 0.6, 16, -5 + wy);
    ctx.quadraticCurveTo(7, -7 + wy * 0.3, 0, -3);
    ctx.moveTo(-2, -3); ctx.lineTo(-2.6, -6); ctx.lineTo(-0.8, -3.6);
    ctx.moveTo(2, -3); ctx.lineTo(2.6, -6); ctx.lineTo(0.8, -3.6);
    ctx.fillStyle = "#0b0a0c";
    ctx.fill();
    ctx.strokeStyle = "rgba(" + PAPER + ",0.22)";
    ctx.lineWidth = 0.6 / size;
    ctx.stroke();
    ctx.restore();
  }

  function cobweb() {
    // Corner web anchored at the hero's top-left, under the header.
    const ax = 0, ay = 64, R = Math.min(w, h) * 0.32;
    const spokes = 7;
    ctx.save();
    ctx.strokeStyle = "rgba(" + PAPER + ",0.13)";
    ctx.lineWidth = 0.8;
    const angles = [];
    for (let i = 0; i < spokes; i++) angles.push((i / (spokes - 1)) * (Math.PI / 2));
    angles.forEach(function (a) {
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(ax + Math.cos(a) * R, ay + Math.sin(a) * R);
      ctx.stroke();
    });
    for (let ring = 1; ring <= 6; ring++) {
      const rr = (ring / 6) * R * 0.92;
      ctx.beginPath();
      for (let i = 0; i < spokes; i++) {
        const a = angles[i];
        const px = ax + Math.cos(a) * rr, py = ay + Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(px, py);
        else {
          const pa = angles[i - 1], mid = (a + pa) / 2, sag = rr * 0.86;
          ctx.quadraticCurveTo(ax + Math.cos(mid) * sag, ay + Math.sin(mid) * sag, px, py);
        }
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawHalloween(sec, dt) {
    const ox = tx * 30, oy = ty * 18;
    drawMoon(ox, oy);

    // Clouds drift across the moon, darkening it.
    for (let i = 0; i < clouds.length; i++) {
      const c = clouds[i];
      const span = w + c.rx * 4;
      const x = w + c.rx * 2 - ((sec * c.speed + c.offset) % span) + ox;
      const g = ctx.createRadialGradient(x, c.y + oy, 0, x, c.y + oy, c.rx);
      g.addColorStop(0, "rgba(10, 10, 11, 0.78)");
      g.addColorStop(1, "rgba(10, 10, 11, 0)");
      ctx.save();
      ctx.translate(x, c.y + oy);
      ctx.scale(1, c.ry / c.rx);
      ctx.translate(-x, -(c.y + oy));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, c.y + oy, c.rx, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    for (let i = 0; i < bats.length; i++) {
      const b = bats[i];
      const span = w + 200;
      const x = w + 100 - ((sec * b.speed + b.offset) % span) + tx * 40;
      const y = b.base + Math.sin(sec * 0.9 + b.phase) * b.amp + ty * 24;
      bat(x, y, b.size, Math.sin(sec * b.flap + b.phase));
    }

    // Embers rise from the bottom like sparks off a bonfire.
    for (let i = 0; i < embers.length; i++) {
      const e = embers[i];
      e.y -= e.vy * dt;
      e.life -= dt * 0.12;
      if (e.y < h * 0.25 || e.life <= 0) { embers[i] = newEmber(null, false); continue; }
      const x = e.x + Math.sin(sec * 1.3 + e.sway) * 8;
      const a = Math.max(0, Math.min(1, e.life)) * 0.85;
      ctx.fillStyle = "rgba(" + EMBER + "," + a.toFixed(3) + ")";
      ctx.fillRect(x, e.y, e.size, e.size);
    }

    // Ground fog.
    const fog = ctx.createLinearGradient(0, h * 0.72, 0, h);
    fog.addColorStop(0, "rgba(" + PAPER + ",0)");
    fog.addColorStop(1, "rgba(" + PAPER + ",0.07)");
    ctx.fillStyle = fog;
    for (let k = 0; k < 2; k++) {
      const shift = Math.sin(sec * 0.12 + k * 2) * w * 0.08;
      ctx.beginPath();
      ctx.ellipse(w * (0.3 + k * 0.45) + shift, h * 0.98, w * 0.55, h * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    cobweb();
  }

  function draw(t) {
    const sec = t / 1000;
    const dt = Math.min(0.05, Math.max(0, (t - lastT) / 1000));
    lastT = t;
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

    if (HALLOWEEN) {
      drawHalloween(sec, dt);
      return;
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
