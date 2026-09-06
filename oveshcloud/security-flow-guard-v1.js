(()=>{'use strict';
// Final guard: never allow the legacy Security Logs screen to block login.
const enter=()=>{const b=document.getElementById('continueBtn');if(b){b.click();return true}return false};
const finish=()=>{const w=document.getElementById('welcomeView'),e=document.getElementById('enterBtn');if(w&&!w.classList.contains('hidden')&&e){e.click();return true}return false};
const check=()=>{const s=document.getElementById('securityView');if(s&&!s.classList.contains('hidden')){enter();setTimeout(finish,80);setTimeout(finish,250);setTimeout(finish,700)}};
new MutationObserver(check).observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:['class']});
setInterval(check,250);
})();
