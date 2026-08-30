(()=>{'use strict';
const load=()=>{if(window.OVESH_COLLEGE_V2)return;const s=document.createElement('script');s.src='/oveshcloud/college-workspace-v2.js?v=2.1.0';s.async=false;document.head.appendChild(s)};
load();
const startGuard=()=>{if(window.OVESH_COLLEGE_V2){const s=document.createElement('script');s.src='/oveshcloud/college-runtime-guard.js?v=1.0.0';document.head.appendChild(s)}else setTimeout(startGuard,25)};
startGuard();
})();