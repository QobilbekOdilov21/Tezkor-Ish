// api/notifications.js
const { setCors, getAuthUser } = require('../lib/auth');
const { getNotifs, markRead } = require('../lib/db');

module.exports = async function handler(req, res) {
  setCors(res, req);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = getAuthUser(req);
  if (!auth) return res.status(401).json({ error: 'Token kerak' });

  if (req.method === 'GET') {
    try {
      return res.json(await getNotifs(auth.id));
    } catch(e) { return res.status(500).json({ error: 'Server xatosi' }); }
  }

  // O'qilgan deb belgilash
  if (req.method === 'POST') {
    try {
      await markRead(auth.id);
      return res.json({ ok: true });
    } catch(e) { return res.status(500).json({ error: 'Server xatosi' }); }
  }

  return res.status(405).end();
};
