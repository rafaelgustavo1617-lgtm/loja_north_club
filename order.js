const { publicOrder } = require('../lib/checkout');
module.exports = async (req, res) => {
  const o = await publicOrder(String(req.query.id || ''));
  if (!o) return res.status(404).end();
  res.setHeader('Cache-Control', 'no-store');
  res.json(o);
};
