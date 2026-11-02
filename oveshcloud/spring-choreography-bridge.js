(() => {
  'use strict';

  const active = new Map();
  const attempts = { login: 0, orion: 0 };
  const state = window.__OV_SPRING_STATUS = {
    bundle: 'waiting', webgpu: !!navigator.gpu,
    login: 'waiting', orion: 'waiting', errors: {}
  };
  const getApi = () => {
    const api = window.OvSpringChoreography;
    return api && typeof api.mountSpringChoreography === 'function' ? api : null;
  };

  function report(key, status, error) {
    state[key] = status;
    if (error) {
      const message = String(error?.message || error || 'Unknown renderer error');
      state.errors[key] = message;
      console.error('[OV CLOUD] Spring Choreography ' + key + ':', error);
      const stage = key === 'login'
        ? document.querySelector('#loginSpringCanvas')?.closest('.brand-stage')
        : document.querySelector('#orionSpringCanvas')?.closest('.orion-holo-stage');
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
      const stage = key === 'login'
        ? document.querySelector('#loginSpringCanvas')?.closest('.brand-stage')
        : document.querySelector('#orionSpringCanvas')?.closest('.orion-holo-stage');
      stage?.querySelector('.ov-spring-diagnostic')?.remove();
    }
  }

  async function start(key, canvas, container) {
    if (active.has(key) || !canvas || !container) return;
    const api = getApi();
    if (!api) {
      report('bundle', 'missing', 'Renderer bundle export is unavailable');
      return;
    }
    if (!navigator.gpu) {
      report(key, 'webgpu-unavailable', 'WebGPU API unavailable in this page');
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
      report(key, 'running');
    } catch (error) {
      const current = active.get(key);
      try { current?.instance?.dispose(); } catch (_) {}
      active.delete(key);
      canvas.hidden = true;
      container.classList.remove('ov-spring-active');
      report(key, 'failed', error);
    }
  }

  function schedule(key, canvas, container) {
    if (active.has(key) || state[key] === 'initializing' || state[key] === 'running') return;
    if (attempts[key] >= 3) return;
    const delay = attempts[key]++ === 0 ? 0 : 900;
    window.setTimeout(() => requestAnimationFrame(() => start(key, canvas, container)), delay);
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
    report(key, 'stopped');
  }

  function syncLogin() {
    const view = document.getElementById('loginView');
    const canvas = document.getElementById('loginSpringCanvas');
    const stage = canvas?.closest('.brand-stage');
    if (!view || !canvas || !stage) return;
    if (!view.classList.contains('hidden')) schedule('login', canvas, stage);
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
      canvas.setAttribute('aria-label', 'Spring Choreography particle animation. Move the pointer to part the particles and click to create a spring burst.');
      stage.prepend(canvas);
    }
    schedule('orion', canvas, stage);
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