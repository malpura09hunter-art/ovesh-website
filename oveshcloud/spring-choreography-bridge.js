(() => {
  'use strict';
  const active = new Map();
  const supportsWebGPU = () => !!(navigator.gpu && window.OvSpringChoreography?.mountSpringChoreography);
  function start(key, canvas, container) {
    if (active.has(key) || !canvas || !container || !supportsWebGPU()) return;
    canvas.hidden = false;
    try {
      const instance = window.OvSpringChoreography.mountSpringChoreography(canvas, container);
      active.set(key, instance);
      container.classList.add('ov-spring-active');
      Promise.resolve(instance.ready).catch((error) => {
        console.warn('[OV CLOUD] Spring Choreography could not initialize:', error);
        stop(key);
        canvas.hidden = true;
      });
    } catch (error) {
      console.warn('[OV CLOUD] Spring Choreography unavailable:', error);
      canvas.hidden = true;
      container.classList.remove('ov-spring-active');
    }
  }
  function stop(key) {
    const instance = active.get(key);
    if (!instance) return;
    active.delete(key);
    const container = key === 'login' ? document.querySelector('.brand-stage') : document.querySelector('.orion-holo-stage');
    container?.classList.remove('ov-spring-active');
    try { instance.dispose(); } catch (error) { console.warn('[OV CLOUD] Spring Choreography cleanup:', error); }
  }
  function syncLogin() {
    const view = document.getElementById('loginView');
    const canvas = document.getElementById('loginSpringCanvas');
    const stage = canvas?.closest('.brand-stage');
    if (!view || !canvas || !stage) return;
    if (!view.classList.contains('hidden')) start('login', canvas, stage);
    else stop('login');
  }
  function syncOrion() {
    const page = document.getElementById('page');
    const stage = page?.querySelector('.orion-holo-stage');
    if (!stage) { stop('orion'); return; }
    let canvas = stage.querySelector('#orionSpringCanvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'orionSpringCanvas';
      canvas.className = 'ov-spring-canvas orion-spring-canvas';
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', 'Spring Choreography: a GPU particle swarm morphing between a wave field, sphere and torus knot. Move the pointer to part the particles and click to create a spring burst.');
      stage.prepend(canvas);
    }
    start('orion', canvas, stage);
  }
  function boot() {
    syncLogin(); syncOrion();
    const login = document.getElementById('loginView');
    if (login) new MutationObserver(syncLogin).observe(login, { attributes: true, attributeFilter: ['class'] });
    const page = document.getElementById('page');
    if (page) new MutationObserver(syncOrion).observe(page, { childList: true, subtree: true });
    window.addEventListener('pagehide', () => { stop('login'); stop('orion'); }, { once: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
