import session from 'express-session';
import { pool } from './db.js';

// Logins are kept in a server-side session; the browser only holds the session id in a cookie.
// The Vite dev server proxies /api to this server, so the cookie is same-origin and needs no CORS.
// Sessions live in memory: restarting the server logs everyone out, which is fine for local use.
export const SESSION_COOKIE = 'smartcart.sid';

// Anyone who knows the secret can forge a login cookie, so the fixed fallback is only for local
// development; a production server refuses to start without its own SESSION_SECRET.
const secret = process.env.SESSION_SECRET?.trim();
if (!secret && process.env.NODE_ENV === 'production') {
  throw new Error('SESSION_SECRET must be set when NODE_ENV=production');
}

export const sessionMiddleware = session({
  name: SESSION_COOKIE,
  secret: secret || 'smartcart-dev-secret',
  resave: false,
  saveUninitialized: false,  // no cookie until someone logs in
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 },
});

// Log the request in as uid. A fresh session id on every login stops a session id that was
// planted before login (session fixation) from becoming a logged-in session.
export function startSession(req, uid) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      req.session.uid = uid;
      resolve();
    });
  });
}

export function endSession(req, res) {
  res.clearCookie(SESSION_COOKIE);
  return new Promise((resolve, reject) => {
    req.session.destroy((err) => (err ? reject(err) : resolve()));
  });
}

// Every shop feature needs a login. requireAuth('compare stores') rejects a logged-out request with
// 401 { error: 'log in or sign up to compare stores', loginRequired: true }, so the app can show
// the message and send the visitor to the login page.
// The account is looked up too, so a session whose account was deleted elsewhere (another
// browser) is logged out instead of acting on a uid that no longer exists.
export function requireAuth(action) {
  return async (req, res, next) => {
    const { uid } = req.session;
    const [rows] = uid ? await pool.execute('SELECT 1 FROM User WHERE uid = ?', [uid]) : [[]];
    if (rows.length === 0) {
      if (uid) await endSession(req, res);
      return res.status(401).json({ error: `log in or sign up to ${action}`, loginRequired: true });
    }
    next();
  };
}
