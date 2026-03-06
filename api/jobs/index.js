// api/jobs/index.js
const { setCors, getAuthUser } = require('../../lib/auth');
const { getJobs, createJob, getMyJobs } = require('../../lib/db');

module.exports = async function handler(req, res) {
  setCors(res, req);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET — barcha aktiv e'lonlar
  if (req.method === 'GET') {
    try {
      const { category, workType, q, my } = req.query;
      if (my) {
        const auth = getAuthUser(req);
        if (!auth) return res.status(401).json({ error: 'Token kerak' });
        return res.json(await getMyJobs(auth.id));
      }
      return res.json(await getJobs({ category, workType, q: q?.slice(0,50) }));
    } catch(e) {
      return res.status(500).json({ error: 'Server xatosi' });
    }
  }

  // POST — yangi e'lon (faqat employer)
  if (req.method === 'POST') {
    const auth = getAuthUser(req);
    if (!auth) return res.status(401).json({ error: 'Token kerak' });
    if (auth.type !== 'employer') return res.status(403).json({ error: 'Faqat ish beruvchilar' });

    const { title, category, workType, salary, salaryUnit, location, description, urgent } = req.body || {};
    if (!title?.trim()) return res.status(400).json({ error: 'Sarlavha kerak' });
    if (!location?.trim()) return res.status(400).json({ error: 'Joylashuv kerak' });

    try {
      // Employer Telegram username'ini olish
      const { getUserById } = require('../../lib/db');
      const employer = await getUserById(auth.id);

      const job = await createJob({
        employerId:   auth.id,
        employerName: employer?.name || '',
        tgUsername:   employer?.tgUsername || null,
        title:        title.trim().slice(0,150),
        category:     category || '',
        workType:     workType || '',
        salary:       parseInt(salary) || 0,
        salaryUnit:   salaryUnit || 'kun',
        location:     location.trim().slice(0,150),
        description:  (description||'').slice(0,1000),
        urgent:       Boolean(urgent),
      });
      return res.json({ ok: true, job });
    } catch(e) {
      console.error(e);
      return res.status(500).json({ error: 'Server xatosi' });
    }
  }

  return res.status(405).end();
};
