const nodemailer = require('nodemailer');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

function getAdminApp() {
  if (getApps().length) return getApps()[0];
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (raw) return initializeApp({ credential: cert(JSON.parse(raw)) });
  return initializeApp();
}
function getDb() { return getFirestore(getAdminApp()); }
function getMessagingClient() { return getMessaging(getAdminApp()); }
function formatDetails(d) {
  return [`Device: ${d.device || 'Unknown'}`, `OS: ${d.os || 'Unknown'}`, `Browser: ${d.browser || 'Unknown'}`, `IP: ${d.ip || 'Unknown'}`, `ISP: ${d.isp || 'Unknown'}`, `Approx. location: ${d.location || 'Unavailable'}`, `Time: ${d.time || new Date().toISOString()}`].join('\n');
}
function esc(v) { return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

async function sendEmail(d) {
  const to = process.env.OVESH_CLOUD_ALERT_EMAIL || process.env.ZOHO_USER;
  if (!to || !process.env.ZOHO_USER || !process.env.ZOHO_APP_PASSWORD) return { ok:false, skipped:true };
  const transporter = nodemailer.createTransport({ host:process.env.ZOHO_SMTP_HOST || 'smtp.zoho.in', port:465, secure:true, auth:{user:process.env.ZOHO_USER,pass:process.env.ZOHO_APP_PASSWORD}, connectionTimeout:8000, greetingTimeout:8000, socketTimeout:8000 });
  const s = Object.fromEntries(Object.entries(d).map(([k,v])=>[k,esc(v)]));
  await transporter.sendMail({
    from:`"OVESH CLOUD™ Security" <${process.env.ZOHO_USER}>`, to,
    subject:'🔐 OVESH CLOUD™ — New login detected',
    text:`OVESH CLOUD™ SECURITY ALERT\n\nA successful login was detected.\n\n${formatDetails(d)}\n\nIf this was not you, secure your Cloud account immediately.`,
    html:`<!doctype html><html><body style="font-family:Arial;background:#071007;padding:24px;color:#d8ffe0"><div style="max-width:560px;margin:auto;background:#0d180e;border:1px solid #1c5b28;border-radius:14px;padding:28px"><div style="font-size:12px;letter-spacing:2px;color:#43ff68">OVESH CLOUD™ · SECURITY</div><h1>New login detected</h1><p>A successful login was detected on your private Cloud.</p><div style="background:#091109;border:1px solid #1c5b28;border-radius:10px;padding:18px;line-height:1.9"><b>Device</b>: ${s.device}<br><b>OS</b>: ${s.os}<br><b>Browser</b>: ${s.browser}<br><b>IP</b>: ${s.ip}<br><b>ISP</b>: ${s.isp}<br><b>Approx. location</b>: ${s.location}<br><b>Time</b>: ${s.time}</div><p>If this wasn't you, secure the Cloud account immediately.</p></div></body></html>`
  });
  return { ok:true };
}

async function sendTelegram(d) {
  const token=process.env.OVESH_TELEGRAM_BOT_TOKEN, chatId=process.env.OVESH_TELEGRAM_CHAT_ID;
  if(!token || !chatId) return {ok:false,skipped:true};
  const response=await fetch(`https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:chatId,text:`🔐 OVESH CLOUD™ LOGIN ALERT\n\nSuccessful login detected.\n\n${formatDetails(d)}\n\nIf this wasn't you, secure your Cloud account.`})});
  if(!response.ok) throw new Error(`Telegram HTTP ${response.status}`);
  return {ok:true};
}

async function sendPush(d) {
  const db=getDb();
  const snap=await db.collection('oveshCloudPushDevices').where('active','==',true).limit(10).get();
  const devices=snap.docs.map(doc=>({id:doc.id,...doc.data()})).filter(x=>x.token);
  if(!devices.length) return {ok:false,skipped:true,sent:0};
  const response=await getMessagingClient().sendEachForMulticast({
    tokens:devices.map(x=>x.token),
    notification:{title:'🔐 OVESH CLOUD™ — Login detected',body:`${d.device || 'Device'} · ${d.ip || 'IP unavailable'} · ${d.location || 'Location unavailable'}`},
    data:{type:'oveshcloud_login',ip:String(d.ip||''),isp:String(d.isp||''),location:String(d.location||''),device:String(d.device||''),os:String(d.os||''),browser:String(d.browser||''),time:String(d.time||'')},
    webpush:{fcmOptions:{link:'https://malpuraovesh.vercel.app/ovesh'}}
  });
  const stale=[];
  response.responses.forEach((r,i)=>{const msg=String(r.error?.code||r.error?.message||'');if(!r.success && /registration-token-not-registered|invalid-registration-token/i.test(msg))stale.push(devices[i].id);});
  await Promise.all(stale.map(id=>db.collection('oveshCloudPushDevices').doc(id).update({active:false,updatedAt:new Date()})));
  return {ok:true,sent:response.successCount};
}

async function sendLoginAlerts(details) {
  const results=await Promise.allSettled([sendEmail(details),sendTelegram(details),sendPush(details)]);
  return results.map((r,i)=>({channel:['email','telegram','push'][i],ok:r.status==='fulfilled'&&r.value?.ok===true,skipped:r.status==='fulfilled'&&r.value?.skipped===true,error:r.status==='rejected'?String(r.reason?.message||r.reason):null}));
}
module.exports={getDb,getAdminApp,sendLoginAlerts};
