// lib/auth.js
const crypto = require('crypto');

function getSecret() {
  const s = process.env.JWT_SECRET;
  if (!s && process.env.VERCEL_ENV === 'production')
    throw new Error('JWT_SECRET majburiy!');
  return s || 'kunlikish_dev_secret_32chars_long!!';
}

const JWT_TTL = 30 * 24 * 3600; // 30 kun

function b64url(str) {
  return Buffer.from(str).toString('base64')
    .replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
}

function signToken(payload) {
  const secret = getSecret();
  const h = b64url(JSON.stringify({ alg:'HS256', typ:'JWT' }));
  const now = Math.floor(Date.now()/1000);
  const b = b64url(JSON.stringify({ ...payload, iat: now, exp: now + JWT_TTL }));
  const s = crypto.createHmac('sha256', secret).update(`${h}.${b}`).digest('base64')
    .replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
  return `${h}.${b}.${s}`;
}

function verifyToken(token) {
  try {
    if (!token) return null;
    const [h, b, s] = token.split('.');
    if (!h || !b || !s) return null;
    const secret = getSecret();
    const expected = crypto.createHmac('sha256', secret).update(`${h}.${b}`).digest('base64')
      .replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
    if (s.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected))) return null;
    const p = JSON.parse(Buffer.from(b, 'base64').toString());
    if (p.exp && Math.floor(Date.now()/1000) > p.exp) return null;
    return p;
  } catch { return null; }
}

function getAuthUser(req) {
  const header = req.headers['authorization'] || '';
  return verifyToken(header.replace('Bearer ','').trim());
}

const ORIGINS = [
  'https://web.telegram.org',
  'https://telegram.org',
];

function setCors(res, req) {
  const origin = req?.headers?.origin || '';
  const ok = ORIGINS.includes(origin)
    || /^https:\/\/[\w-]+\.vercel\.app$/.test(origin)
    || process.env.APP_URL === origin;
  res.setHeader('Access-Control-Allow-Origin', ok ? origin : ORIGINS[0]);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
}

function verifyTelegramData(initData) {
  const BOT_TOKEN = process.env.BOT_TOKEN;
  if (!BOT_TOKEN) return null;
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return null;
    params.delete('hash');
    const str = [...params.entries()]
      .sort(([a],[b]) => a.localeCompare(b))
      .map(([k,v]) => `${k}=${v}`).join('\n');
    const key = crypto.createHmac('sha256','WebAppData').update(BOT_TOKEN).digest();
    const expected = crypto.createHmac('sha256', key).update(str).digest('hex');
    if (hash.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(hash,'hex'), Buffer.from(expected,'hex'))) return null;
    const authDate = parseInt(params.get('auth_date')||'0');
    if (Date.now()/1000 - authDate > 3600) return null;
    return JSON.parse(params.get('user')||'{}');
  } catch { return null; }
}

module.exports = { setCors, signToken, verifyToken, getAuthUser, verifyTelegramData };
