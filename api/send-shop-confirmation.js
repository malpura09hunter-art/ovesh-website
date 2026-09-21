const nodemailer=require('nodemailer');
let transporter;
function getTransporter(){if(!transporter)transporter=nodemailer.createTransport({host:process.env.ZOHO_SMTP_HOST||'smtp.zoho.in',port:465,secure:true,auth:{user:process.env.ZOHO_USER,pass:process.env.ZOHO_APP_PASSWORD},connectionTimeout:8000,greetingTimeout:8000,socketTimeout:8000});return transporter;}
function esc(v){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#39;');}
function money(n){return '₹'+Number(n||0).toLocaleString('en-IN');}
async function authenticate(req){
  const header=String(req.headers.authorization||'');
  if(!header.startsWith('Bearer ')) throw Object.assign(new Error('Missing authentication'),{statusCode:401});
  const idToken=header.slice(7).trim();
  if(!idToken) throw Object.assign(new Error('Missing authentication'),{statusCode:401});
  const key=process.env.FIREBASE_WEB_API_KEY||'AIzaSyDB8ZVagSc8C3o3tdrwUcuflZhT8X5lMZ0';
  if(!key) throw Object.assign(new Error('Firebase API key is not configured'),{statusCode:500});
  const response=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key='+encodeURIComponent(key),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken})});
  if(!response.ok) throw Object.assign(new Error('Invalid authentication'),{statusCode:401});
  const data=await response.json();
  const user=data.users&&data.users[0];
  if(!user||!user.localId) throw Object.assign(new Error('Invalid authentication'),{statusCode:401});
  return user;
}
module.exports=async(req,res)=>{
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  try{
    const user=await authenticate(req);
    const {orderId,fullName,email,items,total,requirements,agreementVersion,agreementAcceptedAt}=req.body||{};
    if(!/^SHOP-\d{8}$/.test(String(orderId||''))||!Array.isArray(items)||items.length<1||items.length>20)return res.status(400).json({error:'Invalid request details'});
    const accountEmail=String(user.email||'').trim().toLowerCase();
    if(!accountEmail||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(accountEmail))return res.status(400).json({error:'Signed-in account has no valid email'});
    const normalizedEmail=accountEmail;
    const safeItems=items.map(x=>({name:String(x.name||'').slice(0,160),qty:Math.max(1,Math.min(99,Number(x.qty)||1))})).filter(x=>x.name);
    if(!safeItems.length)return res.status(400).json({error:'No valid items'});
    const siteUrl=process.env.SITE_URL||'https://malpuraovesh.vercel.app';
    const agreementAccepted=agreementVersion==='1.0';
    if(!agreementAccepted)return res.status(400).json({error:'Agreement acceptance required'});
    const agreementDate=String(agreementAcceptedAt||'');
    const serviceNames=safeItems.map(x=>x.name);
    const serviceText=serviceNames.join(', ');
    const lowerServices=serviceNames.join(' ').toLowerCase();
    let serviceSpecific='The selected services will be delivered according to the final approved scope and quotation.';
    if(lowerServices.includes('ai automation')) serviceSpecific='AI Automation: workflow mapping, approved AI integrations, automation configuration and testing for the business processes described in the approved scope. AI-generated output may require human review and depends on the selected AI provider and connected services.';
    else if(lowerServices.includes('ai assistant')) serviceSpecific='AI Assistant: assistant configuration, knowledge setup, prompt/workflow configuration and lead or support functionality described in the approved scope. AI responses may require human review and depend on the connected model and knowledge sources.';
    else if(lowerServices.includes('security review')) serviceSpecific='Website Security Review: authorized review of the website and agreed security areas, findings documentation and hardening guidance. Testing is limited to the systems and scope approved by the client.';
    else if(lowerServices.includes('premium business website')) serviceSpecific='Premium Business Website: design, development, responsive implementation, deployment and the website features listed in the approved scope.';
    else if(lowerServices.includes('business automation system')) serviceSpecific='Business Automation System: workflow mapping, approved integrations, automation configuration and testing for the business processes listed in the approved scope.';
    const serviceSpecificHtml='<div style="border:1px solid rgba(0,255,65,.15);border-radius:8px;padding:14px;margin:18px 0"><p style="color:#00aa22;letter-spacing:2px;font-size:11px;margin:0 0 8px">SERVICE-SPECIFIC SCOPE</p><p style="color:#c8ffd4;font-size:13px;line-height:1.6;margin:0 0 8px"><strong>Selected service(s):</strong> '+esc(serviceText)+'</p><p style="color:#a9c9af;font-size:12px;line-height:1.6;margin:0">'+esc(serviceSpecific)+'</p></div>';
    const agreementHtml=`
      <div style="border-top:1px solid rgba(0,255,65,.12);margin-top:24px;padding-top:20px">
        <p style="color:#00aa22;letter-spacing:2px;font-size:11px;margin:0 0 8px">CLIENT SERVICE AGREEMENT · VERSION 1.0</p>
        <h2 style="color:#39ff14;font-size:18px;margin:0 0 12px">Project Terms</h2>
        <p style="color:#a9c9af;font-size:12px;line-height:1.6">By submitting this request, you confirmed that you reviewed and accepted the Client Service Agreement &amp; Project Terms shown at checkout. This email keeps a copy of the terms applicable to your request.</p>${serviceSpecificHtml}
        <ol style="color:#a9c9af;font-size:12px;line-height:1.65;padding-left:20px">
          <li><strong style="color:#c8ffd4">Scope:</strong> Work follows the accepted request or later-approved quotation. Out-of-scope work may require a separate quote.</li>
          <li><strong style="color:#c8ffd4">Requirements &amp; revisions:</strong> You provide accurate requirements, content, approvals and access. Changes may affect price and timeline.</li>
          <li><strong style="color:#c8ffd4">Pricing &amp; payment:</strong> Shop prices may be estimates or starting prices. Final pricing and payment terms are confirmed in the applicable quotation or invoice.</li>
          <li><strong style="color:#c8ffd4">Delivery:</strong> Timelines are estimates and depend on scope, feedback, approvals and third-party services.</li>
          <li><strong style="color:#c8ffd4">Third-party services:</strong> Domains, hosting, APIs, AI providers and subscriptions may carry separate fees and terms.</li>
          <li><strong style="color:#c8ffd4">Ownership &amp; licenses:</strong> After agreed payments are completed, deliverables are provided as specified in the quotation; third-party components remain subject to their licenses.</li>
          <li><strong style="color:#c8ffd4">Security:</strong> Cybersecurity work is performed only within authorized scope and permission.</li>
          <li><strong style="color:#c8ffd4">Cancellation &amp; refunds:</strong> These depend on project stage and the applicable quotation or invoice; completed work and non-refundable third-party costs may not be refundable.</li>
          <li><strong style="color:#c8ffd4">Support:</strong> Post-delivery support is included only when stated in the quotation. Additional work is separate.</li>
          <li><strong style="color:#c8ffd4">Confidentiality:</strong> Both parties should protect non-public business, technical and project information, subject to legal requirements and necessary service providers.</li>
          <li><strong style="color:#c8ffd4">Acceptance:</strong> Submission confirms review of these terms. A request is not itself final acceptance of a quotation or a guarantee that the project will be accepted.</li>
        </ol>
        <p style="color:#4a7a52;font-size:11px;margin:12px 0 0">Agreement accepted: ${esc(agreementDate)} · Version 1.0</p><p style="color:#4a7a52;font-size:11px;line-height:1.5;margin:10px 0 0">Keep this email for your records. The agreement version shown here is the version accepted with this service request.</p>
      </div>`;
    const rows=safeItems.map(x=>'<tr><td style="padding:8px 0;color:#c8ffd4">'+esc(x.name)+'</td><td style="padding:8px 0;color:#7fa389;text-align:right">× '+esc(x.qty)+'</td></tr>').join('');
    const html=`<div style="background:#030a03;padding:32px 16px;font-family:Arial,Helvetica,sans-serif"><div style="max-width:520px;margin:auto;background:#060f06;border:1px solid rgba(0,255,65,.25);border-radius:10px;padding:32px"><p style="color:#00aa22;letter-spacing:2px;font-size:11px;margin:0 0 8px">OVESH MALPURA CYBER LABS</p><h1 style="color:#39ff14;font-size:23px;margin:0 0 16px">Service request received</h1><p style="color:#c8ffd4;font-size:15px;line-height:1.6">Hello ${esc(fullName)||'there'}, we've received your request and will review the requirements.</p><div style="border:1px solid rgba(0,255,65,.15);border-radius:8px;padding:14px;margin:18px 0"><p style="color:#7fa389;margin:0 0 8px;font-size:12px">REFERENCE</p><strong style="color:#39ff14">${esc(orderId)}</strong><table style="width:100%;margin-top:12px">${rows}</table><p style="color:#c8ffd4;border-top:1px solid rgba(0,255,65,.12);padding-top:12px;margin-bottom:0"><strong>Estimated total: ${money(total)}</strong></p></div><a href="${siteUrl}/dashboard.html" style="display:inline-block;background:#00cc33;color:#021002;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:6px">Open Client Portal</a><p style="color:#4a7a52;font-size:12px;line-height:1.5;margin-top:20px">This is a request confirmation, not a payment receipt. Final pricing and next steps are confirmed after review.</p>${agreementHtml}</div></div>`;
    await getTransporter().sendMail({from:`"Ovesh Malpura Cyber Labs" <${process.env.ZOHO_USER}>`,to:normalizedEmail,subject:`Service Request + Client Agreement — ${orderId}`,html});
    return res.status(200).json({ok:true});
  }catch(err){
    console.error('SHOP CONFIRMATION EMAIL FAILED:',err.code||err.message);
    return res.status(err.statusCode||500).json({error:err.statusCode===401?'Authentication required':err.statusCode===403?'Not permitted':err.code==='EAUTH'?'Email account authentication failed':err.code==='ECONNECTION'||err.code==='ETIMEDOUT'?'Email server connection failed':'Could not send confirmation email'});
  }
};