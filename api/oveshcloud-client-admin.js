const {getAuth}=require('firebase-admin/auth');
const {getDb,getAdminApp}=require('../lib/oveshcloud-alerts.js');
const {requireOwner,jsonError,httpError}=require('../lib/oveshcloud-client-cloud.js');
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
  if(req.method==='POST'&&action==='create'){
   const name=String(body.name||'').trim().slice(0,120),email=String(body.email||'').trim().toLowerCase(),company=String(body.company||'').trim().slice(0,160),quotaGb=Number(body.quotaGb||10);
   if(name.length<2||!/^\S+@\S+\.\S+$/.test(email))throw httpError(400,'Enter a client name and valid email address.');
   if(!Number.isFinite(quotaGb)||quotaGb<1||quotaGb>1000)throw httpError(400,'Storage quota must be between 1 and 1000 GB.');
   try{await auth.getUserByEmail(email);throw httpError(409,'A Firebase account with this email already exists. Use the existing account or reset its access.')}catch(e){if(e.statusCode)throw e;if(e.code!=='auth/user-not-found')throw e}
   const user=await auth.createUser({email,displayName:name,emailVerified:false,disabled:false});
   const quotaBytes=Math.round(quotaGb*1024*1024*1024);
   try{
    await db.collection('client_accounts').doc(user.uid).create({uid:user.uid,name,email,company,status:'active',quotaBytes,usedBytes:0,reservedBytes:0,loginMethods:['password','google'],mustChangePassword:true,createdAt:new Date(),updatedAt:new Date(),createdBy:'OVESH_OWNER',storagePrefix:'client-cloud/'+user.uid+'/'});
   }catch(e){await auth.deleteUser(user.uid).catch(()=>{});throw e}
   const setupLink=await auth.generatePasswordResetLink(email);
   return res.status(201).json({ok:true,client:{uid:user.uid,name,email,company,status:'active',quotaBytes,usedBytes:0,reservedBytes:0,mustChangePassword:true},setupLink,message:'Account created. Share the password-setup link with the client through a secure channel. The client must finish setup before accessing files.'});
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
   const user=await auth.getUser(uid),setupLink=await auth.generatePasswordResetLink(user.email);
   await snap.ref.update({mustChangePassword:true,updatedAt:new Date()});
   return res.status(200).json({ok:true,email:user.email,setupLink,message:'Send the password-setup link to the verified client using a secure channel.'});
  }
  throw httpError(400,'Unknown client management action.');
 }catch(e){return jsonError(res,e)}
};