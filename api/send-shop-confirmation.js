const nodemailer=require('nodemailer');
const {buildAgreementPdf}=require('./shop-agreement-pdf');
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
    function policy(name){
      const n=String(name||'').toLowerCase();
      if(n.includes('ai automation')) return '<h3>AI Automation — Service-Specific Terms &amp; Policy</h3><p><strong>Scope:</strong> Agreed business automation workflows, approved AI integrations, automation logic and testing.</p><p><strong>AI provider:</strong> Third-party AI models/APIs may have separate availability, limits, pricing, policies and output.</p><p><strong>AI output:</strong> AI-generated content or decisions may be inaccurate and may require human review.</p><p><strong>Data:</strong> Sensitive, confidential or regulated information should not be provided to an AI service unless specifically approved and provider terms reviewed.</p><p><strong>Changes:</strong> New workflows, integrations, model changes or major revisions outside scope may affect price and delivery time.</p><p><strong>Acceptance:</strong> Delivery is based on the agreed scope and acceptance criteria, not a guaranteed AI response or business result.</p>';
      if(n.includes('ai assistant')) return '<h3>AI Assistant — Service-Specific Terms &amp; Policy</h3><p><strong>Scope:</strong> Assistant configuration, knowledge setup, prompt/workflow configuration and agreed support, FAQ or lead-capture functionality.</p><p><strong>AI output:</strong> Responses may be incorrect, incomplete or outdated and may require human review.</p><p><strong>Knowledge:</strong> The client supplies accurate source material and approves information used by the assistant.</p><p><strong>Third-party services:</strong> Model providers, APIs, hosting and connected services may have separate limits, charges and policies.</p><p><strong>Changes:</strong> Additional channels, integrations, knowledge sources, workflows or major revisions may require a separate quote.</p>';
      if(n.includes('security review')) return '<h3>Website Security Review — Service-Specific Terms &amp; Policy</h3><p><strong>Authorization:</strong> Testing is limited to systems and assets the client has authority to test and that are included in the approved scope.</p><p><strong>Testing:</strong> The review may identify risks and hardening opportunities but does not guarantee every vulnerability will be discovered.</p><p><strong>Safety:</strong> No unauthorized access, credential theft, malware deployment or destructive activity is included.</p><p><strong>Report:</strong> Findings and recommendations follow the agreed scope. Remediation is separate unless included.</p><p><strong>Client responsibility:</strong> Accurate authorization, scope and access information must be provided.</p>';
      if(n.includes('premium business website')) return '<h3>Premium Business Website — Service-Specific Terms &amp; Policy</h3><p><strong>Scope:</strong> Design, development, responsive implementation, agreed pages, functionality and deployment specified in the quotation.</p><p><strong>Content:</strong> The client provides accurate text, images, branding and legal notices unless content creation is included.</p><p><strong>Revisions:</strong> Revisions are limited to the quotation. New pages, major redesigns or new functionality may be charged separately.</p><p><strong>Third-party costs:</strong> Domains, hosting, fonts, plugins, APIs, stock assets and external services may have separate charges.</p><p><strong>Delivery:</strong> Launch depends on timely approvals and required access. Ownership/transfer follows the agreed payment terms.</p>';
      if(n.includes('business automation system')) return '<h3>Business Automation System — Service-Specific Terms &amp; Policy</h3><p><strong>Scope:</strong> Workflow mapping, approved integrations, automation configuration, notifications, data flows and testing in the approved scope.</p><p><strong>Integrations:</strong> Third-party platforms may change APIs, limits, pricing or availability.</p><p><strong>Data:</strong> The client is responsible for lawful processing and sharing of data used by connected systems.</p><p><strong>Testing:</strong> Workflows are tested against agreed scenarios; third-party outages, policy changes and out-of-scope inputs are not guaranteed.</p><p><strong>Changes:</strong> New integrations, workflows, conditions or major changes may require a separate quote.</p>';
      return '<h3>Service-Specific Terms &amp; Policy</h3><p>The selected service will be delivered only within the final scope approved in the quotation or project confirmation. Additional requirements, integrations, revisions or features may require a separate quote.</p>';
    }
    const serviceSpecificHtml='<div style="border:1px solid rgba(0,255,65,.15);border-radius:8px;padding:14px;margin:18px 0"><p style="color:#00aa22;letter-spacing:2px;font-size:11px;margin:0 0 8px">SERVICE-SPECIFIC TERMS &amp; POLICY</p><p style="color:#c8ffd4;font-size:13px;line-height:1.6;margin:0 0 12px"><strong>Services covered:</strong> '+esc(serviceText)+'</p>'+serviceNames.map(policy).join('<div style="height:1px;background:rgba(0,255,65,.08);margin:14px 0"></div>')+'</div>';
    const agreementHtml=`
      <div style="border-top:1px solid rgba(0,255,65,.12);margin-top:24px;padding-top:20px">
        <p style="color:#00aa22;letter-spacing:2px;font-size:11px;margin:0 0 8px">CLIENT SERVICE AGREEMENT · VERSION 1.0</p>
        <h2 style="color:#39ff14;font-size:18px;margin:0 0 12px">Project Terms</h2>
        <p style="color:#a9c9af;font-size:12px;line-height:1.6">You accepted the Client Service Agreement at checkout. This email keeps a copy of the terms applicable to your request. You may also review and sign the agreement through the secure client signing page.</p>${serviceSpecificHtml}
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
    const html=`<div style="background:#030a03;padding:32px 16px;font-family:Arial,Helvetica,sans-serif"><div style="max-width:520px;margin:auto;background:#060f06;border:1px solid rgba(0,255,65,.25);border-radius:10px;padding:32px"><p style="color:#00aa22;letter-spacing:2px;font-size:11px;margin:0 0 8px">OVESH MALPURA CYBER LABS</p><h1 style="color:#39ff14;font-size:23px;margin:0 0 16px">Service request received</h1><p style="color:#c8ffd4;font-size:15px;line-height:1.6">Hello ${esc(fullName)||'there'}, we've received your request and will review the requirements.</p><div style="border:1px solid rgba(0,255,65,.15);border-radius:8px;padding:14px;margin:18px 0"><p style="color:#7fa389;margin:0 0 8px;font-size:12px">REFERENCE</p><strong style="color:#39ff14">${esc(orderId)}</strong><table style="width:100%;margin-top:12px">${rows}</table><p style="color:#c8ffd4;border-top:1px solid rgba(0,255,65,.12);padding-top:12px;margin-bottom:0"><strong>Estimated total: ${money(total)}</strong></p></div><a href="${siteUrl}/dashboard.html" style="display:inline-block;background:#00cc33;color:#021002;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:6px">Open Client Portal</a><div style="height:10px"></div><a href="${siteUrl}/sign-agreement.html?orderId=${encodeURIComponent(orderId)}" style="display:inline-block;background:#39ff14;color:#021002;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:6px">Review &amp; Sign Agreement</a><p style="color:#4a7a52;font-size:12px;line-height:1.5;margin-top:20px">This is a request confirmation, not a payment receipt. Final pricing and next steps are confirmed after review.</p>${agreementHtml}</div></div>`;
    const agreementPdf=await buildAgreementPdf({orderId,fullName,items:safeItems,total,acceptedAt:agreementDate});
    await getTransporter().sendMail({from:`"Ovesh Malpura Cyber Labs" <${process.env.ZOHO_USER}>`,to:normalizedEmail,subject:`Service Request + Client Agreement — ${orderId}`,html,attachments:[{filename:`Ovesh-Client-Agreement-${orderId}.pdf`,content:agreementPdf,contentType:'application/pdf'}]});
    return res.status(200).json({ok:true});
  }catch(err){
    console.error('SHOP CONFIRMATION EMAIL FAILED:',err.code||err.message);
    return res.status(err.statusCode||500).json({error:err.statusCode===401?'Authentication required':err.statusCode===403?'Not permitted':err.code==='EAUTH'?'Email account authentication failed':err.code==='ECONNECTION'||err.code==='ETIMEDOUT'?'Email server connection failed':'Could not send confirmation email'});
  }
};