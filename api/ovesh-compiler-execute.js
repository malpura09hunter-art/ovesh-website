import crypto from 'crypto';

function parseSession(req){
  const cookie=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('ovesh_cloud_session='));
  if(!cookie)return false;
  const token=cookie.slice('ovesh_cloud_session='.length); const [payload,sig]=token.split('.');
  if(!payload||!sig)return false;
  const secret=process.env.OVESH_CLOUD_SESSION_SECRET||process.env.OVESH_CLOUD_PASSWORD;
  if(!secret)return false;
  const expected=crypto.createHmac('sha256',secret).update(payload).digest('base64url');
  if(!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected)))return false;
  try{const data=JSON.parse(Buffer.from(payload,'base64url').toString());return data.exp>Date.now()}catch{return false}
}

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({ok:false,error:'Method not allowed'});
  if(!parseSession(req))return res.status(401).json({ok:false,error:'Compiler session expired. Sign in again.'});
  const {source_code='',stdin='',filename='main.c'}=req.body||{};
  if(typeof source_code!=='string'||source_code.length>100000)return res.status(413).json({ok:false,error:'Source code is too large.'});
  if(typeof stdin!=='string'||stdin.length>20000)return res.status(413).json({ok:false,error:'Input is too large.'});
  const base=process.env.JUDGE0_URL||'https://ce.judge0.com';
  const headers={'Content-Type':'application/json'};
  if(process.env.JUDGE0_AUTH_TOKEN)headers['X-Auth-Token']=process.env.JUDGE0_AUTH_TOKEN;
  try{
    const response=await fetch(`${base.replace(/\/$/,'')}/submissions/?base64_encoded=false&wait=true`,{method:'POST',headers,body:JSON.stringify({language_id:Number(process.env.JUDGE0_C_LANGUAGE_ID||50),source_code,stdin,cpu_time_limit:2,cpu_extra_time:0.5,wall_time_limit:5,memory_limit:128000,max_file_size:1024})});
    const data=await response.json();
    if(!response.ok)return res.status(502).json({ok:false,error:data.error||'Compiler execution service unavailable.'});
    const status=data.status?.description||'UNKNOWN';
    let mapped='SUCCESS';
    if(status==='Compilation Error')mapped='COMPILATION ERROR';
    else if(status.startsWith('Runtime Error'))mapped='RUNTIME ERROR';
    else if(status==='Time Limit Exceeded')mapped='TIMEOUT';
    else if(status!=='Accepted')mapped=status.toUpperCase();
    return res.status(200).json({ok:true,status:mapped,stdout:data.stdout||'',stderr:data.stderr||'',compile_output:data.compile_output||'',time:data.time||null,memory:data.memory||null,filename});
  }catch(e){return res.status(502).json({ok:false,error:'Execution service unavailable. Configure JUDGE0_URL/JUDGE0_AUTH_TOKEN or run a self-hosted Judge0 instance.'})}
}
