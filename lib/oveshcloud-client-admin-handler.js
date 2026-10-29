const {getAuth}=require('firebase-admin/auth');
const {getDb,getAdminApp}=require('./oveshcloud-alerts.js');
const {requireOwner,jsonError,httpError}=require('./oveshcloud-client-cloud.js');

function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
async function sendClientAccessEmail({to,name,company,setupLink,kind='welcome'}){
 const apiKey=String(process.env.RESEND_API_KEY||'').trim();
 const from=String(process.env.OVESH_CLOUD_EMAIL_FROM||'').trim();
 if(!apiKey||!from)throw httpError(503,'Email delivery is not configured. Set RESEND_API_KEY and OVESH_CLOUD_EMAIL_FROM in Vercel, using a verified sender domain.');
 const safeName=escapeHtml(name||'there'),safeCompany=escapeHtml(company||''),safeLink=escapeHtml(setupLink);
 const reset=kind==='reset';
 const subject=reset?'Reset your OVESH CLOUD password':'Your OVESH CLOUD client workspace is ready';
 const intro=reset?'A password reset was requested for your OVESH CLOUD account.':'Your client workspace has been created. Use the secure link below to set your password and access your files.';
 const html='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>'+subject+'</title></head><body style="margin:0;background:#eef3f8;font-family:Arial,Helvetica,sans-serif;color:#142235"><div style="display:none;max-height:0;overflow:hidden;opacity:0">'+intro+'</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef3f8;padding:32px 12px"><tr><td align="center"><table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#fff;border:1px solid #dbe5ef;border-radius:18px;overflow:hidden"><tr><td style="background:#071827;padding:28px 32px"><div style="font-size:12px;letter-spacing:3px;font-weight:bold;color:#45d8e8">OVESH CLOUD™</div><div style="font-size:23px;font-weight:bold;color:#fff;margin-top:12px">Secure client workspace</div><div style="font-size:13px;color:#b7c9d8;margin-top:6px">Private access. Your files. Your workspace.</div></td></tr><tr><td style="padding:32px"><p style="font-size:16px;margin:0 0 14px">Hello '+safeName+',</p><p style="font-size:15px;line-height:1.7;color:#435368;margin:0 0 22px">'+intro+'</p>'+(safeCompany?'<p style="font-size:13px;color:#617287;margin:0 0 22px">Organization: <strong>'+safeCompany+'</strong></p>':'')+'<table role="presentation" cellspacing="0" cellpadding="0" style="margin:26px 0"><tr><td bgcolor="#087f95" style="border-radius:9px"><a href="'+safeLink+'" style="display:inline-block;padding:14px 22px;color:#fff;text-decoration:none;font-size:15px;font-weight:bold">'+(reset?'Reset password':'Set password &amp; activate account')+'</a></td></tr></table><p style="font-size:13px;line-height:1.7;color:#617287">For your security, this link is intended only for you and may expire. Do not forward it or share it with anyone. If you did not expect this email, you can ignore it.</p><div style="margin-top:24px;padding:16px;background:#f4f8fb;border:1px solid #e0e9f1;border-radius:10px"><div style="font-size:12px;color:#617287;margin-bottom:8px">Button not working? Copy this secure link:</div><div style="font-size:12px;line-height:1.6;word-break:break-all"><a href="'+safeLink+'" style="color:#087f95">'+safeLink+'</a></div></div><p style="font-size:14px;line-height:1.7;color:#435368;margin:28px 0 0">Regards,<br><strong>OVESH CLOUD Support</strong><br><span style="font-size:12px;color:#718096">Ovesh Malpura Cyber Labs</span></p></td></tr><tr><td style="padding:18px 32px;background:#f7f9fc;border-top:1px solid #e5edf4;font-size:11px;line-height:1.6;color:#8090a2">This is an account-related security email. Please do not reply with passwords or verification codes.</td></tr></table><div style="font-size:11px;color:#8a99a8;margin-top:16px">© '+new Date().getFullYear()+' Ovesh Malpura Cyber Labs</div></td></tr></table></body></html>';
 const textBody='Hello '+(name||'there')+',\n\n'+intro+'\n\n'+(reset?'Reset password':'Set password and activate account')+': '+setupLink+'\n\nFor your security, this link is intended only for you. If you did not expect this email, you can ignore it.\n\nOVESH CLOUD Support — Ovesh Malpura Cyber Labs';
 const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},body:JSON.stringify({from,to:[to],subject,html,text:textBody})});
 const result=await response.json().catch(()=>({}));
 if(!response.ok)throw httpError(502,'The account link could not be emailed. Check the Resend sender/domain configuration and try again.');
 return {id:result.id||null};
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
   const setupLink=await auth.generatePasswordResetLink(email,{url:'https://malpuraovesh.vercel.app/client-login.html',handleCodeInApp:false});
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
   const user=await auth.getUser(uid),setupLink=await auth.generatePasswordResetLink(user.email,{url:'https://malpuraovesh.vercel.app/client-login.html',handleCodeInApp:false});
   await sendClientAccessEmail({to:user.email,name:snap.data().name||user.displayName||'',company:snap.data().company||'',setupLink,kind:'reset'});
   await snap.ref.update({passwordResetRequestedAt:new Date(),updatedAt:new Date()});
   return res.status(200).json({ok:true,email:user.email,emailSent:true,message:'A password-reset email was sent to the client.'});
  }
  throw httpError(400,'Unknown client management action.');
 }catch(e){return jsonError(res,e)}
};