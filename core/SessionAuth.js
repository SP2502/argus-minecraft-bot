const crypto = require('crypto');

const DEFAULT_PASSWORDS = new Set(['admin', 'changeme', 'password']);
const DEFAULT_SECRETS = new Set(['secret_argus_key_2026', 'your_secure_secret_key_here', 'replace_with_a_secure_random_session_secret_key']);

function getConfig() {
  return { password: process.env.DASHBOARD_PASSWORD || '', secret: process.env.DASHBOARD_SESSION_SECRET || '', ttlMs: Number(process.env.DASHBOARD_SESSION_TTL_MS || 28800000) };
}

function validateConfig() {
  const { password, secret, ttlMs } = getConfig();
  if (password.length < 12 || DEFAULT_PASSWORDS.has(password)) throw new Error('DASHBOARD_PASSWORD must be a non-default value of at least 12 characters.');
  if (secret.length < 32 || DEFAULT_SECRETS.has(secret)) throw new Error('DASHBOARD_SESSION_SECRET must be a non-default value of at least 32 characters.');
  if (!Number.isFinite(ttlMs) || ttlMs <= 0 || ttlMs > 604800000) throw new Error('DASHBOARD_SESSION_TTL_MS must be between 1ms and 7 days.');
}

function sign(payload, secret) { return crypto.createHmac('sha256', secret).update(payload).digest('hex'); }

function createSessionToken(username, role = 'owner') {
  validateConfig();
  const { secret, ttlMs } = getConfig();
  const payload = Buffer.from(JSON.stringify({ username, role, expiresAt: Date.now() + ttlMs })).toString('base64url');
  return `${payload}.${sign(payload, secret)}`;
}

function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return null;
  const [payload, signature, ...extra] = token.split('.');
  if (!payload || !signature || extra.length) return null;
  if (!/^[a-f0-9]{64}$/i.test(signature)) return null;
  const { secret } = getConfig();
  if (!secret) return null;
  const actual = Buffer.from(signature, 'hex');
  const expected = Buffer.from(sign(payload, secret), 'hex');
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return session.username && session.role && Number.isFinite(session.expiresAt) && session.expiresAt > Date.now() ? session : null;
  } catch { return null; }
}

function extractBearerToken(headers = {}) {
  const match = typeof headers.authorization === 'string' && headers.authorization.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

module.exports = { createSessionToken, verifySessionToken, extractBearerToken, validateConfig };
