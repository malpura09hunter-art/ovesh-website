(()=>{'use strict';
const $=id=>document.getElementById(id);
const root=$('orionRoot');
if(!root)return;
const panel=$('orionPanel'),launcher=$('orionLauncher'),feed=$('orionFeed'),status=$('orionStatus');
let started=false,muted=false,recognition=null,listening=false,lastGreeting='';
const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
function addMessage(text,who='orion'){
  const item=document.createElement('div');
  item.className='orion-message '+who;
  item.textContent=text;
  feed.appendChild(item);
  feed.scrollTop=feed.scrollHeight;
}
function setStatus(text,active=false){status.textContent=text;status.classList.toggle('active',active)}
function chooseVoice(){
  const voices=window.speechSynthesis?.getVoices?.()||[];
  return voices.find(v=>/^en[-_]IN$/i.test(v.lang)&&/female|zira|samantha|aria|jenny|google/i.test(v.name))
    ||voices.find(v=>/^en[-_]IN$/i.test(v.lang))
    ||voices.find(v=>/^en[-_]GB$/i.test(v.lang)&&/female|samantha|serena|google/i.test(v.name))
    ||voices.find(v=>/^en/i.test(v.lang)&&/female|samantha|serena|aria|jenny|google/i.test(v.name))
    ||voices.find(v=>/^en/i.test(v.lang))
    ||voices.find(v=>v.default)||voices[0]||null;
}
function speak(text){
  if(muted||!window.speechSynthesis||!text)return;
  try{
    const utterance=new SpeechSynthesisUtterance(text);
    const voice=chooseVoice();
    if(voice){utterance.voice=voice;utterance.lang=voice.lang||'en-IN';}
    else utterance.lang='en-IN';
    utterance.rate=.91;utterance.pitch=.94;utterance.volume=.88;
    utterance.onstart=()=>{root.classList.add('speaking');setStatus('Speaking',true)};
    utterance.onend=()=>{root.classList.remove('speaking');setStatus('Ready')};
    utterance.onerror=()=>{root.classList.remove('speaking');setStatus('Voice unavailable · use text')};
    window.speechSynthesis.speak(utterance);
  }catch{setStatus('Voice unavailable · use text')}
}
async function ask(message){
  const clean=String(message||'').trim();
  if(!clean)return;
  addMessage(clean,'owner');
  setStatus('Checking your workspace…',true);
  $('orionSend').disabled=true;
  try{
    const response=await fetch('/api/oveshcloud-auth?action=orion',{method:'POST',credentials:'include',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:clean})});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||'Unable to contact ORION.');
    addMessage(data.answer||'I could not prepare a response.');
    speak(data.answer||'I could not prepare a response.');
    setStatus('Ready');
  }catch(error){
    const text=responseMessage(error);
    addMessage(text);
    speak(text);
    setStatus('Connection unavailable');
  }finally{$('orionSend').disabled=false;}
}
function responseMessage(error){return error?.message||'ORION is temporarily unavailable. Your cloud workspace is not affected.'}
function startListening(){
  if(!SpeechRecognition){addMessage('Voice input is not supported in this browser. You can type your question instead.');return}
  if(listening){recognition?.stop();return}
  try{
    recognition=new SpeechRecognition();
    recognition.lang='en-IN';recognition.continuous=false;recognition.interimResults=false;recognition.maxAlternatives=1;
    recognition.onstart=()=>{listening=true;setStatus('Listening · speak now',true);$('orionMic').classList.add('listening')};
    recognition.onresult=event=>{const spoken=event.results?.[0]?.[0]?.transcript||'';if(spoken){$('orionInput').value=spoken;ask(spoken)}};
    recognition.onerror=event=>{addMessage(event.error==='not-allowed'?'Microphone permission was not granted. You can still type to ORION.':'I could not hear that clearly. Please try again or type your question.');};
    recognition.onend=()=>{listening=false;$('orionMic').classList.remove('listening');setStatus('Ready')};
    recognition.start();
  }catch{listening=false;setStatus('Ready');addMessage('Voice input could not start. Please use the text box.')}
}
function openPanel(){panel.hidden=false;launcher.setAttribute('aria-expanded','true');$('orionInput').focus()}
function closePanel(){panel.hidden=true;launcher.setAttribute('aria-expanded','false');}
async function greet(){
  if(started)return;
  started=true;
  openPanel();
  setStatus('Preparing your briefing…',true);
  const hour=new Date().getHours();
  const greeting=hour<12?'Good morning':hour<17?'Good afternoon':'Good evening';
  try{
    const response=await fetch('/api/oveshcloud-auth?action=orion',{method:'POST',credentials:'include',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'cloud status briefing'})});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||'Briefing unavailable');
    lastGreeting=greeting+', Owner. Welcome back to OV CLOUD. '+data.answer;
  }catch{
    lastGreeting=greeting+', Owner. Welcome back to OV CLOUD. Your private workspace is open. I am ready to help with cloud status, file information and security summaries.';
  }
  addMessage(lastGreeting);
  setStatus('Ready');
  speak(lastGreeting);
}
$('orionLauncher').addEventListener('click',()=>panel.hidden?openPanel():closePanel());
$('orionClose').addEventListener('click',closePanel);
$('orionForm').addEventListener('submit',event=>{event.preventDefault();const input=$('orionInput');const value=input.value;input.value='';ask(value)});
$('orionMic').addEventListener('click',startListening);
$('orionMute').addEventListener('click',()=>{
  muted=!muted;
  $('orionMute').textContent=muted?'Enable voice':'Mute voice';
  $('orionMute').setAttribute('aria-pressed',String(muted));
  if(muted&&window.speechSynthesis)window.speechSynthesis.cancel();
});
$('orionHearGreeting').addEventListener('click',()=>{if(lastGreeting)speak(lastGreeting)});
document.querySelectorAll('[data-orion-prompt]').forEach(button=>button.addEventListener('click',()=>ask(button.dataset.orionPrompt)));
const app=$('appView');
if(app){
  const observer=new MutationObserver(()=>{
    if(!app.classList.contains('hidden')){observer.disconnect();setTimeout(greet,700);}
  });
  observer.observe(app,{attributes:true,attributeFilter:['class']});
  if(!app.classList.contains('hidden'))setTimeout(greet,700);
}
window.addEventListener('pagehide',()=>{try{recognition?.stop();}catch{}});
})();