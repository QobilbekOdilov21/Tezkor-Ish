// api/auth/index.js
const { setCors, signToken, getAuthUser, verifyTelegramData } = require('../../lib/auth');
const { getUserByTgId, getUserById, createUser, updateUser } = require('../../lib/db');

module.exports = async function handler(req, res) {
  setCors(res, req);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action } = req.query;

  // ─── LOGIN via Telegram initData ───
  if (action === 'login') {
    if (req.method !== 'POST') return res.status(405).end();
    const { initData, tgUser: fallback } = req.body || {};

    let tgUser = initData ? verifyTelegramData(initData) : null;
    // Dev mode: BOT_TOKEN yo'q bo'lsa fallback
    if (!tgUser && !process.env.BOT_TOKEN) tgUser = fallback;
    if (!tgUser?.id) return res.status(401).json({ error: 'Telegram auth failed' });

    try {
      let user = await getUserByTgId(tgUser.id);
      if (user) {
        // Ismni va username'ni yangilash
        const name = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ');
        const upd = {};
        if (name && user.name !== name) upd.name = name;
        if (tgUser.username && user.tgUsername !== tgUser.username) upd.tgUsername = tgUser.username;
        if (Object.keys(upd).length) user = await updateUser(user.id, upd);
        const token = signToken({ id: user.id, type: user.type });
        return res.json({ action: 'login', user, token });
      }
      // Yangi foydalanuvchi — ro'yxatdan o'tish kerak
      return res.json({
        action:    'register',
        tgId:      String(tgUser.id),
        tgUsername: tgUser.username || '',
        name:      [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' '),
      });
    } catch(e) {
      console.error(e);
      return res.status(500).json({ error: 'Server xatosi' });
    }
  }

  // ─── REGISTER ───
  if (action === 'register') {
    if (req.method !== 'POST') return res.status(405).end();
    const { tgId, tgUsername, name, type, category, workTypes, phone } = req.body || {};
    if (!tgId || !name?.trim()) return res.status(400).json({ error: 'Ism kiritilmadi' });
    if (!['worker','employer'].includes(type)) return res.status(400).json({ error: 'Tur kerak' });

    try {
      const exists = await getUserByTgId(tgId);
      if (exists) {
        const token = signToken({ id: exists.id, type: exists.type });
        return res.json({ action: 'login', user: exists, token });
      }
      const user = await createUser({
        tgId, tgUsername, name: name.trim().slice(0,80),
        type, category: category||'', workTypes: workTypes||[], phone: phone||'',
      });
      const token = signToken({ id: user.id, type: user.type });
      return res.json({ action: 'register', user, token });
    } catch(e) {
      console.error(e);
      return res.status(500).json({ error: 'Server xatosi' });
    }
  }

  // ─── ME ───
  if (action === 'me') {
    const auth = getAuthUser(req);
    if (!auth) return res.status(401).json({ error: 'Token kerak' });
    try {
      const user = await getUserById(auth.id);
      if (!user) return res.status(404).json({ error: 'Topilmadi' });
      return res.json(user);
    } catch(e) {
      return res.status(500).json({ error: 'Server xatosi' });
    }
  }

  return res.status(400).json({ error: 'action: login | register | me' });
};
