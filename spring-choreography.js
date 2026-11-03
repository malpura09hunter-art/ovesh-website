/* ============================================================
   OV CLOUD — Spring Choreography
   Matched to design tokens: soft cyan, accent blue, mint.
   Sits with the existing orbit-stage, not against it.
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
  const COUNT = Math.min(140, Math.floor((window.innerWidth * window.innerHeight) / 11000));
  const particles = [];
  const mouse = { x: 0, y: 0, active: false };
  let t = 0, last = performance.now();
  let shapePhase = 0;
  let rafId = 0;

  // Soft springs — calm, premium feel
  const STIFF = 22;
  const DAMP  = 10.2;
  const MASS  = 1.2;

  // Design palette from cloud.css
  // cyan #67e8f9, accent #9eafff, green #72e6a1, orbit blue
  const COLORS = [
    [103, 232, 249],  // cyan
    [158, 175, 255],  // accent blue
    [114, 230, 161],  // soft mint
    [120, 145, 255],  // orbit blue
  ];

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width  = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width  = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // Centered on the brand / orbit-stage region (left side of login layout)
  function targetFor(i, phase) {
    const n = COUNT;
    const a = (i / n) * Math.PI * 2 + phase * 0.35;
    const cx = W * 0.36;
    const cy = H * 0.52;
    const R  = Math.min(W, H) * 0.24;

    // Primary soft orbit (matches CSS .orbit)
    const ringX = cx + Math.cos(a) * R;
    const ringY = cy + Math.sin(a) * R * 0.62;

    // Inner tilted orbit
    const a2 = a * 1.15 + 0.8;
    const innerX = cx + Math.cos(a2) * R * 0.55;
    const innerY = cy + Math.sin(a2) * R * 0.38;

    // Outer gentle ellipse
    const a3 = a * 0.9 - 0.4;
    const outerX = cx + Math.cos(a3) * R * 1.15;
    const outerY = cy + Math.sin(a3) * R * 0.78;

    const p = phase % 1;
    let x, y;
    if (p < 0.33) {
      const k = p / 0.33;
      x = ringX + (innerX - ringX) * k;
      y = ringY + (innerY - ringY) * k;
    } else if (p < 0.66) {
      const k = (p - 0.33) / 0.33;
      x = innerX + (outerX - innerX) * k;
      y = innerY + (outerY - innerY) * k;
    } else {
      const k = (p - 0.66) / 0.34;
      x = outerX + (ringX - outerX) * k;
      y = outerY + (ringY - outerY) * k;
    }
    return { x, y };
  }

  function init() {
    particles.length = 0;
    for (let i = 0; i < COUNT; i++) {
      const tgt = targetFor(i, 0);
      particles.push({
        x: tgt.x + (Math.random() - 0.5) * 30,
        y: tgt.y + (Math.random() - 0.5) * 30,
        vx: 0, vy: 0,
        tx: tgt.x, ty: tgt.y,
        size: 0.9 + Math.random() * 1.4,
        color: COLORS[i % COLORS.length],
        alpha: 0.28 + Math.random() * 0.35
      });
    }
  }

  function step(dt) {
    t += dt;
    shapePhase = (t * 0.032) % 1; // slower morph — calmer

    for (let i = 0; i < COUNT; i++) {
      const p = particles[i];
      const tgt = targetFor(i, shapePhase);
      p.tx = tgt.x;
      p.ty = tgt.y;

      const dx = p.tx - p.x;
      const dy = p.ty - p.y;
      const ax = (STIFF * dx - DAMP * p.vx) / MASS;
      const ay = (STIFF * dy - DAMP * p.vy) / MASS;
      p.vx += ax * dt;
      p.vy += ay * dt;

      // Very soft pointer influence
      if (mouse.active) {
        const mx = mouse.x - p.x;
        const my = mouse.y - p.y;
        const dist2 = mx * mx + my * my;
        if (dist2 < 180 * 180) {
          const dist = Math.sqrt(dist2) || 1;
          const force = (1 - dist / 180) * 22;
          p.vx += (mx / dist) * force * dt;
          p.vy += (my / dist) * force * dt;
        }
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  function draw() {
    // Light fade matching page bg #05070d
    ctx.fillStyle = 'rgba(5, 7, 13, 0.28)';
    ctx.fillRect(0, 0, W, H);

    for (let i = 0; i < COUNT; i++) {
      const p = particles[i];
      const [r, g, b] = p.color;
      const speed = Math.abs(p.vx) + Math.abs(p.vy);
      const a = Math.min(0.75, p.alpha + speed * 0.015);

      // Soft core
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r},${g},${b},${a})`;
      ctx.fill();

      // Tiny outer glow (cheap, no gradient)
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 2.2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r},${g},${b},${a * 0.12})`;
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
    for (let i = 0; i < COUNT; i++) {
      const p = particles[i];
      const dx = p.x - e.clientX;
      const dy = p.y - e.clientY;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      if (d < 200) {
        const f = (1 - d / 200) * 90;
        p.vx += (dx / d) * f * 0.012;
        p.vy += (dy / d) * f * 0.012;
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

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(rafId);
    } else {
      last = performance.now();
      rafId = requestAnimationFrame(loop);
    }
  });
})();
