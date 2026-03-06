// api/jobs/[id].js
const { setCors, getAuthUser } = require('../../lib/auth');
const { getJobById, closeJob } = require('../../lib/db');

module.exports = async function handler(req, res) {
  setCors(res, req);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query;

  if (req.method === 'GET') {
    try {
      const job = await getJobById(id);
      if (!job) return res.status(404).json({ error: 'Topilmadi' });
      return res.json(job);
    } catch(e) { return res.status(500).json({ error: 'Server xatosi' }); }
  }

  if (req.method === 'DELETE') {
    const auth = getAuthUser(req);
    if (!auth) return res.status(401).json({ error: 'Token kerak' });
    try {
      const job = await getJobById(id);
      if (!job) return res.status(404).json({ error: 'Topilmadi' });
      if (job.employerId !== auth.id) return res.status(403).json({ error: "Ruxsat yo'q" });
      await closeJob(id, auth.id);
      return res.json({ ok: true });
    } catch(e) { return res.status(500).json({ error: 'Server xatosi' }); }
  }

  return res.status(405).end();
};
