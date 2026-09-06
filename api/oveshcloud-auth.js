import crypto from 'crypto';
const { sendLoginAlerts } = require('../lib/oveshcloud-alerts.js');
function detectOS(ua=''){if(/Windows NT 10\.0/i.test(ua))return'Windows 10/11';if(/Mac OS X/i.test(ua))return'macOS';if(/Android/i.test(ua))return'Android';if(/iPhone|iPad|iPod/i.test(ua))return'iOS/iPadOS';if(/Linux/i.test(ua))return'Linux';return'Not available'}
function detectBrowser(ua=''){if(/Edg\//i.test(ua))return'Microsoft Edge';if(/OPR\//i.test(ua))return'Opera';if(/Chrome\//i.test(ua))return'Google Chrome';if(/Firefox\//i.test(ua))return'Mozilla Firefox';if(/Safari\//i.test(ua))return'Safari';return'Not available'}
function detectDevice(ua=''){return/Mobi|Android|iPhone|iPad|iPod/i.test(ua)?'Mobile / Tablet':'Desktop / Laptop'}
async function lookupIp(ip){if(!ip)return{};try{const r=await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`,{signal:AbortSignal.timeout(1200)});if(!r.ok)return{};const x=await r.json();if(x.success===false)return{};return{isp:x.connection?.isp||x.connection?.org||null,location:[x.city,x.region,x.country].filter(Boolean).join(', ')||null};}catch{return{}}}
export default async function handler(req,res){
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
