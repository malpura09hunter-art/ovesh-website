(()=>{'use strict';
const esc=s=>String(s??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
let injected=false;
function collectContext(){
  const lines=[];
  const page=document.querySelector('#page');
  if(page) lines.push('CURRENT PAGE: '+(document.querySelector('#pageTitle')?.textContent||'Unknown'));
  try{
    if(window.firebase?.auth?.().currentUser) lines.push('AUTHENTICATED OWNER: yes');
    const nav=[...document.querySelectorAll('#nav button')].map(x=>x.textContent.trim()).filter(Boolean);
    if(nav.length) lines.push('NAVIGATION: '+nav.join(' | '));
  }catch{}
  if(page) lines.push('VISIBLE WORKSPACE TEXT:\n'+page.innerText.slice(0,12000));
  return lines.join('\n').slice(0,28000);
}
function add(){
  if(injected||!document.querySelector('#page')||!document.querySelector('#pageTitle'))return;
  const title=document.querySelector('#pageTitle').textContent.trim();
  if(title!=='Command Center')return;
  const page=document.querySelector('#page');
  if(page.querySelector('.ask-ovesh-card')){injected=true;return}
  const card=document.createElement('section');
  card.className='ask-ovesh-card';
  card.innerHTML=`<div class="ask-ovesh-head"><div class="ask-ovesh-title"><div class="ask-ovesh-orb">AI</div><div><h3>ASK OVESH AI</h3><p>Your intelligent cloud workspace assistant</p></div></div><span class="ask-ovesh-status">READY</span></div><div class="ask-ovesh-prompts"><button data-ai-prompt="Find my most relevant files">Find relevant files</button><button data-ai-prompt="What is in my College workspace?">Analyze College</button><button data-ai-prompt="Give me a quick overview of my cloud">Cloud overview</button></div><form class="ask-ovesh-form"><input class="ask-ovesh-input" autocomplete="off" placeholder="Ask anything about your OVESH CLOUD…" maxlength="1200"><button class="ask-ovesh-send primary-btn" type="submit">ASK AI →</button></form><div class="ask-ovesh-answer"></div><div class="ask-ovesh-context">Context-aware: uses the workspace information currently available to your session.</div></section>`;
  page.appendChild(card); injected=true;
  const input=card.querySelector('.ask-ovesh-input'),answer=card.querySelector('.ask-ovesh-answer'),form=card.querySelector('form');
  card.querySelectorAll('[data-ai-prompt]').forEach(b=>b.addEventListener('click',()=>{input.value=b.dataset.aiPrompt;input.focus()}));
  form.addEventListener('submit',async e=>{e.preventDefault();const message=input.value.trim();if(!message)return;answer.className='ask-ovesh-answer show loading';answer.textContent='OVESH AI is thinking…';card.querySelector('.ask-ovesh-status').textContent='PROCESSING';card.querySelector('.ask-ovesh-send').disabled=true;try{const r=await fetch('/api/ovesh-ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message,context:collectContext()})});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||'AI request failed');answer.className='ask-ovesh-answer show';answer.textContent=data.answer}catch(err){answer.className='ask-ovesh-answer show ask-ovesh-error';answer.textContent=err.message||'OVESH AI is unavailable right now.'}finally{card.querySelector('.ask-ovesh-status').textContent='READY';card.querySelector('.ask-ovesh-send').disabled=false}});
}
new MutationObserver(()=>{if(!injected)add()}).observe(document.body,{childList:true,subtree:true});
setTimeout(add,700);
})();