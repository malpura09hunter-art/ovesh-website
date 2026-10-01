const crypto = require('crypto');

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
module.exports=async(req,res)=>{
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
};
