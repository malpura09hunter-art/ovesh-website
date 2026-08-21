(function(){
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'Not available').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  function addHero(){
    const intro=document.querySelector('.cloud-intro');
    if(!intro||intro.querySelector('.ovesh-hero-art'))return;
    const art=document.createElement('div');
    art.className='ovesh-hero-art';
    art.innerHTML='<div class="hero-cloud"><span class="hero-cloud-core"></span><i class="hero-orbit orbit-one"></i><i class="hero-orbit orbit-two"></i><span class="hero-file file-one">PDF</span><span class="hero-file file-two">PPT</span><span class="hero-file file-three">WEB</span></div>';
    intro.insertBefore(art,intro.firstChild);
  }
  function speak(text){if(!('speechSynthesis' in window))return;try{speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.rate=.96;u.pitch=.98;speechSynthesis.speak(u)}catch(_){} }
  function securityPanel(data){
    const gate=$('accessGate');
    if(!gate)return;
    gate.classList.add('security-stage');
    gate.innerHTML='<div class="security-panel"><div class="security-check">✓</div><div class="security-eyebrow">OVESH CLOUD · SECURITY</div><h2>ACCESS GRANTED</h2><p class="security-welcome">Welcome, Ovesh Malpura</p><div class="security-live">LIVE LOGIN RECORD</div><div class="security-details"><div><small>LOGIN TIME</small><b>'+esc(data.timestamp)+'</b></div><div><small>IP ADDRESS</small><b>'+esc(data.ip)+'</b></div><div><small>ISP</small><b>'+esc(data.isp)+'</b></div><div><small>OPERATING SYSTEM</small><b>'+esc(data.os)+'</b></div><div><small>BROWSER</small><b>'+esc(data.browser)+'</b></div><div><small>DEVICE</small><b>'+esc(data.device)+'</b></div><div class="security-wide"><small>USER AGENT</small><b>'+esc(data.userAgent)+'</b></div><div><small>LOCATION</small><b>'+esc(data.location?data.location.latitude+', '+data.location.longitude:'Permission not granted')+'</b></div></div><div class="security-timer"><span>Security summary closes in</span><strong id="securityCountdown">40</strong><span>s</span></div><button id="securityContinue" class="security-continue">Continue to Ovesh Cloud →</button></div>';
    gate.classList.remove('hidden');
    let left=40;
    const countdown=$('securityCountdown');
    const timer=setInterval(()=>{left--;if(countdown)countdown.textContent=left;if(left<=0){clearInterval(timer);finish()}},1000);
    $('securityContinue').addEventListener('click',()=>{clearInterval(timer);finish()});
    function finish(){
      gate.classList.add('security-exit');
      setTimeout(()=>{gate.classList.add('hidden');gate.classList.remove('security-exit','security-stage');gate.innerHTML='<div class="access-orbit orbit-a"></div><div class="access-orbit orbit-b"></div><div class="access-core"><span>OC</span></div><div class="access-brand">OVESH CLOUD</div><div id="accessStatus" class="access-status">AUTHENTICATING</div><div class="access-line"><span></span></div><div id="accessMessage" class="access-message">Verifying your identity</div>';},500);
      if(typeof window.load==='function')window.load().then(()=>{if(typeof window.go==='function')window.go('home')}).catch(()=>{});
    }
  }
  function start(){
    addHero();
    const form=$('loginForm');
    if(!form||form.dataset.overshSecurityBound)return;
    form.dataset.overshSecurityBound='1';
    form.addEventListener('submit',async function(e){
      e.preventDefault();e.stopImmediatePropagation();
      const err=$('loginError'),button=form.querySelector('.login-button');
      err.textContent='';button.disabled=true;button.classList.add('loading');
      let locationData=null;
      try{if(navigator.geolocation)locationData=await new Promise(resolve=>navigator.geolocation.getCurrentPosition(p=>resolve({latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy:p.coords.accuracy}),()=>resolve(null),{enableHighAccuracy:true,timeout:7000,maximumAge:300000}))}catch(_){}
      try{
        const r=await fetch('/api/oveshcloud-auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:$('username').value.trim(),password:$('password').value,location:locationData})});
        const data=await r.json();if(!r.ok)throw new Error(data.error||'ACCESS DENIED');
        sessionStorage.setItem('oveshCloudSession',data.token);sessionStorage.setItem('oveshCloudSecurity',JSON.stringify(data.security));
        $('login').classList.add('hidden');
        const gate=$('accessGate');gate.classList.remove('hidden');
        const status=$('accessStatus'),msg=$('accessMessage');
        const steps=[['AUTHENTICATING','Verifying your identity'],['IDENTITY VERIFIED','Authentication successful'],['SECURITY VERIFIED','Creating your secure session'],['ACCESS GRANTED','Ovesh Cloud workspace ready']];let i=0;
        function next(){status.textContent=steps[i][0];msg.textContent=steps[i][1];if(i<steps.length-1){i++;setTimeout(next,850)}else{setTimeout(()=>{speak('Welcome, Ovesh Malpura. Your identity has been verified. Cloud access has been granted.');securityPanel(data.security||{})},650)}}
        next();
      }catch(ex){err.textContent=ex.message;button.disabled=false;button.classList.remove('loading')}
    },true);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
