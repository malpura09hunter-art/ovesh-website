const {getAuth}=require('firebase-admin/auth');
const {getDb,getAdminApp}=require('./oveshcloud-alerts.js');
const {requireOwner,jsonError,httpError}=require('./oveshcloud-client-cloud.js');

function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
async function sendClientAccessEmail({to,name,company,setupLink,kind='welcome'}){
 const user=String(process.env.ZOHO_USER||'').trim(),pass=String(process.env.ZOHO_APP_PASSWORD||'').trim();
 if(!user||!pass)throw httpError(503,'Transactional email is not configured. Check the existing Zoho SMTP environment variables in Vercel.');
 const safeName=escapeHtml(name||'there'),safeCompany=escapeHtml(company||''),safeLink=escapeHtml(setupLink);
 const reset=kind==='reset',subject=reset?'Reset your OVESH CLOUD password':'Your OVESH CLOUD client workspace is ready';
 const intro=reset?'A password reset was requested for your OVESH CLOUD account.':'Your client workspace has been created. Use the secure link below to set your password and access your files.';
 const preview=reset?'Use the secure link below to reset your password.':'Your secure client workspace is ready. Set your password to activate access.';
 const buttonLabel=reset?'Reset password':'Set password & activate workspace';
 const html=[
 '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>',subject,'</title></head>',
 '<body style="margin:0;padding:0;background:#edf2f7;font-family:Arial,Helvetica,sans-serif;color:#142033;-webkit-text-size-adjust:100%">',
 '<div style="display:none;font-size:1px;color:#edf2f7;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden">',preview,'</div>',
 '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#edf2f7;width:100%"><tr><td align="center" style="padding:32px 12px">',
 '<table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #dce5ef;border-radius:18px;overflow:hidden">',
 '<tr><td style="padding:27px 32px;background:#081321;background-image:linear-gradient(135deg,#081321,#102b40)">',
 '<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>',
 '<td valign="middle" width="46" height="46" align="center" style="width:46px;height:46px;border-radius:12px;background:#12334a;border:1px solid #28546a;color:#68dcf5;font-size:23px;font-weight:bold">C</td>',
 '<td valign="middle" style="padding-left:13px"><div style="font-size:18px;line-height:1.3;font-weight:700;letter-spacing:1.2px;color:#f4f8fc">OVESH CLOUD</div><div style="font-size:10px;line-height:1.6;letter-spacing:2px;color:#8fb1c7">SECURE CLOUD WORKSPACE</div></td>',
 '</tr></table><div style="height:25px;line-height:25px">&nbsp;</div>',
 '<div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;font-weight:700;color:#6adbf4">',reset?'ACCOUNT RECOVERY':'CLIENT ACCESS','</div>',
 '<div style="font-size:26px;line-height:1.25;font-weight:700;color:#ffffff;margin-top:8px">',reset?'Reset your password':'Your workspace is ready','</div>',
 '<div style="font-size:14px;line-height:1.7;color:#b8c9d8;margin-top:8px">',reset?'A secure step to restore access to your account.':'Securely activate your private client workspace.','</div>',
 '</td></tr><tr><td style="padding:32px">',
 '<p style="font-size:16px;line-height:1.5;margin:0 0 14px;color:#142033">Hello ',safeName,',</p>',
 '<p style="font-size:14px;line-height:1.8;color:#4b5b70;margin:0 0 18px">',intro,'</p>',
 safeCompany?'<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 22px"><tr><td style="padding:9px 12px;background:#f4f7fa;border:1px solid #e4eaf1;border-radius:8px;font-size:12px;color:#52647a">Organization: <strong style="color:#1b2c41">'+safeCompany+'</strong></td></tr></table>':'',
 '<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:25px 0 22px"><tr><td align="center" bgcolor="#087f95" style="border-radius:9px;background:#087f95">',
 '<a href="',safeLink,'" style="display:inline-block;padding:15px 23px;border:1px solid #087f95;border-radius:9px;color:#ffffff;text-decoration:none;font-size:14px;line-height:1.2;font-weight:700">',buttonLabel,' &rarr;</a>',
 '</td></tr></table>',
 '<p style="font-size:12px;line-height:1.8;color:#63748a;margin:0">If you did not request this action, you can safely ignore this email. Never share this link with anyone.</p>',
 '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:24px"><tr><td style="padding:15px;background:#f5f8fb;border:1px solid #e1e9f1;border-radius:10px">',
 '<div style="font-size:11px;line-height:1.6;font-weight:700;color:#4e6075;margin-bottom:7px">BUTTON NOT WORKING?</div>',
 '<div style="font-size:11px;line-height:1.7;color:#65758a;margin-bottom:7px">Copy and paste this secure link into your browser:</div>',
 '<div style="font-size:11px;line-height:1.7;word-break:break-all"><a href="',safeLink,'" style="color:#087f95;text-decoration:underline">',safeLink,'</a></div>',
 '</td></tr></table>',
 '<p style="font-size:14px;line-height:1.8;color:#35465b;margin:27px 0 0">Regards,<br><strong style="color:#142033">OVESH CLOUD Support</strong><br><span style="font-size:12px;color:#738298">Ovesh Malpura Cyber Labs</span></p>',
 '</td></tr><tr><td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #e6edf4">',
 '<div style="font-size:11px;line-height:1.7;color:#7b899b">This is an automated account-security email. We will never ask you to reply with your password or verification code.</div>',
 '</td></tr></table><div style="padding:16px 8px 0;font-size:11px;line-height:1.6;color:#8996a6;text-align:center">© ',String(new Date().getFullYear()),' Ovesh Malpura Cyber Labs · OVESH CLOUD</div>',
 '</td></tr></table></body></html>'
 ].join('');
 const textBody='Hello '+(name||'there')+',\n\n'+intro+'\n\n'+(reset?'Reset password':'Set password and activate account')+': '+setupLink+'\n\nFor your security, this link is intended only for you. If you did not expect this email, you can ignore it.\n\nOVESH CLOUD Support — Ovesh Malpura Cyber Labs';
 const nodemailer=require('nodemailer');
 const transporter=nodemailer.createTransport({host:String(process.env.ZOHO_SMTP_HOST||'smtp.zoho.in').trim(),port:465,secure:true,auth:{user,pass},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000});
 try{const info=await transporter.sendMail({from:'OVESH CLOUD <'+user+'>',to,subject,html,text:textBody});const accepted=Array.isArray(info.accepted)?info.accepted.map(x=>String(x).toLowerCase()):[];const rejected=Array.isArray(info.rejected)?info.rejected.map(x=>String(x).toLowerCase()):[];if(!accepted.includes(String(to).trim().toLowerCase())||rejected.includes(String(to).trim().toLowerCase())){console.error('OVESH CLOUD SMTP did not accept recipient:',JSON.stringify({responseCode:info.responseCode||null,acceptedCount:accepted.length,rejectedCount:rejected.length}));throw httpError(502,'Zoho SMTP did not accept the recipient address. Check the recipient email and Zoho SMTP delivery settings.');}console.log('OVESH CLOUD SMTP accepted message:',JSON.stringify({messageId:info.messageId||null,responseCode:info.responseCode||null,acceptedCount:accepted.length}));}
 catch(e){console.error('OVESH CLOUD email delivery failed:',String(e?.code||''),String(e?.responseCode||''),String(e?.message||'').slice(0,300));if(e.statusCode)throw e;throw httpError(502,'Email delivery failed. Check the Zoho mailbox, app password, SMTP host (ZOHO_SMTP_HOST), and verified sender address in Vercel.');}
}
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','no-store, private');
 try{
  requireOwner(req);
  if(!['GET','POST','PATCH'].includes(req.method))return res.status(405).json({ok:false,error:'Method not allowed.'});
  const db=getDb(),auth=getAuth(getAdminApp()),body=req.body||{};
  if(req.method==='GET'){
   const snap=await db.collection('client_accounts').orderBy('createdAt','desc').limit(500).get();
   const clients=snap.docs.map(d=>{const x=d.data()||{};return{uid:d.id,name:x.name||'',email:x.email||'',company:x.company||'',status:x.status||'pending',quotaBytes:Number(x.quotaBytes||10737418240),usedBytes:Number(x.usedBytes||0),reservedBytes:Number(x.reservedBytes||0),createdAt:x.createdAt?.toDate?x.createdAt.toDate().toISOString():x.createdAt||null,loginMethods:Array.isArray(x.loginMethods)?x.loginMethods:['password'],mustChangePassword:x.mustChangePassword===true}});
   return res.status(200).json({ok:true,clients});
  }
  const action=String(body.action||'');
  if(req.method==='POST'&&action==='files'){
   const uid=String(body.uid||'');if(!/^[A-Za-z0-9_-]{10,150}$/.test(uid))throw httpError(400,'Invalid client account.');
   const ref=db.collection('client_accounts').doc(uid),snap=await ref.get();if(!snap.exists)throw httpError(404,'Client account not found.');
   const fs=await ref.collection('files').orderBy('createdAt','desc').limit(500).get();
   return res.status(200).json({ok:true,files:fs.docs.map(d=>{const f=d.data()||{};return{id:d.id,name:f.name||'File',size:Number(f.size||0),contentType:f.contentType||'',createdAt:f.createdAt?.toDate?f.createdAt.toDate().toISOString():f.createdAt||null}})});
  }
  if(req.method==='POST'&&action==='create'){
   const name=String(body.name||'').trim().slice(0,120),email=String(body.email||'').trim().toLowerCase(),company=String(body.company||'').trim().slice(0,160),quotaGb=Number(body.quotaGb||10);
   if(name.length<2||!/^\S+@\S+\.\S+$/.test(email))throw httpError(400,'Enter a client name and valid email address.');
   if(!Number.isFinite(quotaGb)||quotaGb<1||quotaGb>1000)throw httpError(400,'Storage quota must be between 1 and 1000 GB.');
   try{await auth.getUserByEmail(email);throw httpError(409,'A Firebase account with this email already exists. Use the existing account or reset its access.')}catch(e){if(e.statusCode)throw e;if(e.code!=='auth/user-not-found')throw e}
   const user=await auth.createUser({email,displayName:name,emailVerified:false,disabled:false});
   const quotaBytes=Math.round(quotaGb*1024*1024*1024);
   try{
    await db.collection('client_accounts').doc(user.uid).create({uid:user.uid,name,email,company,status:'active',quotaBytes,usedBytes:0,reservedBytes:0,loginMethods:['password'],mustChangePassword:true,createdAt:new Date(),updatedAt:new Date(),createdBy:'OVESH_OWNER',storagePrefix:'client-cloud/'+user.uid+'/'});
   }catch(e){await auth.deleteUser(user.uid).catch(()=>{});throw e}
   let setupLink;try{setupLink=await auth.generatePasswordResetLink(email,{url:'https://malpuraovesh.vercel.app/client-login.html',handleCodeInApp:false});}catch(e){await db.collection('client_accounts').doc(user.uid).delete().catch(()=>{});await auth.deleteUser(user.uid).catch(()=>{});console.error('OVESH CLOUD setup-link generation failed:',String(e?.code||''),String(e?.message||'').slice(0,300));throw httpError(502,'Firebase could not generate the setup link. Check Firebase Authentication email/password provider and authorized domains for malpuraovesh.vercel.app.');}
   try{await sendClientAccessEmail({to:email,name,company,setupLink,kind:'welcome'});}catch(e){await db.collection('client_accounts').doc(user.uid).delete().catch(()=>{});await auth.deleteUser(user.uid).catch(()=>{});throw e;}
   return res.status(201).json({ok:true,client:{uid:user.uid,name,email,company,status:'active',quotaBytes,usedBytes:0,reservedBytes:0,mustChangePassword:true},emailSent:true,message:'Client account created and the secure setup email was sent.'});
  }
  if(req.method==='PATCH'&&action==='status'){
   const uid=String(body.uid||'');if(!/^[A-Za-z0-9_-]{10,150}$/.test(uid))throw httpError(400,'Invalid client account.');
   const status=body.status==='active'?'active':body.status==='suspended'?'suspended':null;if(!status)throw httpError(400,'Status must be active or suspended.');
   const ref=db.collection('client_accounts').doc(uid),snap=await ref.get();if(!snap.exists)throw httpError(404,'Client account not found.');
   await ref.update({status,updatedAt:new Date(),updatedBy:'OVESH_OWNER'});
   await auth.updateUser(uid,{disabled:status!=='active'}).catch(async e=>{if(e.code!=='auth/user-not-found')throw e});
   await ref.collection('audit').add({event:'account_'+status,actor:'OVESH_OWNER',createdAt:new Date()});
   return res.status(200).json({ok:true,status});
  }
  if(req.method==='POST'&&action==='reset'){
   const uid=String(body.uid||'');if(!/^[A-Za-z0-9_-]{10,150}$/.test(uid))throw httpError(400,'Invalid client account.');
   const snap=await db.collection('client_accounts').doc(uid).get();if(!snap.exists)throw httpError(404,'Client account not found.');
   const user=await auth.getUser(uid);if(!user.email)throw httpError(400,'This client account does not have an email address.');
   let setupLink;try{setupLink=await auth.generatePasswordResetLink(user.email,{url:'https://malpuraovesh.vercel.app/client-login.html',handleCodeInApp:false});}catch(e){console.error('OVESH CLOUD reset-link generation failed:',String(e?.code||''),String(e?.message||'').slice(0,300));throw httpError(502,'Firebase could not generate the password-reset link. Check Firebase Authentication email/password provider and authorized domains for malpuraovesh.vercel.app.');}
   await sendClientAccessEmail({to:user.email,name:snap.data().name||user.displayName||'',company:snap.data().company||'',setupLink,kind:'reset'});
   await snap.ref.update({passwordResetRequestedAt:new Date(),updatedAt:new Date()});
   return res.status(200).json({ok:true,email:user.email,emailSent:true,message:'A password-reset email was sent to the client.'});
  }
  throw httpError(400,'Unknown client management action.');
 }catch(e){return jsonError(res,e)}
};