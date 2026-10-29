const crypto=require('crypto');
const {getSignedUrl}=require('@aws-sdk/s3-request-presigner');
const {requireClient,b2,safeName,mimeForName,jsonError,httpError}=require('../lib/oveshcloud-client-cloud.js');
const {PutObjectCommand,GetObjectCommand,DeleteObjectCommand,HeadObjectCommand}=require('@aws-sdk/client-s3');
const clientAdminHandler=require('../lib/oveshcloud-client-admin-handler.js');
const GB=1024*1024*1024,MAX_FILE=2*GB;
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','no-store, private');
 try{
  const body=req.body||{},action=String(body.action||'');
  // Owner-only client administration shares this function to stay within Vercel Hobby's function cap.
  if(req.method==='GET'||req.method==='PATCH'||['create','reset','status','files'].includes(action))return clientAdminHandler(req,res);
  if(req.method!=='POST')throw httpError(405,'Method not allowed.');
  const c=await requireClient(req,{allowSetup:action==='finish-setup'||action==='google-linked'||action==='profile'}),accountRef=c.ref,db=c.db;
  if(action==='profile'){return res.status(200).json({ok:true,profile:{name:c.account.name||'',email:c.email,company:c.account.company||'',status:c.account.status||'active'}})}
  if(action==='finish-setup'){
   // Never trust the browser to claim password setup is complete. Firebase Admin's
   // passwordUpdatedAt is set by Firebase only after a successful password change.
   if(c.account.mustChangePassword===true){
    const user=await c.auth.getUser(c.uid);
    const passwordUpdatedAt=Date.parse(user.metadata?.passwordUpdatedAt||'');
    const createdAtValue=c.account.createdAt?.toDate?c.account.createdAt.toDate():c.account.createdAt;
    const createdAt=createdAtValue instanceof Date?createdAtValue.getTime():Date.parse(createdAtValue||'');
    if(!Number.isFinite(passwordUpdatedAt)||!Number.isFinite(createdAt)||passwordUpdatedAt<=createdAt){
     throw httpError(403,'Finish setting your password using the secure Firebase password-reset link sent by the owner before accessing your workspace.');
    }
    await accountRef.update({mustChangePassword:false,passwordChangedAt:new Date(passwordUpdatedAt),updatedAt:new Date()});
   }
   return res.status(200).json({ok:true});
  }
  if(action==='google-linked'){
   const user=await c.auth.getUser(c.uid),methods=(user.providerData||[]).map(p=>p.providerId);
   await accountRef.update({loginMethods:Array.from(new Set(['password',...(methods.includes('google.com')?['google']:[])])),updatedAt:new Date()});
   return res.status(200).json({ok:true,loginMethods:['password',...(methods.includes('google.com')?['google']:[])]});
  }
  if(action==='list'){
   const snap=await accountRef.collection('files').orderBy('createdAt','desc').limit(1000).get();
   const files=snap.docs.map(d=>{const f=d.data()||{};return{id:d.id,name:f.name||'File',size:Number(f.size||0),contentType:f.contentType||mimeForName(f.name),createdAt:f.createdAt?.toDate?f.createdAt.toDate().toISOString():f.createdAt||null}});
   const used=Number(c.account.usedBytes||files.reduce((n,f)=>n+f.size,0)),quotaBytes=Number(c.account.quotaBytes||10*GB);
   return res.status(200).json({ok:true,files,usage:{usedBytes:used,quotaBytes,remainingBytes:Math.max(0,quotaBytes-used),fileCount:files.length}});
  }
  if(action==='prepare-upload'){
   const name=safeName(body.name),size=Number(body.size),contentType=String(body.contentType||mimeForName(name)).slice(0,160);
   if(!name||!Number.isSafeInteger(size)||size<1||size>MAX_FILE)throw httpError(400,'File size must be between 1 byte and 2 GB.');
   const pending=await db.collection('client_upload_reservations').where('uid','==',c.uid).limit(100).get();
   for(const doc of pending.docs){const old=doc.data()||{};if(old.status==='pending'&&Number(old.expiresAt||0)<Date.now()){await db.runTransaction(async tx=>{const [ar,rr]=await Promise.all([tx.get(accountRef),tx.get(doc.ref)]);if(!rr.exists||rr.data().status!=='pending'||Number(rr.data().expiresAt||0)>=Date.now())return;const a=ar.data()||{};tx.update(accountRef,{reservedBytes:Math.max(0,Number(a.reservedBytes||0)-Number(rr.data().size||0)),updatedAt:new Date()});tx.update(doc.ref,{status:'expired',finishedAt:new Date()})});if(old.objectKey){const {bucket,s3}=b2();await s3.send(new DeleteObjectCommand({Bucket:bucket,Key:old.objectKey})).catch(()=>{})}}}
   const reservationId=crypto.randomUUID(),reservationRef=db.collection('client_upload_reservations').doc(reservationId),quota=Number(c.account.quotaBytes||10*GB);
   await db.runTransaction(async tx=>{const snap=await tx.get(accountRef);if(!snap.exists||snap.data().status!=='active')throw httpError(403,'Client account is not active.');const a=snap.data(),used=Number(a.usedBytes||0),reserved=Number(a.reservedBytes||0),q=Number(a.quotaBytes||quota);if(used+reserved+size>q)throw httpError(413,'This upload exceeds your remaining storage quota.');tx.update(accountRef,{reservedBytes:reserved+size,updatedAt:new Date()});tx.create(reservationRef,{uid:c.uid,name,size,contentType,status:'pending',createdAt:new Date(),expiresAt:Date.now()+15*60*1000})});
   const objectKey='client-cloud/'+c.uid+'/'+crypto.randomUUID()+'-'+name,{bucket,s3}=b2(),command=new PutObjectCommand({Bucket:bucket,Key:objectKey,ContentType:contentType,Metadata:{'client-uid':c.uid,'reservation-id':reservationId}});
   const uploadUrl=await getSignedUrl(s3,command,{expiresIn:900});await reservationRef.update({objectKey});
   return res.status(200).json({ok:true,uploadUrl,objectKey,reservationId,contentType,expiresIn:900});
  }
  if(action==='complete-upload'||action==='cancel-upload'){
   const id=String(body.reservationId||'');if(!/^[a-f0-9-]{36}$/i.test(id))throw httpError(400,'Invalid upload reservation.');
   const rr=db.collection('client_upload_reservations').doc(id),rs=await rr.get();if(!rs.exists||rs.data().uid!==c.uid)throw httpError(404,'Upload reservation not found.');
   const r=rs.data();if(r.status!=='pending')throw httpError(409,'This upload reservation has already been processed.');
   if(action==='cancel-upload'){
    await db.runTransaction(async tx=>{const [ar,rrs]=await Promise.all([tx.get(accountRef),tx.get(rr)]);if(!rrs.exists||rrs.data().status!=='pending')return;const a=ar.data()||{};tx.update(accountRef,{reservedBytes:Math.max(0,Number(a.reservedBytes||0)-Number(r.size||0)),updatedAt:new Date()});tx.update(rr,{status:'cancelled',finishedAt:new Date()})});
    if(r.objectKey){const {bucket,s3}=b2();await s3.send(new DeleteObjectCommand({Bucket:bucket,Key:r.objectKey})).catch(()=>{})}
    return res.status(200).json({ok:true});
   }
   const {bucket,s3}=b2(),head=await s3.send(new HeadObjectCommand({Bucket:bucket,Key:r.objectKey}));
   if(Number(head.ContentLength)!==Number(r.size))throw httpError(400,'Uploaded file size does not match the reservation.');
   const fileRef=accountRef.collection('files').doc(id);
   await db.runTransaction(async tx=>{const [ar,rrs]=await Promise.all([tx.get(accountRef),tx.get(rr)]);if(!rrs.exists||rrs.data().status!=='pending')throw httpError(409,'Upload reservation has already been processed.');const a=ar.data()||{},used=Number(a.usedBytes||0),reserved=Number(a.reservedBytes||0),quota=Number(a.quotaBytes||10*GB);if(used+Number(head.ContentLength||0)>quota)throw httpError(413,'Storage quota was exceeded.');tx.update(accountRef,{usedBytes:used+Number(head.ContentLength||0),reservedBytes:Math.max(0,reserved-Number(r.size||0)),updatedAt:new Date()});tx.create(fileRef,{id,name:r.name,objectKey:r.objectKey,size:Number(head.ContentLength||0),contentType:r.contentType,createdAt:new Date(),uploadedBy:c.uid});tx.update(rr,{status:'complete',finishedAt:new Date()})});
   await accountRef.collection('audit').add({event:'file_uploaded',fileId:id,name:r.name,size:Number(head.ContentLength||0),actor:c.uid,createdAt:new Date()});
   return res.status(200).json({ok:true,file:{id,name:r.name,size:Number(head.ContentLength||0)}});
  }
  if(action==='download'){
   const id=String(body.id||'');if(!/^[a-f0-9-]{36}$/i.test(id))throw httpError(400,'Invalid file reference.');
   const snap=await accountRef.collection('files').doc(id).get();if(!snap.exists)throw httpError(404,'File not found.');const f=snap.data(),{bucket,s3}=b2(),command=new GetObjectCommand({Bucket:bucket,Key:f.objectKey,ResponseContentDisposition:'attachment; filename="'+safeName(f.name)+'"'});return res.status(200).json({ok:true,downloadUrl:await getSignedUrl(s3,command,{expiresIn:300}),expiresIn:300});
  }
  if(action==='delete'){
   const id=String(body.id||'');if(!/^[a-f0-9-]{36}$/i.test(id))throw httpError(400,'Invalid file reference.');
   const fr=accountRef.collection('files').doc(id),snap=await fr.get();if(!snap.exists)throw httpError(404,'File not found.');const f=snap.data(),{bucket,s3}=b2();await s3.send(new DeleteObjectCommand({Bucket:bucket,Key:f.objectKey}));
   await db.runTransaction(async tx=>{const [ar,fs]=await Promise.all([tx.get(accountRef),tx.get(fr)]);if(!fs.exists)return;const a=ar.data()||{};tx.update(accountRef,{usedBytes:Math.max(0,Number(a.usedBytes||0)-Number(fs.data().size||0)),updatedAt:new Date()});tx.delete(fr)});
   await accountRef.collection('audit').add({event:'file_deleted',fileId:id,name:f.name||'File',size:Number(f.size||0),actor:c.uid,createdAt:new Date()});
   return res.status(200).json({ok:true});
  }
  throw httpError(400,'Unknown client file operation.');
 }catch(e){return jsonError(res,e)}
};