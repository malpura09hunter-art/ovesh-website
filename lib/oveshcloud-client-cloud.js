const crypto = require('crypto');
const { getAuth } = require('firebase-admin/auth');
const { getDb, getAdminApp } = require('./oveshcloud-alerts.js');

function httpError(statusCode, message) { const e = new Error(message); e.statusCode = statusCode; return e; }
function timingSafeEqualText(a,b){const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length&&crypto.timingSafeEqual(x,y)}
function parseCookies(req){return Object.fromEntries(String(req.headers.cookie||'').split(';').map(x=>x.trim()).filter(Boolean).map(x=>{const i=x.indexOf('=');return i<0?[x,'']:[x.slice(0,i),decodeURIComponent(x.slice(i+1))]}))}
function requireOwner(req){
  const token=parseCookies(req).ovesh_cloud_session||String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
  const parts=String(token).split('.'),secret=process.env.OVESH_CLOUD_SESSION_SECRET||process.env.OVESH_CLOUD_PASSWORD;
  if(parts.length!==2||!secret)throw httpError(401,'Your OVESH CLOUD owner session is required.');
  const expected=crypto.createHmac('sha256',secret).update(parts[0]).digest('base64url');
  if(!timingSafeEqualText(parts[1],expected))throw httpError(401,'Your OVESH CLOUD owner session is invalid.');
  let data;try{data=JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8'))}catch{throw httpError(401,'Your OVESH CLOUD owner session is invalid.')}
  if(data.u!==(process.env.OVESH_CLOUD_USERNAME||'OVESH')||Number(data.exp)<=Date.now())throw httpError(401,'Your OVESH CLOUD owner session has expired.');
  return {uid:data.u};
}
async function requireClient(req, options={}){
  const header=String(req.headers.authorization||'');
  const match=header.match(/^Bearer\s+(.+)$/i);
  if(!match)throw httpError(401,'Client sign-in is required.');
  let decoded;try{decoded=await getAuth(getAdminApp()).verifyIdToken(match[1],true)}catch{throw httpError(401,'Your client session is invalid or expired. Sign in again.')}
  const db=getDb(),ref=db.collection('client_accounts').doc(decoded.uid),snap=await ref.get();
  if(!snap.exists)throw httpError(403,'This account has not been provisioned for OVESH CLOUD.');
  const account=snap.data()||{};
  if(account.status!=='active')throw httpError(403,'Client access is not active. Contact the owner.');
  if(account.mustChangePassword===true&&!options.allowSetup)throw httpError(403,'Finish password setup before opening your cloud.');
  return {uid:decoded.uid,email:decoded.email||account.email||'',account,ref,db,auth:getAuth(getAdminApp())};
}
function b2(){
  const endpoint=String(process.env.B2_ENDPOINT||'').trim().replace(/\/$/,'');
  const region=String(process.env.B2_REGION||'').trim();
  const bucket=String(process.env.B2_BUCKET||'').trim();
  const keyId=String(process.env.B2_KEY_ID||'').trim();
  const applicationKey=String(process.env.B2_APPLICATION_KEY||'').trim();
  if(!endpoint||!region||!bucket||!keyId||!applicationKey)throw httpError(503,'Private Backblaze B2 storage is not fully configured.');
  const {S3Client}=require('@aws-sdk/client-s3');
  return {bucket,s3:new S3Client({region,endpoint,forcePathStyle:false,credentials:{accessKeyId:keyId,secretAccessKey:applicationKey}})};
}
const safeName=n=>String(n||'file').split(/[\\/]/).pop().replace(/[^a-zA-Z0-9._ -]/g,'_').slice(0,160)||'file';
const mimeForName=name=>{const e=String(name||'').split('.').pop().toLowerCase();return({jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',gif:'image/gif',webp:'image/webp',pdf:'application/pdf',doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xls:'application/vnd.ms-excel',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',ppt:'application/vnd.ms-powerpoint',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation',txt:'text/plain',md:'text/markdown',json:'application/json',csv:'text/csv',html:'text/html',css:'text/css',js:'text/javascript',xml:'application/xml',mp4:'video/mp4',webm:'video/webm',mp3:'audio/mpeg',wav:'audio/wav'})[e]||'application/octet-stream'};
function jsonError(res,e){const status=Number(e?.statusCode)||500; if(status>=500)console.error('Client cloud API error:',e?.message||e);return res.status(status).json({ok:false,error:status>=500?'The client cloud operation could not be completed. Check server configuration and logs.':String(e.message||'Request denied.')})}
module.exports={httpError,requireOwner,requireClient,b2,safeName,mimeForName,jsonError};