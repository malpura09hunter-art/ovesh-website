import crypto from 'crypto';
const {S3Client,GetObjectCommand}=require('@aws-sdk/client-s3');
const { getDb, sendLoginAlerts } = require('../lib/oveshcloud-alerts.js');
const getAdminDb = getDb;
function detectOS(ua=''){if(/Windows NT 10\.0/i.test(ua))return'Windows 10/11';if(/Mac OS X/i.test(ua))return'macOS';if(/Android/i.test(ua))return'Android';if(/iPhone|iPad|iPod/i.test(ua))return'iOS/iPadOS';if(/Linux/i.test(ua))return'Linux';return'Not available'}
function detectBrowser(ua=''){if(/Edg\//i.test(ua))return'Microsoft Edge';if(/OPR\//i.test(ua))return'Opera';if(/Chrome\//i.test(ua))return'Google Chrome';if(/Firefox\//i.test(ua))return'Mozilla Firefox';if(/Safari\//i.test(ua))return'Safari';return'Not available'}
function detectDevice(ua=''){return/Mobi|Android|iPhone|iPad|iPod/i.test(ua)?'Mobile / Tablet':'Desktop / Laptop'}
async function lookupIp(ip){if(!ip)return{};try{const r=await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`,{signal:AbortSignal.timeout(1800)});if(!r.ok)return{};const x=await r.json();if(x.success===false)return{};const c=x.connection||{},tz=x.timezone||{};return{isp:c.isp||null,organization:c.org||null,asn:c.asn?String(c.asn):null,connectionDomain:c.domain||null,location:[x.city,x.region,x.country].filter(Boolean).join(', ')||null,city:x.city||null,region:x.region||null,country:x.country||null,countryCode:x.country_code||null,postalCode:x.postal||null,timezone:tz.id||null,latitude:Number.isFinite(x.latitude)?x.latitude:null,longitude:Number.isFinite(x.longitude)?x.longitude:null,ipType:x.type||null};}catch{return{}}}
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

function parseCookies(req){
  return Object.fromEntries(String(req.headers.cookie||'').split(';').map(x=>x.trim()).filter(Boolean).map(x=>{const i=x.indexOf('=');return i<0?[x,'']:[x.slice(0,i),decodeURIComponent(x.slice(i+1))]}));
}
function requireCloudSession(req){
  const token=parseCookies(req).ovesh_cloud_session||String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
  const [payload,sig]=String(token).split('.');
  const secret=process.env.OVESH_CLOUD_SESSION_SECRET||process.env.OVESH_CLOUD_PASSWORD;
  if(!payload||!sig||!secret)throw Object.assign(new Error('Secure OVESH CLOUD session is unavailable.'),{statusCode:401});
  const expected=crypto.createHmac('sha256',secret).update(payload).digest('base64url');
  const a=Buffer.from(sig),b=Buffer.from(expected);
  if(a.length!==b.length||!crypto.timingSafeEqual(a,b))throw Object.assign(new Error('Secure OVESH CLOUD session is invalid.'),{statusCode:401});
  let data;try{data=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'))}catch{throw Object.assign(new Error('Secure OVESH CLOUD session is invalid.'),{statusCode:401})}
  if(!data.exp||Date.now()>Number(data.exp))throw Object.assign(new Error('Secure OVESH CLOUD session has expired.'),{statusCode:401});
  return data;
}
function config(){
  const raw=String(process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON||'').trim();
  if(!raw)throw Object.assign(new Error('Google Drive is not configured. Add GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON and GOOGLE_DRIVE_FOLDER_ID in Vercel.'),{statusCode:503});
  let sa;try{sa=JSON.parse(raw)}catch{throw Object.assign(new Error('Google Drive service-account configuration is invalid.'),{statusCode:500})}
  const folderId=String(process.env.GOOGLE_DRIVE_FOLDER_ID||'').trim();
  if(!folderId||!sa.client_email||!sa.private_key)throw Object.assign(new Error('Google Drive is not fully configured. Check GOOGLE_DRIVE_FOLDER_ID and the service-account JSON.'),{statusCode:503});
  return{sa,folderId};
}
function b64url(v){return Buffer.from(v).toString('base64url')}
async function accessToken(sa){
  const now=Math.floor(Date.now()/1000);
  const header=b64url(JSON.stringify({alg:'RS256',typ:'JWT'}));
  const payload=b64url(JSON.stringify({iss:sa.client_email,scope:'https://www.googleapis.com/auth/drive.readonly',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600}));
  const signer=crypto.createSign('RSA-SHA256');signer.update(header+'.'+payload);signer.end();
  const assertion=header+'.'+payload+'.'+signer.sign(sa.private_key,'base64url');
  const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion})});
  const x=await r.json().catch(()=>({}));
  if(!r.ok||!x.access_token)throw Object.assign(new Error('Google Drive authentication failed.'),{statusCode:502});
  return x.access_token;
}
async function driveFetch(token,path,opts={}){
  const r=await fetch('https://www.googleapis.com/drive/v3/'+path,{...opts,headers:{Authorization:'Bearer '+token,...(opts.headers||{})}});
  const text=await r.text();let x;try{x=JSON.parse(text)}catch{x=text}
  if(!r.ok){const e=new Error(typeof x==='object'&&x?.error?.message?x.error.message:'Google Drive request failed ('+r.status+')');e.statusCode=r.status===401?502:500;throw e}
  return x;
}
async function isInside(token,fileId,rootId){
  let current=String(fileId),seen=new Set();
  for(let depth=0;depth<20;depth++){
    if(current===rootId)return true;
    if(seen.has(current))return false;seen.add(current);
    const x=await driveFetch(token,'files/'+encodeURIComponent(current)+'?fields=id%2Cparents%2CmimeType%2Ctrashed&supportsAllDrives=true');
    if(x.trashed)return false;
    const parents=Array.isArray(x.parents)?x.parents:[];
    if(!parents.length)return false;
    current=parents[0];
  }
  return false;
}
function safeDownloadName(name){return String(name||'file').replace(/[\\/\r\n\0]/g,'_').slice(0,180)||'file'}
function exportForMime(mime){return({'application/vnd.google-apps.document':['application/pdf','pdf'],'application/vnd.google-apps.spreadsheet':['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','xlsx'],'application/vnd.google-apps.presentation':['application/vnd.openxmlformats-officedocument.presentationml.presentation','pptx']})[mime]||null}
async function handleGoogleDrive(req,res){
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  try{
    if(req.method!=='GET')return res.status(405).json({ok:false,error:'Method not allowed'});
    requireCloudSession(req);
    const {sa,folderId}=config();
    const token=await accessToken(sa);
    const action=String(req.query?.action||'list');
    if(action==='list'){
      const parent=String(req.query?.parentId||folderId);
      if(!(await isInside(token,parent,folderId)))return res.status(403).json({ok:false,error:'Drive folder access denied.'});
      const q="'"+parent.replace(/'/g,"\\'")+"' in parents and trashed = false";
      const fields=encodeURIComponent('nextPageToken,files(id,name,mimeType,size,modifiedTime,webViewLink,iconLink,resourceKey)');
      const data=await driveFetch(token,'files?q='+encodeURIComponent(q)+'&pageSize=100&orderBy=name_natural&fields='+fields+'&supportsAllDrives=true&includeItemsFromAllDrives=true');
      const files=(data.files||[]).map(f=>({id:f.id,name:f.name,mimeType:f.mimeType,size:Number(f.size||0),modifiedTime:f.modifiedTime||null,webViewLink:f.webViewLink||null,iconLink:f.iconLink||null,isFolder:f.mimeType==='application/vnd.google-apps.folder'}));
      return res.status(200).json({ok:true,parentId:parent,rootId:folderId,files});
    }
    if(action==='download'){
      const id=String(req.query?.id||'');if(!id)return res.status(400).json({ok:false,error:'File id is required.'});
      if(!(await isInside(token,id,folderId)))return res.status(403).json({ok:false,error:'Drive file access denied.'});
      const meta=await driveFetch(token,'files/'+encodeURIComponent(id)+'?fields=id%2Cname%2CmimeType%2Csize%2Ctrashed&supportsAllDrives=true');
      if(meta.trashed||meta.mimeType==='application/vnd.google-apps.folder')return res.status(400).json({ok:false,error:'Folders cannot be downloaded.'});
      const ex=exportForMime(meta.mimeType);
      const url=ex?'https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(id)+'/export?mimeType='+encodeURIComponent(ex[0]):'https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(id)+'?alt=media&supportsAllDrives=true';
      const r=await fetch(url,{headers:{Authorization:'Bearer '+token}});
      if(!r.ok)return res.status(r.status===404?404:502).json({ok:false,error:'Unable to download the Google Drive file.'});
      res.setHeader('Content-Type',ex?ex[0]:(r.headers.get('content-type')||'application/octet-stream'));
      res.setHeader('Content-Disposition','attachment; filename="'+safeDownloadName(meta.name)+(ex&&!meta.name.toLowerCase().endsWith('.'+ex[1])?'.'+ex[1]:'')+'"');
      if(r.headers.get('content-length'))res.setHeader('Content-Length',r.headers.get('content-length'));
      return res.status(200).send(Buffer.from(await r.arrayBuffer()));
    }
    return res.status(400).json({ok:false,error:'Invalid Google Drive operation.'});
  }catch(e){console.error('OVESH CLOUD GOOGLE DRIVE:',e);return res.status(Number(e.statusCode)||500).json({ok:false,error:e.message||'Unable to access Google Drive.'})}
}

function readCloudSessionData(req){
  const raw=String(req.headers.cookie||'');
  const item=raw.split(';').map(x=>x.trim()).find(x=>x.startsWith('ovesh_cloud_session='));
  if(!item)return null;
  const token=decodeURIComponent(item.slice('ovesh_cloud_session='.length)),parts=token.split('.');
  const secret=process.env.OVESH_CLOUD_SESSION_SECRET||process.env.OVESH_CLOUD_PASSWORD;
  if(!secret||parts.length!==2)return null;
  const expected=crypto.createHmac('sha256',secret).update(parts[0]).digest('base64url');
  const a=Buffer.from(parts[1]),b=Buffer.from(expected);
  if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return null;
  try{const data=JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8'));return data.u===(process.env.OVESH_CLOUD_USERNAME||'OVESH')&&Number(data.exp)>Date.now()?data:null}catch{return null}
}
async function recordSecurityEvent(event){
  try{await getAdminDb().collection('oveshCloudSecurityEvents').add({...event,ip:event.ip||null,userAgent:String(event.userAgent||'').slice(0,500),path:String(event.path||'').slice(0,160),createdAt:new Date()})}
  catch(error){console.error('OVESH security event write failed:',error?.message||error)}
}
async function listSecurityEvents(req,res){
  if(req.method!=='GET')return res.status(405).json({ok:false,error:'Method not allowed'});
  if(!readCloudSession(req))return res.status(401).json({ok:false,error:'OVESH CLOUD session required'});
  try{
    const snap=await getAdminDb().collection('oveshCloudSecurityEvents').orderBy('createdAt','desc').limit(100).get();
    const events=snap.docs.map(doc=>{const x=doc.data()||{};return{id:doc.id,eventType:x.eventType||'security_event',severity:x.severity||'info',outcome:x.outcome||'recorded',reason:x.reason||null,ip:x.ip||null,isp:x.isp||null,organization:x.organization||null,asn:x.asn||null,connectionDomain:x.connectionDomain||null,browser:x.browser||null,os:x.os||null,device:x.device||null,userAgent:x.userAgent||null,method:x.method||null,path:x.path||null,host:x.host||null,vercelRequestId:x.vercelRequestId||null,protocol:x.protocol||null,timestamp:x.timestamp||x.createdAt?.toDate?.().toISOString?.()||null,location:x.location||null,city:x.city||null,region:x.region||null,country:x.country||null,countryCode:x.countryCode||null,postalCode:x.postalCode||null,timezone:x.timezone||null,latitude:x.latitude??null,longitude:x.longitude??null,ipType:x.ipType||null}});
    return res.status(200).json({ok:true,count:events.length,events});
  }catch(error){console.error('OVESH security events read failed:',error?.message||error);return res.status(500).json({ok:false,error:'Unable to load security events. Check Firebase Admin configuration and Firestore access.'})}
}

async function orionCount(db,name){
  try{const snap=await db.collection(name).count().get();return Number(snap.data().count||0)}catch{return null}
}
async function handleOrion(req,res){
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  if(req.method!=='POST')return res.status(405).json({ok:false,error:'Method not allowed'});
  if(!readCloudSessionData(req))return res.status(401).json({ok:false,error:'A valid OV CLOUD owner session is required.'});
  const message=String(req.body?.message||'').trim().slice(0,300);
  if(!message)return res.status(400).json({ok:false,error:'Please provide a short message.'});
  try{
    const db=getAdminDb();
    const [files,requests,events]=await Promise.all([
      orionCount(db,'oveshCloudFiles'),
      orionCount(db,'service_requests'),
      db.collection('oveshCloudSecurityEvents').orderBy('createdAt','desc').limit(25).get().catch(()=>null)
    ]);
    const recent=events?events.docs.map(doc=>{const x=doc.data()||{};return{severity:String(x.severity||'info').toLowerCase()}}):[];
    const high=recent.filter(x=>x.severity==='high'||x.severity==='critical').length;
    const q=message.toLowerCase();
    let answer='';
    if(/\b(help|what can you do|commands)\b/.test(q)){
      answer='I can give you a cloud briefing, report file metadata counts, summarize recent security events, and report service request totals. Try asking: cloud status, file count, or security status.';
    }else if(/\b(security|alert|threat|suspicious|incident)\b/.test(q)){
      answer=!events?'I could not retrieve the security event summary right now. Your cloud session remains separate and unaffected.':high?'The latest 25 recorded security events include '+high+' high or critical severity event'+(high===1?'':'s')+'. Please open the Security section to inspect the full records. I have not changed any access or files.':'I found no high or critical severity events in the latest '+recent.length+' recorded security events. Please use the Security section for the full event history.';
    }else if(/\b(file|files|upload|storage)\b/.test(q)){
      answer=files===null?'The file metadata count is currently unavailable.':'OV CLOUD currently has '+files+' file metadata record'+(files===1?'':'s')+' in its Firestore file index. This is an index count, not a measurement of Backblaze storage usage.';
    }else if(/\b(client|order|request|project)\b/.test(q)){
      answer=requests===null?'The service request count is currently unavailable.':'I can see '+requests+' service request record'+(requests===1?'':'s')+' in the workspace request collection.';
    }else if(/\b(status|briefing|overview|summary|how are things|good morning|good afternoon|hello|hi)\b/.test(q)){
      const fileText=files===null?'file index count unavailable':files+' file metadata records';
      const requestText=requests===null?'service request count unavailable':requests+' service requests';
      const securityText=!events?'security summary temporarily unavailable':high?high+' high or critical events among the latest '+recent.length+' security records':'no high or critical events among the latest '+recent.length+' security records';
      answer='Your OV CLOUD owner session is active. The workspace index shows '+fileText+' and '+requestText+'. Security summary: '+securityText+'. These are read-only summaries. What would you like to check next?';
    }else{
      answer='I am ORION, your OV CLOUD voice companion. I can summarize cloud status, file index counts, service requests, and recent security events. Ask me for a cloud briefing or say help.';
    }
    return res.status(200).json({ok:true,answer,stats:{files,requests,recentSecurityEvents:recent.length,highSeverityEvents:high,securityAvailable:Boolean(events)}});
  }catch(error){
    console.error('OV CLOUD ORION briefing failed:',error?.message||error);
    return res.status(503).json({ok:false,error:'ORION cannot reach the workspace summary right now.'});
  }
}

export default async function handler(req,res){
  if(req.method==='GET'&&(String(req.query?.action||'')==='drive-list'||String(req.query?.action||'')==='drive-download')){
    const mapped={...req,query:{...req.query,action:String(req.query.action)==='drive-list'?'list':'download'}};
    return handleGoogleDrive(mapped,res);
  }
  const action=String(req.query?.action||'');
  if(action==='orion')return handleOrion(req,res);
  if(action==='security-events')return listSecurityEvents(req,res);
  if(req.method==='GET'&&action==='shop-orders')return shopOrders(req,res);
  if(req.method==='GET'&&action==='shop-agreement-pdf')return shopAgreementPdf(req,res);
  if(req.method==='GET'&&action==='session'){const session=readCloudSessionData(req);if(!session)return res.status(401).json({ok:false,authenticated:false,error:'OVESH CLOUD session required'});return res.status(200).json({ok:true,authenticated:true,expiresAt:Number(session.exp),username:session.u});}
  if(req.method!=='POST')return res.status(405).json({ok:false,error:'Method not allowed'});
  const{username,password,location}=req.body||{};const u=process.env.OVESH_CLOUD_USERNAME||'OVESH',p=process.env.OVESH_CLOUD_PASSWORD;
  if(!p)return res.status(500).json({ok:false,error:'OVESH_CLOUD_PASSWORD is not configured in Vercel'});
  if(username!==u||password!==p){
    const ip=(req.headers['x-forwarded-for']||req.headers['x-real-ip']||'').toString().split(',')[0].trim()||null,ua=String(req.headers['user-agent']||''),timestamp=new Date().toISOString();
    const net=await lookupIp(ip);const forwardedHost=String(req.headers['x-forwarded-host']||req.headers.host||'').slice(0,180);
    await recordSecurityEvent({eventType:'authentication_failure',severity:'high',outcome:'blocked',reason:username===u?'WRONG_PASSWORD':'UNKNOWN_USERNAME',ip,isp:net.isp||null,organization:net.organization||null,asn:net.asn||null,connectionDomain:net.connectionDomain||null,location:net.location||[req.headers['x-vercel-ip-city'],req.headers['x-vercel-ip-country']].filter(Boolean).join(', ')||null,city:net.city||null,region:net.region||null,country:net.country||req.headers['x-vercel-ip-country']||null,countryCode:net.countryCode||null,postalCode:net.postalCode||null,timezone:net.timezone||null,latitude:net.latitude??null,longitude:net.longitude??null,ipType:net.ipType||null,browser:detectBrowser(ua),os:detectOS(ua),device:detectDevice(ua),userAgent:ua,method:req.method,path:'/api/oveshcloud-auth',host:forwardedHost,vercelRequestId:String(req.headers['x-vercel-id']||'').slice(0,180)||null,protocol:String(req.headers['x-forwarded-proto']||'').slice(0,20)||null,timestamp});
    return res.status(401).json({ok:false,error:username===u?'WRONG PASSWORD':'ACCESS DENIED'});
  }
  const ip=(req.headers['x-forwarded-for']||req.headers['x-real-ip']||'').toString().split(',')[0].trim()||null,ua=req.headers['user-agent']||'',timestamp=new Date().toISOString();
  const secret=process.env.OVESH_CLOUD_SESSION_SECRET||p,payload=Buffer.from(JSON.stringify({u,iat:Date.now(),exp:Date.now()+1000*60*60*12,nonce:crypto.randomBytes(16).toString('hex')})).toString('base64url'),signature=crypto.createHmac('sha256',secret).update(payload).digest('base64url'),token=`${payload}.${signature}`;
  const ipInfo=await lookupIp(ip);const os=detectOS(ua),browser=detectBrowser(ua),device=detectDevice(ua),finalLocation=ipInfo.location||location||null;
  const details={timestamp,ip,isp:ipInfo.isp||'Not available',os,browser,device,userAgent:ua||'Not available',location:finalLocation,time:new Date(timestamp).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',dateStyle:'medium',timeStyle:'short'})+' IST'};
  await recordSecurityEvent({eventType:'authentication_success',severity:'info',outcome:'allowed',reason:'VALID_CREDENTIALS',ip,isp:ipInfo.isp||null,organization:ipInfo.organization||null,asn:ipInfo.asn||null,connectionDomain:ipInfo.connectionDomain||null,location:finalLocation,city:ipInfo.city||null,region:ipInfo.region||null,country:ipInfo.country||null,countryCode:ipInfo.countryCode||null,postalCode:ipInfo.postalCode||null,timezone:ipInfo.timezone||null,latitude:ipInfo.latitude??null,longitude:ipInfo.longitude??null,ipType:ipInfo.ipType||null,browser,os,device,userAgent:ua,method:req.method,path:'/api/oveshcloud-auth',host:String(req.headers['x-forwarded-host']||req.headers.host||'').slice(0,180),vercelRequestId:String(req.headers['x-vercel-id']||'').slice(0,180)||null,protocol:String(req.headers['x-forwarded-proto']||'').slice(0,20)||null,timestamp});
  res.setHeader('Set-Cookie',`ovesh_cloud_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=43200`);
  // Alerts are deliberately best-effort: a notification outage must never block a valid Cloud login.
  const alerts=await sendLoginAlerts(details).catch(err=>{console.error('OVESH login alert pipeline failed',err);return[]});
  return res.status(200).json({ok:true,token,security:{...details,locationStatus:finalLocation?'IP lookup/browser location available':'Location unavailable'},alerts});
}
