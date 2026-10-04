import { HttpError, randomToken, sha256Hex, uuid } from './util.js';

const SESSION_DAYS = 90;
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];
let jwksCache = { keys: null, at: 0 };

const b64urlToBytes = (s) => {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s + '='.repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};
const b64urlJson = (s) => JSON.parse(new TextDecoder().decode(b64urlToBytes(s)));

async function googleKeys() {
  if (jwksCache.keys && Date.now() - jwksCache.at < 3600_000) return jwksCache.keys;
  const res = await fetch('https://www.googleapis.com/oauth2/v3/certs');
  if (!res.ok) throw new HttpError(502, 'Could not reach Google to verify sign-in');
  jwksCache = { keys: (await res.json()).keys, at: Date.now() };
  return jwksCache.keys;
}

/** Verify a Google Identity Services ID token (RS256) and return its claims. */
export async function verifyGoogleIdToken(credential, env) {
  if (!env.GOOGLE_CLIENT_ID || env.GOOGLE_CLIENT_ID.startsWith('REPLACE_')) throw new HttpError(500, 'Google sign-in is not configured on the server');
  const parts = String(credential || '').split('.');
  if (parts.length !== 3) throw new HttpError(401, 'Malformed sign-in token');
  const header = b64urlJson(parts[0]);
  const claims = b64urlJson(parts[1]);
  if (header.alg !== 'RS256') throw new HttpError(401, 'Unsupported token algorithm');

  const jwk = (await googleKeys()).find((k) => k.kid === header.kid);
  if (!jwk) throw new HttpError(401, 'Unknown signing key');
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlToBytes(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
  if (!valid) throw new HttpError(401, 'Invalid sign-in token');

  const now = Math.floor(Date.now() / 1000);
  if (!GOOGLE_ISSUERS.includes(claims.iss)) throw new HttpError(401, 'Bad token issuer');
  if (claims.aud !== env.GOOGLE_CLIENT_ID) throw new HttpError(401, 'Token was issued for a different app');
  if (claims.exp < now - 30) throw new HttpError(401, 'Sign-in token expired');
  if (!claims.sub || !claims.email) throw new HttpError(401, 'Token is missing account details');
  if (claims.email_verified === false) throw new HttpError(401, 'Google email is not verified');
  return claims;
}

/** Create/refresh the user plus profile, stats and prefs rows. Idempotent. */
export async function upsertUser(env, { sub, email, name, picture }, timezone) {
  const db = env.DB;
  let user = await db.prepare('SELECT * FROM users WHERE google_sub = ?').bind(sub).first();
  if (!user) {
    const id = uuid();
    await db.batch([
      db.prepare('INSERT INTO users (id, google_sub, email, name, avatar_url) VALUES (?, ?, ?, ?, ?)').bind(id, sub, email, name || null, picture || null),
      db.prepare('INSERT INTO profiles (user_id, display_name, timezone) VALUES (?, ?, ?)').bind(id, (name || email.split('@')[0]).split(' ')[0], timezone || 'UTC'),
      db.prepare('INSERT INTO user_stats (user_id) VALUES (?)').bind(id),
      db.prepare('INSERT INTO notification_prefs (user_id) VALUES (?)').bind(id),
    ]);
    user = { id, email, name };
  } else {
    await db.prepare("UPDATE users SET email = ?, name = ?, avatar_url = ?, last_login_at = datetime('now') WHERE id = ?")
      .bind(email, name || user.name, picture || user.avatar_url, user.id).run();
  }
  return user;
}

export async function createSession(env, userId) {
  const token = randomToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000).toISOString();
  await env.DB.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').bind(await sha256Hex(token), userId, expires).run();
  return token;
}

export async function authenticate(request, env) {
  const h = request.headers.get('Authorization') || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!token) throw new HttpError(401, 'Sign in required');
  const hash = await sha256Hex(token);
  const row = await env.DB.prepare(
    'SELECT s.user_id AS id, s.expires_at, u.email, u.name, u.avatar_url FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?'
  ).bind(hash).first();
  if (!row || row.expires_at < new Date().toISOString()) throw new HttpError(401, 'Session expired — please sign in again');
  return { ...row, tokenHash: hash };
}
