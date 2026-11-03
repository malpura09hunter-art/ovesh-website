/* ============================================================
   OV CLOUD — Quantum Field Hybrid (strong mouse interaction)
   ============================================================ */
(function () {
  'use strict';
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const canvas = document.createElement('canvas');
  canvas.id = 'spring-choreography';
  canvas.setAttribute('aria-hidden', 'true');
  // pointer-events none so form still works; we listen on window
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:0;pointer-events:none;';
  document.body.insertBefore(canvas, document.body.firstChild);

  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;

  let W = 0, H = 0, dpr = 1;
  const COUNT = Math.min(200, Math.floor((window.innerWidth * window.innerHeight) / 7000));
  const particles = [];
  const mouse = { x: W / 2, y: H / 2, active: false, down: false };
  let t = 0, last = performance.now();
  let shapePhase = 0;
  let rafId = 0;
  const shockwaves = [];

  const STIFF = 18;   // weaker spring so mouse wins easily
  const DAMP  = 7.5;
  const MASS  = 1.0;

  const COLORS = [
    [103, 232, 249],
    [158, 175, 255],
    [114, 230, 161],
    [120, 145, 255],
    [180, 200, 255],
  ];

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width  = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width  = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function targetFor(i, phase) {
    const n = COUNT;
    const a = (i / n) * Math.PI * 2;
    const cx = W * 0.36;
    const cy = H * 0.52;
    const R  = Math.min(W, H) * 0.28;

    const th = a;
    const ph = (i / n) * Math.PI;
    const sphX = cx + Math.sin(ph) * Math.cos(th) * R * 0.9;
    const sphY = cy + Math.cos(ph) * R * 0.55;

    const ringX = cx + Math.cos(a) * R;
    const ringY = cy + Math.sin(a) * R * 0.58;

    const s = Math.sin(a);
    const figX = cx + R * 0.95 * s;
    const figY = cy + R * 0.55 * s * Math.cos(a);

    const spiralR = R * (0.2 + 0.8 * ((i % 36) / 36));
    const spA = a * 2.1 + phase * 5;
    const spiX = cx + Math.cos(spA) * spiralR;
    const spiY = cy + Math.sin(spA) * spiralR * 0.62;

    const p = phase % 1;
    let x, y, k;
    if (p < 0.25) {
      k = p / 0.25;
      x = sphX + (ringX - sphX) * k;
      y = sphY + (ringY - sphY) * k;
    } else if (p < 0.5) {
      k = (p - 0.25) / 0.25;
      x = ringX + (figX - ringX) * k;
      y = ringY + (figY - ringY) * k;
    } else if (p < 0.75) {
      k = (p - 0.5) / 0.25;
      x = figX + (spiX - figX) * k;
      y = figY + (spiY - figY) * k;
    } else {
      k = (p - 0.75) / 0.25;
      x = spiX + (sphX - spiX) * k;
      y = spiY + (sphY - spiY) * k;
    }
    return { x, y };
  }

  function init() {
    particles.length = 0;
    for (let i = 0; i < COUNT; i++) {
      const tgt = targetFor(i, 0);
      particles.push({
        x: tgt.x + (Math.random() - 0.5) * 80,
        y: tgt.y + (Math.random() - 0.5) * 80,
        vx: 0, vy: 0,
        size: 1.2 + Math.random() * 2.0,
        color: COLORS[i % COLORS.length],
        baseAlpha: 0.4 + Math.random() * 0.4,
        wake: 0
      });
    }
  }

  function step(dt) {
    t += dt;
    // Slow morph when idle, faster feel when interacting
    shapePhase = (t * (mouse.active ? 0.055 : 0.032)) % 1;

    for (let s = shockwaves.length - 1; s >= 0; s--) {
      const sw = shockwaves[s];
      sw.r += 520 * dt;
      sw.life -= dt * 1.5;
      if (sw.life <= 0) shockwaves.splice(s, 1);
    }

    for (let i = 0; i < COUNT; i++) {
      const p = particles[i];
      const tgt = targetFor(i, shapePhase);

      // Spring toward morph target (weaker so mouse dominates)
      let dx = tgt.x - p.x;
      let dy = tgt.y - p.y;
      let ax = (STIFF * dx - DAMP * p.vx) / MASS;
      let ay = (STIFF * dy - DAMP * p.vy) / MASS;

      // ===== STRONG FULL-SCREEN MOUSE GRAVITY =====
      if (mouse.active) {
        const mx = mouse.x - p.x;
        const my = mouse.y - p.y;
        const dist = Math.hypot(mx, my) || 1;
        const rad = Math.max(W, H) * 0.55; // large radius
        if (dist < rad) {
          const falloff = 1 - dist / rad;
          const f2 = falloff * falloff;

          // Strong pull toward cursor
          const pull = f2 * 220;
          ax += (mx / dist) * pull;
          ay += (my / dist) * pull;

          // Swirl (perpendicular)
          ax += (-my / dist) * falloff * 55;
          ay += ( mx / dist) * falloff * 55;

          p.wake = Math.min(1, p.wake + f2 * 0.5);
        }
      }

      // Shockwave
      for (let s = 0; s < shockwaves.length; s++) {
        const sw = shockwaves[s];
        const sx = p.x - sw.x;
        const sy = p.y - sw.y;
        const d = Math.hypot(sx, sy) || 1;
        const band = Math.abs(d - sw.r);
        if (band < 70) {
          const force = (1 - band / 70) * sw.life * 480;
          ax += (sx / d) * force;
          ay += (sy / d) * force;
          p.wake = Math.min(1, p.wake + 0.4);
        }
      }

      p.vx += ax * dt;
      p.vy += ay * dt;
      p.vx *= 0.985;
      p.vy *= 0.985;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.wake = Math.max(0, p.wake - dt * 1.4);
    }
  }

  function draw() {
    ctx.fillStyle = 'rgba(5, 7, 13, 0.18)';
    ctx.fillRect(0, 0, W, H);

    for (let s = 0; s < shockwaves.length; s++) {
      const sw = shockwaves[s];
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(103, 232, 249, ${Math.max(0, sw.life * 0.4)})`;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    for (let i = 0; i < COUNT; i++) {
      const p = particles[i];
      const [r, g, b] = p.color;
      const speed = Math.hypot(p.vx, p.vy);
      const a = Math.min(0.95, p.baseAlpha + speed * 0.01 + p.wake * 0.5);
      const sz = p.size * (1 + p.wake * 0.7);

      ctx.beginPath();
      ctx.arc(p.x, p.y, sz, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r},${g},${b},${a})`;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(p.x, p.y, sz * 2.6, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r},${g},${b},${a * 0.14})`;
      ctx.fill();
    }
  }

  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    step(dt);
    draw();
    rafId = requestAnimationFrame(loop);
  }

  // Bulletproof mouse tracking on window
  function updateMouse(e) {
    const pt = e.touches ? e.touches[0] : e;
    if (!pt) return;
    mouse.x = pt.clientX;
    mouse.y = pt.clientY;
    mouse.active = true;
  }
  function clearMouse() {
    mouse.active = false;
  }
  function onDown(e) {
    updateMouse(e);
    const pt = e.touches ? e.touches[0] : e;
    if (!pt) return;
    shockwaves.push({ x: pt.clientX, y: pt.clientY, r: 6, life: 1 });
  }

  resize();
  init();

  window.addEventListener('pointermove', updateMouse, { passive: true });
  window.addEventListener('mousemove', updateMouse, { passive: true });
  window.addEventListener('touchmove', updateMouse, { passive: true });
  window.addEventListener('pointerleave', clearMouse, { passive: true });
  window.addEventListener('pointerdown', onDown, { passive: true });
  window.addEventListener('mousedown', onDown, { passive: true });
  window.addEventListener('touchstart', onDown, { passive: true });
  window.addEventListener('resize', () => { resize(); init(); }, { passive: true });

  rafId = requestAnimationFrame(loop);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancelAnimationFrame(rafId);
    else {
      last = performance.now();
      rafId = requestAnimationFrame(loop);
    }
  });
})();
