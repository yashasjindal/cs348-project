import session from 'express-session';

// Logins are kept in a server-side session; the browser only holds the session id in a cookie.
// The Vite dev server proxies /api to this server, so the cookie is same-origin and needs no CORS.
// Sessions live in memory: restarting the server logs everyone out, which is fine for local use.
export const SESSION_COOKIE = 'smartcart.sid';

export const sessionMiddleware = session({
  name: SESSION_COOKIE,
  secret: process.env.SESSION_SECRET ?? 'smartcart-dev-secret',
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
export function requireAuth(action) {
  return (req, res, next) => {
    if (!req.session.uid) {
      return res.status(401).json({ error: `log in or sign up to ${action}`, loginRequired: true });
    }
    next();
  };
}
