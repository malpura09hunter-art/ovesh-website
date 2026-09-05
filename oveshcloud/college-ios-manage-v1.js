(()=>{'use strict';
const STYLE_ID='college-ios-manage-v1-style';
function install(){
 if(!document.getElementById(STYLE_ID)){const s=document.createElement('style');s.id=STYLE_ID;s.textContent=`
.cv16 .cv16ios-manage{position:relative;overflow:hidden}
.cv16 .cv16ios-manage::after{content:'';position:absolute;inset:0;pointer-events:none;border-radius:18px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.04)}
.cv16.ios-editing .cv16card{animation:iosIconJiggle .36s ease-in-out infinite alternate!important;transform-origin:50% 60%;}
.cv16.ios-editing .cv16card:nth-child(2n){animation-delay:-.12s!important}.cv16.ios-editing .cv16card:nth-child(3n){animation-delay:-.22s!important}.cv16.ios-editing .cv16card:nth-child(4n){animation-delay:-.07s!important}
@keyframes iosIconJiggle{0%{transform:rotate(-1.35deg) translateY(-.4px)}100%{transform:rotate(1.35deg) translateY(.4px)}}
.cv16 .cv16ios-hint{display:flex;align-items:center;gap:9px;margin:0 0 14px;padding:11px 14px;border:1px solid rgba(255,255,255,.11);border-radius:14px;background:rgba(255,255,255,.045);font-size:11px;font-weight:800;letter-spacing:.06em;opacity:.9}
.cv16 .cv16ios-dot{width:8px;height:8px;border-radius:50%;background:#ff3b30;box-shadow:0 0 12px rgba(255,59,48,.6);animation:iosPulse 1s infinite}
@keyframes iosPulse{50%{transform:scale(.72);opacity:.65}}
.cv16.ios-editing .cv16grid{user-select:none}
.cv16.ios-editing .cv16card{box-shadow:0 10px 30px rgba(0,0,0,.18)!important}
.cv16.ios-editing .cv16editbadge{animation:iosBadgePop .22s ease-out both}
@keyframes iosBadgePop{from{transform:scale(.55);opacity:0}to{transform:scale(1);opacity:1}}
`;document.head.appendChild(s)}
}
function enhance(){const root=document.querySelector('.cv16');if(!root||root.dataset.iosEnhanced==='1')return;root.dataset.iosEnhanced='1';const manage=root.querySelector('[data-manage]');if(!manage)return;manage.addEventListener('click',()=>{setTimeout(()=>{const r=document.querySelector('.cv16');if(!r)return;const editing=!!r.querySelector('.cv16editbar');r.classList.toggle('ios-editing',editing);let hint=r.querySelector('.cv16ios-hint');if(editing&&!hint){hint=document.createElement('div');hint.className='cv16ios-hint';hint.innerHTML='<span class="cv16ios-dot"></span><span>EDIT MODE · ICONS ARE WIGGLING LIKE iOS</span>';const bar=r.querySelector('.cv16editbar');if(bar)bar.after(hint)}else if(!editing&&hint)hint.remove()},30)},{passive:true})}
install();new MutationObserver(()=>enhance()).observe(document.body,{childList:true,subtree:true});setInterval(enhance,700);enhance();
})();