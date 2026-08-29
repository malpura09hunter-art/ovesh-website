(()=>{'use strict';
const DEFAULTS=[{name:'PPC',icon:'📘',slug:'ppc',desc:'PPC academic workspace'},{name:'Web Programming',icon:'💻',slug:'web-programming',desc:'Web development and programming academic workspace'},{name:'LS',icon:'📚',slug:'ls',desc:'LS academic workspace'}];
function boot(){
 const nav=document.getElementById('nav'); if(!nav)return;
 const openCollege=()=>setTimeout(renderFallback,120);
 nav.addEventListener('click',e=>{const b=e.target.closest('[data-page="college"]');if(b)openCollege();},true);
 if(document.querySelector('[data-page="college"].active'))openCollege();
 function renderFallback(){
   const page=document.getElementById('page'); if(!page)return;
   if(!document.querySelector('.college-os,.oc-college'))return;
   if(document.getElementById('oc-default-subjects'))return;
   const host=document.createElement('section'); host.id='oc-default-subjects'; host.style.cssText='margin-top:18px';
   host.innerHTML='<div style="font-size:10px;letter-spacing:.18em;opacity:.5;margin:0 0 10px">DEFAULT COLLEGE SUBJECTS</div><div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px">'+DEFAULTS.map((s,i)=>`<button type="button" data-fallback-subject="${s.slug}" style="text-align:left;color:inherit;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.035);border-radius:18px;padding:20px;cursor:pointer"><div style="font-size:28px">${s.icon}</div><div style="font-size:18px;font-weight:800;margin-top:10px">${s.name}</div><div style="font-size:12px;opacity:.55;margin-top:6px">${s.desc}</div><div style="font-size:10px;letter-spacing:.12em;opacity:.45;margin-top:15px">OPEN SUBJECT →</div></button>`).join('')+'</div>';
   page.appendChild(host);
   host.querySelectorAll('[data-fallback-subject]').forEach(btn=>btn.addEventListener('click',()=>openSubject(btn.dataset.fallbackSubject)));
 }
 function openSubject(slug){
   const s=DEFAULTS.find(x=>x.slug===slug); if(!s)return;
   const page=document.getElementById('page');
   page.innerHTML=`<div class="college-os"><div class="co-head"><div><button class="co-btn" id="oc-fallback-back">← COLLEGE</button><div class="co-k" style="margin-top:12px">SUBJECT WORKSPACE</div><h1>${s.icon} ${s.name}</h1><p>${s.desc}</p></div></div><div class="co-nav">${['Overview','Practicals','Assignments','Projects','Presentations','Notes','Resources','Files'].map((x,i)=>`<button type="button" class="${i===0?'active':''}" data-fallback-tab="${x.toLowerCase()}">${x}</button>`).join('')}</div><div id="oc-fallback-content"><div class="co-panel" style="padding:20px"><h3>${s.name} Overview</h3><p style="opacity:.55">This is the dedicated academic workspace for ${s.name}. Practicals, assignments, projects, presentations, notes, resources and files are organized here.</p></div></div></div>`;
   document.getElementById('oc-fallback-back').onclick=()=>{location.reload()};
   page.querySelectorAll('[data-fallback-tab]').forEach(tab=>tab.addEventListener('click',()=>{page.querySelectorAll('[data-fallback-tab]').forEach(x=>x.classList.remove('active'));tab.classList.add('active');const title=tab.textContent;document.getElementById('oc-fallback-content').innerHTML=`<div class="co-panel" style="padding:20px"><h3>${title}</h3><p style="opacity:.55">${title==='Practicals'?'Add and organize your '+s.name+' practical files here.':`Manage ${s.name} ${title.toLowerCase()} in this subject workspace.`}</p>${title==='Practicals'?'<button class="co-btn co-primary" style="margin-top:12px" type="button">+ ADD PRACTICAL</button>':''}</div>`;}));
 }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();