/* ============================================================
   OV CLOUD — Spring Choreography (lightweight, design-matched)
   Soft spring-physics particle field tuned to the existing
   cyan / soft-green login aesthetic. Low particle count.
   ============================================================ */
(function () {
  'use strict';
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const canvas = document.createElement('canvas');
  canvas.id = 'spring-choreography';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:0;pointer-events:none;';
  document.body.insertBefore(canvas, document.body.firstChild);

  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;

  let W = 0, H = 0, dpr = 1;
  // Much lighter particle count for smooth 60fps
  const COUNT = Math.min(160, Math.floor((window.innerWidth * window.innerHeight) / 9000));
  const particles = [];
  const mouse = { x: 0, y: 0, active: false };
  let t = 0, last = performance.now();
  let shapePhase = 0;
  let rafId = 0;

  // Softer spring constants
  const STIFF = 28;
  const DAMP  = 9.5;
  const MASS  = 1.15;

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

  // Target shapes centered near the existing orbit-stage area (left-center)
  function targetFor(i, phase) {
    const n = COUNT;
    const a = (i / n) * Math.PI * 2 + phase * 0.4;
    // Sit the system toward the left brand / orbit area
    const cx = W * 0.38;
    const cy = H * 0.52;
    const R  = Math.min(W, H) * 0.26;

    // Soft ring
    const ringX = cx + Math.cos(a) * R;
    const ringY = cy + Math.sin(a) * R * 0.68;

    // Gentle wave band
    const waveX = cx + ((i % 20) - 9.5) * (R * 0.09);
    const waveY = cy + Math.sin(a * 2.2 + phase * 4) * R * 0.18 + ((Math.floor(i / 20) - 4) * R * 0.05);

    // Soft ellipse / torus suggestion
    const u = a * 1.6;
    const knotX = cx + Math.cos(u) * R * 0.92;
    const knotY = cy + Math.sin(u) * R * 0.55 + Math.sin(u * 2) * R * 0.08;

    const p = phase % 1;
    let x, y;
    if (p < 0.34) {
      const k = p / 0.34;
      x = ringX + (waveX - ringX) * k;
      y = ringY + (waveY - ringY) * k;
    } else if (p < 0.67) {
      const k = (p - 0.34) / 0.33;
      x = waveX + (knotX - waveX) * k;
      y = waveY + (knotY - waveY) * k;
    } else {
      const k = (p - 0.67) / 0.33;
      x = knotX + (ringX - knotX) * k;
      y = knotY + (ringY - knotY) * k;
    }
    return { x, y };
  }

  function init() {
    particles.length = 0;
    for (let i = 0; i < COUNT; i++) {
      const tgt = targetFor(i, 0);
      particles.push({
        x: tgt.x + (Math.random() - 0.5) * 40,
        y: tgt.y + (Math.random() - 0.5) * 40,
        vx: 0, vy: 0,
        tx: tgt.x, ty: tgt.y,
        size: 1.1 + Math.random() * 1.6,
        hue: Math.random() // 0 = cyan-ish, 1 = soft green
      });
    }
  }

  function step(dt) {
    t += dt;
    shapePhase = (t * 0.045) % 1;

    for (let i = 0; i < COUNT; i++) {
      const p = particles[i];
      const tgt = targetFor(i, shapePhase);
      p.tx = tgt.x;
      p.ty = tgt.y;

      // Spring force
      const dx = p.tx - p.x;
      const dy = p.ty - p.y;
      const ax = (STIFF * dx - DAMP * p.vx) / MASS;
      const ay = (STIFF * dy - DAMP * p.vy) / MASS;
      p.vx += ax * dt;
      p.vy += ay * dt;

      // Soft pointer attraction
      if (mouse.active) {
        const mx = mouse.x - p.x;
        const my = mouse.y - p.y;
        const dist2 = mx * mx + my * my;
        if (dist2 < 220 * 220) {
          const dist = Math.sqrt(dist2) || 1;
          const force = (1 - dist / 220) * 38;
          p.vx += (mx / dist) * force * dt;
          p.vy += (my / dist) * force * dt;
        }
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  function draw() {
    // Very light trail (keeps motion smooth without heavy fill)
    ctx.fillStyle = 'rgba(5, 7, 13, 0.22)';
    ctx.fillRect(0, 0, W, H);

    for (let i = 0; i < COUNT; i++) {
      const p = particles[i];
      // Design palette: soft cyan → soft mint green
      const r = Math.floor(90 + p.hue * 30);
      const g = Math.floor(210 + p.hue * 30);
      const b = Math.floor(230 - p.hue * 80);
      const alpha = 0.55 + Math.min(0.35, (Math.abs(p.vx) + Math.abs(p.vy)) * 0.02);

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
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

  function onMove(e) {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouse.active = true;
  }
  function onLeave() { mouse.active = false; }
  function onClick(e) {
    // Gentle burst
    for (let i = 0; i < COUNT; i++) {
      const p = particles[i];
      const dx = p.x - e.clientX;
      const dy = p.y - e.clientY;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      if (d < 260) {
        const f = (1 - d / 260) * 180;
        p.vx += (dx / d) * f * 0.018;
        p.vy += (dy / d) * f * 0.018;
      }
    }
  }

  resize();
  init();
  window.addEventListener('resize', () => { resize(); init(); }, { passive: true });
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerleave', onLeave, { passive: true });
  window.addEventListener('click', onClick, { passive: true });
  rafId = requestAnimationFrame(loop);

  // Pause when tab is hidden (saves battery / lag)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(rafId);
    } else {
      last = performance.now();
      rafId = requestAnimationFrame(loop);
    }
  });
})();
