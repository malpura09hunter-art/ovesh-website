(() => {
  'use strict';

  const active = new Map();
  const state = window.__OV_SPRING_STATUS = {
    bundle: 'waiting',
    webgpu: !!navigator.gpu,
    login: 'waiting',
    orion: 'waiting',
    errors: {}
  };
  const getApi = () => {
    const api = window.OvSpringChoreography;
    return api && typeof api.mountSpringChoreography === 'function' ? api : null;
  };

  function setStatus(key, value, error) {
    state[key] = value;
    if (error) {
      state.errors[key] = String(error && (error.stack || error.message) || error);
      console.error('[OV CLOUD] Spring Choreography ' + key + ':', error);
    } else {
      delete state.errors[key];
    }
  }

  async function start(key, canvas, container) {
    if (active.has(key) || !canvas || !container) return;
    const api = getApi();
    if (!api) {
      setStatus('bundle', 'missing', 'Renderer bundle did not expose mountSpringChoreography');
      return;
    }
    if (!navigator.gpu) {
      setStatus(key, 'webgpu-unavailable', 'This page cannot access navigator.gpu');
      return;
    }

    canvas.hidden = false;
    setStatus(key, 'initializing');
    try {
      const instance = api.mountSpringChoreography(canvas, container);
      active.set(key, { instance, canvas, container });
      await Promise.resolve(instance.ready);
      if (active.get(key)?.instance !== instance) return;
      container.classList.add('ov-spring-active');
      setStatus(key, 'running');
    } catch (error) {
      const current = active.get(key);
      if (current?.instance) {
        try { current.instance.dispose(); } catch (_) {}
      }
      active.delete(key);
      canvas.hidden = true;
      container.classList.remove('ov-spring-active');
      setStatus(key, 'failed', error);
    }
  }

  function stop(key) {
    const current = active.get(key);
    if (!current) return;
    active.delete(key);
    current.container.classList.remove('ov-spring-active');
    try { current.instance.dispose(); } catch (error) {
      console.warn('[OV CLOUD] Spring Choreography cleanup:', error);
    }
    current.canvas.hidden = true;
    setStatus(key, 'stopped');
  }

  function syncLogin() {
    const view = document.getElementById('loginView');
    const canvas = document.getElementById('loginSpringCanvas');
    const stage = canvas?.closest('.brand-stage');
    if (!view || !canvas || !stage) return;
    if (!view.classList.contains('hidden')) {
      if (!active.has('login') && state.login !== 'initializing' && state.login !== 'running') {
        requestAnimationFrame(() => start('login', canvas, stage));
      }
    } else {
      stop('login');
    }
  }

  function syncOrion() {
    const page = document.getElementById('page');
    const stage = page?.querySelector('.orion-holo-stage');
    if (!stage) {
      stop('orion');
      return;
    }
    let canvas = stage.querySelector('#orionSpringCanvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'orionSpringCanvas';
      canvas.className = 'ov-spring-canvas orion-spring-canvas';
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', 'Spring Choreography particle animation. Move the pointer to part the particles and click to create a spring burst.');
      stage.prepend(canvas);
    }
    if (!active.has('orion') && state.orion !== 'initializing' && state.orion !== 'running') {
      requestAnimationFrame(() => start('orion', canvas, stage));
    }
  }

  function boot() {
    state.bundle = getApi() ? 'loaded' : 'missing';
    syncLogin();
    syncOrion();

    const login = document.getElementById('loginView');
    if (login) new MutationObserver(syncLogin).observe(login, {
      attributes: true,
      attributeFilter: ['class']
    });

    const page = document.getElementById('page');
    if (page) new MutationObserver(syncOrion).observe(page, {
      childList: true,
      subtree: true
    });

    window.addEventListener('pagehide', () => {
      stop('login');
      stop('orion');
    }, { once: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
  window.addEventListener('load', () => {
    if (!getApi()) setStatus('bundle', 'missing', 'Spring Choreography bundle is not available on this page');
    syncLogin();
    syncOrion();
  }, { once: true });
})();