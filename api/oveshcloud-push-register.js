const crypto = require('crypto');
const { getDb } = require('../lib/oveshcloud-alerts');

function cookie(req,name){const raw=String(req.headers.cookie||'');const m=raw.match(new RegExp('(?:^|; )'+name.replace(/[.*+?^${}()|[\\]\\]/g,'\\$&')+'=([^;]+)'));return m?decodeURIComponent(m[1]):'';}
function validSession(token){
  if(!token || !token.includes('.')) return false;
  const [payload,sig]=token.split('.');
  const secret=process.env.OVESH_CLOUD_SESSION_SECRET||process.env.OVESH_CLOUD_PASSWORD;
  if(!secret) return false;
  const expected=crypto.createHmac('sha256',secret).update(payload).digest('base64url');
  if(!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected))) return false;
  try{const p=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));return p.exp>Date.now()&&p.u===(process.env.OVESH_CLOUD_USERNAME||'OVESH');}catch{return false;}
}
module.exports=async(req,res)=>{
  if(req.method!=='POST')return res.status(405).json({ok:false,error:'Method not allowed'});
  const body=req.body||{},session=body.sessionToken||cookie(req,'ovesh_cloud_session');
  if(!validSession(session))return res.status(401).json({ok:false,error:'Unauthorized'});
  const token=String(body.token||'').trim();
  if(token.length<40||token.length>4096)return res.status(400).json({ok:false,error:'Invalid push token'});
  try{
    const db=getDb(), ref=db.collection('oveshCloudPushDevices'), id=crypto.createHash('sha256').update(token).digest('hex');
    const existing=await ref.doc(id).get();
    if(!existing.exists){const active=await ref.where('active','==',true).limit(3).get();if(active.size>=2)return res.status(409).json({ok:false,error:'OVESH CLOUD push is already registered on two owner devices. Remove an old device before adding another.'});}
    await ref.doc(id).set({token,device:String(body.device||'Unknown device').slice(0,120),platform:String(body.platform||'Unknown').slice(0,120),active:true,updatedAt:new Date(),createdAt:existing.exists?existing.data().createdAt:new Date()},{merge:true});
    return res.status(200).json({ok:true});
  }catch(err){console.error('OVESH push register failed',err);return res.status(500).json({ok:false,error:'Push registration unavailable'});}
};
