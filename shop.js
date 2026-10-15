(function(){'use strict';
const fallback=[
{id:'ai-automation',name:'AI Automation',category:'AI',icon:'⚙️',price:20000,description:'Automate repetitive business workflows, lead handling and internal processes.',features:['Workflow design','AI integration','Automation setup'],quote:true},
{id:'ai-assistant',name:'AI Assistant',category:'AI',icon:'✦',price:10000,description:'A practical AI assistant for FAQs, lead capture and customer support.',features:['Prompt design','Knowledge setup','Lead capture'],quote:true},
{id:'premium-website',name:'Premium Business Website',category:'Websites',icon:'◈',price:30000,description:'A fast, premium business website built around your goals and brand.',features:['Responsive UI','Deployment','Basic security'],quote:true},
{id:'security-review',name:'Website Security Review',category:'Cybersecurity',icon:'⌁',price:7500,description:'A structured review of common web security risks and hardening opportunities.',features:['Security review','Findings report','Hardening guidance'],quote:true},
{id:'automation-system',name:'Business Automation System',category:'Automation',icon:'↗',price:25000,description:'Connect forms, notifications, data and workflows into one operating system.',features:['Workflow mapping','Integrations','Testing'],quote:true}
];
let products=[...fallback],cart=[],category='All';
try{const saved=localStorage.getItem('oveshShopCart');const parsed=saved?JSON.parse(saved):[];cart=Array.isArray(parsed)?parsed:[]}catch(e){console.warn('Shop cart storage reset.');cart=[];}
const $=id=>document.getElementById(id),money=n=>'₹'+Number(n||0).toLocaleString('en-IN');
function save(){try{localStorage.setItem('oveshShopCart',JSON.stringify(cart))}catch(e){console.warn('Could not save shop cart.')}renderCart()}
function bumpCart(){const btn=$('cartBtn');if(!btn)return;btn.classList.remove('cart-bump');void btn.offsetWidth;btn.classList.add('cart-bump');setTimeout(()=>btn.classList.remove('cart-bump'),650)}
function showAddToast(p){let t=$('shopAddToast');if(!t){t=document.createElement('div');t.id='shopAddToast';t.className='shop-add-toast';t.setAttribute('role','status');t.setAttribute('aria-live','polite');t.innerHTML='<span class="toast-check">✓</span><span><strong class="toast-title">Added to cart</strong><small class="toast-service"></small></span><button type="button" class="toast-cart" aria-label="Open cart">View Cart</button>';document.body.appendChild(t);t.querySelector('.toast-cart').onclick=openCart}t.querySelector('.toast-service').textContent=p.name;t.classList.remove('show');void t.offsetWidth;t.classList.add('show');clearTimeout(showAddToast.timer);showAddToast.timer=setTimeout(()=>t.classList.remove('show'),3200)}
function animateAddedToCart(source){const target=$('cartBtn');if(!source||!target)return;const a=source.getBoundingClientRect(),b=target.getBoundingClientRect(),fly=document.createElement('span');fly.className='cart-fly-dot';fly.textContent='+';fly.style.left=(a.left+a.width/2)+'px';fly.style.top=(a.top+a.height/2)+'px';fly.style.setProperty('--fly-x',(b.left+b.width/2-a.left-a.width/2)+'px');fly.style.setProperty('--fly-y',(b.top+b.height/2-a.top-a.height/2)+'px');document.body.appendChild(fly);setTimeout(()=>fly.remove(),650)}
async function load(){try{if(typeof db!=='undefined'){const s=await db.collection('shop_products').where('status','==','Published').get();if(!s.empty)products=s.docs.map(d=>({id:d.id,...d.data()}));}}catch(e){console.info('Shop catalog fallback active.')}renderCategories();renderProducts()}
function renderCategories(){const cats=['All',...new Set(products.map(p=>p.category).filter(Boolean))];$('categories').innerHTML=cats.map(c=>'<button class="'+(c===category?'active':'')+'" data-cat="'+esc(c)+'">'+esc(c)+'</button>').join('');document.querySelectorAll('[data-cat]').forEach(b=>b.onclick=()=>{category=b.dataset.cat;renderCategories();renderProducts()})}
function ensureDetailModal(){if($('shopDetailModal'))return;const m=document.createElement('div');m.id='shopDetailModal';m.className='shop-detail-modal';m.innerHTML='<div class="shop-detail-box" role="dialog" aria-modal="true" aria-labelledby="shopDetailTitle"><button class="detail-close" type="button" aria-label="Close details">×</button><div class="eyebrow" id="shopDetailCategory"></div><h2 id="shopDetailTitle"></h2><p id="shopDetailDescription"></p><div id="shopDetailFeatures" class="detail-features"></div><div id="shopDetailPrice" class="detail-price"></div><div class="detail-actions"><button class="details-btn" type="button" id="shopDetailClose">Close</button><button class="primary" type="button" id="shopDetailAdd">Add to Cart</button></div></div>';document.body.appendChild(m);m.addEventListener('click',e=>{if(e.target===m||e.target.closest('.detail-close')||e.target.id==='shopDetailClose')m.classList.remove('open')})}
window.viewService=id=>{const p=products.find(x=>x.id===id);if(!p)return;ensureDetailModal();$('shopDetailCategory').textContent=String(p.category||'SERVICE').toUpperCase();$('shopDetailTitle').textContent=p.name;$('shopDetailDescription').textContent=p.description||'Professional service delivered according to the approved project scope.';$('shopDetailFeatures').innerHTML=(p.features||[]).map(x=>'<div class="detail-feature">✓ '+esc(x)+'</div>').join('');$('shopDetailPrice').textContent=p.price?'From '+money(p.price):'Request quote';$('shopDetailAdd').onclick=()=>{addToCart(p.id);$('shopDetailModal').classList.remove('open')};$('shopDetailModal').classList.add('open')};
function renderProducts(){
 const q=$('search').value.toLowerCase();
 const list=products.filter(p=>(category==='All'||p.category===category)&&(!q||(p.name+' '+p.description+' '+p.category).toLowerCase().includes(q)));
 const grid=$('products');
 grid.innerHTML=list.length?list.map((p,i)=>'<article class="product" style="animation-delay:'+Math.min(i*55,440)+'ms"><div class="icon">'+esc(p.icon||'◈')+'</div><h3>'+esc(p.name)+'</h3><p>'+esc(p.description||'')+'</p><div class="chips">'+(p.features||[]).slice(0,4).map(x=>'<span class="chip">'+esc(x)+'</span>').join('')+'</div><div class="price">'+(p.price?'From '+money(p.price):'Request quote')+'</div><button class="primary add-service" type="button" data-service-id="'+esc(p.id)+'">Add to Cart</button><button class="details-btn view-service" type="button" data-service-id="'+esc(p.id)+'">View Details</button></article>').join(''):'<div class="empty-shop"><h3>No matching services</h3><p>Try another search or category.</p></div>';
 grid.querySelectorAll('.add-service').forEach(b=>b.onclick=()=>addToCart(b.dataset.serviceId));
 grid.querySelectorAll('.view-service').forEach(b=>b.onclick=()=>viewService(b.dataset.serviceId));
}
window.addToCart=id=>{const p=products.find(x=>x.id===id);if(!p)return;const found=cart.find(x=>x.id===id);if(found)found.qty++;else cart.push({id:p.id,name:p.name,price:Number(p.price||0),qty:1});save();bumpCart();showAddToast(p);const source=[...document.querySelectorAll('.add-service')].find(b=>b.dataset.serviceId===id);animateAddedToCart(source);openCart()};
function renderCart(){
 const total=cart.reduce((a,x)=>a+x.qty,0);
 $('cartCount').textContent=total;
 $('cartItems').innerHTML=cart.length?cart.map((x,i)=>'<div class="cart-line" data-cart-id="'+esc(x.id)+'" style="--cart-index:'+i+'"><div><strong>'+esc(x.name)+'</strong><button class="remove-cart" type="button" aria-label="Remove '+esc(x.name)+'" data-cart-id="'+esc(x.id)+'">×</button></div><div class="qty"><span>'+money(x.price*x.qty)+'</span><span><button class="qty-minus" type="button" aria-label="Decrease quantity" data-cart-id="'+esc(x.id)+'">−</button> '+x.qty+' <button class="qty-plus" type="button" aria-label="Increase quantity" data-cart-id="'+esc(x.id)+'">+</button></span></div></div>').join(''):'<p class="muted">Your cart is empty.<br><small>Add a service to begin your request.</small></p>';
 $('cartTotal').textContent=money(cart.reduce((a,x)=>a+x.price*x.qty,0));
 $('checkoutBtn').disabled=!cart.length;
 $('cartItems').querySelectorAll('.remove-cart').forEach(b=>b.onclick=()=>removeCart(b.dataset.cartId));
 $('cartItems').querySelectorAll('.qty-minus').forEach(b=>b.onclick=()=>changeQty(b.dataset.cartId,-1));
 $('cartItems').querySelectorAll('.qty-plus').forEach(b=>b.onclick=()=>changeQty(b.dataset.cartId,1));
}
window.removeCart=id=>{const row=[...document.querySelectorAll('.cart-line')].find(el=>el.dataset.cartId===id);if(row){row.classList.add('cart-line-out');setTimeout(()=>{cart=cart.filter(x=>x.id!==id);save()},220)}else{cart=cart.filter(x=>x.id!==id);save()}};window.changeQty=(id,n)=>{const x=cart.find(x=>x.id===id);if(!x)return;const row=[...document.querySelectorAll('.cart-line')].find(el=>el.dataset.cartId===id);const button=row?.querySelector(n>0?'button[aria-label="Increase quantity"]':'button[aria-label="Decrease quantity"]');if(button){button.classList.remove('qty-pulse');void button.offsetWidth;button.classList.add('qty-pulse');setTimeout(()=>button.classList.remove('qty-pulse'),240)}x.qty+=n;if(x.qty<1){if(row){row.classList.add('cart-line-out');setTimeout(()=>{cart=cart.filter(y=>y.id!==id);save()},220);return}cart=cart.filter(y=>y.id!==id)}save()};
function openCart(){$('cartDrawer').classList.add('open');$('overlay').classList.add('open')};function closeCart(){$('cartDrawer').classList.remove('open');$('overlay').classList.remove('open')}
$('cartBtn').onclick=openCart;$('closeCart').onclick=closeCart;$('overlay').onclick=closeCart;$('search').oninput=renderProducts;
function waitForAuth(){return new Promise(resolve=>{if(typeof auth==='undefined')return resolve(null);if(auth.currentUser)return resolve(auth.currentUser);const unsub=auth.onAuthStateChanged(user=>{unsub();resolve(user||null);});});}
function serviceAgreementText(items){
  const names=(items||[]).map(x=>String(x.name||'')).filter(Boolean);
  const lower=names.join(' ').toLowerCase();
  if(lower.includes('ai automation')) return 'AI Automation: workflow mapping, approved AI integrations, automation setup and testing for the business processes described in the approved scope. AI output can require human review and depends on the selected AI provider and connected services.';
  if(lower.includes('ai assistant')) return 'AI Assistant: assistant configuration, knowledge setup, prompt/workflow configuration and lead or support functionality described in the approved scope. AI responses can require human review and depend on the connected model and knowledge sources.';
  if(lower.includes('security review')) return 'Website Security Review: authorized review of the website and agreed security areas, findings documentation and hardening guidance. Testing is limited to the systems and scope approved by the client.';
  if(lower.includes('premium business website')) return 'Premium Business Website: design, development, responsive implementation, deployment and the website features listed in the approved scope.';
  if(lower.includes('business automation system')) return 'Business Automation System: workflow mapping, approved integrations, automation configuration and testing for the business processes listed in the approved scope.';
  return 'The selected services will be delivered according to the final approved scope and quotation.';
}
function servicePolicyHtml(name){
  const n=String(name||'').toLowerCase();
  if(n.includes('ai automation')) return '<h4>AI Automation — Service-Specific Terms &amp; Policy</h4><p><strong>Scope:</strong> Design and implementation of the agreed business automation workflows, approved AI integrations, automation logic and testing.</p><p><strong>AI provider:</strong> The automation may use third-party AI models or APIs. Their availability, limits, pricing, policies and output are controlled by those providers.</p><p><strong>AI output:</strong> AI-generated content or decisions may be inaccurate and may require human review. The client remains responsible for reviewing important business outputs before relying on them.</p><p><strong>Data:</strong> The client must not provide sensitive, confidential or regulated information to an AI service unless that use has been specifically approved and the relevant provider terms have been reviewed.</p><p><strong>Changes:</strong> New workflows, integrations, model changes, additional automation steps or major revisions outside the approved scope may affect price and delivery time.</p><p><strong>Acceptance:</strong> The automation is considered delivered according to the agreed scope and acceptance criteria, not based on a guarantee of a particular AI response or business result.</p>';
  if(n.includes('ai assistant')) return '<h4>AI Assistant — Service-Specific Terms &amp; Policy</h4><p><strong>Scope:</strong> Assistant configuration, knowledge setup, prompt/workflow configuration and the agreed support, FAQ or lead-capture functionality.</p><p><strong>AI output:</strong> Responses are generated by AI and can be incorrect, incomplete or outdated. Human review may be required for important information or decisions.</p><p><strong>Knowledge:</strong> The client is responsible for supplying accurate source material and approving the information used by the assistant.</p><p><strong>Third-party services:</strong> Model providers, APIs, hosting and other connected services may have separate limits, charges and policies.</p><p><strong>Changes:</strong> Additional channels, integrations, knowledge sources, workflows or major revisions outside the approved scope may require a separate quote.</p>';
  if(n.includes('security review')) return '<h4>Website Security Review — Service-Specific Terms &amp; Policy</h4><p><strong>Authorization:</strong> Security testing is performed only against systems and assets the client has authority to test and that are included in the approved scope.</p><p><strong>Testing:</strong> The review may identify security risks, configuration issues and hardening opportunities. It does not guarantee that every vulnerability will be discovered.</p><p><strong>Safety:</strong> Testing is designed to avoid unnecessary disruption. No unauthorized access, credential theft, malware deployment or destructive activity is included.</p><p><strong>Report:</strong> Findings and recommendations are provided according to the agreed review scope. Remediation or implementation work is separate unless specifically included.</p><p><strong>Client responsibility:</strong> The client must provide accurate authorization, scope and access information before testing begins.</p>';
  if(n.includes('premium business website')) return '<h4>Premium Business Website — Service-Specific Terms &amp; Policy</h4><p><strong>Scope:</strong> Website design and development, responsive implementation, agreed pages and functionality, deployment and the features listed in the approved quotation.</p><p><strong>Content:</strong> The client is responsible for providing accurate text, images, branding, legal notices and other materials unless content creation is included.</p><p><strong>Revisions:</strong> Revisions are limited to the amount and scope stated in the quotation. New pages, major redesigns or new functionality may be charged separately.</p><p><strong>Third-party costs:</strong> Domain, hosting, paid fonts, plugins, APIs, stock assets and other external services may have separate charges.</p><p><strong>Delivery:</strong> Launch depends on timely client approvals and required access. Final ownership or transfer is subject to the agreed payment terms.</p>';
  if(n.includes('business automation system')) return '<h4>Business Automation System — Service-Specific Terms &amp; Policy</h4><p><strong>Scope:</strong> Workflow mapping, approved integrations, automation configuration, notifications, data flows and testing described in the approved scope.</p><p><strong>Integrations:</strong> Third-party platforms can change their APIs, limits, pricing or availability. Such changes may require additional work.</p><p><strong>Data:</strong> The client is responsible for ensuring that the data used by connected systems may lawfully be processed and shared for the intended workflow.</p><p><strong>Testing:</strong> Workflows are tested against the agreed scenarios. No guarantee is made for failures caused by third-party outages, policy changes or inputs outside the agreed design.</p><p><strong>Changes:</strong> New integrations, workflows, conditions or major changes outside the approved scope may require a separate quote.</p>';
  return '<h4>Service-Specific Terms &amp; Policy</h4><p>The selected service will be delivered only within the final scope approved in the quotation or project confirmation. Additional requirements, integrations, revisions or features may require a separate quote.</p>';
}
function renderAgreementServices(targetId){
  const box=$(targetId);
  if(!box)return;
  const names=cart.map(x=>String(x.name||'')).filter(Boolean);
  box.innerHTML='<div class="agreement-selected"><strong>Services covered by this request</strong><br>'+names.map(esc).join('<br>')+'</div><div class="agreement-service-policies">'+names.map(servicePolicyHtml).join('')+'</div><p class="agreement-notice"><strong>Important:</strong> These service-specific terms are read together with the full Client Service Agreement above. If a quotation contains more specific project terms, those approved project terms apply to that engagement.</p>';
}
function openAgreement(){
  renderAgreementServices('agreementServices');
  $('agreementModal').classList.add('open')
}
function closeAgreement(){$('agreementModal').classList.remove('open')}function renderAccount(user){const link=$('accountLink');if(!link)return;if(user){const email=String(user.email||'').trim();link.href='dashboard.html';link.textContent=email?'Account · '+email:'Account';link.title=email;}else{link.href='login.html?return=shop';link.textContent='Account';link.title='Sign in to your account';}}
$('agreementBtn').onclick=openAgreement;$('closeAgreement').onclick=closeAgreement;$('agreementDone').onclick=closeAgreement;
$('checkoutBtn').onclick=async()=>{const user=await waitForAuth();if(!user){localStorage.setItem('oveshShopReturn','1');window.location.href='login.html?return=shop';return;}$('checkoutSummary').innerHTML=cart.map(x=>esc(x.name)+' × '+x.qty).join('<br>');renderAgreementServices('checkoutAgreementServices');$('checkoutStatus').textContent='';$('checkoutModal').classList.add('open')};document.querySelector('[data-close]').onclick=()=>$('checkoutModal').classList.remove('open');
$('checkoutForm').onsubmit=async e=>{
  e.preventDefault();
  const user=await waitForAuth();
  if(!user){
    localStorage.setItem('oveshShopReturn','1');
    window.location.href='login.html?return=shop';
    return;
  }
  const f=new FormData(e.target);
  f.set('email',user.email||'');
  const emailField=e.target.querySelector('[name="email"]');
  if(emailField)emailField.value=user.email||'';
  const items=cart.map(x=>({productId:x.id,name:x.name,qty:x.qty,price:x.price}));
  const orderId='SHOP-'+Date.now().toString().slice(-8);
  const payload={
    source:'shop',
    orderId,
    fullName:String(f.get('fullName')||'').trim(),
    email:String(f.get('email')||'').trim(),
    phone:String(f.get('phone')||'').trim(),
    selectedService:items.map(x=>x.name).join(', '),
    items,
    estimatedTotal:items.reduce((a,x)=>a+x.price*x.qty,0),
    uid:user.uid,
    userId:user.uid,
    projectDescription:String(f.get('message')||'').trim(),
    agreementVersion:'1.0',
    agreementAccepted:true,
    agreementAcceptedAt:new Date().toISOString(),
    status:'Pending',
    paymentStatus:'Quote / payment pending',
    createdAt:firebase.firestore.FieldValue.serverTimestamp()
  };
  const s=$('checkoutStatus');
  s.textContent='Submitting…';
  try{
    await db.collection('service_requests').add(payload);

    let emailSent=false;
    try{
      const emailResponse=await fetch('/api/send-shop-confirmation',{
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          'Authorization':'Bearer '+(await user.getIdToken())
        },
        body:JSON.stringify({
          orderId,
          fullName:payload.fullName,
          email:user.email||payload.email,
          items:payload.items,
          total:payload.estimatedTotal,
          requirements:payload.projectDescription,
          agreementVersion:payload.agreementVersion,
          agreementAcceptedAt:payload.agreementAcceptedAt
        })
      });
      emailSent=emailResponse.ok;
      if(!emailResponse.ok){
        let emailResult={};
        try{emailResult=await emailResponse.json()}catch(_){}
        console.warn('Shop confirmation email failed:',emailResult);
      }
    }catch(emailError){
      console.error('Shop confirmation email request failed:',emailError);
    }

    s.innerHTML='<div class="request-success-card"><div class="request-success-icon">✓</div><div class="request-success-eyebrow">REQUEST SUBMITTED SUCCESSFULLY</div><h3>Thank You, '+esc(payload.fullName)+'!</h3><p class="request-success-main">Your service request has been received and everything is successfully submitted.</p><div class="request-reference"><span>REQUEST REFERENCE</span><strong>'+esc(orderId)+'</strong></div><div class="request-success-details"><p>📧 Confirmation email: <strong>'+esc(payload.email)+'</strong></p><p>'+(
      emailSent
        ? 'A confirmation email with your Client Service Agreement has been sent to your account email.'
        : 'Your request was saved successfully. The confirmation email could not be sent right now, but you can still download your Client Service Agreement below.'
    )+'</p></div><button type="button" class="primary" id="downloadAgreementCheckout">Download Agreement PDF</button><p class="request-success-next">We’ll review your request and contact you with the next steps.</p></div>';

    const downloadBtn=document.getElementById('downloadAgreementCheckout');
    if(downloadBtn)downloadBtn.onclick=async()=>{
      try{
        downloadBtn.disabled=true;
        downloadBtn.textContent='Preparing PDF…';
        const token=await user.getIdToken();
        const r=await fetch('/api/shop-agreement-pdf?orderId='+encodeURIComponent(orderId),{
          headers:{Authorization:'Bearer '+token}
        });
        if(!r.ok)throw new Error('Could not generate agreement PDF');
        const blob=await r.blob();
        const url=URL.createObjectURL(blob);
        const link=document.createElement('a');
        link.href=url;
        link.download='Ovesh-Client-Agreement-'+orderId+'.pdf';
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        downloadBtn.textContent='Agreement PDF Downloaded';
      }catch(err){
        downloadBtn.disabled=false;
        downloadBtn.textContent='Download Agreement PDF';
        console.error('Agreement PDF download failed:',err.message);
      }
    };

    cart=[];
    save();
    e.target.reset();
  }catch(err){
    console.error('Shop request submission failed:',err.code,err.message,err);
    const msg=err.code==='permission-denied'
      ? 'Your account is signed in, but this request is not permitted. Please contact the lab.'
      : err.code==='unauthenticated'
      ? 'Your session expired. Please sign in again.'
      : err.code==='unavailable'
      ? 'Service temporarily unavailable. Please try again.'
      : 'Could not submit right now. Please try again.';
    s.textContent=msg;
  }
};
function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
if(typeof auth!=='undefined'&&auth.onAuthStateChanged)auth.onAuthStateChanged(renderAccount);else renderAccount(null);
load();renderCart();
})();