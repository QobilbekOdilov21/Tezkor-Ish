// lib/db.js
const { neon } = require('@neondatabase/serverless');

let _sql = null;
function db() {
  if (!_sql) _sql = neon(process.env.DATABASE_URL);
  return _sql;
}

function genId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
}

// ─── USERS ───
function toUser(r) {
  if (!r) return null;
  return {
    id:          r.id,
    telegramId:  r.telegram_id,
    tgUsername:  r.tg_username || null,
    name:        r.name,
    type:        r.type,         // worker | employer
    category:    r.category || '',
    workTypes:   r.work_types || [],  // ['Kunlik','Soatlik',...]
    phone:       r.phone || '',
    rating:      parseFloat(r.rating) || 0,
    jobsDone:    r.jobs_done || 0,
    createdAt:   r.created_at,
  };
}

async function getUserByTgId(tgId) {
  const rows = await db()`SELECT * FROM users WHERE telegram_id=${String(tgId)} LIMIT 1`;
  return rows[0] ? toUser(rows[0]) : null;
}

async function getUserById(id) {
  const rows = await db()`SELECT * FROM users WHERE id=${id} LIMIT 1`;
  return rows[0] ? toUser(rows[0]) : null;
}

async function createUser({ tgId, tgUsername, name, type, category, workTypes, phone }) {
  const id = genId('u');
  await db()`
    INSERT INTO users (id, telegram_id, tg_username, name, type, category, work_types, phone)
    VALUES (${id}, ${String(tgId)}, ${tgUsername||null}, ${name}, ${type},
            ${category||''}, ${JSON.stringify(workTypes||[])}::jsonb, ${phone||''})
  `;
  return getUserById(id);
}

async function updateUser(id, data) {
  const sql = db();
  if (data.name      !== undefined) await sql`UPDATE users SET name=${data.name}                            WHERE id=${id}`;
  if (data.category  !== undefined) await sql`UPDATE users SET category=${data.category}                    WHERE id=${id}`;
  if (data.workTypes !== undefined) await sql`UPDATE users SET work_types=${JSON.stringify(data.workTypes)}::jsonb WHERE id=${id}`;
  if (data.phone     !== undefined) await sql`UPDATE users SET phone=${data.phone}                          WHERE id=${id}`;
  if (data.rating    !== undefined) await sql`UPDATE users SET rating=${data.rating}                        WHERE id=${id}`;
  if (data.jobsDone  !== undefined) await sql`UPDATE users SET jobs_done=${data.jobsDone}                   WHERE id=${id}`;
  if (data.tgUsername!== undefined) await sql`UPDATE users SET tg_username=${data.tgUsername}               WHERE id=${id}`;
  return getUserById(id);
}

// ─── JOBS ───
function toJob(r) {
  if (!r) return null;
  return {
    id:           r.id,
    employerId:   r.employer_id,
    employerName: r.employer_name || '',
    tgUsername:   r.tg_username || null,
    title:        r.title,
    category:     r.category || '',
    workType:     r.work_type || '',
    salary:       r.salary || 0,
    salaryUnit:   r.salary_unit || 'kun',  // kun | soat | ish
    location:     r.location || '',
    description:  r.description || '',
    urgent:       r.urgent || false,
    status:       r.status,
    createdAt:    r.created_at,
  };
}

async function getJobs({ category, workType, q } = {}) {
  const rows = await db()`
    SELECT * FROM jobs WHERE status='active'
    ORDER BY urgent DESC, created_at DESC
    LIMIT 100
  `;
  let list = rows.map(toJob);
  if (category && category !== 'Hammasi') list = list.filter(j => j.category === category);
  if (workType && workType !== 'Hammasi') list = list.filter(j => j.workType === workType);
  if (q) {
    const ql = q.toLowerCase();
    list = list.filter(j =>
      j.title.toLowerCase().includes(ql) ||
      j.category.toLowerCase().includes(ql) ||
      j.location.toLowerCase().includes(ql)
    );
  }
  return list;
}

async function getJobById(id) {
  const rows = await db()`SELECT * FROM jobs WHERE id=${id} LIMIT 1`;
  return rows[0] ? toJob(rows[0]) : null;
}

async function createJob(data) {
  const id = genId('j');
  await db()`
    INSERT INTO jobs (id, employer_id, employer_name, tg_username, title, category,
                      work_type, salary, salary_unit, location, description, urgent)
    VALUES (${id}, ${data.employerId}, ${data.employerName||''}, ${data.tgUsername||null},
            ${data.title}, ${data.category||''}, ${data.workType||''},
            ${data.salary||0}, ${data.salaryUnit||'kun'},
            ${data.location||''}, ${data.description||''}, ${!!data.urgent})
  `;
  return getJobById(id);
}

async function closeJob(id, employerId) {
  await db()`UPDATE jobs SET status='closed' WHERE id=${id} AND employer_id=${employerId}`;
}

async function getMyJobs(employerId) {
  const rows = await db()`SELECT * FROM jobs WHERE employer_id=${employerId} ORDER BY created_at DESC`;
  return rows.map(toJob);
}

// ─── NOTIFICATIONS ───
function toNotif(r) {
  return {
    id:        r.id,
    type:      r.type,
    title:     r.title,
    body:      r.body,
    unread:    r.unread,
    createdAt: r.created_at,
  };
}

async function getNotifs(userId) {
  const rows = await db()`
    SELECT * FROM notifications WHERE user_id=${userId}
    ORDER BY created_at DESC LIMIT 30
  `;
  return rows.map(toNotif);
}

async function createNotif(userId, type, title, body) {
  const id = genId('n');
  await db()`
    INSERT INTO notifications (id, user_id, type, title, body)
    VALUES (${id}, ${userId}, ${type}, ${title}, ${body})
  `;
}

async function markRead(userId) {
  await db()`UPDATE notifications SET unread=false WHERE user_id=${userId}`;
}

// ─── STATS ───
async function getStats() {
  const sql = db();
  const [w, e, j] = await Promise.all([
    sql`SELECT COUNT(*) c FROM users WHERE type='worker'`,
    sql`SELECT COUNT(*) c FROM users WHERE type='employer'`,
    sql`SELECT COUNT(*) c FROM jobs  WHERE status='active'`,
  ]);
  return {
    workers:  parseInt(w[0].c),
    employers: parseInt(e[0].c),
    activeJobs: parseInt(j[0].c),
  };
}

module.exports = {
  getUserByTgId, getUserById, createUser, updateUser,
  getJobs, getJobById, createJob, closeJob, getMyJobs,
  getNotifs, createNotif, markRead,
  getStats,
};
