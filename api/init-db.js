// api/init-db.js
const { neon } = require('@neondatabase/serverless');

module.exports = async function handler(req, res) {
  if (req.query.key !== process.env.INIT_SECRET)
    return res.status(403).json({ error: "Ruxsat yo'q" });

  const db = neon(process.env.DATABASE_URL);
  const stmts = [
    `CREATE TABLE IF NOT EXISTS users (
      id           TEXT PRIMARY KEY,
      telegram_id  TEXT UNIQUE NOT NULL,
      tg_username  TEXT,
      name         TEXT NOT NULL,
      type         TEXT NOT NULL CHECK(type IN ('worker','employer')),
      category     TEXT DEFAULT '',
      work_types   JSONB DEFAULT '[]',
      phone        TEXT DEFAULT '',
      rating       NUMERIC(3,1) DEFAULT 0,
      jobs_done    INTEGER DEFAULT 0,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS jobs (
      id            TEXT PRIMARY KEY,
      employer_id   TEXT NOT NULL REFERENCES users(id),
      employer_name TEXT DEFAULT '',
      tg_username   TEXT,
      title         TEXT NOT NULL,
      category      TEXT DEFAULT '',
      work_type     TEXT DEFAULT '',
      salary        INTEGER DEFAULT 0,
      salary_unit   TEXT DEFAULT 'kun',
      location      TEXT DEFAULT '',
      description   TEXT DEFAULT '',
      urgent        BOOLEAN DEFAULT false,
      status        TEXT DEFAULT 'active' CHECK(status IN ('active','closed')),
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS notifications (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id),
      type       TEXT DEFAULT '',
      title      TEXT DEFAULT '',
      body       TEXT DEFAULT '',
      unread     BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_jobs_status     ON jobs(status)`,
    `CREATE INDEX IF NOT EXISTS idx_jobs_employer   ON jobs(employer_id)`,
    `CREATE INDEX IF NOT EXISTS idx_notif_user      ON notifications(user_id)`,
  ];

  const results = [];
  for (const s of stmts) {
    try {
      await db(s);
      results.push({ ok: true, stmt: s.trim().slice(0,40) });
    } catch(e) {
      if (e.message?.includes('already exists')) {
        results.push({ skipped: true, stmt: s.trim().slice(0,40) });
      } else {
        return res.status(500).json({ error: e.message, results });
      }
    }
  }
  return res.json({ ok: true, results });
};
