module.exports = (req,res) => {
  if (req.method !== 'GET') return res.status(405).json({ok:false,error:'Method not allowed'});
  const key = process.env.OVESH_CLOUD_VAPID_PUBLIC_KEY;
  if (!key) return res.status(503).json({ok:false,error:'Push notifications are not configured yet'});
  res.setHeader('Cache-Control','no-store');
  return res.status(200).json({ok:true,vapidKey:key});
};
