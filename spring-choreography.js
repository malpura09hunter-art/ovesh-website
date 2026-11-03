/* ============================================================
   OV CLOUD — Spring Choreography (self-contained Canvas 2D)
   Premium spring-physics particle field for the login gateway.
   Does not touch Firebase, auth, or any existing logic.
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
  const COUNT = Math.min(420, Math.floor((window.innerWidth * window.innerHeight) / 2800));
  const particles = [];
  const mouse = { x: 0, y: 0, active: false, burst: 0 };
  let t = 0, last = performance.now();
  let shapePhase = 0;

  const STIFF = 48;
  const DAMP  = 11.5;
  const MASS  = 1.0;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
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
    const cx = W * 0.5;
    const cy = H * 0.48;
    const R  = Math.min(W, H) * 0.28;

    const ringX = cx + Math.cos(a) * R;
    const ringY = cy + Math.sin(a) * R * 0.72;

    const waveX = cx + ((i % 28) - 13.5) * (R * 0.085);
    const waveY = cy + Math.sin(a * 3 + phase * 6) * R * 0.22 + ((Math.floor(i / 28) - 7) * R * 0.055);

    const u = a * 2;
    const knotX = cx + (Math.cos(u) * (1 + 0.45 * Math.cos(1.5 * u))) * R * 0.85;
    const knotY = cy + (Math.sin(u) * (1 + 0.45 * Math.cos(1.5 * u))) * R * 0.55;

    const p = (phase % 1);
    let x, y;
    if (p < 0.33) {
      const k = p / 0.33;
      x = ringX + (waveX - ringX) * k;
      y = ringY + (waveY - ringY) * k;
    } else if (p < 0.66) {
      const k = (p - 0.33) / 0.33;
      x = waveX + (knotX - waveX) * k;
      y = waveY + (knotY - waveY) * k;
    } else {
      const k = (p - 0.66) / 0.34;
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
        hue: 120 + Math.random() * 40,
        alpha: 0.35 + Math.random() * 0.55
      });
    }
  }

  function springStep(p, dt) {
    const dx = p.tx - p.x;
    const dy = p.ty - p.y;
    const ax = (STIFF * dx - DAMP * p.vx) / MASS;
    const ay = (STIFF * dy - DAMP * p.vy) / MASS;
    p.vx += ax * dt;
    p.vy += ay * dt;

    if (mouse.active) {
      const mx = p.x - mouse.x;
      const my = p.y - mouse.y;
      const d2 = mx * mx + my * my;
      const rad = 110;
      if (d2 < rad * rad && d2 > 1) {
        const d = Math.sqrt(d2);
        const f = (1 - d / rad) * 420;
        p.vx += (mx / d) * f * dt;
        p.vy += (my / d) * f * dt;
      }
    }

    if (mouse.burst > 0) {
      const mx = p.x - mouse.x;
      const my = p.y - mouse.y;
      const d2 = mx * mx + my * my;
      if (d2 < 220 * 220 && d2 > 1) {
        const d = Math.sqrt(d2);
        const f = mouse.burst * (1 - d / 220) * 18;
        p.vx += (mx / d) * f;
        p.vy += (my / d) * f;
      }
    }

    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }

  function frame(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    t += dt;
    shapePhase = (t * 0.045) % 1;

    for (let i = 0; i < COUNT; i++) {
      const tgt = targetFor(i, shapePhase);
      particles[i].tx = tgt.x;
      particles[i].ty = tgt.y;
      springStep(particles[i], dt);
    }
    if (mouse.burst > 0) mouse.burst = Math.max(0, mouse.burst - dt * 2.8);

    ctx.fillStyle = 'rgba(2, 6, 4, 0.18)';
    ctx.fillRect(0, 0, W, H);

    for (let i = 0; i < COUNT; i++) {
      const p = particles[i];
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3.5);
      g.addColorStop(0, `hsla(${p.hue}, 95%, 62%, ${p.alpha})`);
      g.addColorStop(0.45, `hsla(${p.hue}, 90%, 45%, ${p.alpha * 0.35})`);
      g.addColorStop(1, 'hsla(140, 80%, 30%, 0)');
      ctx.beginPath();
      ctx.fillStyle = g;
      ctx.arc(p.x, p.y, p.size * 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = 'rgba(57, 255, 20, 0.035)';
    ctx.lineWidth = 0.6;
    for (let i = 0; i < COUNT; i += 3) {
      const a = particles[i];
      for (let j = i + 1; j < Math.min(i + 8, COUNT); j++) {
        const b = particles[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        if (dx * dx + dy * dy < 3600) {
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    requestAnimationFrame(frame);
  }

  function onMove(e) {
    const pt = e.touches ? e.touches[0] : e;
    mouse.x = pt.clientX;
    mouse.y = pt.clientY;
    mouse.active = true;
  }
  function onLeave() { mouse.active = false; }
  function onDown(e) {
    onMove(e);
    mouse.burst = 1.0;
  }

  window.addEventListener('resize', () => { resize(); init(); }, { passive: true });
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerleave', onLeave, { passive: true });
  window.addEventListener('pointerdown', onDown, { passive: true });

  resize();
  init();
  ctx.fillStyle = '#020604';
  ctx.fillRect(0, 0, W, H);
  requestAnimationFrame(frame);
})();
