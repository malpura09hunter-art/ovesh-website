(()=>{'use strict';
const $=s=>document.querySelector(s);
let recognition=null,listening=false,speaking=false,started=false,manualStop=false,awaitingCommand=false,restartTimer=null,restartAttempts=0,lastWakeAt=0,recognitionFailed=false;
const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
const page=$('#page');
const panel=()=>`<section class="orion-shell orion-command-center" aria-labelledby="orionTitle">
<header class="orion-heading"><div class="orion-brand"><div class="orion-brand-mark">✧</div><div><div class="orion-kicker">OV CLOUD · PRIVATE INTELLIGENCE</div><h1 id="orionTitle">ORION <span>Command Center</span></h1><p>Voice, conversations and workspace intelligence in one place.</p></div></div><div class="orion-state"><i id="orionLed"></i><span id="orionStatus">Standby</span></div></header>
<div class="orion-metrics">
<div class="orion-metric"><span class="orion-metric-icon violet">✧</span><div><small>ASSISTANT STATUS</small><strong id="orionMetricStatus">Standby</strong><em>Private owner session</em></div></div>
<div class="orion-metric"><span class="orion-metric-icon blue">◉</span><div><small>VOICE MODE</small><strong>Continuous</strong><em>Start once · speak naturally</em></div></div>
<div class="orion-metric"><span class="orion-metric-icon teal">⌘</span><div><small>AI CONNECTION</small><strong>Smart routing</strong><em>Configured model provider</em></div></div>
<div class="orion-metric"><span class="orion-metric-icon purple">▣</span><div><small>SESSION SECURITY</small><strong>Owner only</strong><em>Protected OV CLOUD session</em></div></div>
</div>
<section class="orion-mission" aria-label="ORION Mission Control">
 <div class="orion-mission-top"><div><small>OWNER OPERATIONS · READ-ONLY SCAN</small><h2>Mission Control</h2><p>One command. A live briefing across the workspace.</p></div><button type="button" id="orionMissionRun" class="orion-mission-button">Run cloud scan <span>↗</span></button></div>
 <div class="orion-mission-tiles"><div><b>01</b><span>Storage</span></div><div><b>02</b><span>Clients</span></div><div><b>03</b><span>Orders</span></div><div><b>04</b><span>Security</span></div></div>
 <div id="orionMissionResult" class="orion-mission-result" aria-live="polite">Ready to scan. ORION will inspect available owner-session data without changing files, accounts, or security settings.</div>
</section>
<div class="orion-overview-grid">
<article class="orion-panel orion-live-panel">
<div class="orion-panel-head"><div><small>LIVE ASSISTANT</small><h2>Conversation workspace</h2></div><span class="orion-live-tag"><i></i> PRIVATE SESSION</span></div>
<div class="orion-voice-stage"><div class="orion-orb-wrap"><div class="orion-orb" id="orionOrb"><span>O</span></div><small id="orionActivity">READY WHEN YOU ARE</small></div><div class="orion-voice-copy"><strong>Your command center, connected.</strong><p>Talk to ORION, ask questions, or direct it to sections of your private workspace.</p><div class="orion-voice-actions"><button id="orionTalk" class="orion-primary" type="button">Start voice session <span>→</span></button><button id="orionRecord" class="orion-secondary" type="button">Tap to speak</button><button id="orionStop" class="orion-secondary" type="button" disabled>Pause</button></div></div></div>
<div class="orion-transcript"><div class="orion-message-head"><small><i class="orion-message-dot"></i> ORION RESPONSE</small><span>LIVE TRANSCRIPT</span></div><p id="orionReply" aria-live="polite">Hello. I'm ORION. Start a conversation and speak naturally. You do not need to say a wake word.</p><div class="orion-user-line"><small>YOU SAID</small><p id="orionHeard">Your spoken words will appear here.</p></div></div>
<form id="orionChatForm" class="orion-chat-form"><label class="orion-chat-label" for="orionTextInput">MESSAGE ORION</label><div class="orion-chat-row"><textarea id="orionTextInput" rows="2" maxlength="1800" placeholder="Ask ORION anything about your workspace…"></textarea><button id="orionSend" class="orion-primary" type="submit">Send ↑</button></div></form>
<p class="orion-hint" id="orionHint">Start once, allow microphone access, and speak naturally. ORION listens for each turn and resumes after replying. You can interrupt while ORION speaks.</p>
</article>
<aside class="orion-panel orion-side-panel">
<div class="orion-panel-head"><div><small>QUICK ACCESS</small><h2>Workspace commands</h2></div><span class="orion-count">04</span></div>
<div class="orion-command-list">
<button type="button" data-orion-say="Open my command center"><span class="orion-command-icon violet">⌂</span><span><b>Command Center</b><small>Workspace overview</small></span><i>↗</i></button>
<button type="button" data-orion-say="Open cloud storage"><span class="orion-command-icon blue">▤</span><span><b>Cloud Storage</b><small>Files and folders</small></span><i>↗</i></button>
<button type="button" data-orion-say="Show my client projects"><span class="orion-command-icon teal">◇</span><span><b>Client Projects</b><small>Project workspace</small></span><i>↗</i></button>
<button type="button" data-orion-say="Open security"><span class="orion-command-icon amber">⬡</span><span><b>Security Center</b><small>Login and security activity</small></span><i>↗</i></button>
</div>
<div class="orion-routing"><div class="orion-panel-head"><div><small>INTELLIGENCE FLOW</small><h2>How ORION works</h2></div><span class="orion-flow-live">● READY</span></div>
<div class="orion-flow-3d" aria-label="ORION three-dimensional workflow: voice input, AI reasoning, cloud action, response"><div class="orion-flow-scene"><div class="orion-flow-grid"></div><div class="orion-flow-path"></div><div class="orion-flow-nodes"><div class="orion-flow-node"><i>◉</i><span>Listen</span><small>Voice input</small></div><div class="orion-flow-node"><i>✧</i><span>Understand</span><small>AI reasoning</small></div><div class="orion-flow-node"><i>⌘</i><span>Operate</span><small>Cloud tools</small></div><div class="orion-flow-node"><i>↗</i><span>Respond</span><small>Verified result</small></div></div></div></div>
<div class="orion-flow-legend"><span><i class="violet"></i> Voice input</span><span><i class="blue"></i> AI reasoning</span><span><i class="teal"></i> Spoken reply</span></div></div>
<div class="orion-privacy"><div class="orion-privacy-icon">⌑</div><div><strong>OWNER SESSION PROTECTED</strong><p>Microphone access is controlled by your browser. Audio is sent to the configured transcription service only when you speak during an active voice session.</p></div></div>
</aside></div>
</section>`;

function status(s,mode=''){const el=$('#orionStatus');if(el)el.textContent=s;const led=$('#orionLed'),orb=$('#orionOrb'),act=$('#orionActivity');if(led)led.className=mode;if(orb)orb.className='orion-orb '+mode;if(act)act.textContent=s.toUpperCase()}
function transcript(user,reply){if(user&&$('#orionHeard'))$('#orionHeard').textContent=user;if(reply&&$('#orionReply'))$('#orionReply').textContent=reply}
function voice(){if(!window.speechSynthesis)return null;const voices=window.speechSynthesis.getVoices();return voices.find(v=>/^en[-_]IN$/i.test(v.lang)&&/female|natural|google/i.test(v.name))||voices.find(v=>/^en[-_]IN$/i.test(v.lang))||voices.find(v=>/^en/i.test(v.lang))||voices.find(v=>v.default)||voices[0]}

let conversationStream=null,conversationContext=null,conversationAnalyser=null,conversationBuffer=null,conversationFrame=0,conversationRecorder=null,conversationChunks=[],conversationStartedAt=0,conversationLastVoice=0,conversationSpeechFrames=0,conversationUploading=false,conversationReplying=false;
function stopConversationEngine(){
 if(conversationFrame)cancelAnimationFrame(conversationFrame);conversationFrame=0;
 if(conversationRecorder&&conversationRecorder.state==='recording'){try{conversationRecorder.stop()}catch{}}
 conversationRecorder=null;conversationChunks=[];
 if(conversationStream){conversationStream.getTracks().forEach(t=>t.stop());conversationStream=null}
 if(conversationContext){try{conversationContext.close()}catch{}conversationContext=null}
 conversationAnalyser=null;conversationBuffer=null;conversationUploading=false;conversationReplying=false;
}
function startConversationListening(){
 if(!started||manualStop||speaking||conversationFrame||conversationUploading||!conversationStream||!conversationAnalyser)return;
 status('Listening · speak naturally','listening');
 const tick=()=>{
  if(!started||manualStop||!conversationStream||!conversationAnalyser){conversationFrame=0;return}
  if(speaking||bargeRecording||conversationUploading||conversationReplying){conversationFrame=requestAnimationFrame(tick);return}
  conversationAnalyser.getByteTimeDomainData(conversationBuffer);
  let sum=0;for(let i=0;i<conversationBuffer.length;i++){const v=(conversationBuffer[i]-128)/128;sum+=v*v}
  const rms=Math.sqrt(sum/conversationBuffer.length);
  if(!conversationRecorder){
   if(rms>0.022)conversationSpeechFrames++;else conversationSpeechFrames=Math.max(0,conversationSpeechFrames-1);
   if(conversationSpeechFrames>=4){
    try{
     const mime=MediaRecorder.isTypeSupported('audio/webm;codecs=opus')?'audio/webm;codecs=opus':'audio/webm';
     conversationRecorder=new MediaRecorder(conversationStream,{mimeType:mime,audioBitsPerSecond:48000});
     conversationChunks=[];conversationStartedAt=Date.now();conversationLastVoice=Date.now();
     conversationRecorder.ondataavailable=e=>{if(e.data&&e.data.size)conversationChunks.push(e.data)};
     conversationRecorder.onstop=()=>{const blob=new Blob(conversationChunks,{type:conversationRecorder?.mimeType||'audio/webm'});conversationRecorder=null;conversationChunks=[];conversationSpeechFrames=0;processConversationAudio(blob)};
     conversationRecorder.start(250);status('Listening to you…','listening');
    }catch(error){conversationRecorder=null;status('Microphone recording unavailable');transcript('','I could not start voice capture. Please check your browser microphone settings.')}
   }
  }else{
   if(rms>0.018)conversationLastVoice=Date.now();
   if(Date.now()-conversationLastVoice>950||Date.now()-conversationStartedAt>9500){
    const rec=conversationRecorder;conversationRecorder=null;
    try{if(rec.state==='recording')rec.stop()}catch{}
   }
  }
  conversationFrame=requestAnimationFrame(tick);
 };
 conversationFrame=requestAnimationFrame(tick);
}
async function processConversationAudio(blob){
 if(!started||manualStop)return;
 if(!blob||blob.size<1200){startConversationListening();return}
 if(blob.size>500000){transcript('','That was a long voice message. Please speak in shorter sentences.');startConversationListening();return}
 conversationUploading=true;status('Understanding your words…','thinking');
 try{
  const reader=new FileReader();
  const encoded=await new Promise((resolve,reject)=>{reader.onload=()=>resolve(String(reader.result||'').split(',')[1]||'');reader.onerror=()=>reject(new Error('Could not read microphone audio.'));reader.readAsDataURL(blob)});
  const response=await fetch('/api/oveshcloud-auth?action=orion-transcribe',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({audio:encoded,mimeType:'audio/webm'})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error||'Voice transcription failed.');
  const words=String(data.text||'').trim();
  if(words){transcript(words,'');conversationUploading=false;replyTo(words);return}
  throw new Error('I could not hear clear words.');
 }catch(error){transcript('','I had trouble understanding that. '+(error.message||'Please try again.'));status('Listening · try again','listening')}
 finally{conversationUploading=false;if(started&&!manualStop&&!speaking)startConversationListening()}
}

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
function speak(text,thenListen=true){if(listening){try{recognition?.stop()}catch{}listening=false}transcript('',text);if(!window.speechSynthesis){conversationReplying=false;if(thenListen)startConversationListening();return}const spoken=speechFriendlyText(text)||String(text||'');const synth=window.speechSynthesis;synth.cancel();speaking=true;status('Speaking · you can interrupt','speaking');const u=new SpeechSynthesisUtterance(spoken),v=voice();if(v){u.voice=v;u.lang=v.lang}else u.lang='en-IN';u.rate=.92;u.pitch=1.02;u.volume=1;u.onend=()=>{speaking=false;conversationReplying=false;if(!bargeRecording)stopBargeWatch();if(thenListen&&started&&!manualStop&&!bargeRecording){startConversationListening()}else if(!started&&!bargeRecording)status('Standby')};u.onerror=()=>{speaking=false;conversationReplying=false;if(!bargeRecording)stopBargeWatch();if(thenListen&&started&&!manualStop&&!bargeRecording)startConversationListening();else if(!bargeRecording)status('Standby')};synth.speak(u);startBargeWatch()}
async function loadShopOrders(){
 const response=await fetch('/api/oveshcloud-auth?action=shop-orders',{method:'GET',credentials:'same-origin',headers:{'Accept':'application/json','Cache-Control':'no-cache'}});
 const data=await response.json().catch(()=>({}));
 if(!response.ok||data.ok!==true||!Array.isArray(data.orders))throw new Error(data.error||'Shop Orders could not be loaded. Please verify your OV CLOUD owner session.');
 return data.orders;
}
function orderDateValue(value){
 if(!value)return null;
 if(typeof value==='string'||typeof value==='number'){const d=new Date(value);return Number.isNaN(d.getTime())?null:d}
 if(value&&typeof value.toDate==='function'){const d=value.toDate();return Number.isNaN(d.getTime())?null:d}
 if(value&&typeof value.seconds==='number'){const d=new Date(value.seconds*1000);return Number.isNaN(d.getTime())?null:d}
 return null;
}
function lastCalendarMonthRange(now=new Date()){
 const start=new Date(now.getFullYear(),now.getMonth()-1,1);
 const end=new Date(now.getFullYear(),now.getMonth(),1);
 return {start,end,label:start.toLocaleDateString('en-IN',{month:'long',year:'numeric'})};
}
function summarizeShopOrders(orders){
 const countStatus=test=>orders.filter(o=>test(String(o.status||'Pending').toLowerCase())).length;
 return {total:orders.length,pending:countStatus(s=>s.includes('pending')),reviewing:countStatus(s=>s.includes('review')),inProgress:countStatus(s=>s.includes('progress')||s.includes('working')),completed:countStatus(s=>s.includes('complete')||s.includes('delivered')),rejected:countStatus(s=>s.includes('reject')||s.includes('cancel')),value:orders.reduce((n,o)=>n+(Number(o.estimatedTotal)||0),0)};
}
async function cloudCommand(raw,speakResponse=true){
 const q=String(raw||'').trim(),lower=q.toLowerCase();
 const storage=window.OVESH_STORAGE,files=()=>Array.isArray(storage?.files)?storage.files:[];
 const refresh=async()=>{if(typeof storage?.listFiles!=='function')throw new Error('Cloud storage is not ready yet.');return await storage.listFiles()};
 const say=(message)=>{if(speakResponse)speak(message,true);else{transcript('',message);status('Cloud action complete')}};
 const loadClientAccounts=async()=>{
  const response=await fetch('/api/oveshcloud-client-admin',{method:'GET',credentials:'include',headers:{'Accept':'application/json','Cache-Control':'no-cache'}});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||!Array.isArray(data.clients))throw new Error(data.error||'Client Cloud data could not be loaded. Please verify your owner session.');
  return data.clients;
 };
 const clientBytes=n=>{n=Number(n||0);if(!n)return'0 bytes';const units=['bytes','KB','MB','GB','TB'],i=Math.min(4,Math.floor(Math.log(n)/Math.log(1024)));return(n/1024**i).toFixed(i?1:0)+' '+units[i]};
 const clientIntent=/\b(?:client cloud|client accounts?|clients|client directory|client list|list clients|customer accounts?)\b/i.test(q);
 if(clientIntent){
  try{
   const clients=await loadClientAccounts(),active=clients.filter(c=>String(c.status||'').toLowerCase()==='active'),suspended=clients.filter(c=>String(c.status||'').toLowerCase()!=='active');
   const used=clients.reduce((n,c)=>n+Number(c.usedBytes||0),0),quota=clients.reduce((n,c)=>n+Number(c.quotaBytes||0),0);
   if(/\b(?:how many|count|number|total)\b/i.test(q)&&/\b(?:active|enabled)\b/i.test(q)){say('You have '+active.length+' active client accounts.');return true}
   if(/\b(?:how many|count|number|total)\b/i.test(q)&&/\b(?:suspended|inactive|disabled)\b/i.test(q)){say('You have '+suspended.length+' suspended or non-active client accounts.');return true}
   if(/\b(?:storage|space|usage|used|quota)\b/i.test(q)){
    const ranked=clients.slice().sort((a,b)=>Number(b.usedBytes||0)-Number(a.usedBytes||0));
    const top=ranked[0];
    say('Your '+clients.length+' client accounts use '+clientBytes(used)+' of '+clientBytes(quota)+' total allocated quota.'+(top?' The highest reported usage is '+(top.name||'an unnamed client')+' at '+clientBytes(top.usedBytes)+'.':''));
    return true;
   }
   if(/\b(?:list|show|name|who|which|directory)\b/i.test(q)){
    const rows=clients.slice(0,10).map(c=>(c.name||'Unnamed client')+(c.company?' at '+c.company:'')+', '+(c.status||'status unavailable')).join('; ');
    say(clients.length?'You have '+clients.length+' client accounts. '+rows+(clients.length>10?'; and '+(clients.length-10)+' more.':''):'There are no client accounts in Client Cloud yet.');
    return true;
   }
   say('Your Client Cloud summary: '+clients.length+' total accounts, '+active.length+' active, '+suspended.length+' suspended or non-active. Reported storage used: '+clientBytes(used)+' of '+clientBytes(quota)+' allocated.');
   return true;
  }catch(error){say('I could not read Client Cloud data. '+(error?.message||'Please try again.'));return true}
 }
  if(/\b(?:shop\s+orders?|orders?|sales|store\s+orders?)\b/i.test(q)){
   const orders=await loadShopOrders(),stats=summarizeShopOrders(orders);
   const byNewest=orders.slice().sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
   const recent=byNewest.slice(0,5),money=n=>'₹'+Number(n||0).toLocaleString('en-IN',{maximumFractionDigits:2});
   if(/\b(?:pending|awaiting|not processed|unfulfilled)\b/i.test(q)){
    const pending=orders.filter(o=>/pending|reviewing/i.test(String(o.status||'Pending')));
    say(pending.length?'There are '+pending.length+' pending or reviewing shop orders. '+pending.slice(0,6).map(o=>(o.orderId||o.id)+' for '+(o.selectedService||'a service')+', status '+(o.status||'Pending')).join('. '):'There are no pending or reviewing shop orders.');return true;
   }
   if(/\b(?:latest|recent|newest)\b/i.test(q)){
    say(recent.length?'Your '+recent.length+' most recent shop orders are: '+recent.map(o=>(o.orderId||o.id)+' — '+(o.selectedService||'service')+' — '+(o.status||'Pending')+' — '+(o.createdAt?new Date(o.createdAt).toLocaleDateString():'date unavailable')).join('. '):'There are no shop orders yet.');return true;
   }
   if(/\b(?:last month|previous month|past month)\b/i.test(q)){
    const range=lastCalendarMonthRange(),filtered=orders.filter(o=>{const d=orderDateValue(o.createdAt);return d&&d>=range.start&&d<range.end;});
    const totalValue=filtered.reduce((n,o)=>n+(Number(o.estimatedTotal)||0),0);
    say('There were '+filtered.length+' shop orders in '+range.label+'. '+filtered.filter(o=>/pending/i.test(String(o.status||''))).length+' pending, '+filtered.filter(o=>/complete|delivered/i.test(String(o.status||''))).length+' completed. Recorded estimated order value: ₹'+totalValue.toLocaleString('en-IN',{maximumFractionDigits:2})+'. This is order value, not confirmed collected revenue. I checked the order creation dates.');
    return true;
   }
   if(/\b(?:revenue|sales|total value|order value|amount)\b/i.test(q)){
    say('I found '+stats.total+' shop orders. Their recorded estimated order value totals '+money(stats.value)+'. This is order value, not confirmed payments. Payment status is recorded separately.');return true;
   }
   say('Your Shop Orders summary: '+stats.total+' total. '+stats.pending+' pending, '+stats.reviewing+' reviewing, '+stats.inProgress+' in progress, '+stats.completed+' completed, and '+stats.rejected+' rejected or cancelled. Recorded estimated order value: '+money(stats.value)+'. This is not confirmed collected revenue.');return true;
  }
 const findFile=(name)=>{const needle=String(name||'').trim().replace(/^["']|["']$/g,'').toLowerCase();if(!needle)return null;const all=files();return all.find(f=>String(f.name||'').toLowerCase()===needle)||all.find(f=>String(f.name||'').toLowerCase().includes(needle))||null};
 const showStorage=()=>{if(typeof window.render==='function')window.render('storage')};
 try{
  if(/^(?:check|show|get|tell me|what is|what's).*(?:cloud|storage).*(?:status|usage|health|space)|^(?:storage|cloud)\s+(?:status|usage|health)$/i.test(q)){
   const result=await storage.api({action:'status'});const list=await refresh();const bytes=list.reduce((n,f)=>n+Number(f.size||0),0);
   showStorage();say('Your private Backblaze storage connection is '+(result.ok?'available':'not available')+'. I found '+list.length+' files using '+formatBytes(bytes)+'.');return true;
  }
  if(/^(?:list|show|find all|read out|what are).*(?:files|documents|assets)|^(?:list files|show files|what files do i have)$/i.test(q)){
   const list=await refresh();showStorage();if(!list.length){say('Your cloud storage currently has no files in the index.');return true}
   const names=list.slice(0,12).map(f=>f.name).filter(Boolean);say('I found '+list.length+' files. '+names.join(', ')+(list.length>12?'. And '+(list.length-12)+' more.':''));return true;
  }
  let m=q.match(/^(?:search|find|locate)\s+(?:for\s+)?(?:a\s+)?file\s+(?:named\s+)?(.+)$/i);
  if(m){await refresh();const f=findFile(m[1]);showStorage();if(!f){say('I could not find a file matching '+m[1]+'.');return true}say('I found '+f.name+'. Would you like me to preview, download, or share it?');return true}
  m=q.match(/^(?:preview|view|open)\s+(?:the\s+)?file\s+(.+)$/i)||q.match(/^open\s+(.+\.[a-z0-9]{2,8})$/i);
  if(m){await refresh();const f=findFile(m[1]);if(!f){say('I could not find that file in your private storage.');return true}if(!window.OVESH_B2_ACTIONS?.preview){say('The secure file preview module is not ready.');return true}showStorage();await window.OVESH_B2_ACTIONS.preview(f.objectKey||f.id);say('Opening '+f.name+' in the secure preview.');return true}
  m=q.match(/^(?:download|get)\s+(?:the\s+)?file\s+(.+)$/i);
  if(m){await refresh();const f=findFile(m[1]);if(!f){say('I could not find that file in your private storage.');return true}showStorage();await storage.downloadRemote(f.objectKey||f.id);say('The secure download for '+f.name+' has been prepared.');return true}
  m=q.match(/^(?:share)\s+(?:the\s+)?file\s+(.+)$/i);
  if(m){await refresh();const f=findFile(m[1]);if(!f){say('I could not find that file in your private storage.');return true}if(!window.OVESH_SHARE?.share){say('Secure sharing is not ready.');return true}showStorage();window.OVESH_SHARE.share(f.objectKey||f.id);say('I opened the secure sharing options for '+f.name+'. Choose the sharing method and expiration.');return true}
  m=q.match(/^(?:create|make|add)\s+(?:a\s+)?folder\s+(?:called\s+|named\s+)?(.+)$/i);
  if(m){const folder=m[1].trim().replace(/^["']|["']$/g,'');if(!folder||folder.length>100||/[\\\0]/.test(folder)){say('That folder name is not valid.');return true}if(!confirm('Create this folder in your private OV CLOUD storage?\n\n'+folder))return true;const result=await storage.api({action:'create-folder',folder});await refresh();showStorage();say(result.ok?'Folder '+folder+' has been created.':'I could not create that folder.');return true}
  m=q.match(/^(?:move)\s+(?:the\s+)?file\s+(.+?)\s+to\s+(?:folder\s+)?(.+)$/i);
  if(m){await refresh();const f=findFile(m[1]);if(!f){say('I could not find the source file.');return true}const dest=m[2].trim().replace(/^["']|["']$/g,'').replace(/^\/+|\/+$/g,'');if(!dest||dest.includes('..')){say('That destination folder is not valid.');return true}const leaf=String(f.objectKey||f.id).split('/').pop();const ownerPrefix=String(f.objectKey||f.id).split('/').slice(0,2).join('/')+'/';const destinationKey=ownerPrefix+dest+'/'+leaf;if(!confirm('Move '+f.name+' to '+dest+'? The original object will be removed after the move succeeds.'))return true;await storage.moveRemote(f.objectKey||f.id,destinationKey,'file');await refresh();showStorage();say('The move request for '+f.name+' completed.');return true}
  m=q.match(/^(?:delete|trash|remove)\s+(?:the\s+)?file\s+(.+)$/i);
  if(m){await refresh();const f=findFile(m[1]);if(!f){say('I could not find that file.');return true}if(!confirm('Move '+f.name+' to OV CLOUD Trash? You can restore it later.'))return true;const result=await storage.api({action:'trash',objectKey:f.objectKey||f.id,kind:'file'});await refresh();showStorage();say(result.ok?'I moved '+f.name+' to Trash. It has not been permanently erased.':'I could not move the file to Trash.');return true}
  if(/^(?:upload|add)\s+(?:a\s+)?files?$/i.test(q)){showStorage();say('Cloud Storage is open. Use the Upload button to choose files from your device. I will not upload anything until you select it.');return true}
 }catch(error){say('I could not complete that cloud action. '+(error?.message||'Please try again.'));return true}
 return false;
}
function formatBytes(n){n=Number(n||0);if(!n)return'0 bytes';const units=['bytes','KB','MB','GB','TB'],i=Math.min(4,Math.floor(Math.log(n)/Math.log(1024)));return(n/1024**i).toFixed(i?1:0)+' '+units[i]}
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
let lastWorkspacePage='command';
const workspaceAliases=[
 {page:'command',label:'Command Center',terms:/\b(?:dashboard|home|overview|main screen|control room|command center)\b/},
 {page:'storage',label:'Cloud Storage',terms:/\b(?:my files|file manager|documents|storage|uploads|folders)\b/},
 {page:'projects',label:'Client Projects',terms:/\b(?:client work|project workspace|projects|project list)\b/},
 {page:'activity',label:'Activity',terms:/\b(?:what happened|recent events|activity|audit trail|history)\b/},
 {page:'security',label:'Security',terms:/\b(?:security center|security logs|login events|sign in activity)\b/},
 {page:'college',label:'College',terms:/\b(?:study workspace|college|subjects|practicals|assignments)\b/},
 {page:'client-cloud',label:'Client Cloud',terms:/\b(?:manage clients|client management|customer accounts|client accounts|my customers)\b/},
 {page:'shop-orders',label:'Shop Orders',terms:/\b(?:store orders|shop orders|sales orders|orders)\b/}
];
function smartNavigation(raw,speakResponse=true){
 const q=String(raw||'').toLowerCase().replace(/[’']/g,'').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
 const navIntent=/\b(?:open|go|take me|bring up|show|switch|navigate|head to|let me see|i need|i want to see|where can i|where do i)\b/.test(q);
 const item=workspaceAliases.find(x=>x.terms.test(q));
 if(!item||!navIntent)return false;
 lastWorkspacePage=item.page;
 if(typeof window.render==='function')window.render(item.page);else document.querySelector('[data-page="'+item.page+'"]')?.click();
 const message='Got it. '+item.label+' is open. You can ask me to inspect it, summarize it, or take the next step.';
 if(speakResponse)speak(message,true);else{transcript('',message);status('Workspace opened')}
 return true;
}
function renderMissionResult(message,details=[],speakResponse=true){
 const target=$('#orionMissionResult');
 if(target)target.innerHTML='<strong>'+message.replace(/[<>&"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]))+'</strong>'+(details.length?'<ul>'+details.map(x=>'<li>'+String(x).replace(/[<>&"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]))+'</li>').join('')+'</ul>':'');
 if(speakResponse)speak(message+(details.length?' '+details.join('. '):''),true);else{transcript('',message+(details.length?' '+details.join('. '):''));status('Mission report ready')}
}
async function runMissionControl(speakResponse=true){
 const target=$('#orionMissionResult');if(target)target.textContent='Scanning storage, client accounts, shop orders and security events…';
 status('Mission scan in progress','thinking');
 const storage=window.OVESH_STORAGE;
 const tasks=[
  (async()=>{if(!storage?.api||!storage?.listFiles)throw new Error('Storage module unavailable');const [health,files]=await Promise.all([storage.api({action:'status'}),storage.listFiles()]);return{health,files:Array.isArray(files)?files:[]}})(),
  (async()=>{const r=await fetch('/api/oveshcloud-client-admin',{credentials:'include',headers:{Accept:'application/json','Cache-Control':'no-cache'}});const d=await r.json().catch(()=>({}));if(!r.ok||!Array.isArray(d.clients))throw new Error(d.error||'Client data unavailable');return d.clients})(),
  loadShopOrders(),
  (async()=>{const r=await fetch('/api/oveshcloud-auth?action=security-events',{credentials:'same-origin',headers:{Accept:'application/json','Cache-Control':'no-cache'}});const d=await r.json().catch(()=>({}));if(!r.ok||!Array.isArray(d.events))throw new Error(d.error||'Security events unavailable');return d.events})()
 ];
 const results=await Promise.allSettled(tasks),names=['Storage','Client Cloud','Shop Orders','Security'];
 const data=results.map((r,i)=>({name:names[i],ok:r.status==='fulfilled',value:r.status==='fulfilled'?r.value:null,error:r.status==='rejected'?(r.reason?.message||'Unavailable'):''}));
 const details=[],alerts=[];
 const st=data[0];
 if(st.ok){const bytes=st.value.files.reduce((n,x)=>n+Number(x.size||0),0);details.push('Storage: '+st.value.files.length+' indexed files, '+formatBytes(bytes)+'. Connection '+(st.value.health?.ok?'available':'reported unavailable')+'.');if(!st.value.health?.ok)alerts.push('Storage connection needs checking')}
 const cl=data[1];
 if(cl.ok){const clients=cl.value,active=clients.filter(x=>String(x.status||'').toLowerCase()==='active').length,near=clients.filter(x=>Number(x.quotaBytes)>0&&Number(x.usedBytes||0)/Number(x.quotaBytes)>=.8);details.push('Clients: '+clients.length+' accounts, '+active+' active. '+near.length+' at or above 80% of reported quota.');if(near.length)alerts.push(near.length+' client accounts are nearing their storage limit')}
 const od=data[2];
 if(od.ok){const orders=od.value,pending=orders.filter(x=>/pending|review/i.test(String(x.status||'pending'))).length;details.push('Shop Orders: '+orders.length+' total, '+pending+' pending or reviewing.');if(pending)alerts.push(pending+' orders need review')}
 const sec=data[3];
 if(sec.ok){const high=sec.value.filter(x=>/high|critical/i.test(String(x.severity||''))),blocked=sec.value.filter(x=>/blocked|denied|failure/i.test(String(x.outcome||'')));details.push('Security: '+sec.value.length+' recent events inspected; '+high.length+' high/critical severity and '+blocked.length+' blocked/failed outcomes.');if(high.length)alerts.push(high.length+' high/critical security events in the recent event window')}
 const unavailable=data.filter(x=>!x.ok).map(x=>x.name);
 details.push('Cost visibility: OV CLOUD can report file usage and client quota consumption from connected systems. No live provider billing or invoice integration is configured, so this scan cannot calculate actual cloud charges or savings.');
 if(unavailable.length)details.push('Unavailable sources: '+unavailable.join(', ')+'. This is a partial report.');
 const headline=alerts.length?'Scan complete. '+alerts.length+' attention item'+(alerts.length===1?'':'s')+' found.':unavailable.length?'Partial scan complete. Some sources could not be checked.':'Scan complete. No attention flags were found in the available data.';
 renderMissionResult(headline,details,speakResponse);
 return{headline,details,alerts,unavailable};
}
async function replyTo(raw,speakResponse=true){
 const original=String(raw||'').trim();
 const q=original.toLowerCase().replace(/[’']/g,'').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
 if(!q){if(speakResponse)speak('I did not catch that. Please repeat your command.',true);else transcript('','I did not catch that. Please repeat your command.');return}
 // Mission Control is an explicit read-only multi-source operation.
 if(/\b(?:scan|check|audit|inspect|review|run)\b.{0,70}\b(?:cloud|workspace|ov cloud|ovesh cloud|storage|health|costs?|billing|accounts?|security|everything|all systems)\b|\b(?:cloud|workspace|storage)\s+(?:health|cost|security)\s+(?:scan|check|report)\b|\b(?:mission control|daily briefing|brief me|what needs attention|anything unusual|full cloud report|quick scan|health and cost scan|health & cost scan)\b/i.test(original)){
  try{await runMissionControl(speakResponse)}catch(error){const msg='Mission scan could not complete. '+(error?.message||'Please try again.');if(speakResponse)speak(msg,true);else{transcript('',msg);status('Mission scan failed')}}return;
 }
 if(smartNavigation(original,speakResponse))return;
 // Resolve workspace navigation before data commands or AI so phrases like
 // "could you please take me to Client Cloud" never fall through to generic chat.
 const cleaned=q
  .replace(/\b(?:hey\s+orion|okay\s+orion|ok\s+orion|orion)\b/g,' ')
  .replace(/\b(?:please|for me|right now|now|thanks|thank you|could you|can you|would you|i want you to|i need you to|take me|bring me)\b/g,' ')
  .replace(/\s+/g,' ').trim();
 const routes=[
  {page:'command',label:'Command Center',patterns:[/\bcommand\s*center\b/,/\bdashboard\b/,/\bhome\b/]},
  {page:'storage',label:'Cloud Storage',patterns:[/\bcloud\s*storage\b/,/\bstorage\b/,/\bfile\s*manager\b/]},
  {page:'projects',label:'Client Projects',patterns:[/\bclient\s*projects?\b/,/\bproject\s*workspace\b/,/\bprojects?\b/]},
  {page:'activity',label:'Activity',patterns:[/\bactivity(?:\s+log)?\b/,/\brecent\s+activity\b/]},
  {page:'security',label:'Security',patterns:[/\bsecurity(?:\s+(?:center|console|logs?))?\b/,/\blogin\s+activity\b/]},
  {page:'college',label:'College',patterns:[/\bcollege\b/,/\bstudy\s+workspace\b/,/\bsubjects\b/]},
  {page:'client-cloud',label:'Client Cloud',patterns:[/\bclient\s*cloud\b/,/\bclient\s+management\b/]},
  {page:'shop-orders',label:'Shop Orders',patterns:[/\bshop\s+orders?\b/,/\border\s+management\b/]}
 ];
 const navigationVerb=/\b(?:open|go|show|navigate|switch|access|enter|visit|load|display|bring\s+up|take\s+me\s+to|head\s+to)\b/.test(cleaned);
 const route=routes.find(item=>item.patterns.some(pattern=>pattern.test(cleaned)));
 if(route&&navigationVerb){
  if(typeof window.render==='function')window.render(route.page);
  else document.querySelector('[data-page="'+route.page+'"]')?.click();
  const message='Opening '+route.label+'.';
  if(speakResponse)speak(message,true);else{transcript('',message);status('Workspace opened')}
  return;
 }
 if(await cloudCommand(original,speakResponse))return;
 await askAI(original,speakResponse);
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
async function start(){
 if(started)return;
 if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){status('Secure microphone access required');$('#orionHint').textContent='Open OV CLOUD in the latest Chrome or Edge over HTTPS to use continuous voice conversation.';return}
 started=true;manualStop=false;recognitionFailed=false;awaitingCommand=false;conversationMode=true;
 if($('#orionTalk'))$('#orionTalk').disabled=true;if($('#orionStop'))$('#orionStop').disabled=false;
 transcript('','Connecting your microphone…');status('Starting voice conversation','listening');
 try{
  conversationStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true,channelCount:1}});
  if(!started||manualStop){stopConversationEngine();return}
  const AudioCtx=window.AudioContext||window.webkitAudioContext;
  if(!AudioCtx)throw new Error('Web Audio is not supported in this browser.');
  conversationContext=new AudioCtx();await conversationContext.resume();
  const source=conversationContext.createMediaStreamSource(conversationStream);
  conversationAnalyser=conversationContext.createAnalyser();conversationAnalyser.fftSize=2048;
  source.connect(conversationAnalyser);conversationBuffer=new Uint8Array(conversationAnalyser.fftSize);
  transcript('','ORION is ready. Speak naturally; you do not need to press the microphone again.');
  $('#orionHint').textContent='Continuous conversation is active. Speak naturally, pause when you finish, and ORION will reply. During replies, the interruption listener is available.';
  startConversationListening();
 }catch(error){
  stopConversationEngine();started=false;manualStop=true;
  if($('#orionTalk'))$('#orionTalk').disabled=false;if($('#orionStop'))$('#orionStop').disabled=true;
  status('Could not start voice conversation');
  $('#orionHint').textContent=error?.name==='NotAllowedError'?'Allow microphone access for this site, then click Start conversation again.':(error?.message||'Check your microphone and try again.');
 }
}
function stop(message='Voice conversation paused. Click Start conversation when you are ready.'){manualStop=true;started=false;awaitingCommand=false;listening=false;clearTimeout(restartTimer);try{recognition?.stop()}catch{}try{window.speechSynthesis?.cancel()}catch{}stopBargeWatch();stopConversationEngine();speaking=false;if($('#orionTalk'))$('#orionTalk').disabled=false;if($('#orionStop'))$('#orionStop').disabled=true;status('Standby');if(message){transcript('',message)}}

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
function show(){if(!page)return;page.innerHTML=panel();$('#orionMissionRun')?.addEventListener('click',()=>runMissionControl(false).catch(e=>renderMissionResult('Mission scan failed: '+(e?.message||'Please try again.'),[],false)));$('#orionTalk').onclick=start;$('#orionRecord').onclick=toggleVoiceRecording;$('#orionStop').onclick=()=>stop();$('#orionChatForm').onsubmit=e=>{e.preventDefault();const input=$('#orionTextInput'),send=$('#orionSend'),q=input.value.trim();if(!q)return;transcript(q,'');input.value='';send.disabled=true;replyTo(q,false).finally(()=>{if($('#orionSend'))$('#orionSend').disabled=false})};document.querySelectorAll('[data-orion-say]').forEach(b=>b.onclick=()=>{const q=b.dataset.orionSay;transcript(q,'');replyTo(q)});if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)$('#orionHint').textContent='Continuous microphone conversation is not supported in this browser. You can still chat with ORION by typing.'}
function openPanel(){show();document.querySelectorAll('#nav button').forEach(x=>x.classList.toggle('active',x.id==='orionNav'));if($('#pageTitle'))$('#pageTitle').textContent='ORION Assistant'}
function activateAfterLogin(){openPanel();transcript('','Welcome back. ORION is starting automatically. Allow microphone access if your browser asks, then say “ORION” or “wake up” whenever you need me.');status('Starting microphone','listening');if(!started&&!manualStop){setTimeout(()=>{if(!started&&!manualStop)start()},350)}}
function addNav(){const nav=$('#nav'),btn=$('#orionNav');if(!nav||!btn)return;btn.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();openPanel();if(!started){transcript('','I am here. Start conversation to talk naturally with me.');status('Standby')}},true)}
function observeLogin(){const app=$('#appView');if(!app)return;let wasHidden=true;new MutationObserver(()=>{const visible=!app.classList.contains('hidden');if(visible&&wasHidden&&!window.__orionLoginGreeting){window.__orionLoginGreeting=true;setTimeout(()=>{if(!$('#welcomeView')?.classList.contains('hidden'))return;const utter='Welcome back. ORION is online. Open the ORION Assistant and enable wake-word listening when you are ready.';if(window.speechSynthesis){const u=new SpeechSynthesisUtterance(utter),v=voice();if(v){u.voice=v;u.lang=v.lang}else u.lang='en-IN';u.rate=.92;window.speechSynthesis.speak(u)}},700)}wasHidden=!visible}).observe(app,{attributes:true,attributeFilter:['class']})}
document.addEventListener('DOMContentLoaded',()=>{addNav();observeLogin()});if(document.readyState!=='loading'){addNav();observeLogin()}window.ORION={activateAfterLogin,stop};
window.addEventListener('beforeunload',()=>{clearTimeout(restartTimer);try{recognition?.stop();window.speechSynthesis?.cancel()}catch{}stopBargeWatch();});
})();