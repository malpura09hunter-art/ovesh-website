'use strict';

const crypto = require('crypto');
const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');
const { getDb } = require('../lib/oveshcloud-alerts.js');

const CURRENCIES = new Set(['INR','USD','EUR','GBP','AED','AUD','CAD','CHF','CNY','JPY','SGD','NZD','ZAR','SAR','HKD','SEK','NOK','DKK','THB','MYR','IDR','KRW','BRL','MXN','TRY','PLN','CZK','HUF','ILS','ISK','PHP','RON','BGN']);

function ownerSession(req) {
  const raw = String(req.headers.cookie || '');
  const item = raw.split(';').map(x => x.trim()).find(x => x.startsWith('ovesh_cloud_session='));
  if (!item) return false;
  let token;
  try { token = decodeURIComponent(item.slice('ovesh_cloud_session='.length)); } catch { return false; }
  const parts = token.split('.');
  const secret = process.env.OVESH_CLOUD_SESSION_SECRET || process.env.OVESH_CLOUD_PASSWORD;
  if (!secret || parts.length !== 2) return false;
  const expected = crypto.createHmac('sha256', secret).update(parts[0]).digest('base64url');
  const a = Buffer.from(parts[1]), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    const data = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    return data.u === (process.env.OVESH_CLOUD_USERNAME || 'OVESH') && Number(data.exp) > Date.now();
  } catch { return false; }
}
function clean(value, max = 240) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}
function emailValid(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '')) && String(value).length <= 254;
}
function quoteData(body) {
  const clientName = clean(body.clientName, 120);
  const clientCompany = clean(body.clientCompany, 160);
  const clientEmail = clean(body.clientEmail, 254).toLowerCase();
  const projectTitle = clean(body.projectTitle, 180);
  const currency = clean(body.currency || 'INR', 3).toUpperCase();
  const taxRate = Number(body.taxRate || 0);
  const validUntil = clean(body.validUntil, 40);
  const clientCountry = clean(body.clientCountry, 100);
  const timeline = clean(body.timeline, 180);
  const scope = String(body.scope || '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ').trim().slice(0, 3000);
  const revisions = clean(body.revisions, 500);
  const exclusions = String(body.exclusions || '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ').trim().slice(0, 1200);
  const terms = clean(body.terms || '50% advance and 50% on project completion.', 1000);
  if (!clientName || !projectTitle) throw Object.assign(new Error('Client name and project title are required.'), { statusCode: 400 });
  if (!CURRENCIES.has(currency)) throw Object.assign(new Error('Unsupported quotation currency.'), { statusCode: 400 });
  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 40) throw Object.assign(new Error('Tax rate must be between 0 and 40 percent.'), { statusCode: 400 });
  if (!Array.isArray(body.items) || !body.items.length || body.items.length > 20) throw Object.assign(new Error('Add between 1 and 20 quotation items.'), { statusCode: 400 });
  const items = body.items.map((item, index) => {
    const description = clean(item.description, 180);
    const quantity = Number(item.quantity);
    const rate = Number(item.rate);
    if (!description || !Number.isFinite(quantity) || quantity <= 0 || quantity > 10000 || !Number.isFinite(rate) || rate < 0 || rate > 100000000) {
      throw Object.assign(new Error('Quotation item ' + (index + 1) + ' has invalid details.'), { statusCode: 400 });
    }
    return { description, quantity, rate, amount: quantity * rate };
  });
  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
  const tax = subtotal * taxRate / 100;
  return {
    quoteId: 'OMCL-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
    createdAt: new Date(), clientName, clientCompany, clientEmail, clientCountry, projectTitle, currency, taxRate,
    validUntil: validUntil || '7 days from issue', timeline, scope, revisions, exclusions, terms, items, subtotal, tax, total: subtotal + tax
  };
}
function money(value, currency) {
  try { return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value); }
  catch { return currency + ' ' + Number(value).toFixed(2); }
}
function buildPdf(q) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 48, info: { Title: 'Quotation ' + q.quoteId, Author: 'Ovesh Malpura Cyber Labs' } });
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      const left = 48, right = 547, width = right - left;
      doc.rect(0, 0, 595, 155).fill('#08130f');
      doc.fillColor('#6ee7a2').font('Helvetica-Bold').fontSize(10).text('OVESH MALPURA CYBER LABS', left, 43, { characterSpacing: 1.2 });
      doc.fillColor('#ffffff').fontSize(25).text('QUOTATION', left, 68);
      doc.fillColor('#a8c7b6').font('Helvetica').fontSize(9).text('Professional services proposal', left, 105);
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(10).text(q.quoteId, 390, 72, { width: 157, align: 'right' });
      doc.fillColor('#a8c7b6').font('Helvetica').fontSize(9).text('ISSUED ' + q.createdAt.toLocaleDateString('en-IN'), 390, 91, { width: 157, align: 'right' });
      doc.fillColor('#18251e').font('Helvetica-Bold').fontSize(9).text('PREPARED FOR', left, 184);
      doc.fillColor('#17251d').font('Helvetica-Bold').fontSize(13).text(q.clientName, left, 203);
      if (q.clientCompany) doc.font('Helvetica').fontSize(10).fillColor('#526158').text(q.clientCompany, left, 222);
      if (q.clientEmail) doc.font('Helvetica').fontSize(9).fillColor('#526158').text(q.clientEmail, left, q.clientCompany ? 239 : 222);
      if (q.clientCountry) doc.font('Helvetica').fontSize(9).fillColor('#526158').text(q.clientCountry, left, q.clientEmail ? (q.clientCompany ? 255 : 238) : (q.clientCompany ? 239 : 222));
      doc.fillColor('#18251e').font('Helvetica-Bold').fontSize(9).text('PROJECT', 350, 184);
      doc.fillColor('#17251d').font('Helvetica').fontSize(11).text(q.projectTitle, 350, 203, { width: 197 });
      doc.fillColor('#526158').fontSize(9).text('Valid until: ' + q.validUntil, 350, 239, { width: 197 });
      let y = 285;
      doc.roundedRect(left, y, width, 27, 5).fill('#eaf4ed');
      doc.fillColor('#1c3928').font('Helvetica-Bold').fontSize(8).text('DESCRIPTION', left + 10, y + 9);
      doc.text('QTY', 350, y + 9, { width: 45, align: 'right' });
      doc.text('RATE', 405, y + 9, { width: 65, align: 'right' });
      doc.text('AMOUNT', 475, y + 9, { width: 62, align: 'right' });
      y += 38;
      for (const item of q.items) {
        if (y > 650) { doc.addPage(); y = 60; }
        doc.fillColor('#17251d').font('Helvetica').fontSize(9).text(item.description, left + 10, y, { width: 275 });
        doc.text(String(item.quantity), 350, y, { width: 45, align: 'right' });
        doc.text(money(item.rate, q.currency), 405, y, { width: 65, align: 'right' });
        doc.text(money(item.amount, q.currency), 475, y, { width: 62, align: 'right' });
        y += Math.max(28, doc.heightOfString(item.description, { width: 275 }) + 12);
        doc.moveTo(left, y - 5).lineTo(right, y - 5).strokeColor('#e6ece7').stroke();
      }
      y += 14;
      doc.fillColor('#526158').font('Helvetica').fontSize(9).text('Subtotal', 360, y, { width: 100, align: 'right' });
      doc.fillColor('#17251d').text(money(q.subtotal, q.currency), 475, y, { width: 62, align: 'right' });
      y += 19;
      doc.fillColor('#526158').text('Tax (' + q.taxRate + '%)', 360, y, { width: 100, align: 'right' });
      doc.fillColor('#17251d').text(money(q.tax, q.currency), 475, y, { width: 62, align: 'right' });
      y += 25;
      doc.roundedRect(350, y - 5, 197, 36, 6).fill('#10271a');
      doc.fillColor('#9ee8b6').font('Helvetica-Bold').fontSize(9).text('TOTAL', 362, y + 7);
      doc.fillColor('#ffffff').fontSize(12).text(money(q.total, q.currency), 420, y + 6, { width: 115, align: 'right' });
      y += 58;
      const section=(heading,content)=>{if(!content)return;if(y>690){doc.addPage();y=58;}doc.fillColor('#18251e').font('Helvetica-Bold').fontSize(9).text(heading.toUpperCase(),left,y);y+=16;doc.fillColor('#526158').font('Helvetica').fontSize(9).text(content,left,y,{width,lineGap:3});y+=doc.heightOfString(content,{width,lineGap:3})+15;};
      section('Scope of work & deliverables',q.scope);
      section('Estimated delivery timeline',q.timeline);
      section('Payment milestones',q.terms);
      section('Revision policy',q.revisions);
      section('Exclusions & third-party costs',q.exclusions);
      section('Terms & conditions','This quotation is valid until '+q.validUntil+'. Work begins after written approval and receipt of the agreed advance payment. Any work, features or revisions outside the approved scope require a written change request and may affect fees and delivery dates. Third-party services, licences, hosting, domains, taxes and payment-provider charges are excluded unless expressly listed. The client is responsible for providing accurate content, access and approvals in a timely manner. Delivery and acceptance are assessed against the agreed scope and deliverables.');
      doc.moveTo(left, 760).lineTo(right, 760).strokeColor('#dce7df').stroke();
      doc.fillColor('#526158').fontSize(8).text('Ovesh Malpura Cyber Labs  ·  Professional digital services', left, 772, { width, align: 'center' });
      doc.end();
    } catch (error) { reject(error); }
  });
}
async function exchangeRate(from, to) {
  const url = 'https://api.frankfurter.app/latest?from=' + encodeURIComponent(from) + '&to=' + encodeURIComponent(to);
  const response = await fetch(url, { signal: AbortSignal.timeout(7000), headers: { Accept: 'application/json' } });
  if (!response.ok) throw Object.assign(new Error('Live exchange-rate service is temporarily unavailable.'), { statusCode: 502 });
  const data = await response.json();
  const rate = Number(data?.rates?.[to]);
  if (!Number.isFinite(rate) || rate <= 0) throw Object.assign(new Error('The requested currency pair is not available.'), { statusCode: 422 });
  return { rate, date: data.date || null, source: 'Frankfurter reference exchange rates' };
}
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Vary', 'Cookie');
  const action = String(req.query?.action || req.body?.action || '');
  try {
    // Public client review is token-only; it never grants access to the owner workspace.
    if (req.method === 'GET' && action === 'client-view') {
      const token = String(req.query?.token || '');
      if (!/^[a-f0-9]{64}$/.test(token)) return res.status(404).json({ok:false,error:'This quotation link is invalid or unavailable.'});
      const snap = await getDb().collection('oveshCloudQuotations').where('tokenHash','==',crypto.createHash('sha256').update(token).digest('hex')).limit(1).get();
      if (snap.empty) return res.status(404).json({ok:false,error:'This quotation link is invalid or unavailable.'});
      const doc = snap.docs[0], q = doc.data() || {};
      if (q.expiresAt && q.expiresAt.toDate && q.expiresAt.toDate().getTime() < Date.now()) {
        await doc.ref.set({status:'Expired',updatedAt:new Date()},{merge:true});
        return res.status(410).json({ok:false,error:'This quotation has expired. Please contact Ovesh Malpura Cyber Labs.'});
      }
      if (!['Accepted','Rejected','Expired'].includes(q.status)) {
        await doc.ref.set({status:'Viewed',viewedAt:q.viewedAt||new Date(),updatedAt:new Date(),viewCount:(Number(q.viewCount)||0)+1},{merge:true});
      }
      const safe = {...q}; delete safe.tokenHash; delete safe.clientEmail;
      return res.status(200).json({ok:true,quotation:safe});
    }
    if (req.method === 'POST' && action === 'client-respond') {
      const token = String(req.body?.token || ''), decision = String(req.body?.decision || '');
      const clientName = clean(req.body?.clientName,120), note = clean(req.body?.note,1000);
      if (!/^[a-f0-9]{64}$/.test(token) || !['Accepted','Rejected'].includes(decision) || !clientName) return res.status(400).json({ok:false,error:'Please provide a valid response and your name.'});
      const hash = crypto.createHash('sha256').update(token).digest('hex');
      const snap = await getDb().collection('oveshCloudQuotations').where('tokenHash','==',hash).limit(1).get();
      if (snap.empty) return res.status(404).json({ok:false,error:'This quotation link is invalid or unavailable.'});
      const doc=snap.docs[0], q=doc.data()||{};
      if (q.expiresAt && q.expiresAt.toDate && q.expiresAt.toDate().getTime()<Date.now()) {
        await doc.ref.set({status:'Expired',updatedAt:new Date()},{merge:true});
        return res.status(410).json({ok:false,error:'This quotation has expired.'});
      }
      if (['Accepted','Rejected','Expired'].includes(q.status)) return res.status(409).json({ok:false,error:'A final response has already been recorded for this quotation.'});
      await doc.ref.set({status:decision,clientResponse:{decision,clientName,note,respondedAt:new Date()},updatedAt:new Date()},{merge:true});
      return res.status(200).json({ok:true,status:decision,message:decision==='Accepted'?'Thank you. Your acceptance has been recorded.':'Your response has been recorded. Ovesh Malpura Cyber Labs will follow up.'});
    }
    if (!ownerSession(req)) return res.status(401).json({ ok: false, error: 'OV CLOUD owner session required.' });
    if (req.method === 'GET' && action === 'list') {
      const snap=await getDb().collection('oveshCloudQuotations').orderBy('createdAt','desc').limit(100).get();
      return res.status(200).json({ok:true,quotations:snap.docs.map(d=>{const x=d.data()||{};return{id:d.id,quoteId:x.quoteId,clientName:x.clientName,clientCompany:x.clientCompany,projectTitle:x.projectTitle,total:x.total,currency:x.currency,status:x.status||'Draft',createdAt:x.createdAt?.toDate?.()?.toISOString?.()||null,validUntil:x.validUntil,viewCount:x.viewCount||0}})});
    }
    if (req.method === 'POST' && action === 'draft') {
      const q=quoteData(req.body||{}), db=getDb(), now=new Date();
      await db.collection('oveshCloudQuotations').doc(q.quoteId).set({...q,createdAt:now,updatedAt:now,status:'Draft',viewCount:0});
      return res.status(200).json({ok:true,quoteId:q.quoteId,status:'Draft'});
    }
    if (req.method === 'GET' && action === 'convert') {
      const from = String(req.query.from || 'USD').toUpperCase();
      const to = String(req.query.to || 'INR').toUpperCase();
      const amount = Number(req.query.amount);
      if (!CURRENCIES.has(from) || !CURRENCIES.has(to) || !Number.isFinite(amount) || amount < 0 || amount > 1e12) return res.status(400).json({ ok: false, error: 'Enter a valid amount and supported currencies.' });
      if (from === to) return res.status(200).json({ ok: true, from, to, amount, rate: 1, converted: amount, date: new Date().toISOString().slice(0, 10), source: 'Same-currency conversion' });
      const quote = await exchangeRate(from, to);
      return res.status(200).json({ ok: true, from, to, amount, ...quote, converted: amount * quote.rate });
    }
    if (req.method === 'POST' && (action === 'pdf' || action === 'send')) {
      const q = quoteData(req.body || {});
      if (action === 'send') {
        if (req.body?.confirmSend !== true) return res.status(400).json({ ok: false, error: 'Explicit send approval is required.' });
        if (!emailValid(q.clientEmail)) return res.status(400).json({ ok: false, error: 'Enter a valid client email address before sending.' });
        const user = String(process.env.ZOHO_USER || '').trim(), pass = String(process.env.ZOHO_APP_PASSWORD || '').trim();
        if (!user || !pass) return res.status(503).json({ ok: false, error: 'Quotation email is not configured. Zoho SMTP credentials are missing.' });
        const db=getDb(), ref=db.collection('oveshCloudQuotations').doc(q.quoteId);
        const token=crypto.randomBytes(32).toString('hex'), tokenHash=crypto.createHash('sha256').update(token).digest('hex');
        const baseUrl='https://'+String(req.headers.host||'oveshmalpura.tech').replace(/[^a-z0-9.:-]/gi,'');
        const reviewUrl=baseUrl+'/oveshcloud/quotation.html?token='+token;
        const expiresAt=new Date(Date.now()+30*24*60*60*1000);
        const pdf=await buildPdf(q);
        await ref.set({...q,createdAt:q.createdAt,updatedAt:new Date(),status:'Sent',sentAt:new Date(),viewCount:0,tokenHash,reviewUrl,expiresAt,reviewLinkExpiresAt:expiresAt},{merge:true});
        const transporter = nodemailer.createTransport({ host: process.env.ZOHO_SMTP_HOST || 'smtp.zoho.in', port: 465, secure: true, auth: { user, pass }, connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000 });
        const subject='Project Quotation '+q.quoteId+' — '+q.projectTitle;
        const esc=value=>String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
        const text='Dear '+q.clientName+',\\n\\nThank you for considering Ovesh Malpura Cyber Labs. Review your quotation securely using this private link: '+reviewUrl+'\\n\\nReference: '+q.quoteId+'\\nTotal: '+money(q.total,q.currency)+'\\nValid until: '+q.validUntil+'\\n\\nThis link expires in 30 days.\\n\\nRegards,\\nOvesh Malpura\\nOvesh Malpura Cyber Labs';
        const html='<div style="font-family:Arial,sans-serif;color:#17251d;line-height:1.65;max-width:640px"><p>Dear '+esc(q.clientName)+',</p><p>Thank you for considering <strong>Ovesh Malpura Cyber Labs</strong>. Your project quotation is ready for secure review.</p><div style="background:#f1f7f2;border:1px solid #dce9df;border-radius:12px;padding:18px"><div>Reference: <strong>'+esc(q.quoteId)+'</strong></div><div>Project: <strong>'+esc(q.projectTitle)+'</strong></div><div>Total: <strong>'+esc(money(q.total,q.currency))+'</strong></div><div>Valid until: '+esc(q.validUntil)+'</div></div><p><a href="'+esc(reviewUrl)+'" style="display:inline-block;background:#10271a;color:#fff;text-decoration:none;padding:13px 20px;border-radius:8px;font-weight:bold">Review quotation securely</a></p><p>You can review the details and accept or decline online. This private link expires in 30 days.</p><p>Regards,<br><strong>Ovesh Malpura</strong><br>Ovesh Malpura Cyber Labs</p></div>';
        try {
          const sent=await transporter.sendMail({from:'"Ovesh Malpura Cyber Labs" <'+user+'>',to:q.clientEmail,subject,text,html,attachments:[{filename:'Quotation-'+q.quoteId+'.pdf',content:pdf,contentType:'application/pdf'}]});
          await ref.set({emailMessageId:sent.messageId||null,updatedAt:new Date()},{merge:true});
          return res.status(200).json({ok:true,sent:true,quoteId:q.quoteId,to:q.clientEmail,messageId:sent.messageId,reviewUrl,total:q.total,currency:q.currency,status:'Sent'});
        } catch(mailError) {
          await ref.set({status:'Draft',sendError:clean(mailError.message,300),updatedAt:new Date()},{merge:true});
          throw mailError;
        }
      }
      const pdf = await buildPdf(q);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="Quotation-' + q.quoteId + '.pdf"');
      res.setHeader('Content-Length', String(pdf.length));
      return res.status(200).send(pdf);
    }
    return res.status(404).json({ ok: false, error: 'Unknown business tool action.' });
  } catch (error) {
    console.error('OV CLOUD business tools:', error?.message || error);
    return res.status(Number(error.statusCode) || 500).json({ ok: false, error: error.message || 'Business tool request failed.' });
  }
};