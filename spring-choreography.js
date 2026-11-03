/* ============================================================
   OV CLOUD — Quantum Field + Hybrid Spring Choreography
   Morphing particle field with real spring physics,
   gravity-well mouse interaction, wake trails & click shockwave.
   Design-matched: cyan / accent blue / mint.
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
  const COUNT = Math.min(220, Math.floor((window.innerWidth * window.innerHeight) / 6500));
  const particles = [];
  const mouse = { x: -9999, y: -9999, active: false, vx: 0, vy: 0, px: 0, py: 0 };
  let t = 0, last = performance.now();
  let shapePhase = 0;
  let rafId = 0;
  let shockwaves = []; // {x,y,r,life}

  // Responsive springs
  const STIFF = 36;
  const DAMP  = 9.0;
  const MASS  = 1.0;

  // Design colors
  const COLORS = [
    [103, 232, 249],  // cyan
    [158, 175, 255],  // accent
    [114, 230, 161],  // mint
    [120, 145, 255],  // orbit blue
    [180, 200, 255],  // soft white-blue
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

  // Quantum morph targets: sphere → ring → figure-8 → spiral → sphere
  function targetFor(i, phase) {
    const n = COUNT;
    const a = (i / n) * Math.PI * 2;
    const cx = W * 0.36;
    const cy = H * 0.52;
    const R  = Math.min(W, H) * 0.27;

    // Sphere / cloud
    const th = a;
    const ph = (i / n) * Math.PI;
    const sphX = cx + Math.sin(ph) * Math.cos(th) * R * 0.85;
    const sphY = cy + Math.cos(ph) * R * 0.55;

    // Ring
    const ringX = cx + Math.cos(a) * R;
    const ringY = cy + Math.sin(a) * R * 0.58;

    // Figure-8 (lemniscate)
    const s = Math.sin(a);
    const figX = cx + R * 0.95 * s;
    const figY = cy + R * 0.55 * s * Math.cos(a);

    // Spiral arm
    const spiralR = R * (0.25 + 0.75 * ((i % 40) / 40));
    const spA = a * 2.2 + phase * 4;
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
        x: tgt.x + (Math.random() - 0.5) * 60,
        y: tgt.y + (Math.random() - 0.5) * 60,
        vx: 0, vy: 0,
        tx: tgt.x, ty: tgt.y,
        size: 1.0 + Math.random() * 1.8,
        color: COLORS[i % COLORS.length],
        baseAlpha: 0.35 + Math.random() * 0.4,
        wake: 0
      });
    }
  }

  function step(dt) {
    t += dt;
    shapePhase = (t * 0.038) % 1;

    // Mouse velocity for wake strength
    if (mouse.active) {
      mouse.vx = mouse.x - mouse.px;
      mouse.vy = mouse.y - mouse.py;
      mouse.px = mouse.x;
      mouse.py = mouse.y;
    }

    // Update shockwaves
    for (let s = shockwaves.length - 1; s >= 0; s--) {
      const sw = shockwaves[s];
      sw.r += 380 * dt;
      sw.life -= dt * 1.4;
      if (sw.life <= 0) shockwaves.splice(s, 1);
    }

    for (let i = 0; i < COUNT; i++) {
      const p = particles[i];
      const tgt = targetFor(i, shapePhase);
      p.tx = tgt.x;
      p.ty = tgt.y;

      // Spring toward morph target
      let dx = p.tx - p.x;
      let dy = p.ty - p.y;
      let ax = (STIFF * dx - DAMP * p.vx) / MASS;
      let ay = (STIFF * dy - DAMP * p.vy) / MASS;

      // === MOUSE GRAVITY WELL (strong & responsive) ===
      if (mouse.active) {
        const mx = mouse.x - p.x;
        const my = mouse.y - p.y;
        const dist2 = mx * mx + my * my;
        const rad = 240;
        if (dist2 < rad * rad) {
          const dist = Math.sqrt(dist2) || 1;
          const falloff = 1 - dist / rad;
          // Attract toward cursor (gravity well)
          const pull = falloff * falloff * 95;
          ax += (mx / dist) * pull;
          ay += (my / dist) * pull;
          // Add tangential swirl for organic feel
          ax += (-my / dist) * falloff * 28;
          ay += ( mx / dist) * falloff * 28;
          // Wake from mouse velocity
          const speed = Math.hypot(mouse.vx, mouse.vy);
          if (speed > 2) {
            p.wake = Math.min(1, p.wake + falloff * 0.35);
            ax += mouse.vx * falloff * 1.8;
            ay += mouse.vy * falloff * 1.8;
          }
        }
      }

      // Shockwave impulse
      for (let s = 0; s < shockwaves.length; s++) {
        const sw = shockwaves[s];
        const sx = p.x - sw.x;
        const sy = p.y - sw.y;
        const d = Math.hypot(sx, sy) || 1;
        const band = Math.abs(d - sw.r);
        if (band < 55) {
          const force = (1 - band / 55) * sw.life * 320;
          ax += (sx / d) * force;
          ay += (sy / d) * force;
        }
      }

      p.vx += ax * dt;
      p.vy += ay * dt;

      // Soft velocity damping so it never explodes
      p.vx *= 0.992;
      p.vy *= 0.992;

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Wake decay
      p.wake = Math.max(0, p.wake - dt * 1.6);
    }
  }

  function draw() {
    // Fade trail matched to bg
    ctx.fillStyle = 'rgba(5, 7, 13, 0.20)';
    ctx.fillRect(0, 0, W, H);

    // Draw shockwave rings
    for (let s = 0; s < shockwaves.length; s++) {
      const sw = shockwaves[s];
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(103, 232, 249, ${sw.life * 0.35})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    for (let i = 0; i < COUNT; i++) {
      const p = particles[i];
      const [r, g, b] = p.color;
      const speed = Math.hypot(p.vx, p.vy);
      const a = Math.min(0.9, p.baseAlpha + speed * 0.012 + p.wake * 0.45);

      // Core
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1 + p.wake * 0.6), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r},${g},${b},${a})`;
      ctx.fill();

      // Soft glow halo
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 2.8, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r},${g},${b},${a * 0.15})`;
      ctx.fill();
    }
  }

  function loop(now) {
    const dt = Math.min(0.032, (now - last) / 1000);
    last = now;
    step(dt);
    draw();
    rafId = requestAnimationFrame(loop);
  }

  function onMove(e) {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    if (!mouse.active) {
      mouse.px = mouse.x;
      mouse.py = mouse.y;
    }
    mouse.active = true;
  }
  function onLeave() {
    mouse.active = false;
    mouse.x = -9999;
    mouse.y = -9999;
  }
  function onClick(e) {
    // Launch shockwave
    shockwaves.push({ x: e.clientX, y: e.clientY, r: 8, life: 1 });
    // Extra local kick
    for (let i = 0; i < COUNT; i++) {
      const p = particles[i];
      const dx = p.x - e.clientX;
      const dy = p.y - e.clientY;
      const d = Math.hypot(dx, dy) || 1;
      if (d < 280) {
        const f = (1 - d / 280) * 220;
        p.vx += (dx / d) * f * 0.025;
        p.vy += (dy / d) * f * 0.025;
        p.wake = Math.min(1, p.wake + 0.5);
      }
    }
  }

  resize();
  init();
  window.addEventListener('resize', () => { resize(); init(); }, { passive: true });
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerleave', onLeave, { passive: true });
  window.addEventListener('pointerdown', onClick, { passive: true });
  rafId = requestAnimationFrame(loop);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancelAnimationFrame(rafId);
    else {
      last = performance.now();
      rafId = requestAnimationFrame(loop);
    }
  });
})();
