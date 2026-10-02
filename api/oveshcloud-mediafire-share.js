const crypto=require('crypto');
const {S3Client,GetObjectCommand}=require('@aws-sdk/client-s3');
const {getSignedUrl}=require('@aws-sdk/s3-request-presigner');

function parseCookies(req){return Object.fromEntries(String(req.headers.cookie||'').split(';').map(x=>x.trim()).filter(Boolean).map(x=>{const i=x.indexOf('=');return i<0?[x,'']:[x.slice(0,i),decodeURIComponent(x.slice(i+1))]}));}
function session(req){
  const token=parseCookies(req).ovesh_cloud_session||String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
  const [payload,sig]=String(token).split('.');
  const secret=process.env.OVESH_CLOUD_SESSION_SECRET||process.env.OVESH_CLOUD_PASSWORD;
  if(!payload||!sig||!secret)throw Object.assign(new Error('Secure OVESH CLOUD session is unavailable.'),{statusCode:401});
  const expected=crypto.createHmac('sha256',secret).update(payload).digest('base64url');
  const a=Buffer.from(sig),b=Buffer.from(expected);
  if(a.length!==b.length||!crypto.timingSafeEqual(a,b))throw Object.assign(new Error('Secure OVESH CLOUD session is invalid.'),{statusCode:401});
  let d;try{d=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'))}catch{throw Object.assign(new Error('Secure OVESH CLOUD session is invalid.'),{statusCode:401})}
  if(!d.exp||Date.now()>Number(d.exp))throw Object.assign(new Error('Secure OVESH CLOUD session has expired.'),{statusCode:401});
  return String(d.u||'OVESH').replace(/[^a-zA-Z0-9._-]/g,'_');
}
function b2(){
  const c={endpoint:String(process.env.B2_ENDPOINT||'').trim().replace(/\/$/,''),region:String(process.env.B2_REGION||'').trim(),bucket:String(process.env.B2_BUCKET||'').trim(),keyId:String(process.env.B2_KEY_ID||'').trim(),applicationKey:String(process.env.B2_APPLICATION_KEY||'').trim()};
  if(Object.values(c).some(v=>!v))throw Object.assign(new Error('Backblaze is not configured.'),{statusCode:500});
  return {c,s:new S3Client({region:c.region,endpoint:c.endpoint,forcePathStyle:false,credentials:{accessKeyId:c.keyId,secretAccessKey:c.applicationKey}})};
}
function safeName(n){return String(n||'file').split(/[\\/]/).pop().replace(/[^a-zA-Z0-9._ -]/g,'_').slice(0,180)||'file';}
function owned(uid,key){return key.startsWith(`users/${uid}/`)&&!key.includes('..');}
async function mfCall(action,params,session){
  const secretKey=String(session.secret_key||'').trim();
  const time=String(Math.floor(Date.now()/1000));
  const uri=`/api/1.5/${action}.php`;
  const signature=crypto.createHash('md5').update(secretKey+time+uri).digest('hex');
  const q=new URLSearchParams({response_format:'json',session_token:session.session_token,time,signature,...params});
  const r=await fetch(`https://www.mediafire.com${uri}?${q.toString()}`);
  const x=await r.json().catch(()=>null);
  if(!r.ok||!x?.response||x.response.result!=='Success')throw new Error(x?.response?.message||`MediaFire API error during ${action}.`);
  return x.response;
}
async function mfSession(){
  const email=String(process.env.MEDIAFIRE_EMAIL||'').trim(),password=String(process.env.MEDIAFIRE_PASSWORD||''),appId=String(process.env.MEDIAFIRE_APP_ID||'').trim(),apiKey=String(process.env.MEDIAFIRE_API_KEY||'').trim();
  if(!email||!password||!appId||!apiKey)throw Object.assign(new Error('MediaFire sharing is not configured yet.'),{statusCode:503});
  const signature=crypto.createHash('sha1').update(email+password+appId+apiKey).digest('hex');
  const q=new URLSearchParams({application_id:appId,signature,email,password,token_version:'2',response_format:'json'});
  const r=await fetch(`https://www.mediafire.com/api/user/get_session_token.php?${q.toString()}`);
  const x=await r.json().catch(()=>null);
  if(!r.ok||x?.response?.result!=='Success')throw Object.assign(new Error(x?.response?.message||'MediaFire authentication failed.'),{statusCode:502});
  return x.response;
}
module.exports=async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  try{
    if(req.method!=='POST')return res.status(405).json({ok:false,error:'Method not allowed.'});
    const uid=session(req),objectKey=String(req.body?.objectKey||'');
    if(!owned(uid,objectKey))return res.status(403).json({ok:false,error:'Access denied.'});
    const {c,s}=b2();
    const name=safeName(objectKey.split('/').pop().replace(/^[0-9a-f-]{36}-/i,''));
    const b2Url=await getSignedUrl(s,new GetObjectCommand({Bucket:c.bucket,Key:objectKey}),{expiresIn:900});
    const mf=await mfSession();
    const added=await mfCall('upload/add_web_upload',{url:b2Url,filename:name},mf);
    const uploadKey=added.upload_key;
    if(!uploadKey)throw new Error('MediaFire did not return an upload key.');
    for(let i=0;i<30;i++){
      await new Promise(r=>setTimeout(r,1000));
      const status=await mfCall('upload/get_web_uploads',{key:uploadKey},mf);
      const item=(status.uploads||status.upload||[])[0]||status;
      const state=String(item.status||item.state||'').toLowerCase();
      if(state==='complete'||state==='completed'||item.quickkey||item.quick_key){
        const quickKey=String(item.quickkey||item.quick_key||'');
        if(!quickKey)break;
        const links=await mfCall('file/get_links',{quick_key:quickKey,link_type:'direct_download'},mf);
        const direct=links.links?.[0]?.direct_download||links.links?.[0]?.normal_download||links.links?.[0]?.view;
        if(!direct)throw new Error('MediaFire file was uploaded, but no download link was returned.');
        const origin=`https://${req.headers.host}`;
        return res.status(200).json({ok:true,name,provider:'mediafire',quickKey,mediafireUrl:direct,sharePage:`${origin}/ovesh/mediafire-share?url=${encodeURIComponent(direct)}&name=${encodeURIComponent(name)}`});
      }
      if(state==='error'||state==='failed')throw new Error(item.error||'MediaFire upload failed.');
    }
    throw new Error('MediaFire upload is still processing. Please try Share again in a moment.');
  }catch(e){console.error('OVESH CLOUD MEDIAFIRE SHARE:',e);return res.status(Number(e.statusCode)||500).json({ok:false,error:e.message||'Unable to create MediaFire share.'});}
};