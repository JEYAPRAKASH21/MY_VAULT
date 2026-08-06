require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
app.use(cors({
  origin: '*',
  optionsSuccessStatus: 200,
  maxAge: 86400
}));
app.use(express.json());

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

// Health check / pre-warming endpoint for fast cold starts
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: Date.now() });
});

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Vault API is operational' });
});

const JWT_SECRET = process.env.JWT_SECRET || 'change-me';

function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    req.userId = jwt.verify(token, JWT_SECRET).userId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ---------- auth ----------
app.post('/api/register', async (req, res) => { const { identifier, password } = req.body;
  if (!identifier || !password || password.length < 4) {
    return res.status(400).json({ error: 'Identifier and a password (min 4 chars) are required' });
  }
  const id = identifier.trim().toLowerCase();
  const [existing] = await pool.query('SELECT id FROM users WHERE identifier = ?', [id]);
  if (existing.length) return res.status(409).json({ error: 'That identifier is already registered' });

  const hash = await bcrypt.hash(password, 10);
  const [result] = await pool.query(
    'INSERT INTO users (identifier, password_hash) VALUES (?, ?)',
    [id, hash]
  );
  const token = jwt.sign({ userId: result.insertId }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token });
});

app.post('/api/login', async (req, res) => {
  const { identifier, password } = req.body;
  const [rows] = await pool.query('SELECT * FROM users WHERE identifier = ?', [(identifier || '').trim().toLowerCase()]);
  if (!rows.length) return res.status(401).json({ error: 'Account not found' });
  const user = rows[0];
  const ok = await bcrypt.compare(password || '', user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Wrong password' });
  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token });
});

app.post('/api/forgot-password/verify', async (req, res) => {
  const { identifier } = req.body;
  const [rows] = await pool.query('SELECT id FROM users WHERE identifier = ?', [(identifier || '').trim().toLowerCase()]);
  if (!rows.length) return res.status(404).json({ error: 'No account with that identifier' });
  const resetToken = jwt.sign({ userId: rows[0].id, purpose: 'reset' }, JWT_SECRET, { expiresIn: '15m' });
  // In production: email/text resetToken to the user instead of returning it in the response.
  res.json({ resetToken });
});

app.post('/api/forgot-password/reset', async (req, res) => {
  const { resetToken, newPassword } = req.body;
  if (!newPassword || newPassword.length < 4) return res.status(400).json({ error: 'Password too short' });
  try {
    const payload = jwt.verify(resetToken, JWT_SECRET);
    if (payload.purpose !== 'reset') throw new Error('bad token');
    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, payload.userId]);
    const token = jwt.sign({ userId: payload.userId }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token });
  } catch {
    res.status(400).json({ error: 'Reset link invalid or expired' });
  }
});

// ---------- vault entries (all require a valid token) ----------
app.get('/api/entries', auth, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM vault_entries WHERE user_id = ? ORDER BY created_at DESC', [req.userId]);
  res.json(rows);
});

app.post('/api/entries', auth, async (req, res) => {
  const { name, category, username, password, notes } = req.body;
  const [result] = await pool.query(
    'INSERT INTO vault_entries (user_id, name, category, username, password, notes) VALUES (?, ?, ?, ?, ?, ?)',
    [req.userId, name || '', category || 'other', username || '', password || '', notes || '']
  );
  res.json({ id: result.insertId });
});

app.put('/api/entries/:id', auth, async (req, res) => {
  const { name, category, username, password, notes } = req.body;
  await pool.query(
    'UPDATE vault_entries SET name=?, category=?, username=?, password=?, notes=? WHERE id=? AND user_id=?',
    [name || '', category || 'other', username || '', password || '', notes || '', req.params.id, req.userId]
  );
  res.json({ ok: true });
});

app.delete('/api/entries/:id', auth, async (req, res) => {
  await pool.query('DELETE FROM vault_entries WHERE id=? AND user_id=?', [req.params.id, req.userId]);
  res.json({ ok: true });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Vault API running on port ${PORT}`));
