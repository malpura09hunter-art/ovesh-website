const nodemailer=require('nodemailer');
let transporter;
function getTransporter(){
  if(!transporter) transporter=nodemailer.createTransport({
    host:process.env.ZOHO_SMTP_HOST||'smtp.zoho.in',port:465,secure:true,
    auth:{user:process.env.ZOHO_USER,pass:process.env.ZOHO_APP_PASSWORD},
    connectionTimeout:8000,greetingTimeout:8000,socketTimeout:8000
  });
  return transporter;
}
function esc(v){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function money(n){return '₹'+Number(n||0).toLocaleString('en-IN');}
module.exports=async(req,res)=>{
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const {orderId,fullName,email,items,total,requirements}=req.body||{};
  if(!orderId||!email||!Array.isArray(items))return res.status(400).json({error:'Missing request details'});
  const siteUrl=process.env.SITE_URL||'https://malpuraovesh.vercel.app';
  const rows=items.map(x=>'<tr><td style="padding:8px 0;color:#c8ffd4">'+esc(x.name)+'</td><td style="padding:8px 0;color:#7fa389;text-align:right">× '+esc(x.qty)+'</td></tr>').join('');
  const html=`<div style="background:#030a03;padding:32px 16px;font-family:Arial,Helvetica,sans-serif"><div style="max-width:520px;margin:auto;background:#060f06;border:1px solid rgba(0,255,65,.25);border-radius:10px;padding:32px"><p style="color:#00aa22;letter-spacing:2px;font-size:11px;margin:0 0 8px">OVESH MALPURA CYBER LABS</p><h1 style="color:#39ff14;font-size:23px;margin:0 0 16px">Service request received</h1><p style="color:#c8ffd4;font-size:15px;line-height:1.6">Hello ${esc(fullName)||'there'}, we've received your request and will review the requirements.</p><div style="border:1px solid rgba(0,255,65,.15);border-radius:8px;padding:14px;margin:18px 0"><p style="color:#7fa389;margin:0 0 8px;font-size:12px">REFERENCE</p><strong style="color:#39ff14">${esc(orderId)}</strong><table style="width:100%;margin-top:12px">${rows}</table><p style="color:#c8ffd4;border-top:1px solid rgba(0,255,65,.12);padding-top:12px;margin-bottom:0"><strong>Estimated total: ${money(total)}</strong></p></div><a href="${siteUrl}/dashboard.html" style="display:inline-block;background:#00cc33;color:#021002;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:6px">Open Client Portal</a><p style="color:#4a7a52;font-size:12px;line-height:1.5;margin-top:20px">This is a request confirmation, not a payment receipt. Final pricing and next steps are confirmed after review.</p></div></div>`;
  try{
    await getTransporter().sendMail({from:`"OveshMalpura Cyber Labs" <${process.env.ZOHO_USER}>`,to:email,subject:`Service Request Received — ${orderId}`,html});
    res.status(200).json({ok:true});
  }catch(err){console.error('SHOP CONFIRMATION EMAIL FAILED:',err.code||err.message);res.status(500).json({error:'Could not send confirmation email'});}
};