const nodemailer=require('nodemailer');
const {getAdminDb}=require('./shop-agreement');
let transporter;
function getTransporter(){
  if(!transporter) transporter=nodemailer.createTransport({
    host:process.env.ZOHO_SMTP_HOST||'smtp.zoho.in',
    port:465,
    secure:true,
    auth:{user:process.env.ZOHO_USER,pass:process.env.ZOHO_APP_PASSWORD},
    connectionTimeout:10000,
    greetingTimeout:10000,
    socketTimeout:10000
  });
  return transporter;
}
function esc(v){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function money(n){return '₹'+Number(n||0).toLocaleString('en-IN');}
async function authenticate(req){
  const header=String(req.headers.authorization||'');
  if(!header.startsWith('Bearer ')) throw Object.assign(new Error('Missing authentication'),{statusCode:401});
  const idToken=header.slice(7).trim();
  const key=process.env.FIREBASE_WEB_API_KEY;
  if(!key) throw Object.assign(new Error('Firebase API key is not configured'),{statusCode:500});
  const response=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key='+encodeURIComponent(key),{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken})
  });
  if(!response.ok) throw Object.assign(new Error('Invalid authentication'),{statusCode:401});
  const data=await response.json();
  const user=data.users&&data.users[0];
  if(!user||!user.localId) throw Object.assign(new Error('Invalid authentication'),{statusCode:401});
  return user;
}
module.exports=async(req,res)=>{
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  try{
    const user=await authenticate(req);
    const {orderId,fullName,items,total,requirements,agreementVersion,agreementAcceptedAt}=req.body||{};
    if(!/^SHOP-\d{8}$/.test(String(orderId||''))||!Array.isArray(items)||items.length<1||items.length>20) return res.status(400).json({error:'Invalid request details'});
    const accountEmail=String(user.email||'').trim().toLowerCase();
    if(!accountEmail||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(accountEmail)) return res.status(400).json({error:'Signed-in account has no valid email'});
    if(agreementVersion!=='1.0') return res.status(400).json({error:'Agreement acceptance required'});
    const safeItems=items.map(x=>({name:String(x.name||'').slice(0,160),qty:Math.max(1,Math.min(99,Number(x.qty)||1))})).filter(x=>x.name);
    if(!safeItems.length) return res.status(400).json({error:'No valid items'});
    const siteUrl=process.env.SITE_URL||'https://malpuraovesh.vercel.app';
    const serviceText=safeItems.map(x=>x.name).join(', ');
    const rows=safeItems.map(x=>'<tr><td style="padding:8px 0;color:#c8ffd4">'+esc(x.name)+'</td><td style="padding:8px 0;color:#7fa389;text-align:right">× '+esc(x.qty)+'</td></tr>').join('');
    const html='<div style="background:#030a03;padding:32px 16px;font-family:Arial,Helvetica,sans-serif"><div style="max-width:520px;margin:auto;background:#060f06;border:1px solid rgba(0,255,65,.25);border-radius:10px;padding:32px"><p style="color:#00aa22;letter-spacing:2px;font-size:11px;margin:0 0 8px">OVESH MALPURA CYBER LABS</p><h1 style="color:#39ff14;font-size:23px;margin:0 0 16px">Service request received</h1><p style="color:#c8ffd4;font-size:15px;line-height:1.6">Hello '+esc(fullName)||'there'+', we have received your request and will review the requirements.</p><div style="border:1px solid rgba(0,255,65,.15);border-radius:8px;padding:14px;margin:18px 0"><p style="color:#7fa389;margin:0 0 8px;font-size:12px">REFERENCE</p><strong style="color:#39ff14">'+esc(orderId)+'</strong><table style="width:100%;margin-top:12px">'+rows+'</table><p style="color:#c8ffd4;border-top:1px solid rgba(0,255,65,.12);padding-top:12px;margin-bottom:0"><strong>Estimated total: '+money(total)+'</strong></p></div><a href="'+siteUrl+'/dashboard.html" style="display:inline-block;background:#00cc33;color:#021002;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:6px">Open Client Portal</a><div style="height:10px"></div><a href="'+siteUrl+'/sign-agreement.html?orderId='+encodeURIComponent(orderId)+'" style="display:inline-block;background:#39ff14;color:#021002;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:6px">Review &amp; Sign Agreement</a><p style="color:#a9c9af;font-size:12px;line-height:1.5;margin-top:14px"><strong style="color:#c8ffd4">Agreement copy:</strong> Your Version 1.0 Client Service Agreement is stored with your request and is available through the Client Portal.</p><p style="color:#4a7a52;font-size:12px;line-height:1.5;margin-top:20px">This is a request confirmation, not a payment receipt. Final pricing and next steps are confirmed after review.</p><div style="border-top:1px solid rgba(0,255,65,.12);margin-top:24px;padding-top:20px"><p style="color:#00aa22;letter-spacing:2px;font-size:11px">CLIENT SERVICE AGREEMENT · VERSION 1.0</p><p style="color:#a9c9af;font-size:12px;line-height:1.6">Services covered: '+esc(serviceText)+'. The accepted terms cover scope, requirements and revisions, pricing and payment, delivery, third-party services, ownership and licenses, authorized security work, cancellation and refunds, support, confidentiality, and acceptance. Service-specific terms are available in the checkout agreement and private Client Portal.</p><p style="color:#4a7a52;font-size:11px">Agreement accepted: '+esc(agreementAcceptedAt||'')+'</p></div></div></div>';
    await getTransporter().sendMail({
      from:'"Ovesh Malpura Cyber Labs" <'+process.env.ZOHO_USER+'>',
      to:accountEmail,
      subject:'Service Request Received — '+orderId,
      html
    });
    return res.status(200).json({ok:true});
  }catch(err){
    console.error('SHOP CONFIRMATION EMAIL FAILED:',err.code||err.message);
    return res.status(err.statusCode||500).json({error:err.statusCode===401?'Authentication required':err.code==='EAUTH'?'Email account authentication failed':err.code==='ECONNECTION'||err.code==='ETIMEDOUT'?'Email server connection failed':'Could not send confirmation email'});
  }
};