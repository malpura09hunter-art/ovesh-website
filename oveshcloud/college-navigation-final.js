(()=>{'use strict';
const ROOT='/ovesh/college';
function navigate(url){history.pushState({},'',url);window.dispatchEvent(new PopStateEvent('popstate'));}
document.addEventListener('click',function(e){
 const open=e.target.closest('[data-open-subject]');
 if(open){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();navigate(ROOT+'/subjects/'+encodeURIComponent(open.dataset.openSubject));return;}
 const go=e.target.closest('[data-go]');
 if(go && go.closest('#page')){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();navigate(go.dataset.go);return;}
 const nav=e.target.closest('#nav [data-page="college"]');
 if(nav){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();navigate(ROOT);return;}
},true);
})();