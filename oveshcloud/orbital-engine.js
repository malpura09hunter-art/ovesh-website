/**
 * OVESH MALPURA CYBER LABS — SIGNATURE 3D "O" & ORBITAL ENGINE
 * Preview integration for OV CLOUD. No authentication or application logic.
 * Three.js global build is loaded immediately before this file.
 */
(function () {
  'use strict';

  if (window.__OV_ORBITAL_ENGINE__) return;
  window.__OV_ORBITAL_ENGINE__ = true;

  const container = document.getElementById('orbital-canvas-container');
  if (!container) return;

  const reducedMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarsePointer = window.matchMedia &&
    window.matchMedia('(pointer: coarse)').matches;
  const lowPower = coarsePointer || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
  const listeners = [];
  let cleanup = function () {};
  let destroyed = false;

  function listen(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    listeners.push(function () { target.removeEventListener(type, handler, options); });
  }

  function webGLAvailable() {
    try {
      const canvas = document.createElement('canvas');
      return !!(window.WebGLRenderingContext &&
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
    } catch (_) {
      return false;
    }
  }

  function initFallback() {
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'display:block;width:100%;height:100%';
    container.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 1, height = 1, angle = 0, raf = 0;
    const resize = function () {
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const draw = function () {
      if (destroyed) return;
      ctx.clearRect(0, 0, width, height);
      const cx = width / 2, cy = height / 2;
      const radius = Math.min(width, height) * 0.22;
      const glow = ctx.createRadialGradient(cx, cy, 8, cx, cy, radius * 1.9);
      glow.addColorStop(0, 'rgba(0,240,255,.22)');
      glow.addColorStop(.52, 'rgba(0,255,136,.08)');
      glow.addColorStop(1, 'rgba(2,5,8,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(cx, cy, radius * 1.9, 0, Math.PI * 2); ctx.fill();

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle * .4);
      ctx.beginPath();
      ctx.ellipse(0, 0, radius * 1.48, radius * .76, Math.PI / 4, 0, Math.PI * 2);
      ctx.setLineDash([8, 12]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(0,240,255,.42)';
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle * .6);
      ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.lineWidth = radius * .43;
      const ring = ctx.createLinearGradient(-radius, -radius, radius, radius);
      ring.addColorStop(0, '#00f0ff');
      ring.addColorStop(.5, '#07151e');
      ring.addColorStop(1, '#00ff88');
      ctx.strokeStyle = ring;
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 30;
      ctx.stroke();
      ctx.restore();

      if (!reducedMotion) angle += .009;
      raf = window.requestAnimationFrame(draw);
    };
    resize();
    listen(window, 'resize', resize, { passive: true });
    draw();
    cleanup = function () { window.cancelAnimationFrame(raf); };
  }

  if (!window.THREE || !webGLAvailable()) {
    initFallback();
    return;
  }

  function initThree() {
    const THREE = window.THREE;
    let width = Math.max(1, container.clientWidth || window.innerWidth);
    let height = Math.max(1, container.clientHeight || window.innerHeight);
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x020508, 0.028);

    const camera = new THREE.PerspectiveCamera(42, width / height, .1, 1000);
    camera.position.set(0, 0, 15);

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !lowPower,
        alpha: true,
        powerPreference: lowPower ? 'default' : 'high-performance'
      });
    } catch (_) {
      initFallback();
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1.35 : 1.8));
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    renderer.outputColorSpace = THREE.SRGBColorSpace || renderer.outputColorSpace;
    renderer.domElement.setAttribute('aria-hidden', 'true');
    renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;';
    container.appendChild(renderer.domElement);

    const masterGroup = new THREE.Group();
    scene.add(masterGroup);

    scene.add(new THREE.AmbientLight(0x081520, 1.8));
    const cyanLight = new THREE.PointLight(0x00f0ff, 5.2, 45);
    cyanLight.position.set(-8, 5, 10); scene.add(cyanLight);
    const emeraldLight = new THREE.PointLight(0x00ff88, 4.5, 40);
    emeraldLight.position.set(8, -5, 8); scene.add(emeraldLight);
    const violetLight = new THREE.PointLight(0xa855f7, 3.8, 45);
    violetLight.position.set(0, 9, -8); scene.add(violetLight);
    const glintLight = new THREE.PointLight(0xffffff, 3, 25);
    glintLight.position.set(0, 0, 12); scene.add(glintLight);
    const directional = new THREE.DirectionalLight(0xdff9ff, 1.6);
    directional.position.set(4, 10, 12); scene.add(directional);

    const letterO = new THREE.Group();
    masterGroup.add(letterO);

    const mainTorus = new THREE.Mesh(
      new THREE.TorusGeometry(3.3, .98, lowPower ? 32 : 64, lowPower ? 96 : 160),
      new THREE.MeshPhysicalMaterial({
        color: 0x05131d, emissive: 0x01131c, emissiveIntensity: .5,
        metalness: .94, roughness: .12, clearcoat: 1, clearcoatRoughness: .08,
        reflectivity: 1
      })
    );
    letterO.add(mainTorus);

    const wireTorus = new THREE.Mesh(
      new THREE.TorusGeometry(3.32, .99, 20, 80),
      new THREE.MeshBasicMaterial({
        color: 0x00f0ff, wireframe: true, transparent: true, opacity: .13
      })
    );
    letterO.add(wireTorus);

    const gyro1 = new THREE.Mesh(
      new THREE.TorusGeometry(2.18, .06, 12, 96),
      new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: .85 })
    );
    letterO.add(gyro1);

    const gyro2 = new THREE.Mesh(
      new THREE.TorusGeometry(1.85, .04, 12, 80),
      new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: .7 })
    );
    gyro2.rotation.x = Math.PI / 2;
    letterO.add(gyro2);

    const crystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(.85, 0),
      new THREE.MeshPhysicalMaterial({
        color: 0x00ffcc, emissive: 0x00f0ff, emissiveIntensity: .8,
        metalness: .8, roughness: .1, wireframe: true
      })
    );
    letterO.add(crystal);

    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(4.55, .025, 12, 128),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: .45 })
    );
    letterO.add(halo);

    const orbits = new THREE.Group();
    masterGroup.add(orbits);

    function makeOrbit(radius, color, dash, gap, rotation) {
      const pts = [];
      const segments = lowPower ? 100 : 160;
      for (let i = 0; i <= segments; i++) {
        const a = i / segments * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
      }
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineDashedMaterial({
          color: color, dashSize: dash, gapSize: gap, transparent: true, opacity: .4
        })
      );
      line.computeLineDistances();
      line.rotation.set(rotation[0], rotation[1], rotation[2]);
      orbits.add(line);
      return line;
    }

    const orbit1 = makeOrbit(6, 0x00f0ff, .28, .16, [Math.PI / 4.8, Math.PI / 5.5, 0]);
    const orbit2 = makeOrbit(7.8, 0x00ff88, .35, .22, [-Math.PI / 3.6, 0, Math.PI / 4.5]);
    const orbit3 = makeOrbit(9.6, 0xa855f7, .42, .28, [Math.PI / 6, Math.PI / 3, 0]);

    const nodeData = [
      { title: 'Offensive Security', subtitle: 'Penetration Testing & Vulnerability Assessment', radius: 6, speed: .007, angle: .2, color: 0x00f0ff, orbit: orbit1 },
      { title: 'Secure Web Architecture', subtitle: 'High-Performance Hardened Web Platforms', radius: 6, speed: .007, angle: .2 + Math.PI, color: 0x00ff88, orbit: orbit1 },
      { title: 'AI Automation', subtitle: 'Intelligent Workflows & Autonomous LLMs', radius: 7.8, speed: .0055, angle: 1.1, color: 0x38bdf8, orbit: orbit2 },
      { title: 'OSINT & Threat Intel', subtitle: 'Footprint Mapping & Due Diligence Recon', radius: 7.8, speed: .0055, angle: 1.1 + Math.PI, color: 0xa855f7, orbit: orbit2 },
      { title: 'Cloud & API Defense', subtitle: 'Zero-Trust IAM Hardening & Audits', radius: 9.6, speed: .0038, angle: 2.2, color: 0x10b981, orbit: orbit3 }
    ];

    const nodeMeshes = nodeData.map(function (d) {
      const group = new THREE.Group();
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(.26, 20, 20),
        new THREE.MeshStandardMaterial({
          color: d.color, emissive: d.color, emissiveIntensity: .9,
          metalness: .85, roughness: .15
        })
      );
      group.add(sphere);
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(.36, .42, 32),
        new THREE.MeshBasicMaterial({
          color: d.color, side: THREE.DoubleSide, transparent: true, opacity: .75
        })
      );
      group.add(ring);
      scene.add(group);
      return { data: d, group: group, sphere: sphere, ring: ring };
    });

    const particleCount = lowPower ? 650 : 1600;
    const particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const cyan = new THREE.Color(0x00f0ff);
    const green = new THREE.Color(0x00ff88);
    const violet = new THREE.Color(0xa855f7);
    for (let i = 0; i < particleCount * 3; i += 3) {
      positions[i] = (Math.random() - .5) * 50;
      positions[i + 1] = (Math.random() - .5) * 40;
      positions[i + 2] = (Math.random() - .5) * 45;
      const pick = Math.random();
      const color = pick < .45 ? cyan : pick < .8 ? green : violet;
      colors[i] = color.r; colors[i + 1] = color.g; colors[i + 2] = color.b;
    }
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const starfield = new THREE.Points(
      particleGeometry,
      new THREE.PointsMaterial({
        size: .058, vertexColors: true, transparent: true, opacity: .7,
        blending: THREE.AdditiveBlending, depthWrite: false
      })
    );
    scene.add(starfield);

    const state = {
      mouseX: 0, mouseY: 0, targetRotX: 0, targetRotY: 0,
      scrollProgress: 0, brandRevealProgress: 0, autoRotate: !reducedMotion, time: 0
    };

    function onPointerMove(event) {
      const halfW = Math.max(window.innerWidth / 2, 1);
      const halfH = Math.max(window.innerHeight / 2, 1);
      state.mouseX = (event.clientX - halfW) / halfW;
      state.mouseY = (event.clientY - halfH) / halfH;
      state.targetRotY = state.mouseX * .42;
      state.targetRotX = state.mouseY * .32;
      glintLight.position.x = state.mouseX * 10;
      glintLight.position.y = -state.mouseY * 8;
    }
    if (!coarsePointer) listen(window, 'mousemove', onPointerMove, { passive: true });

    let touchX = 0, touchY = 0;
    listen(container, 'touchstart', function (event) {
      if (event.touches.length) {
        touchX = event.touches[0].clientX;
        touchY = event.touches[0].clientY;
      }
    }, { passive: true });
    listen(container, 'touchmove', function (event) {
      if (event.touches.length) {
        state.targetRotY = ((event.touches[0].clientX - touchX) / Math.max(window.innerWidth / 2, 1)) * .5;
        state.targetRotX = ((event.touches[0].clientY - touchY) / Math.max(window.innerHeight / 2, 1)) * .38;
      }
    }, { passive: true });

    function updateScroll() {
      const maxScroll = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
      state.scrollProgress = window.scrollY / maxScroll;
    }
    listen(window, 'scroll', updateScroll, { passive: true });
    updateScroll();

    function resize() {
      const rect = container.getBoundingClientRect();
      width = Math.max(1, rect.width || window.innerWidth);
      height = Math.max(1, rect.height || window.innerHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1.35 : 1.8));
      renderer.setSize(width, height);
    }
    listen(window, 'resize', resize, { passive: true });

    const hudName = document.getElementById('hud-node-name');
    const hudDesc = document.getElementById('hud-node-desc');
    const hudStatus = document.getElementById('hud-node-status');
    function updateHud(data) {
      if (hudName) hudName.textContent = data.title;
      if (hudDesc) hudDesc.textContent = data.subtitle;
      if (hudStatus) hudStatus.textContent = 'ONLINE // ORBIT ACTIVE';
    }
    updateHud(nodeData[0]);

    const rotateButton = document.getElementById('toggle-orbital-rotate');
    if (rotateButton) {
      rotateButton.setAttribute('aria-pressed', String(state.autoRotate));
      listen(rotateButton, 'click', function () {
        state.autoRotate = !state.autoRotate;
        rotateButton.classList.toggle('active', state.autoRotate);
        rotateButton.setAttribute('aria-pressed', String(state.autoRotate));
      });
    }

    const resetButton = document.getElementById('reset-orbital-view');
    if (resetButton) {
      listen(resetButton, 'click', function () {
        state.targetRotX = 0;
        state.targetRotY = 0;
        camera.position.set(0, 0, width < 768 ? 21 : 15);
      });
    }

    window.OrbitalRevealController = {
      setBrandRevealProgress: function (progress) {
        state.brandRevealProgress = Math.max(0, Math.min(1, Number(progress) || 0));
      },
      getBrandRevealProgress: function () { return state.brandRevealProgress; },
      centerOnO: function () { state.targetRotX = 0; state.targetRotY = 0; }
    };

    let raf = 0;
    let lastTime = performance.now();
    let visible = true;
    let frameCount = 0;
    let lastRender = 0;
    const targetFrameMs = lowPower ? 1000 / 30 : 1000 / 60;
    const observer = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
      visible = !!(entries[0] && entries[0].isIntersecting);
      if (visible && !document.hidden && !raf) {
        lastTime = performance.now();
        raf = window.requestAnimationFrame(animate);
      }
    }, { threshold: 0 }) : null;
    if (observer) observer.observe(container);

    function animate(now) {
      raf = 0;
      if (destroyed || document.hidden || !visible) return;
      if (now - lastRender < targetFrameMs - 1) {
        raf = window.requestAnimationFrame(animate);
        return;
      }
      const delta = Math.min((now - lastTime) * .001, .05);
      lastTime = now;
      lastRender = now;
      state.time += delta;
      frameCount++;

      if (state.autoRotate && !reducedMotion) {
        letterO.rotation.y += delta * .42;
        letterO.rotation.x = Math.sin(state.time * .45) * .14;
        crystal.rotation.x += delta * 1.4;
        crystal.rotation.y += delta * 1.8;
      }
      gyro1.rotation.z -= delta * .9;
      gyro2.rotation.x += delta * .75;
      halo.rotation.z += delta * .3;

      masterGroup.rotation.y += (state.targetRotY - masterGroup.rotation.y) * .055;
      masterGroup.rotation.x += (state.targetRotX - masterGroup.rotation.x) * .055;

      const reveal = state.brandRevealProgress;
      const scale = 1 - reveal * .28;
      letterO.scale.lerp(new THREE.Vector3(scale, scale, scale), .08);
      letterO.position.y += (-reveal * 1.6 - letterO.position.y) * .08;

      cyanLight.intensity = 5 + Math.sin(state.time * 1.8) * .9;
      emeraldLight.intensity = 4.2 + Math.cos(state.time * 1.4) * .8;

      const mobile = width < 768;
      const baseZ = mobile ? (width < 480 ? 22 : 18.5) : 15;
      const targetZ = baseZ - state.scrollProgress * 5.2 - reveal * 2.5;
      const targetY = -state.scrollProgress * 3.2 + reveal;
      camera.position.z += (targetZ - camera.position.z) * .05;
      camera.position.y += (targetY - camera.position.y) * .05;
      camera.lookAt(0, letterO.position.y * .5, 0);

      orbits.rotation.y += delta * .09;
      nodeMeshes.forEach(function (item, index) {
        const data = item.data;
        if (!reducedMotion) data.angle += data.speed * (delta * 60);
        const position = new THREE.Vector3(
          Math.cos(data.angle) * data.radius, 0, Math.sin(data.angle) * data.radius
        );
        position.applyEuler(data.orbit.rotation);
        position.applyEuler(orbits.rotation);
        position.applyEuler(masterGroup.rotation);
        item.group.position.copy(position);
        item.ring.lookAt(camera.position);
        const pulse = reducedMotion ? 1 : 1 + Math.sin(state.time * 3 + index) * .2;
        item.sphere.scale.setScalar(pulse);
      });
      if (!reducedMotion) {
        starfield.rotation.y += delta * .03;
        starfield.rotation.x += delta * .015;
      }
      renderer.render(scene, camera);
      raf = window.requestAnimationFrame(animate);
    }

    function start() {
      if (!destroyed && visible && !document.hidden && !raf) {
        lastTime = performance.now();
        raf = window.requestAnimationFrame(animate);
      }
    }
    function onVisibility() {
      if (document.hidden) {
        if (raf) window.cancelAnimationFrame(raf);
        raf = 0;
      } else start();
    }
    listen(document, 'visibilitychange', onVisibility);
    start();

    cleanup = function () {
      destroyed = true;
      if (raf) window.cancelAnimationFrame(raf);
      if (observer) observer.disconnect();
      listeners.splice(0).forEach(function (remove) { remove(); });
      scene.traverse(function (object) {
        if (object.geometry && object.geometry.dispose) object.geometry.dispose();
        if (object.material) {
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach(function (material) {
            Object.keys(material).forEach(function (key) {
              const value = material[key];
              if (value && value.isTexture && value.dispose) value.dispose();
            });
            material.dispose();
          });
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
      if (window.OrbitalRevealController) delete window.OrbitalRevealController;
    };
    listen(window, 'pagehide', cleanup, { once: true });
  }

  try {
    initThree();
  } catch (error) {
    if (window.console && console.warn) console.warn('[OV CLOUD orbital] Falling back to 2D renderer.', error);
    container.innerHTML = '';
    initFallback();
  }
})();