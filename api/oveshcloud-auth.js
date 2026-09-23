import crypto from 'crypto';
const { sendLoginAlerts } = require('../lib/oveshcloud-alerts.js');
const { getAdminDb } = require('./shop-agreement.js');
function detectOS(ua=''){if(/Windows NT 10\.0/i.test(ua))return'Windows 10/11';if(/Mac OS X/i.test(ua))return'macOS';if(/Android/i.test(ua))return'Android';if(/iPhone|iPad|iPod/i.test(ua))return'iOS/iPadOS';if(/Linux/i.test(ua))return'Linux';return'Not available'}
function detectBrowser(ua=''){if(/Edg\//i.test(ua))return'Microsoft Edge';if(/OPR\//i.test(ua))return'Opera';if(/Chrome\//i.test(ua))return'Google Chrome';if(/Firefox\//i.test(ua))return'Mozilla Firefox';if(/Safari\//i.test(ua))return'Safari';return'Not available'}
function detectDevice(ua=''){return/Mobi|Android|iPhone|iPad|iPod/i.test(ua)?'Mobile / Tablet':'Desktop / Laptop'}
async function lookupIp(ip){if(!ip)return{};try{const r=await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`,{signal:AbortSignal.timeout(1200)});if(!r.ok)return{};const x=await r.json();if(x.success===false)return{};return{isp:x.connection?.isp||x.connection?.org||null,location:[x.city,x.region,x.country].filter(Boolean).join(', ')||null};}catch{return{}}}
function readCloudSession(req){
  const raw=String(req.headers.cookie||'');
  const item=raw.split(';').map(x=>x.trim()).find(x=>x.startsWith('ovesh_cloud_session='));
  if(!item)return false;
  const token=decodeURIComponent(item.slice('ovesh_cloud_session='.length)),parts=token.split('.');
  const secret=process.env.OVESH_CLOUD_SESSION_SECRET||process.env.OVESH_CLOUD_PASSWORD;
  if(!secret||parts.length!==2)return false;
  const expected=crypto.createHmac('sha256',secret).update(parts[0]).digest('base64url');
  if(parts[1]!==expected)return false;
  try{
    const data=JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8'));
    return data.u===(process.env.OVESH_CLOUD_USERNAME||'OVESH')&&Number(data.exp)>Date.now();
  }catch{return false}
}
const isoDate=v=>{
  if(!v)return null;
  if(typeof v.toDate==='function')return v.toDate().toISOString();
  if(typeof v==='string')return v;
  if(v instanceof Date)return v.toISOString();
  return null;
};
function b2ForAgreements(){const endpoint=String(process.env.B2_ENDPOINT||'').trim().replace(/\/$/,'');const region=String(process.env.B2_REGION||'').trim();const bucket=String(process.env.B2_BUCKET||'').trim();const keyId=String(process.env.B2_KEY_ID||'').trim();const applicationKey=String(process.env.B2_APPLICATION_KEY||'').trim();if(!endpoint||!region||!bucket||!keyId||!applicationKey)throw Error('Agreement storage is not configured');return{bucket,s3:new S3Client({region,endpoint,forcePathStyle:false,credentials:{accessKeyId:keyId,secretAccessKey:applicationKey}})}}
async function shopAgreementPdf(req,res){if(req.method!=='GET'||!readCloudSession(req))return res.status(401).json({ok:false,error:'OVESH CLOUD session required'});const orderId=String(req.query?.orderId||'');if(!/^SHOP-\d{8}$/.test(orderId))return res.status(400).json({ok:false,error:'Invalid request reference'});try{const snap=await getAdminDb().collection('service_requests').where('orderId','==',orderId).limit(1).get();if(snap.empty)return res.status(404).json({ok:false,error:'Service request not found'});const x=snap.docs[0].data()||{},key=String(x.agreementStorageKey||'');if(!key)return res.status(404).json({ok:false,error:'Agreement PDF has not been stored yet'});if(!key.startsWith('client-agreements/')||key.includes('..'))return res.status(403).json({ok:false,error:'Invalid agreement storage key'});const {bucket,s3}=b2ForAgreements(),out=await s3.send(new GetObjectCommand({Bucket:bucket,Key:key}));const chunks=[];for await(const chunk of out.Body)chunks.push(Buffer.from(chunk));const pdf=Buffer.concat(chunks);res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition','attachment; filename="Ovesh-Client-Agreement-'+orderId+'.pdf"');res.setHeader('Content-Length',String(pdf.length));res.setHeader('Cache-Control','private, no-store, max-age=0');return res.status(200).send(pdf)}catch(e){console.error('OVESH SHOP AGREEMENT PDF FAILED:',e.message);return res.status(500).json({ok:false,error:'Unable to retrieve agreement PDF'})}}
async function shopOrders(req,res){
  if(req.method!=='GET'||!readCloudSession(req))return res.status(401).json({ok:false,error:'OVESH CLOUD session required'});
  try{
    const snap=await getAdminDb().collection('service_requests').where('source','==','shop').limit(500).get();
    const orders=snap.docs.map(d=>{
      const x=d.data()||{},s=x.signature||null;
      return {
        id:d.id,orderId:x.orderId||d.id,fullName:x.fullName||'Not provided',
        email:x.email||'Not provided',phone:x.phone||'Not provided',
        selectedService:x.selectedService||'Custom service',
        items:Array.isArray(x.items)?x.items.map(i=>({name:i.name||i.title||'Service',price:i.price??null,quantity:i.quantity??1})):[],
        estimatedTotal:x.estimatedTotal??null,projectDescription:x.projectDescription||'',
        status:x.status||'Pending',paymentStatus:x.paymentStatus||'Quote / payment pending',
        agreementVersion:x.agreementVersion||null,agreementAccepted:x.agreementAccepted===true,
        agreementAcceptedAt:isoDate(x.agreementAcceptedAt),agreementStorageKey:x.agreementStorageKey||null,agreementStoredAt:isoDate(x.agreementStoredAt),agreementStatus:x.agreementStatus||null,signature:s?{signedAt:isoDate(s.signedAt),fullName:s.fullName||null,signatureType:s.signatureType||null,agreementVersion:s.agreementVersion||null}:null,
        createdAt:isoDate(x.createdAt),updatedAt:isoDate(x.updatedAt)
      };
    }).sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
    return res.status(200).json({ok:true,count:orders.length,orders});
  }catch(e){
    console.error('OVESH SHOP ORDERS FAILED:',e.message);
    return res.status(500).json({ok:false,error:'Unable to load Shop Orders'});
  }
}

export default async function handler(req,res){
  const action=String(req.query?.action||'');
  if(req.method==='GET'&&action==='shop-orders')return shopOrders(req,res);
  if(req.method==='GET'&&action==='shop-agreement-pdf')return shopAgreementPdf(req,res);
  if(req.method!=='POST')return res.status(405).json({ok:false,error:'Method not allowed'});
  const{username,password,location}=req.body||{};const u=process.env.OVESH_CLOUD_USERNAME||'OVESH',p=process.env.OVESH_CLOUD_PASSWORD;
  if(!p)return res.status(500).json({ok:false,error:'OVESH_CLOUD_PASSWORD is not configured in Vercel'});
  if(username!==u||password!==p)return res.status(401).json({ok:false,error:'ACCESS DENIED'});
  const ip=(req.headers['x-forwarded-for']||req.headers['x-real-ip']||'').toString().split(',')[0].trim()||null,ua=req.headers['user-agent']||'',timestamp=new Date().toISOString();
  const secret=process.env.OVESH_CLOUD_SESSION_SECRET||p,payload=Buffer.from(JSON.stringify({u,iat:Date.now(),exp:Date.now()+1000*60*60*12,nonce:crypto.randomBytes(16).toString('hex')})).toString('base64url'),signature=crypto.createHmac('sha256',secret).update(payload).digest('base64url'),token=`${payload}.${signature}`;
  const ipInfo=await lookupIp(ip);const os=detectOS(ua),browser=detectBrowser(ua),device=detectDevice(ua),finalLocation=ipInfo.location||location||null;
  const details={timestamp,ip,isp:ipInfo.isp||'Not available',os,browser,device,userAgent:ua||'Not available',location:finalLocation,time:new Date(timestamp).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',dateStyle:'medium',timeStyle:'short'})+' IST'};
  res.setHeader('Set-Cookie',`ovesh_cloud_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=43200`);
  // Alerts are deliberately best-effort: a notification outage must never block a valid Cloud login.
  const alerts=await sendLoginAlerts(details).catch(err=>{console.error('OVESH login alert pipeline failed',err);return[]});
  return res.status(200).json({ok:true,token,security:{...details,locationStatus:finalLocation?'IP lookup/browser location available':'Location unavailable'},alerts});
}
