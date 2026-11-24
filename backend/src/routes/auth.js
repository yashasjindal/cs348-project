import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';
import { startSession, endSession, requireAuth } from '../session.js';

const router = Router();

// Cost 10 matches the bcrypt hashes in db/sample-data.sql, so the sample accounts can log in.
const BCRYPT_COST = 10;
const USERNAME_PATTERN = /^[A-Za-z0-9_.-]{3,50}$/;
const MIN_PASSWORD = 8;
const MAX_PASSWORD_BYTES = 72;  // bcrypt ignores everything after the first 72 bytes

// Compared against when the username doesn't exist, so an unknown username takes as long to
// reject as a wrong password and response times don't reveal which usernames are registered.
const UNKNOWN_USER_HASH = bcrypt.hashSync('no-such-user', BCRYPT_COST);

function signUpError(username, password) {
  if (typeof username !== 'string' || !USERNAME_PATTERN.test(username)) {
    return 'username must be 3 to 50 letters, digits, dots, dashes or underscores';
  }
  if (typeof password !== 'string' || password.length < MIN_PASSWORD
      || Buffer.byteLength(password) > MAX_PASSWORD_BYTES) {
    return `password must be ${MIN_PASSWORD} to ${MAX_PASSWORD_BYTES} characters`;
  }
  return null;
}

// Feature 5a: create an account and log in as it.
// POST /api/register   body: { "username": "carol", "password": "..." }
router.post('/register', async (req, res) => {
  const { username, password } = req.body ?? {};
  const error = signUpError(username, password);
  if (error) return res.status(400).json({ error });

  const hash = await bcrypt.hash(password, BCRYPT_COST);

  // The user and their basket are created together: every user has exactly one basket
  // (Basket.uid is UNIQUE), so later basket requests never have to create one on the fly.
  const conn = await pool.getConnection();
  let uid;
  try {
    await conn.beginTransaction();
    const [result] = await conn.execute(
      'INSERT INTO User (username, password_hash) VALUES (?, ?)',
      [username, hash],
    );
    uid = result.insertId;
    await conn.execute('INSERT INTO Basket (uid) VALUES (?)', [uid]);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    // Rely on UNIQUE (username) instead of checking first: two sign-ups racing for the same
    // name could both pass a SELECT check, but only one INSERT can succeed.
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'that username is taken' });
    throw err;
  } finally {
    conn.release();
  }

  await startSession(req, uid);
  res.status(201).json({ user: { uid, username } });
});

// Feature 5b: log in.
// POST /api/login   body: { "username": "alice", "password": "..." }
router.post('/login', async (req, res) => {
  const { username, password } = req.body ?? {};
  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'username and password are required' });
  }

  const [[user]] = await pool.execute(
    'SELECT uid, username, password_hash FROM User WHERE username = ?',
    [username],
  );
  const passwordOk = await bcrypt.compare(password, user?.password_hash ?? UNKNOWN_USER_HASH);
  // Same message either way, so the response doesn't say whether the username exists.
  if (!user || !passwordOk) return res.status(401).json({ error: 'wrong username or password' });

  await startSession(req, user.uid);
  res.json({ user: { uid: user.uid, username: user.username } });
});

// POST /api/logout
router.post('/logout', async (req, res) => {
  await endSession(req, res);
  res.status(204).end();
});

// Who is logged in: { "user": { "uid": 1, "username": "alice" } }, or { "user": null }.
// GET /api/me
router.get('/me', async (req, res) => {
  if (!req.session.uid) return res.json({ user: null });

  const [[user]] = await pool.execute('SELECT uid, username FROM User WHERE uid = ?', [req.session.uid]);
  if (!user) {
    // The account was deleted from another session; drop this one too.
    await endSession(req, res);
    return res.json({ user: null });
  }
  res.json({ user });
});

// Delete the logged-in account. Asks for the password again so a session left open on a shared
// computer can't be used to delete the account. ON DELETE CASCADE removes the basket and items.
// DELETE /api/account   body: { "password": "..." }
router.delete('/account', requireAuth, async (req, res) => {
  const { password } = req.body ?? {};
  if (typeof password !== 'string') {
    return res.status(400).json({ error: 'password is required to delete the account' });
  }

  const [[user]] = await pool.execute('SELECT password_hash FROM User WHERE uid = ?', [req.session.uid]);
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'wrong password' });
  }

  await pool.execute('DELETE FROM User WHERE uid = ?', [req.session.uid]);
  await endSession(req, res);
  res.status(204).end();
});

export default router;
