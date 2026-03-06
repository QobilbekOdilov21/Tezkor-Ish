// api/users/[id].js
const { setCors, getAuthUser } = require('../../lib/auth');
const { getUserById, updateUser } = require('../../lib/db');

module.exports = async function handler(req, res) {
  setCors(res, req);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query;
  const auth = getAuthUser(req);
  if (!auth) return res.status(401).json({ error: 'Token kerak' });

  if (req.method === 'GET') {
    try {
      const user = await getUserById(id);
      if (!user) return res.status(404).json({ error: 'Topilmadi' });
      // Boshqaning profiliga telefon ko'rsatilmaydi
      if (auth.id !== id) {
        const { phone, ...pub } = user;
        return res.json(pub);
      }
      return res.json(user);
    } catch(e) { return res.status(500).json({ error: 'Server xatosi' }); }
  }

  if (req.method === 'PUT') {
    if (auth.id !== id) return res.status(403).json({ error: "Ruxsat yo'q" });
    try {
      const allowed = ['name','category','workTypes','phone'];
      const updates = {};
      allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
      const user = await updateUser(id, updates);
      return res.json({ ok: true, user });
    } catch(e) { return res.status(500).json({ error: 'Server xatosi' }); }
  }

  return res.status(405).end();
};
