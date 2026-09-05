(()=>{'use strict';
// College VIEW must open the College built-in viewer, never submit/navigate/download.
document.addEventListener('click',e=>{const b=e.target.closest('.cv16 [data-view]');if(!b)return;e.preventDefault();},true);
})();