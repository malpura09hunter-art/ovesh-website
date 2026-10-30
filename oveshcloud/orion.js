(()=>{'use strict';
const $=s=>document.querySelector(s);
let recognition=null,listening=false,speaking=false,started=false,manualStop=false,awaitingCommand=false,restartTimer=null;
const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
const page=$('#page');
const panel=()=>`<section class="orion-shell" aria-labelledby="orionTitle">
<header class="orion-heading"><div><div class="orion-kicker">OWNER VOICE COMPANION · PRIVATE SESSION</div><h1 id="orionTitle">ORION <span>Assistant</span></h1><p>Your workspace companion. Say “ORION” whenever you need me, then speak naturally.</p></div><div class="orion-state"><i id="orionLed"></i><span id="orionStatus">Standby</span></div></header>
<div class="orion-grid"><article class="orion-main-card"><div class="orion-orb-wrap"><div class="orion-orb" id="orionOrb"><span>O</span></div><small id="orionActivity">READY WHEN YOU ARE</small></div><div class="orion-transcript"><small>ORION</small><p id="orionReply" aria-live="polite">Hello. I'm ORION. Enable wake-word mode, then say “wake up” to get my attention.</p><div class="orion-user-line"><small>YOU</small><p id="orionHeard">Your spoken words will appear here.</p></div></div><div class="orion-controls"><button id="orionTalk" class="orion-primary" type="button">Enable wake word <span>→</span></button><button id="orionStop" class="orion-secondary" type="button" disabled>Pause listening</button></div><p class="orion-hint" id="orionHint">Wake-word listening runs only after you enable it and grant microphone permission. Keep this OV CLOUD tab open. Say “ORION” to activate a command.</p></article>
<aside class="orion-side-card"><div class="orion-side-title">TRY SAYING</div><button type="button" data-orion-say="Open my command center">“Open Command Center” <span>↗</span></button><button type="button" data-orion-say="Open cloud storage">“Open Cloud Storage” <span>↗</span></button><button type="button" data-orion-say="Show my client projects">“Show Client Projects” <span>↗</span></button><button type="button" data-orion-say="Open security">“Open Security” <span>↗</span></button><div class="orion-privacy"><strong>VOICE PRIVACY</strong><p>The microphone stays active only while wake-word mode is enabled. Select Pause listening to turn it off. Browser speech recognition may use your browser's speech service.</p></div></aside></div></section>`;
function status(s,mode=''){const el=$('#orionStatus');if(el)el.textContent=s;const led=$('#orionLed'),orb=$('#orionOrb'),act=$('#orionActivity');if(led)led.className=mode;if(orb)orb.className='orion-orb '+mode;if(act)act.textContent=s.toUpperCase()}
function transcript(user,reply){if(user&&$('#orionHeard'))$('#orionHeard').textContent=user;if(reply&&$('#orionReply'))$('#orionReply').textContent=reply}
function voice(){if(!window.speechSynthesis)return null;const voices=window.speechSynthesis.getVoices();return voices.find(v=>/^en[-_]IN$/i.test(v.lang)&&/female|natural|google/i.test(v.name))||voices.find(v=>/^en[-_]IN$/i.test(v.lang))||voices.find(v=>/^en/i.test(v.lang))||voices.find(v=>v.default)||voices[0]}
function speak(text,thenListen=true){if(listening){try{recognition?.stop()}catch{}listening=false}transcript('',text);if(!window.speechSynthesis){if(thenListen)listen();return}const synth=window.speechSynthesis;synth.cancel();speaking=true;status('Speaking','speaking');const u=new SpeechSynthesisUtterance(text),v=voice();if(v){u.voice=v;u.lang=v.lang}else u.lang='en-IN';u.rate=.92;u.pitch=1.02;u.volume=1;u.onend=()=>{speaking=false;if(thenListen&&started&&!manualStop){status('Waiting for “wake up”','listening');listen()}else if(!started)status('Standby')};u.onerror=()=>{speaking=false;if(thenListen&&started&&!manualStop)listen();else status('Standby')};synth.speak(u)}
function navigate(pageName,label){if(typeof window.render==='function')window.render(pageName);else document.querySelector('[data-page="'+pageName+'"]')?.click();speak('Opening '+label+'. Say “wake up” whenever you need me again.',true)}
let chatHistory=[];
async function askAI(raw){
  const userMessage=String(raw||'').trim();
  if(!userMessage)return;
  chatHistory.push({role:'user',content:userMessage.slice(0,1800)});
  chatHistory=chatHistory.slice(-10);
  status('Thinking','speaking');
  transcript('', 'Let me think about that.');
  try{
    const response=await fetch('/api/oveshcloud-orion-chat',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:chatHistory})});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||'ORION could not get an AI response.');
    const answer=String(data.reply||'').trim();
    if(!answer)throw new Error('ORION received an empty response. Please try again.');
    chatHistory.push({role:'assistant',content:answer});
    chatHistory=chatHistory.slice(-10);
    speak(answer,true);
  }catch(error){
    chatHistory.pop();
    const message=error&&error.message?error.message:'The AI service is temporarily unavailable.';
    speak(message,true);
  }
}
function replyTo(raw){
 const q=raw.toLowerCase().replace(/[^a-z0-9 ]/g,' ').trim();
 if(!q){speak('I did not catch that. Say “wake up” to try again.',true);return}
 if(/\b(stop listening|pause listening|go quiet|end conversation)\b/.test(q)){stop('Okay. I have paused the microphone.');return}
 if(/\b(command center|dashboard|home)\b/.test(q)){navigate('command','your command center');return}
 if(/\b(storage|files|file manager|cloud files)\b/.test(q)){navigate('storage','cloud storage');return}
 if(/\b(projects|client work)\b/.test(q)){navigate('projects','client projects');return}
 if(/\b(security|login activity)\b/.test(q)){navigate('security','security');return}
 if(/\b(college|study|subjects|practicals)\b/.test(q)){navigate('college','your college workspace');return}
 if(/\b(client cloud|clients)\b/.test(q)){navigate('client-cloud','client cloud management');return}
 if(/\b(shop|orders)\b/.test(q)){navigate('shop-orders','shop orders');return}
 askAI(raw);
}
let wakeBuffer='',wakeBufferAt=0;
function handleSpeech(raw){transcript(raw,'');const clean=raw.trim();if(!clean)return;if(awaitingCommand){awaitingCommand=false;replyTo(clean);return}
const now=Date.now();if(now-wakeBufferAt>3500)wakeBuffer='';wakeBufferAt=now;
const combined=(wakeBuffer+' '+clean).trim();const normalized=combined.toLowerCase().replace(/[\u2010-\u2015-]/g,' ').replace(/[.,!?;:]+/g,' ').replace(/\bway\s+up\b/g,'wake up').replace(/\s+/g,' ').trim();
const match=normalized.match(/\b(?:wake\s*up|orion)\b\s*(.*)$/i);
if(!match){wakeBuffer=/\bwake\b/i.test(normalized)?normalized.split(/\s+/).slice(-3).join(' '):'';return}
wakeBuffer='';openPanel();const command=(match[1]||'').trim();if(command){replyTo(command)}else{awaitingCommand=true;speak('Yes? I am listening.',true);status('Listening for your command','listening')}}
function listen(){if(!started||manualStop||speaking||listening)return;if(!SpeechRecognition){status('Speech recognition unavailable');$('#orionHint').textContent='Speech recognition is not available here. Try the latest Chrome or Edge and allow microphone access.';return}
try{recognition=new SpeechRecognition();recognition.lang='en-IN';recognition.continuous=true;recognition.interimResults=false;recognition.maxAlternatives=1;recognition.onstart=()=>{listening=true;status(awaitingCommand?'Listening for your command':'Waiting for “wake up”','listening')};recognition.onresult=e=>{for(let i=e.resultIndex;i<e.results.length;i++){if(e.results[i].isFinal){const phrase=e.results[i][0].transcript;handleSpeech(phrase)}}};recognition.onerror=e=>{listening=false;if(e.error==='not-allowed'||e.error==='service-not-allowed'){started=false;manualStop=true;status('Microphone permission needed');$('#orionTalk').disabled=false;$('#orionStop').disabled=true;$('#orionHint').textContent='Allow microphone access in your browser site settings, then enable wake word again.'}else if(e.error==='audio-capture'){status('Microphone unavailable');$('#orionHint').textContent='No working microphone was detected. Check your device input settings.'}};recognition.onend=()=>{listening=false;if(started&&!speaking&&!manualStop){clearTimeout(restartTimer);restartTimer=setTimeout(listen,450)}else if(!speaking)status(started?'Reconnecting':'Standby')};recognition.start()}catch(e){listening=false;started=false;manualStop=true;if($('#orionTalk'))$('#orionTalk').disabled=false;if($('#orionStop'))$('#orionStop').disabled=true;status('Microphone could not start');$('#orionHint').textContent=(e&&e.name==='NotAllowedError'?'The browser blocked microphone access. Allow the microphone for this site, then press Enable wake word again.':'Could not start listening. Check microphone permissions and try again.');}}
function start(){if(started)return;if(!SpeechRecognition){status('Unsupported browser');$('#orionHint').textContent='Use a current Chrome or Edge browser that supports Web Speech recognition.';return}started=true;manualStop=false;awaitingCommand=false;if($('#orionTalk'))$('#orionTalk').disabled=true;if($('#orionStop'))$('#orionStop').disabled=false;transcript('','ORION is now listening. Say “wake up” followed by your command.');status('Starting microphone','listening');listen()}
function stop(message='Listening paused. Say Enable wake word when you want me back.'){manualStop=true;started=false;awaitingCommand=false;listening=false;clearTimeout(restartTimer);try{recognition?.stop()}catch{}try{window.speechSynthesis?.cancel()}catch{}speaking=false;if($('#orionTalk'))$('#orionTalk').disabled=false;if($('#orionStop'))$('#orionStop').disabled=true;status('Standby');if(message){transcript('',message);if(window.speechSynthesis){const u=new SpeechSynthesisUtterance(message),v=voice();if(v)u.voice=v;window.speechSynthesis.speak(u)}}}
function show(){if(!page)return;page.innerHTML=panel();$('#orionTalk').onclick=start;$('#orionStop').onclick=()=>stop();document.querySelectorAll('[data-orion-say]').forEach(b=>b.onclick=()=>{const q=b.dataset.orionSay;transcript(q,'');replyTo(q)});if(!SpeechRecognition)$('#orionHint').textContent='Speech recognition is not available in this browser. Use current Chrome or Edge and allow microphone access.'}
function openPanel(){show();document.querySelectorAll('#nav button').forEach(x=>x.classList.toggle('active',x.id==='orionNav'));if($('#pageTitle'))$('#pageTitle').textContent='ORION Assistant'}
function activateAfterLogin(){openPanel();transcript('','Welcome back. ORION is ready. Select Enable wake word to allow microphone access, then say “wake up” whenever you need me.');status('Ready · microphone off')}
function addNav(){const nav=$('#nav'),btn=$('#orionNav');if(!nav||!btn)return;btn.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();openPanel();if(!started){transcript('','I am here. Enable wake-word mode, then say “wake up” whenever you need me.');status('Standby')}},true)}
function observeLogin(){const app=$('#appView');if(!app)return;let wasHidden=true;new MutationObserver(()=>{const visible=!app.classList.contains('hidden');if(visible&&wasHidden&&!window.__orionLoginGreeting){window.__orionLoginGreeting=true;setTimeout(()=>{if(!$('#welcomeView')?.classList.contains('hidden'))return;const utter='Welcome back. ORION is online. Open the ORION Assistant and enable wake-word listening when you are ready.';if(window.speechSynthesis){const u=new SpeechSynthesisUtterance(utter),v=voice();if(v){u.voice=v;u.lang=v.lang}else u.lang='en-IN';u.rate=.92;window.speechSynthesis.speak(u)}},700)}wasHidden=!visible}).observe(app,{attributes:true,attributeFilter:['class']})}
document.addEventListener('DOMContentLoaded',()=>{addNav();observeLogin()});if(document.readyState!=='loading'){addNav();observeLogin()}window.ORION={activateAfterLogin,stop};
window.addEventListener('beforeunload',()=>{clearTimeout(restartTimer);try{recognition?.stop();window.speechSynthesis?.cancel()}catch{}});
})();