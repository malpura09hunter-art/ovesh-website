(() => {
  'use strict';

  const active = new Map();
  const attempts = { login: 0, orion: 0 };
  const retryTimers = new Map();
  const MAX_ATTEMPTS = 5;
  const state = window.__OV_SPRING_STATUS = {
    bundle: 'waiting', webgpu: !!navigator.gpu,
    login: 'waiting', orion: 'waiting', errors: {}
  };

  const getApi = () => {
    const api = window.OvSpringChoreography;
    return api && typeof api.mountSpringChoreography === 'function' ? api : null;
  };

  function stageFor(key) {
    return key === 'login'
      ? document.querySelector('#loginSpringCanvas')?.closest('.brand-stage')
      : document.querySelector('#orionSpringCanvas')?.closest('.orion-holo-stage');
  }

  function report(key, status, error) {
    state[key] = status;
    const stage = stageFor(key);
    if (error) {
      const message = String(error?.message || error || 'Unknown renderer error');
      state.errors[key] = message;
      console.error('[OV CLOUD] Spring Choreography ' + key + ':', error);
      if (stage) {
        let note = stage.querySelector('.ov-spring-diagnostic');
        if (!note) {
          note = document.createElement('div');
          note.className = 'ov-spring-diagnostic';
          note.setAttribute('role', 'status');
          stage.appendChild(note);
        }
        note.textContent = 'SPRING RENDERER: ' + message.slice(0, 180);
      }
    } else {
      delete state.errors[key];
      stage?.querySelector('.ov-spring-diagnostic')?.remove();
    }
  }

  function queueRetry(key, canvas, container) {
    if (retryTimers.has(key) || attempts[key] >= MAX_ATTEMPTS) return;
    const delay = Math.min(500 * (2 ** attempts[key]), 5000);
    attempts[key] += 1;
    const timer = window.setTimeout(() => {
      retryTimers.delete(key);
      if (!canvas.isConnected || !container.isConnected) return;
      if (key === 'login') {
        const view = document.getElementById('loginView');
        if (!view || view.classList.contains('hidden')) return;
      }
      start(key, canvas, container);
    }, delay);
    retryTimers.set(key, timer);
  }

  async function start(key, canvas, container) {
    if (active.has(key) || !canvas || !container) return;
    const api = getApi();
    if (!api) {
      state.bundle = 'missing';
      report(key, 'waiting-for-bundle', 'Spring Choreography bundle export is unavailable');
      queueRetry(key, canvas, container);
      return;
    }
    state.bundle = 'loaded';
    if (!navigator.gpu) {
      report(key, 'webgpu-unavailable', 'This browser page does not expose the WebGPU API');
      queueRetry(key, canvas, container);
      return;
    }

    canvas.hidden = false;
    canvas.style.display = 'block';
    report(key, 'initializing');
    try {
      const instance = api.mountSpringChoreography(canvas, container);
      if (!instance || !('ready' in instance) || typeof instance.dispose !== 'function') {
        throw new Error('Renderer returned an invalid instance');
      }
      active.set(key, { instance, canvas, container });
      await Promise.resolve(instance.ready);
      if (active.get(key)?.instance !== instance) return;
      container.classList.add('ov-spring-active');
      attempts[key] = 0;
      report(key, 'running');
    } catch (error) {
      const current = active.get(key);
      try { current?.instance?.dispose(); } catch (_) {}
      active.delete(key);
      canvas.hidden = true;
      container.classList.remove('ov-spring-active');
      report(key, 'failed', error);
      queueRetry(key, canvas, container);
    }
  }

  function stop(key) {
    const timer = retryTimers.get(key);
    if (timer) window.clearTimeout(timer);
    retryTimers.delete(key);
    const current = active.get(key);
    if (!current) return;
    active.delete(key);
    current.container.classList.remove('ov-spring-active');
    try { current.instance.dispose(); } catch (error) {
      console.warn('[OV CLOUD] Spring Choreography cleanup:', error);
    }
    current.canvas.hidden = true;
    report(key, 'stopped');
  }

  function syncLogin() {
    const view = document.getElementById('loginView');
    const canvas = document.getElementById('loginSpringCanvas');
    const stage = canvas?.closest('.brand-stage');
    if (!view || !canvas || !stage) return;
    if (!view.classList.contains('hidden')) {
      if (!active.has('login') && !retryTimers.has('login') && state.login !== 'initializing') {
        start('login', canvas, stage);
      }
    } else {
      stop('login');
    }
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
      canvas.setAttribute('aria-label', 'Spring Choreography particle animation. Move the pointer to part the particles and click to create a spring burst.');
      stage.prepend(canvas);
    }
    if (!active.has('orion') && !retryTimers.has('orion') && state.orion !== 'initializing') {
      start('orion', canvas, stage);
    }
  }

  function boot() {
    state.bundle = getApi() ? 'loaded' : 'missing';
    syncLogin();
    syncOrion();
    const login = document.getElementById('loginView');
    if (login) new MutationObserver(syncLogin).observe(login, { attributes: true, attributeFilter: ['class'] });
    const page = document.getElementById('page');
    if (page) new MutationObserver(syncOrion).observe(page, { childList: true, subtree: true });
    window.addEventListener('pagehide', () => { stop('login'); stop('orion'); }, { once: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
  window.addEventListener('load', () => {
    state.bundle = getApi() ? 'loaded' : 'missing';
    syncLogin();
    syncOrion();
  }, { once: true });
})();