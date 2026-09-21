function esc(v){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
async function authenticate(req){
  const h=String(req.headers.authorization||''); if(!h.startsWith('Bearer ')) throw Object.assign(new Error('Authentication required'),{statusCode:401});
  const token=h.slice(7).trim(),key=process.env.FIREBASE_WEB_API_KEY||'AIzaSyDB8ZVagSc8C3o3tdrwUcuflZhT8X5lMZ0';
  const r=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key='+encodeURIComponent(key),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken:token})});
  if(!r.ok)throw Object.assign(new Error('Invalid authentication'),{statusCode:401});
  const d=await r.json(),u=d.users&&d.users[0]; if(!u||!u.localId)throw Object.assign(new Error('Invalid authentication'),{statusCode:401}); return {user:u,token};
}
function stringValue(v){return v&&typeof v.stringValue==='string'?v.stringValue:''}
function numberValue(v){return v&&v.integerValue!==undefined?Number(v.integerValue):v&&v.doubleValue!==undefined?Number(v.doubleValue):0}
module.exports=async(req,res)=>{
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 try{
  const {user,token}=await authenticate(req);
  const {orderId,fullName,signatureType,signature}=req.body||{};
  if(!/^SHOP-\d{8}$/.test(String(orderId||'')))return res.status(400).json({error:'Invalid request reference'});
  const name=String(fullName||'').trim().slice(0,160);
  const sig=String(signature||'');
  if(!name||!['draw','type'].includes(signatureType))return res.status(400).json({error:'Signature details are incomplete'});
  if(signatureType==='draw'&&!/^data:image\/png;base64,/.test(sig))return res.status(400).json({error:'Invalid drawn signature'});
  if(signatureType==='draw'&&sig.length>160000)return res.status(400).json({error:'Signature is too large'});
  if(signatureType==='type'&&(!sig||sig.length>160))return res.status(400).json({error:'Invalid typed signature'});
  const projectId=process.env.FIREBASE_PROJECT_ID||'ovesh-malpura-cyber-lab';
  const base='https://firestore.googleapis.com/v1/projects/'+encodeURIComponent(projectId)+'/databases/(default)/documents';
  const q={structuredQuery:{from:[{collectionId:'service_requests'}],where:{fieldFilter:{field:{fieldPath:'orderId'},op:'EQUAL',value:{stringValue:String(orderId)}}},limit:1}};
  const qr=await fetch(base+':runQuery',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(q)});
  if(!qr.ok)throw Object.assign(new Error('Could not access service request'),{statusCode:403});
  const results=await qr.json(),doc=results.find(x=>x.document)?.document;
  if(!doc)throw Object.assign(new Error('Service request not found'),{statusCode:404});
  const f=doc.fields||{},requestUid=stringValue(f.uid)||stringValue(f.userId);
  if(requestUid&&requestUid!==user.localId)throw Object.assign(new Error('Not permitted'),{statusCode:403});
  const existing=f.signature;
  if(existing&&existing.mapValue&&existing.mapValue.fields&&existing.mapValue.fields.signedAt)return res.status(409).json({error:'This agreement has already been signed'});
  const signatureFields={
    fullName:{stringValue:name},
    signatureType:{stringValue:signatureType},
    signature:{stringValue:sig},
    signedAt:{timestampValue:new Date().toISOString()},
    agreementVersion:{stringValue:'1.0'}
  };
  const url=base+'/'+doc.name.split('/').map(encodeURIComponent).join('/')+'?updateMask.fieldPaths=signature';
  const ur=await fetch(url,{method:'PATCH',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({fields:{signature:{mapValue:{fields:signatureFields}}}})});
  if(!ur.ok)throw Object.assign(new Error('Could not record signature'),{statusCode:500});
  return res.status(200).json({ok:true});
 }catch(e){
  console.error('SHOP AGREEMENT SIGNATURE FAILED:',e.message);
  return res.status(e.statusCode||500).json({error:e.statusCode?e.message:'Could not record signature'});
 }
};