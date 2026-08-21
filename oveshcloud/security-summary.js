(() => {
  function esc(v) { return String(v ?? 'Not available').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function ensurePanel() {
    let panel = document.getElementById('securitySummary');
    if (panel) return panel;
    panel = document.createElement('section');
    panel.id = 'securitySummary';
    panel.className = 'security-summary hidden';
    panel.innerHTML = `
      <div class="security-summary-card">
        <div class="security-summary-top"><span class="security-dot"></span><span>SECURITY LOGIN RECORD</span><span id="securityCountdown">40s</span></div>
        <h2>Access granted</h2>
        <p class="security-welcome">Welcome, Ovesh Malpura. Your login has been recorded.</p>
        <div id="securityGrid" class="security-grid"></div>
        <div class="security-summary-actions"><button id="securityContinue" class="btn primary">Continue to Ovesh Cloud →</button><span id="securityClosing">Closing automatically in 40 seconds</span></div>
      </div>`;
    document.body.appendChild(panel);
    return panel;
  }
  function showSecurity(security, onDone) {
    const panel = ensurePanel();
    const grid = panel.querySelector('#securityGrid');
    const data = security || {};
    const rows = [
      ['IP ADDRESS', data.ip || 'Not available'],
      ['ISP', data.isp || 'Not available'],
      ['OPERATING SYSTEM', data.os || 'Not available'],
      ['BROWSER', data.browser || 'Not available'],
      ['DEVICE', data.device || 'Not available'],
      ['LOGIN TIME', data.timestamp ? new Date(data.timestamp).toLocaleString('en-IN', { dateStyle:'medium', timeStyle:'medium' }) : 'Not available'],
      ['LOCATION', data.location ? (typeof data.location === 'string' ? data.location : JSON.stringify(data.location)) : (data.locationStatus || 'Permission not granted')],
      ['USER AGENT', data.userAgent || 'Not available']
    ];
    grid.innerHTML = rows.map(([k,v]) => `<div class="security-item"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('');
    panel.classList.remove('hidden');
    let left = 40, finished = false;
    const countdown = panel.querySelector('#securityCountdown');
    const closing = panel.querySelector('#securityClosing');
    const finish = () => {
      if (finished) return;
      finished = true;
      clearInterval(timer);
      panel.classList.add('security-exit');
      setTimeout(() => { panel.classList.add('hidden'); panel.classList.remove('security-exit'); onDone?.(); }, 420);
    };
    panel.querySelector('#securityContinue').onclick = finish;
    countdown.textContent = left + 's';
    closing.textContent = 'Closing automatically in ' + left + ' seconds';
    const timer = setInterval(() => {
      left -= 1;
      countdown.textContent = left + 's';
      closing.textContent = left > 0 ? 'Closing automatically in ' + left + ' seconds' : 'Opening Ovesh Cloud…';
      if (left <= 0) finish();
    }, 1000);
  }
  window.runSecurityAccessSequence = async function () {
    const login = document.getElementById('login');
    const gate = document.getElementById('accessGate');
    const status = document.getElementById('accessStatus');
    const msg = document.getElementById('accessMessage');
    login.classList.add('hidden');
    gate.classList.remove('hidden');
    const steps = [
      ['AUTHENTICATING', 'Verifying your identity'],
      ['IDENTITY VERIFIED', 'Authentication successful'],
      ['SECURITY VERIFIED', 'Recording login information'],
      ['ACCESS GRANTED', 'Ovesh Cloud workspace ready']
    ];
    let i = 0;
    const next = () => {
      status.textContent = steps[i][0];
      msg.textContent = steps[i][1];
      if (i < steps.length - 1) { i++; setTimeout(next, 850); return; }
      setTimeout(() => {
        gate.classList.add('gate-exit');
        setTimeout(() => { gate.classList.add('hidden'); gate.classList.remove('gate-exit'); }, 650);
        if ('speechSynthesis' in window) { try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance('Welcome, Ovesh Malpura. Cloud access has been granted.'); u.rate=.96; u.pitch=.98; speechSynthesis.speak(u); } catch (_) {} }
        let security = {};
        try { security = JSON.parse(sessionStorage.getItem('oveshCloudSecurity') || '{}'); } catch (_) {}
        showSecurity(security, async () => {
          document.getElementById('app').classList.remove('hidden');
          document.getElementById('avatar').textContent = 'OM';
          try {
            if (typeof state !== 'undefined') state.user = { uid:'oveshcloud-admin', displayName:'Ovesh Malpura' };
            if (typeof originalLoad === 'function') await originalLoad();
            const view = pathMap[location.pathname] || 'home';
            if (typeof originalGo === 'function') originalGo(view);
          } catch (e) {
            console.error('Cloud data load failed:', e);
            if (typeof renderFallback === 'function') renderFallback();
          }
        });
      }, 700);
    };
    next();
  };
})();