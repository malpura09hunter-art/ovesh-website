(()=>{'use strict';
const $=s=>document.querySelector(s);
let recognition=null,listening=false,speaking=false,started=false,manualStop=false,awaitingCommand=false,restartTimer=null,restartAttempts=0,lastWakeAt=0,recognitionFailed=false;
const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
const page=$('#page');
const panel=()=>`<section class="orion-shell" aria-labelledby="orionTitle">
<header class="orion-heading"><div><div class="orion-kicker">OWNER VOICE COMPANION · PRIVATE SESSION</div><h1 id="orionTitle">ORION <span>Assistant</span></h1><p>Your workspace companion. Microphone listening starts automatically after owner sign-in when browser permission allows it.</p></div><div class="orion-state"><i id="orionLed"></i><span id="orionStatus">Standby</span></div></header>
<div class="orion-grid"><article class="orion-main-card"><div class="orion-orb-wrap"><div class="orion-orb" id="orionOrb"><span>O</span></div><small id="orionActivity">READY WHEN YOU ARE</small></div><div class="orion-transcript"><small>ORION</small><p id="orionReply" aria-live="polite">Hello. I'm ORION. Start a conversation and speak naturally. You do not need to say a wake word.</p><div class="orion-user-line"><small>YOU</small><p id="orionHeard">Your spoken words will appear here.</p></div></div><div class="orion-controls"><button id="orionTalk" class="orion-primary" type="button">Start conversation <span>→</span></button><button id="orionRecord" class="orion-secondary" type="button">Tap to speak</button><button id="orionStop" class="orion-secondary" type="button" disabled>Pause listening</button></div><form id="orionChatForm" class="orion-chat-form"><label class="orion-chat-label" for="orionTextInput">CHAT WITH ORION</label><div class="orion-chat-row"><textarea id="orionTextInput" rows="2" maxlength="1800" placeholder="Type a question or follow-up…"></textarea><button id="orionSend" class="orion-primary" type="submit">Send →</button></div></form><p class="orion-hint" id="orionHint">Start conversation once, allow microphone access, and speak naturally. ORION listens for each turn and resumes listening after replying. You can interrupt while ORION speaks.</p></article>
<aside class="orion-side-card"><div class="orion-side-title">TRY SAYING</div><button type="button" data-orion-say="Open my command center">“Open Command Center” <span>↗</span></button><button type="button" data-orion-say="Open cloud storage">“Open Cloud Storage” <span>↗</span></button><button type="button" data-orion-say="Show my client projects">“Show Client Projects” <span>↗</span></button><button type="button" data-orion-say="Open security">“Open Security” <span>↗</span></button><div class="orion-privacy"><strong>VOICE PRIVACY</strong><p>The microphone stays active only while wake-word mode is enabled. Select Pause listening to turn it off. Browser speech recognition may use your browser's speech service.</p></div></aside></div></section>`;
function status(s,mode=''){const el=$('#orionStatus');if(el)el.textContent=s;const led=$('#orionLed'),orb=$('#orionOrb'),act=$('#orionActivity');if(led)led.className=mode;if(orb)orb.className='orion-orb '+mode;if(act)act.textContent=s.toUpperCase()}
function transcript(user,reply){if(user&&$('#orionHeard'))$('#orionHeard').textContent=user;if(reply&&$('#orionReply'))$('#orionReply').textContent=reply}
function voice(){if(!window.speechSynthesis)return null;const voices=window.speechSynthesis.getVoices();return voices.find(v=>/^en[-_]IN$/i.test(v.lang)&&/female|natural|google/i.test(v.name))||voices.find(v=>/^en[-_]IN$/i.test(v.lang))||voices.find(v=>/^en/i.test(v.lang))||voices.find(v=>v.default)||voices[0]}
let bargeStream=null,bargeFrame=0,bargeSince=0,bargeRecording=false;
function stopBargeWatch(){if(bargeFrame)cancelAnimationFrame(bargeFrame);bargeFrame=0;if(bargeStream){bargeStream.getTracks().forEach(t=>t.stop());bargeStream=null}bargeRecording=false}
async function startBargeWatch(){
 stopBargeWatch();
 if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)return;
 try{
  const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
  if(!speaking){stream.getTracks().forEach(t=>t.stop());return}
  bargeStream=stream;
  const AudioCtx=window.AudioContext||window.webkitAudioContext;if(!AudioCtx){stream.getTracks().forEach(t=>t.stop());bargeStream=null;return;}
  const ctx=new AudioCtx(),source=ctx.createMediaStreamSource(stream),analyser=ctx.createAnalyser(),buffer=new Uint8Array(2048);analyser.fftSize=2048;source.connect(analyser);let above=0,lastVoice=0,recording=false,recorder=null,chunks=[];
  const cleanup=()=>{try{source.disconnect();ctx.close()}catch{}};
  const finish=()=>{if(recorder&&recorder.state==='recording')recorder.stop()};
  const upload=async blob=>{
   stream.getTracks().forEach(t=>t.stop());if(bargeStream===stream)bargeStream=null;bargeRecording=false;cleanup();
   if(blob.size<1200){bargeRecording=false;if(started&&!manualStop)listen();return}
   status('Hearing your interruption','speaking');transcript('','One moment — I’m listening.');
   try{
    const reader=new FileReader();const encoded=await new Promise((resolve,reject)=>{reader.onload=()=>resolve(String(reader.result||'').split(',')[1]||'');reader.onerror=()=>reject(new Error('Could not read audio'));reader.readAsDataURL(blob)});
    const response=await fetch('/api/oveshcloud-auth?action=orion-transcribe',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({audio:encoded,mimeType:(blob.type||'audio/webm').split(';')[0]})});
    const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||'Voice transcription failed');
    const words=String(data.text||'').trim();if(!words)throw new Error('I did not catch that. Please say it again.');
    transcript(words,'');status('You interrupted','listening');replyTo(words);
   }catch(error){bargeRecording=false;transcript('','I could not understand that: '+error.message);if(started&&!manualStop)listen()}
  };
  const tick=()=>{
   if(!speaking||recording||!bargeStream){cleanup();return}
   analyser.getByteTimeDomainData(buffer);let sum=0;for(let i=0;i<buffer.length;i++){const x=(buffer[i]-128)/128;sum+=x*x}const rms=Math.sqrt(sum/buffer.length);
   if(rms>0.045){above++;lastVoice=Date.now()}else above=Math.max(0,above-1);
   if(above>=4){
    recording=true;bargeRecording=true;try{window.speechSynthesis?.cancel()}catch{}speaking=false;status('Interrupted · listening','listening');
    const mime=MediaRecorder.isTypeSupported('audio/webm;codecs=opus')?'audio/webm;codecs=opus':(MediaRecorder.isTypeSupported('audio/mp4')?'audio/mp4':'');
    recorder=mime?new MediaRecorder(stream,{mimeType:mime}):new MediaRecorder(stream);
    chunks=[];recorder.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data)};recorder.onstop=()=>upload(new Blob(chunks,{type:recorder.mimeType||'audio/webm'}));recorder.start(250);
    const stopWhenQuiet=()=>{if(!recorder||recorder.state!=='recording')return;analyser.getByteTimeDomainData(buffer);let total=0;for(let i=0;i<buffer.length;i++){const x=(buffer[i]-128)/128;total+=x*x}const level=Math.sqrt(total/buffer.length);if(level>0.025)lastVoice=Date.now();if(Date.now()-lastVoice>1100||Date.now()-bargeSince>10000){finish();return}bargeFrame=requestAnimationFrame(stopWhenQuiet)};
    bargeSince=Date.now();bargeFrame=requestAnimationFrame(stopWhenQuiet);return;
   }
   bargeFrame=requestAnimationFrame(tick);
  };
  bargeFrame=requestAnimationFrame(tick);
 }catch(e){stopBargeWatch();/* Keep spoken replies available even if barge-in mic access is unavailable. */}
}
function speechFriendlyText(value){return String(value||'').replace(/`([^`]+)`/g,'$1').replace(/https?:\/\/\S+/g,' link ').replace(/^\s{0,3}#{1,6}\s*/gm,'').replace(/^\s*[-*+]\s+/gm,'').replace(/^\s*\d+[.)]\s+/gm,'').replace(/[>*_~|#{}\[\]<>\\]/g,' ').replace(/[\/=+^%$@&;:]+/g,' ').replace(/\s+/g,' ').trim()}
function speak(text,thenListen=true){if(listening){try{recognition?.stop()}catch{}listening=false}transcript('',text);if(!window.speechSynthesis){if(thenListen)listen();return}const spoken=speechFriendlyText(text)||String(text||'');const synth=window.speechSynthesis;synth.cancel();speaking=true;status('Speaking · you can interrupt','speaking');const u=new SpeechSynthesisUtterance(spoken),v=voice();if(v){u.voice=v;u.lang=v.lang}else u.lang='en-IN';u.rate=.92;u.pitch=1.02;u.volume=1;u.onend=()=>{speaking=false;if(!bargeRecording)stopBargeWatch();if(thenListen&&started&&!manualStop&&!bargeRecording){status('Listening for your next message','listening');listen()}else if(!started&&!bargeRecording)status('Standby')};u.onerror=()=>{speaking=false;if(!bargeRecording)stopBargeWatch();if(thenListen&&started&&!manualStop&&!bargeRecording)listen();else if(!bargeRecording)status('Standby')};synth.speak(u);startBargeWatch()}
function navigate(pageName,label){if(typeof window.render==='function')window.render(pageName);else document.querySelector('[data-page="'+pageName+'"]')?.click();speak('Opening '+label+'. What would you like to do next?',true)}
let chatHistory=[];
async function askAI(raw,speakResponse=true){
  const userMessage=String(raw||'').trim();
  if(!userMessage)return;
  chatHistory.push({role:'user',content:userMessage.slice(0,1800)});
  chatHistory=chatHistory.slice(-14);
  status('Thinking','speaking');
  transcript('', 'Let me think about that.');
  try{
    const response=await fetch('/api/oveshcloud-auth?action=orion-chat',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:chatHistory})});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||'ORION could not get an AI response.');
    const answer=String(data.reply||'').trim();
    if(!answer)throw new Error('ORION received an empty response. Please try again.');
    chatHistory.push({role:'assistant',content:answer.slice(0,3800)});
    chatHistory=chatHistory.slice(-14);
    if(speakResponse)speak(answer,true);else{transcript('',answer);status('Reply ready');}
  }catch(error){
    chatHistory.pop();
    const message=error&&error.message?error.message:'The AI service is temporarily unavailable.';
    if(speakResponse){speak(message,true)}else{transcript('',message);status('AI request failed');}
  }
}
function replyTo(raw){
 const q=raw.toLowerCase().replace(/[^a-z0-9 ]/g,' ').trim();
 if(!q){speak('I did not catch that. Say “wake up” to try again.',true);return}
 if(/^(?:open|go to|show|take me to|navigate to|switch to)\s+(?:my\s+)?(?:command center|dashboard|home)[.! ]*$/.test(q)){navigate('command','your command center');return}
 if(/^(?:open|go to|show|take me to|navigate to|switch to)\s+(?:my\s+)?(?:cloud storage|file manager|files|storage)[.! ]*$/.test(q)){navigate('storage','cloud storage');return}
 if(/^(?:open|go to|show|take me to|navigate to|switch to)\s+(?:my\s+)?(?:client projects|projects)[.! ]*$/.test(q)){navigate('projects','client projects');return}
 if(/^(?:open|go to|show|take me to|navigate to|switch to)\s+(?:the\s+)?(?:security|security center|login activity)[.! ]*$/.test(q)){navigate('security','security');return}
 if(/^(?:open|go to|show|take me to|navigate to|switch to)\s+(?:my\s+)?(?:college|study workspace|subjects)[.! ]*$/.test(q)){navigate('college','your college workspace');return}
 if(/^(?:open|go to|show|take me to|navigate to|switch to)\s+(?:client cloud|clients)[.! ]*$/.test(q)){navigate('client-cloud','client cloud management');return}
 if(/^(?:open|go to|show|take me to|navigate to|switch to)\s+(?:shop orders|orders)[.! ]*$/.test(q)){navigate('shop-orders','shop orders');return}
 askAI(raw);
}
let wakeBuffer='',wakeBufferAt=0,conversationMode=true;
function handleSpeech(raw){transcript(raw,'');const clean=raw.trim();if(!clean)return;if(awaitingCommand){awaitingCommand=false;replyTo(clean);return}if(conversationMode){replyTo(clean);return}
const now=Date.now();if(now-wakeBufferAt>3500)wakeBuffer='';wakeBufferAt=now;
const combined=(wakeBuffer+' '+clean).trim();const normalized=combined.toLowerCase().replace(/[\u2010-\u2015-]/g,' ').replace(/[.,!?;:]+/g,' ').replace(/\bway\s+up\b/g,'wake up').replace(/\s+/g,' ').trim();
const match=normalized.match(/\b(?:wake\s*up|wake\s+me\s+up|hey\s+orion|okay\s+orion|ok\s+orion|orion)\b\s*(.*)$/i);
if(!match){wakeBuffer=/\b(?:wake|hey|okay|ok)\b/i.test(normalized)?normalized.split(/\s+/).slice(-4).join(' '):'';return}
wakeBuffer='';lastWakeAt=now;openPanel();const command=(match[1]||'').trim();if(command){replyTo(command)}else{awaitingCommand=true;speak('Yes? I am listening.',true);status('Listening for your command','listening')}}
function listen(){if(!started||manualStop||speaking||listening)return;if(!SpeechRecognition){started=false;status('Speech recognition unavailable');$('#orionTalk').disabled=false;$('#orionStop').disabled=true;$('#orionHint').textContent='Speech recognition is not available here. Try the latest Chrome or Edge.';return}
try{recognition=new SpeechRecognition();recognition.lang='en-IN';recognition.continuous=true;recognition.interimResults=false;recognition.maxAlternatives=3;recognition.onstart=()=>{listening=true;recognitionFailed=false;restartAttempts=0;status(awaitingCommand?'Listening for your command':'Listening · speak naturally','listening');$('#orionHint').textContent='Conversation mode is active. Speak naturally; no wake word is needed.'};recognition.onresult=e=>{for(let i=e.resultIndex;i<e.results.length;i++){if(e.results[i].isFinal)handleSpeech(e.results[i][0].transcript)}};recognition.onerror=e=>{listening=false;const fail=(label,hint)=>{recognitionFailed=true;started=false;manualStop=true;clearTimeout(restartTimer);status(label);$('#orionTalk').disabled=false;$('#orionStop').disabled=true;$('#orionHint').textContent=hint};if(e.error==='not-allowed'||e.error==='service-not-allowed'){fail('Microphone permission needed','Allow microphone access for OV CLOUD in Chrome site settings, then click Retry microphone.')}else if(e.error==='audio-capture'){fail('Microphone unavailable','Chrome cannot access a working microphone. Check Windows Settings → System → Sound → Input and select the correct microphone.')}else if(e.error==='network'){fail('Speech service unavailable','The microphone permission may be fine, but Chrome speech recognition cannot reach its speech service. Check your internet connection, disable VPN/proxy temporarily, and retry.')}else if(e.error==='language-not-supported'){fail('Language unavailable','Chrome speech recognition does not support the selected language. Please retry or use Chrome with English (India) language support.')}};recognition.onend=()=>{listening=false;if(started&&!speaking&&!manualStop&&!recognitionFailed){clearTimeout(restartTimer);restartAttempts++;if(restartAttempts>5){started=false;manualStop=true;status('Microphone stopped · retry needed');$('#orionTalk').disabled=false;$('#orionStop').disabled=true;$('#orionHint').textContent='Chrome repeatedly ended speech recognition. Check your microphone and internet connection, then click Retry microphone.';return}const delay=Math.min(700*Math.pow(1.6,restartAttempts-1),6000);status('Reconnecting microphone · attempt '+restartAttempts,'listening');restartTimer=setTimeout(listen,delay)}else if(!speaking&&started)status('Ready to retry')};recognition.start()}catch(e){listening=false;started=false;manualStop=true;if($('#orionTalk'))$('#orionTalk').disabled=false;if($('#orionStop'))$('#orionStop').disabled=true;status('Microphone could not start');$('#orionHint').textContent=e&&e.name==='NotAllowedError'?'The browser blocked microphone access. Allow the microphone for this site, then press Retry microphone.':'Could not start listening. Check microphone permissions and try again.';}}
async function start(){if(started)return;conversationMode=true;if(!SpeechRecognition){status('Unsupported browser');$('#orionHint').textContent='Use a current Chrome or Edge browser that supports Web Speech recognition.';return}if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia){status('Secure microphone access required');$('#orionHint').textContent='Open OV CLOUD on its HTTPS address in the latest Chrome or Edge browser.';return}started=true;manualStop=false;recognitionFailed=false;awaitingCommand=false;if($('#orionTalk'))$('#orionTalk').disabled=true;if($('#orionStop'))$('#orionStop').disabled=false;transcript('','Checking microphone access…');status('Checking microphone','listening');try{const stream=await navigator.mediaDevices.getUserMedia({audio:true});stream.getTracks().forEach(track=>track.stop());if(!started||manualStop)return;transcript('','Microphone access confirmed. Starting ORION listening…');status('Starting speech recognition','listening');listen()}catch(e){started=false;manualStop=true;if($('#orionTalk'))$('#orionTalk').disabled=false;if($('#orionStop'))$('#orionStop').disabled=true;status(e&&e.name==='NotAllowedError'?'Microphone permission needed':'Microphone unavailable');$('#orionHint').textContent=e&&e.name==='NotAllowedError'?'Click the site icon beside the address bar → Site settings → Microphone → Allow, then retry.':'No microphone could be opened. Check Windows Settings → System → Sound → Input and Chrome microphone selection.'}}
function stop(message='Listening paused. Say Enable wake word when you want me back.'){manualStop=true;started=false;awaitingCommand=false;listening=false;clearTimeout(restartTimer);try{recognition?.stop()}catch{}try{window.speechSynthesis?.cancel()}catch{}stopBargeWatch();speaking=false;if($('#orionTalk'))$('#orionTalk').disabled=false;if($('#orionStop'))$('#orionStop').disabled=true;status('Standby');if(message){transcript('',message);if(window.speechSynthesis){const u=new SpeechSynthesisUtterance(message),v=voice();if(v)u.voice=v;window.speechSynthesis.speak(u)}}}

let voiceStream=null,voiceRecorder=null,voiceChunks=[],voiceTimer=null,voiceBusy=false;
async function toggleVoiceRecording(){
 const button=$('#orionRecord');
 if(voiceRecorder&&voiceRecorder.state==='recording'){voiceRecorder.stop();return}
 if(voiceBusy)return;
 if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){transcript('','Direct voice recording is not supported in this browser. Please use the latest Chrome or Edge.');status('Voice recording unavailable');return}
 try{
  manualStop=true;started=false;awaitingCommand=false;clearTimeout(restartTimer);
  try{recognition?.stop()}catch{}
  try{window.speechSynthesis?.cancel()}catch{}
  voiceStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
  const mime=MediaRecorder.isTypeSupported('audio/webm;codecs=opus')?'audio/webm;codecs=opus':(MediaRecorder.isTypeSupported('audio/mp4')?'audio/mp4':'');
  voiceRecorder=mime?new MediaRecorder(voiceStream,{mimeType:mime}):new MediaRecorder(voiceStream);
  voiceChunks=[];voiceRecorder.ondataavailable=e=>{if(e.data&&e.data.size)voiceChunks.push(e.data)};
  voiceRecorder.onstop=async()=>{
   clearTimeout(voiceTimer);voiceStream?.getTracks().forEach(t=>t.stop());voiceStream=null;
   const blob=new Blob(voiceChunks,{type:voiceRecorder.mimeType||'audio/webm'});voiceRecorder=null;voiceChunks=[];
   if(button){button.disabled=true;button.textContent='Transcribing…'}
   if(blob.size<1200){if(button){button.disabled=false;button.textContent='Tap to speak'}status('No voice detected');transcript('','I did not receive enough audio. Tap to speak and try again.');return}
   if(blob.size>500000){if(button){button.disabled=false;button.textContent='Tap to speak'}status('Recording too long');transcript('','Please keep voice messages under 12 seconds and try again.');return}
   voiceBusy=true;status('Transcribing voice','speaking');transcript('','I’m listening to your recording…');
   try{
    const reader=new FileReader();
    const encoded=await new Promise((resolve,reject)=>{reader.onload=()=>resolve(String(reader.result||'').split(',')[1]||'');reader.onerror=()=>reject(new Error('Could not read the voice recording.'));reader.readAsDataURL(blob)});
    const response=await fetch('/api/oveshcloud-auth?action=orion-transcribe',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({audio:encoded,mimeType:(blob.type||'audio/webm').split(';')[0]})});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||'Voice transcription failed.');
    const words=String(data.text||'').trim();if(!words)throw new Error('I could not hear clear words. Please try again.');
    transcript(words,'');status('Voice received','listening');replyTo(words);
   }catch(error){transcript('','Voice input: '+(error.message||'Unable to transcribe.'));status('Voice input failed')}
   finally{voiceBusy=false;if(button){button.disabled=false;button.textContent='Tap to speak'}}
  };
  voiceRecorder.start();if(button)button.textContent='Stop recording';status('Recording · speak now','listening');transcript('','Speak now. Tap Stop recording when you finish.');voiceTimer=setTimeout(()=>{if(voiceRecorder&&voiceRecorder.state==='recording')voiceRecorder.stop()},10000);
 }catch(error){
  voiceStream?.getTracks().forEach(t=>t.stop());voiceStream=null;voiceRecorder=null;
  if(button){button.disabled=false;button.textContent='Tap to speak'}
  status('Could not start voice recording');transcript('','The microphone could not start. Check that this site is allowed to use your microphone, then try again.');
 }
}
function show(){if(!page)return;page.innerHTML=panel();$('#orionTalk').onclick=start;$('#orionRecord').onclick=toggleVoiceRecording;$('#orionStop').onclick=()=>stop();$('#orionChatForm').onsubmit=e=>{e.preventDefault();const input=$('#orionTextInput'),send=$('#orionSend'),q=input.value.trim();if(!q)return;transcript(q,'');input.value='';send.disabled=true;askAI(q,false).finally(()=>{if($('#orionSend'))$('#orionSend').disabled=false})};document.querySelectorAll('[data-orion-say]').forEach(b=>b.onclick=()=>{const q=b.dataset.orionSay;transcript(q,'');replyTo(q)});if(!SpeechRecognition)$('#orionHint').textContent='Speech recognition is not available in this browser. You can still chat with ORION by typing.'}
function openPanel(){show();document.querySelectorAll('#nav button').forEach(x=>x.classList.toggle('active',x.id==='orionNav'));if($('#pageTitle'))$('#pageTitle').textContent='ORION Assistant'}
function activateAfterLogin(){openPanel();transcript('','Welcome back. ORION is starting automatically. Allow microphone access if your browser asks, then say “ORION” or “wake up” whenever you need me.');status('Starting microphone','listening');if(!started&&!manualStop){setTimeout(()=>{if(!started&&!manualStop)start()},350)}}
function addNav(){const nav=$('#nav'),btn=$('#orionNav');if(!nav||!btn)return;btn.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();openPanel();if(!started){transcript('','I am here. Start conversation to talk naturally with me.');status('Standby')}},true)}
function observeLogin(){const app=$('#appView');if(!app)return;let wasHidden=true;new MutationObserver(()=>{const visible=!app.classList.contains('hidden');if(visible&&wasHidden&&!window.__orionLoginGreeting){window.__orionLoginGreeting=true;setTimeout(()=>{if(!$('#welcomeView')?.classList.contains('hidden'))return;const utter='Welcome back. ORION is online. Open the ORION Assistant and enable wake-word listening when you are ready.';if(window.speechSynthesis){const u=new SpeechSynthesisUtterance(utter),v=voice();if(v){u.voice=v;u.lang=v.lang}else u.lang='en-IN';u.rate=.92;window.speechSynthesis.speak(u)}},700)}wasHidden=!visible}).observe(app,{attributes:true,attributeFilter:['class']})}
document.addEventListener('DOMContentLoaded',()=>{addNav();observeLogin()});if(document.readyState!=='loading'){addNav();observeLogin()}window.ORION={activateAfterLogin,stop};
window.addEventListener('beforeunload',()=>{clearTimeout(restartTimer);try{recognition?.stop();window.speechSynthesis?.cancel()}catch{}stopBargeWatch();});
})();