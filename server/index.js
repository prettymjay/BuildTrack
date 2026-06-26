const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const DEFAULT_MATERIAL_CATEGORIES = [
  { name: 'Cement', description: 'Portland Cement, Masonry Cement' },
  { name: 'Sand', description: 'Fine Sand, Washed Sand' },
  { name: 'Gravel', description: '3/4 Gravel, G1, G2' },
  { name: 'Steel Bars', description: '10mm, 12mm, 16mm Rebars' },
  { name: 'Tie Wire', description: 'GI Tie Wire' },
  { name: 'Lumber', description: 'Coco Lumber, Mahogany' },
  { name: 'Plywood', description: 'Marine Plywood, Ordinary Plywood' },
  { name: 'Roofing', description: 'Long Span Roof, Rib Type' },
  { name: 'Hollow Blocks', description: '4", 5", 6" CHB' },
  { name: 'Bricks', description: 'Clay Bricks' },
  { name: 'Tiles', description: 'Floor Tiles, Wall Tiles' },
  { name: 'Paint', description: 'Primer, Latex, Enamel' },
  { name: 'Plumbing', description: 'PVC Pipe, Elbow, Tee, Faucet' },
  { name: 'Electrical', description: 'Wires, Breakers, Switches, Outlets' },
  { name: 'Doors', description: 'Wooden Door, Steel Door' },
  { name: 'Windows', description: 'Aluminum Window, Glass Window' },
  { name: 'Ceiling', description: 'Gypsum Board, Ceiling Joist' },
  { name: 'Fasteners', description: 'Nails, Screws, Bolts' },
  { name: 'Adhesives', description: 'Rugby, Epoxy, Sealant' },
  { name: 'Hardware Tools', description: 'Hammer, Trowel, Grinder' },
  { name: 'Safety Equipment', description: 'Helmet, Gloves, Safety Vest' },
  { name: 'Miscellaneous', description: 'Other construction supplies' },
];

const DEFAULT_SYSTEM_OPTIONS = {
  daily_expense_categories: [
    'Labor',
    'Transportation',
    'Fuel',
    'Equipment Rental',
    'Food Allowance',
    'Accommodation',
    'Communication',
    'Utility Bills',
    'Repairs & Maintenance',
    'Permit & Fees',
    'Office Supplies',
    'Miscellaneous',
  ],
  supplier_categories: [
    'Cement Supplier',
    'Steel Supplier',
    'Lumber Supplier',
    'Plumbing Supplier',
    'Electrical Supplier',
    'Paint Supplier',
    'Roofing Supplier',
    'Hardware Store',
    'Equipment Rental',
    'General Supplier',
  ],
  user_roles: ['Administrator', 'Owner', 'Staff', 'Viewer'],
  project_statuses: ['Planning', 'Ongoing', 'Completed', 'On Hold', 'Cancelled'],
  payment_statuses: ['Paid', 'Unpaid', 'Partially Paid', 'Cancelled'],
  unit_categories: [
    'Piece (pc)',
    'Box',
    'Bag',
    'Sack',
    'Kilogram (kg)',
    'Meter (m)',
    'Square Meter (m2)',
    'Cubic Meter (m3)',
    'Roll',
    'Bundle',
    'Gallon',
    'Liter',
    'Drum',
    'Sheet',
    'Set',
  ],
  transaction_types: [
    'Material Purchase',
    'Daily Expense',
    'Material Return',
    'Material Adjustment',
    'Material Transfer',
    'Budget Allocation',
  ],
  report_types: [
    'Daily Report',
    'Weekly Report',
    'Monthly Report',
    'Materials Report',
    'Expenses Report',
    'Supplier Report',
    'Project Cost Report',
    'Inventory Report',
  ],
};

const MUTABLE_SYSTEM_GROUPS = ['daily_expense_categories', 'project_statuses', 'unit_categories'];

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const PORT = Number(process.env.PORT || 4000);
const FRONTEND_PORT = Number(process.env.FRONTEND_PORT || 5173);
const ADMIN_NAME = process.env.ADMIN_NAME || 'Administrator';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@gmail.com';
const ADMIN_INITIAL_PASSWORD = process.env.ADMIN_INITIAL_PASSWORD || '1234';
const COMPANY_NAME = process.env.APP_NAME || 'ProBuild App';
const COMPANY_EMAIL = process.env.COMPANY_EMAIL || ADMIN_EMAIL;
const COMPANY_ADDRESS = process.env.COMPANY_ADDRESS || '';
const COMPANY_CONTACT = process.env.COMPANY_CONTACT || '';
const RESET_TOKEN_TTL_MINUTES = Number(process.env.RESET_TOKEN_TTL_MINUTES || 15);
const LOGIN_MAX_ATTEMPTS = Number(process.env.LOGIN_MAX_ATTEMPTS || 5);
const LOGIN_WINDOW_MS = Number(process.env.LOGIN_WINDOW_MS || 15 * 60 * 1000);

const dbPath = path.join(__dirname, 'auth.db');
const backupsDir = path.join(__dirname, 'backups');
const clientDistPath = path.join(__dirname, '..', 'dist');
fs.mkdirSync(backupsDir, { recursive: true });

const db = new sqlite3.Database(dbPath);
const loginAttempts = new Map();

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) {
        reject(err);
        return;
      }
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row || null);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows || []);
    });
  });
}

function exec(sql) {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

function nowIso() {
  return new Date().toISOString();
}

function hashValue(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function hasBundledFrontend() {
  return fs.existsSync(path.join(clientDistPath, 'index.html'));
}

function getClientIp(req) {
  return String(req.ip || req.connection?.remoteAddress || 'unknown');
}

function getLoginAttemptKey(req, username) {
  return `${getClientIp(req)}::${String(username || '').trim().toLowerCase()}`;
}

function clearExpiredLoginAttempts() {
  const now = Date.now();
  for (const [key, state] of loginAttempts.entries()) {
    if (state.expiresAt <= now) {
      loginAttempts.delete(key);
    }
  }
}

function getRetryAfterSeconds(state) {
  return Math.max(1, Math.ceil((state.expiresAt - Date.now()) / 1000));
}

function getBlockedLoginAttempt(req, username) {
  clearExpiredLoginAttempts();
  const key = getLoginAttemptKey(req, username);
  const state = loginAttempts.get(key);
  if (!state) return null;
  if (state.count < LOGIN_MAX_ATTEMPTS) return null;
  if (state.expiresAt <= Date.now()) {
    loginAttempts.delete(key);
    return null;
  }
  return state;
}

function registerFailedLoginAttempt(req, username) {
  clearExpiredLoginAttempts();
  const key = getLoginAttemptKey(req, username);
  const current = loginAttempts.get(key);
  const next = {
    count: (current?.count || 0) + 1,
    expiresAt: Date.now() + LOGIN_WINDOW_MS,
  };
  loginAttempts.set(key, next);
  return next;
}

function clearLoginAttempt(req, username) {
  loginAttempts.delete(getLoginAttemptKey(req, username));
}

function toSqliteBoolean(value) {
  return value ? 1 : 0;
}

function normalizeStatus(value) {
  return value === 'Inactive' ? 'Inactive' : 'Active';
}

function normalizeRecordName(value) {
  return String(value || '').trim();
}

function normalizeSystemRecords(items) {
  const records = [];

  for (const item of items || []) {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const name = normalizeRecordName(item.name);
      if (!name) continue;
      records.push({ name, status: normalizeStatus(item.status) });
      continue;
    }

    const name = normalizeRecordName(item);
    if (!name) continue;
    records.push({ name, status: 'Active' });
  }

  records.sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: 'base' }));
  return records;
}

function activeSystemNames(records) {
  return records.filter((record) => record.status === 'Active').map((record) => record.name);
}

function parseStoredItems(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return normalizeSystemRecords(Array.isArray(parsed) ? parsed : []);
  } catch {
    return [];
  }
}

function toJsonResponseSystemList(record) {
  return {
    key: record.key,
    items: parseStoredItems(record.items),
    created_at: record.created_at || null,
    updated_at: record.updated_at || null,
  };
}

function materialRow(row) {
  if (!row) return row;
  return {
    ...row,
    low_stock: Boolean(row.low_stock),
  };
}

function expenseRow(row) {
  if (!row) return row;
  return {
    ...row,
    amount: Number(row.amount || 0),
  };
}

function toBackupUser(row) {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    password: row.password,
    name: row.name,
    reset_token_hash: row.reset_token_hash,
    reset_token_expires_at: row.reset_token_expires_at,
  };
}

async function ensureColumn(table, column, definition) {
  const columns = await all(`PRAGMA table_info(${table})`);
  const exists = columns.some((row) => row.name === column);
  if (!exists) {
    await run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

async function ensureTables() {
  await exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      email TEXT UNIQUE,
      password TEXT,
      name TEXT,
      reset_token_hash TEXT,
      reset_token_expires_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS company_settings (
      id INTEGER PRIMARY KEY,
      name TEXT,
      address TEXT,
      contact TEXT,
      email TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS system_reference_lists (
      key TEXT PRIMARY KEY,
      items TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE,
      description TEXT,
      status TEXT DEFAULT 'Active'
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      location TEXT,
      progress INTEGER,
      start_date TEXT,
      target_date TEXT,
      cost INTEGER,
      status TEXT
    );

    CREATE TABLE IF NOT EXISTS materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT,
      name TEXT,
      category TEXT,
      quantity TEXT,
      unit TEXT,
      cost TEXT,
      supplier TEXT,
      supplier_category TEXT,
      low_stock INTEGER DEFAULT 0,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT,
      project TEXT,
      category TEXT,
      description TEXT,
      amount INTEGER,
      status TEXT
    );
  `);

  await ensureColumn('users', 'email', 'TEXT');
  await ensureColumn('users', 'name', 'TEXT');
  await ensureColumn('users', 'reset_token_hash', 'TEXT');
  await ensureColumn('users', 'reset_token_expires_at', 'INTEGER');

  await ensureColumn('materials', 'unit', 'TEXT');
  await ensureColumn('materials', 'supplier_category', 'TEXT');
  await ensureColumn('materials', 'low_stock', 'INTEGER DEFAULT 0');
  await ensureColumn('materials', 'created_at', 'TEXT');
}

async function seedAdminUser() {
  const admin = await get('SELECT * FROM users WHERE id = 1');
  if (!admin) {
    const passwordHash = await bcrypt.hash(ADMIN_INITIAL_PASSWORD, 10);
    await run(
      'INSERT INTO users (id, username, email, password, name, reset_token_hash, reset_token_expires_at) VALUES (?, ?, ?, ?, ?, NULL, NULL)',
      [1, ADMIN_USERNAME, ADMIN_EMAIL, passwordHash, ADMIN_NAME],
    );
    return;
  }

  const updates = [];
  const params = [];
  if (!admin.email) {
    updates.push('email = ?');
    params.push(ADMIN_EMAIL);
  }
  if (!admin.name) {
    updates.push('name = ?');
    params.push(ADMIN_NAME);
  }

  if (updates.length) {
    params.push(1);
    await run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
  }
}

async function seedCompanySettings() {
  const current = await get('SELECT * FROM company_settings WHERE id = 1');
  const timestamp = nowIso();

  if (!current) {
    await run(
      'INSERT INTO company_settings (id, name, address, contact, email, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [1, COMPANY_NAME, COMPANY_ADDRESS, COMPANY_CONTACT, COMPANY_EMAIL, timestamp, timestamp],
    );
    return;
  }

  const updates = [];
  const params = [];
  if (!current.name) {
    updates.push('name = ?');
    params.push(COMPANY_NAME);
  }
  if (!current.email) {
    updates.push('email = ?');
    params.push(COMPANY_EMAIL);
  }
  if (!current.address && COMPANY_ADDRESS) {
    updates.push('address = ?');
    params.push(COMPANY_ADDRESS);
  }
  if (!current.contact && COMPANY_CONTACT) {
    updates.push('contact = ?');
    params.push(COMPANY_CONTACT);
  }

  if (updates.length) {
    updates.push('updated_at = ?');
    params.push(timestamp, 1);
    await run(`UPDATE company_settings SET ${updates.join(', ')} WHERE id = ?`, params);
  }
}

async function seedCategories() {
  const row = await get('SELECT COUNT(*) AS count FROM categories');
  if (Number(row?.count || 0) > 0) return;

  for (const category of DEFAULT_MATERIAL_CATEGORIES) {
    await run(
      'INSERT INTO categories (name, description, status) VALUES (?, ?, ?)',
      [category.name, category.description, 'Active'],
    );
  }
}

async function seedSystemReferenceLists() {
  const timestamp = nowIso();

  for (const group of MUTABLE_SYSTEM_GROUPS) {
    const existing = await get('SELECT key FROM system_reference_lists WHERE key = ?', [group]);
    if (existing) continue;

    const items = normalizeSystemRecords(DEFAULT_SYSTEM_OPTIONS[group]);
    await run(
      'INSERT INTO system_reference_lists (key, items, created_at, updated_at) VALUES (?, ?, ?, ?)',
      [group, JSON.stringify(items), timestamp, timestamp],
    );
  }
}

async function initDb() {
  await ensureTables();
  await seedAdminUser();
  await seedCompanySettings();
  await seedCategories();
  await seedSystemReferenceLists();
}

async function getSystemRecords(group) {
  const row = await get('SELECT * FROM system_reference_lists WHERE key = ?', [group]);
  if (row) return parseStoredItems(row.items);
  return normalizeSystemRecords(DEFAULT_SYSTEM_OPTIONS[group] || []);
}

async function saveSystemRecords(group, records) {
  const timestamp = nowIso();
  const payload = JSON.stringify(normalizeSystemRecords(records));
  const existing = await get('SELECT key FROM system_reference_lists WHERE key = ?', [group]);
  if (existing) {
    await run('UPDATE system_reference_lists SET items = ?, updated_at = ? WHERE key = ?', [payload, timestamp, group]);
    return;
  }

  await run(
    'INSERT INTO system_reference_lists (key, items, created_at, updated_at) VALUES (?, ?, ?, ?)',
    [group, payload, timestamp, timestamp],
  );
}

async function getReferenceUsage(group, name) {
  if (group === 'daily_expense_categories') {
    const row = await get('SELECT COUNT(*) AS count FROM expenses WHERE category = ?', [name]);
    return Number(row?.count || 0);
  }
  if (group === 'project_statuses') {
    const row = await get('SELECT COUNT(*) AS count FROM projects WHERE status = ?', [name]);
    return Number(row?.count || 0);
  }
  if (group === 'unit_categories') {
    const row = await get('SELECT COUNT(*) AS count FROM materials WHERE unit = ?', [name]);
    return Number(row?.count || 0);
  }
  return 0;
}

async function renameReferenceUsage(group, previousName, nextName) {
  if (previousName === nextName) return;
  if (group === 'daily_expense_categories') {
    await run('UPDATE expenses SET category = ? WHERE category = ?', [nextName, previousName]);
    return;
  }
  if (group === 'project_statuses') {
    await run('UPDATE projects SET status = ? WHERE status = ?', [nextName, previousName]);
    return;
  }
  if (group === 'unit_categories') {
    await run('UPDATE materials SET unit = ? WHERE unit = ?', [nextName, previousName]);
  }
}

function getBearerToken(req) {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

function requireAuth(req, res, next) {
  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    req.auth = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.auth?.id !== 1) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }
    next();
  });
}

async function createBackupSnapshot() {
  return {
    version: 2,
    created_at: nowIso(),
    company_settings: await all('SELECT * FROM company_settings ORDER BY id'),
    users: (await all('SELECT * FROM users ORDER BY id')).map(toBackupUser),
    projects: await all('SELECT * FROM projects ORDER BY id'),
    materials: (await all('SELECT * FROM materials ORDER BY id')).map(materialRow),
    expenses: (await all('SELECT * FROM expenses ORDER BY id')).map(expenseRow),
    categories: await all('SELECT * FROM categories ORDER BY id'),
    system_reference_lists: (await all('SELECT * FROM system_reference_lists ORDER BY key')).map(toJsonResponseSystemList),
  };
}

async function restoreBackupSnapshot(snapshot) {
  await exec('BEGIN TRANSACTION');
  try {
    await run('DELETE FROM expenses');
    await run('DELETE FROM materials');
    await run('DELETE FROM projects');
    await run('DELETE FROM categories');
    await run('DELETE FROM system_reference_lists');
    await run('DELETE FROM company_settings');
    await run('DELETE FROM users');

    for (const row of snapshot.users || []) {
      await run(
        'INSERT INTO users (id, username, email, password, name, reset_token_hash, reset_token_expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          row.id,
          row.username,
          row.email || null,
          row.password,
          row.name || null,
          row.reset_token_hash || null,
          row.reset_token_expires_at || null,
        ],
      );
    }

    for (const row of snapshot.company_settings || []) {
      await run(
        'INSERT INTO company_settings (id, name, address, contact, email, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          row.id,
          row.name || COMPANY_NAME,
          row.address || '',
          row.contact || '',
          row.email || '',
          row.created_at || nowIso(),
          row.updated_at || nowIso(),
        ],
      );
    }

    for (const row of snapshot.projects || []) {
      await run(
        'INSERT INTO projects (id, title, location, progress, start_date, target_date, cost, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [
          row.id,
          row.title || '',
          row.location || null,
          Number(row.progress || 0),
          row.start_date || null,
          row.target_date || null,
          Number(row.cost || 0),
          row.status || 'Planning',
        ],
      );
    }

    for (const row of snapshot.materials || []) {
      await run(
        'INSERT INTO materials (id, code, name, category, quantity, unit, cost, supplier, supplier_category, low_stock, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          row.id,
          row.code || null,
          row.name || '',
          row.category || null,
          row.quantity || null,
          row.unit || null,
          row.cost || null,
          row.supplier || null,
          row.supplier_category || null,
          toSqliteBoolean(Boolean(row.low_stock)),
          row.created_at || null,
        ],
      );
    }

    for (const row of snapshot.expenses || []) {
      await run(
        'INSERT INTO expenses (id, date, project, category, description, amount, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          row.id,
          row.date || null,
          row.project || null,
          row.category || null,
          row.description || null,
          Number(row.amount || 0),
          row.status || 'Unpaid',
        ],
      );
    }

    for (const row of snapshot.categories || []) {
      await run(
        'INSERT INTO categories (id, name, description, status) VALUES (?, ?, ?, ?)',
        [row.id, row.name || '', row.description || null, normalizeStatus(row.status)],
      );
    }

    for (const row of snapshot.system_reference_lists || []) {
      const items = Array.isArray(row.items) ? row.items : parseStoredItems(row.items);
      await run(
        'INSERT INTO system_reference_lists (key, items, created_at, updated_at) VALUES (?, ?, ?, ?)',
        [row.key, JSON.stringify(normalizeSystemRecords(items)), row.created_at || nowIso(), row.updated_at || nowIso()],
      );
    }

    await exec('COMMIT');
  } catch (error) {
    await exec('ROLLBACK');
    throw error;
  }
}

const app = express();
app.disable('x-powered-by');
app.use(cors({
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }

    const allowed = new Set([
      `http://127.0.0.1:${PORT}`,
      `http://localhost:${PORT}`,
      `http://127.0.0.1:${FRONTEND_PORT}`,
      `http://localhost:${FRONTEND_PORT}`,
    ]);

    callback(null, allowed.has(origin));
  },
}));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    res.status(400).json({ error: 'Missing credentials' });
    return;
  }

  const blockedAttempt = getBlockedLoginAttempt(req, username);
  if (blockedAttempt) {
    const retryAfter = getRetryAfterSeconds(blockedAttempt);
    res.setHeader('Retry-After', String(retryAfter));
    res.status(429).json({ error: `Too many login attempts. Try again in ${retryAfter} seconds.` });
    return;
  }

  try {
    const user = await get(
      'SELECT * FROM users WHERE lower(username) = lower(?) OR lower(email) = lower(?) LIMIT 1',
      [username, username],
    );

    if (!user) {
      registerFailedLoginAttempt(req, username);
      res.status(401).json({ error: 'Wrong username or wrong password.' });
      return;
    }

    const matches = await bcrypt.compare(password, user.password);
    if (!matches) {
      registerFailedLoginAttempt(req, username);
      res.status(401).json({ error: 'Wrong username or wrong password.' });
      return;
    }

    clearLoginAttempt(req, username);
    const token = jwt.sign({ username: user.username, id: user.id }, JWT_SECRET, { expiresIn: '8h' });
    res.json({ token, user: { username: user.username, name: user.name } });
  } catch (error) {
    console.error('login error', error);
    res.status(500).json({ error: 'Auth error' });
  }
});

app.post('/api/password/forgot', async (req, res) => {
  const { email } = req.body || {};
  if (!email) {
    res.status(400).json({ error: 'Missing email' });
    return;
  }

  try {
    const user = await get('SELECT * FROM users WHERE lower(email) = lower(?) LIMIT 1', [email]);
    if (!user) {
      res.status(404).json({ error: 'No account was found for that email address' });
      return;
    }

    const resetToken = crypto.randomBytes(24).toString('hex');
    const expiresAt = Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000;
    await run(
      'UPDATE users SET reset_token_hash = ?, reset_token_expires_at = ? WHERE id = ?',
      [hashValue(resetToken), expiresAt, user.id],
    );

    res.json({
      ok: true,
      message: `Offline recovery code for ${user.username}: ${resetToken}`,
      expiresInMinutes: RESET_TOKEN_TTL_MINUTES,
    });
  } catch (error) {
    console.error('forgot password error', error);
    res.status(500).json({ error: 'Unable to create reset code' });
  }
});

app.post('/api/password/reset', async (req, res) => {
  const { email, token, password } = req.body || {};
  if (!email || !token || !password) {
    res.status(400).json({ error: 'Missing fields' });
    return;
  }

  if (String(password).length < 3) {
    res.status(400).json({ error: 'Password must be at least 3 characters' });
    return;
  }

  try {
    const user = await get('SELECT * FROM users WHERE lower(email) = lower(?) LIMIT 1', [email]);
    if (!user) {
      res.status(400).json({ error: 'Invalid reset request' });
      return;
    }

    const tokenMatches = user.reset_token_hash && user.reset_token_hash === hashValue(token);
    const tokenActive = user.reset_token_expires_at && Number(user.reset_token_expires_at) > Date.now();
    if (!tokenMatches || !tokenActive) {
      res.status(400).json({ error: 'Invalid or expired reset token' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await run(
      'UPDATE users SET password = ?, reset_token_hash = NULL, reset_token_expires_at = NULL WHERE id = ?',
      [passwordHash, user.id],
    );

    res.json({ ok: true });
  } catch (error) {
    console.error('reset password error', error);
    res.status(500).json({ error: 'Reset failed' });
  }
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/projects', requireAuth, async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const perPage = Math.max(1, Number.parseInt(req.query.perPage, 10) || 10);
    const search = String(req.query.search || '').trim();
    const status = String(req.query.status || '').trim();
    const sort = String(req.query.sort || 'recent').trim();

    const filters = [];
    const params = [];

    if (search) {
      filters.push('(title LIKE ? OR location LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    if (status && status !== 'All') {
      filters.push('status = ?');
      params.push(status);
    }

    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const orderBy = sort === 'cost' ? 'cost DESC' : (sort === 'progress' ? 'progress DESC' : 'id DESC');

    const countRow = await get(`SELECT COUNT(*) AS count FROM projects ${where}`, params);
    const total = Number(countRow?.count || 0);
    const offset = (page - 1) * perPage;
    const rows = await all(
      `SELECT * FROM projects ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
      [...params, perPage, offset],
    );

    res.json({ data: rows, total, page, perPage });
  } catch (error) {
    console.error('projects index error', error);
    res.status(500).json({ error: 'DB error' });
  }
});

app.post('/api/projects', requireAuth, async (req, res) => {
  const {
    title,
    location = null,
    progress = 0,
    start_date = null,
    target_date = null,
    cost = 0,
    status = 'Planning',
  } = req.body || {};

  if (!title) {
    res.status(400).json({ error: 'Missing title' });
    return;
  }

  try {
    const result = await run(
      'INSERT INTO projects (title, location, progress, start_date, target_date, cost, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [title, location || null, Number(progress || 0), start_date || null, target_date || null, Number(cost || 0), status || 'Planning'],
    );
    const row = await get('SELECT * FROM projects WHERE id = ?', [result.lastID]);
    res.status(201).json(row);
  } catch (error) {
    console.error('projects create error', error);
    res.status(500).json({ error: 'DB error' });
  }
});

app.put('/api/projects/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const {
    title,
    location = null,
    progress = 0,
    start_date = null,
    target_date = null,
    cost = 0,
    status = 'Planning',
  } = req.body || {};

  if (!title) {
    res.status(400).json({ error: 'Missing title' });
    return;
  }

  try {
    await run(
      'UPDATE projects SET title = ?, location = ?, progress = ?, start_date = ?, target_date = ?, cost = ?, status = ? WHERE id = ?',
      [title, location || null, Number(progress || 0), start_date || null, target_date || null, Number(cost || 0), status || 'Planning', id],
    );
    const row = await get('SELECT * FROM projects WHERE id = ?', [id]);
    res.json(row);
  } catch (error) {
    console.error('projects update error', error);
    res.status(500).json({ error: 'DB error' });
  }
});

app.delete('/api/projects/:id', requireAuth, async (req, res) => {
  try {
    await run('DELETE FROM projects WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('projects delete error', error);
    res.status(500).json({ error: 'DB error' });
  }
});

app.get('/api/materials', requireAuth, async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const perPage = Math.max(1, Number.parseInt(req.query.perPage, 10) || 10);
    const search = String(req.query.search || '').trim();
    const category = String(req.query.category || '').trim();
    const date = String(req.query.date || '').trim();

    const filters = [];
    const params = [];

    if (search) {
      filters.push('(name LIKE ? OR code LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    if (category && category !== 'All') {
      filters.push('category = ?');
      params.push(category);
    }

    if (date) {
      filters.push('substr(created_at, 1, 10) = ?');
      params.push(date);
    }

    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const countRow = await get(`SELECT COUNT(*) AS count FROM materials ${where}`, params);
    const total = Number(countRow?.count || 0);
    const offset = (page - 1) * perPage;
    const rows = await all(
      `SELECT * FROM materials ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...params, perPage, offset],
    );

    res.json({ data: rows.map(materialRow), total, page, perPage });
  } catch (error) {
    console.error('materials index error', error);
    res.status(500).json({ error: 'DB error' });
  }
});

app.post('/api/materials', requireAuth, async (req, res) => {
  const {
    name,
    category = null,
    quantity = null,
    unit = null,
    cost = null,
    supplier = null,
    supplier_category = null,
    low_stock = false,
    lowStock = false,
  } = req.body || {};

  if (!name) {
    res.status(400).json({ error: 'Missing name' });
    return;
  }

  try {
    const result = await run(
      'INSERT INTO materials (code, name, category, quantity, unit, cost, supplier, supplier_category, low_stock, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        null,
        name,
        category || null,
        quantity || null,
        unit || null,
        cost || null,
        supplier || null,
        supplier_category || null,
        toSqliteBoolean(Boolean(low_stock || lowStock)),
        nowIso(),
      ],
    );

    const code = `MAT-${String(result.lastID).padStart(5, '0')}`;
    await run('UPDATE materials SET code = ? WHERE id = ?', [code, result.lastID]);
    const row = await get('SELECT * FROM materials WHERE id = ?', [result.lastID]);
    res.status(201).json(materialRow(row));
  } catch (error) {
    console.error('materials create error', error);
    res.status(500).json({ error: 'DB error' });
  }
});

app.put('/api/materials/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const current = req.body || {};

  if (!current.name) {
    res.status(400).json({ error: 'Missing name' });
    return;
  }

  try {
    await run(
      'UPDATE materials SET name = ?, category = ?, quantity = ?, unit = ?, cost = ?, supplier = ?, supplier_category = ?, low_stock = ? WHERE id = ?',
      [
        current.name,
        current.category || null,
        current.quantity || null,
        current.unit || null,
        current.cost || null,
        current.supplier || null,
        current.supplier_category || null,
        toSqliteBoolean(Boolean(current.low_stock || current.lowStock)),
        id,
      ],
    );
    const row = await get('SELECT * FROM materials WHERE id = ?', [id]);
    res.json(materialRow(row));
  } catch (error) {
    console.error('materials update error', error);
    res.status(500).json({ error: 'DB error' });
  }
});

app.delete('/api/materials/:id', requireAuth, async (req, res) => {
  try {
    await run('DELETE FROM materials WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('materials delete error', error);
    res.status(500).json({ error: 'DB error' });
  }
});

app.get('/api/expenses', requireAuth, async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const perPage = Math.max(1, Number.parseInt(req.query.perPage, 10) || 10);
    const search = String(req.query.search || '').trim();
    const project = String(req.query.project || '').trim();
    const category = String(req.query.category || '').trim();
    const date = String(req.query.date || '').trim();

    const filters = [];
    const params = [];

    if (search) {
      filters.push('(description LIKE ? OR project LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    if (project && project !== 'All') {
      filters.push('project = ?');
      params.push(project);
    }

    if (category && category !== 'All') {
      filters.push('category = ?');
      params.push(category);
    }

    if (date) {
      filters.push('date = ?');
      params.push(date);
    }

    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const countRow = await get(`SELECT COUNT(*) AS count FROM expenses ${where}`, params);
    const total = Number(countRow?.count || 0);
    const offset = (page - 1) * perPage;
    const rows = await all(
      `SELECT * FROM expenses ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...params, perPage, offset],
    );

    res.json({ data: rows.map(expenseRow), total, page, perPage });
  } catch (error) {
    console.error('expenses index error', error);
    res.status(500).json({ error: 'DB error' });
  }
});

app.post('/api/expenses', requireAuth, async (req, res) => {
  const {
    date = null,
    project = null,
    category = null,
    description = null,
    amount = 0,
    status = 'Unpaid',
  } = req.body || {};

  try {
    const result = await run(
      'INSERT INTO expenses (date, project, category, description, amount, status) VALUES (?, ?, ?, ?, ?, ?)',
      [date || null, project || null, category || null, description || null, Math.round(Number(amount || 0) * 100), status || 'Unpaid'],
    );
    const row = await get('SELECT * FROM expenses WHERE id = ?', [result.lastID]);
    res.status(201).json(expenseRow(row));
  } catch (error) {
    console.error('expenses create error', error);
    res.status(500).json({ error: 'DB error' });
  }
});

app.put('/api/expenses/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const current = req.body || {};

  try {
    await run(
      'UPDATE expenses SET date = ?, project = ?, category = ?, description = ?, amount = ?, status = ? WHERE id = ?',
      [
        current.date || null,
        current.project || null,
        current.category || null,
        current.description || null,
        Math.round(Number(current.amount || 0) * 100),
        current.status || 'Unpaid',
        id,
      ],
    );
    const row = await get('SELECT * FROM expenses WHERE id = ?', [id]);
    res.json(expenseRow(row));
  } catch (error) {
    console.error('expenses update error', error);
    res.status(500).json({ error: 'DB error' });
  }
});

app.delete('/api/expenses/:id', requireAuth, async (req, res) => {
  try {
    await run('DELETE FROM expenses WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('expenses delete error', error);
    res.status(500).json({ error: 'DB error' });
  }
});

app.get('/api/categories', requireAuth, async (req, res) => {
  try {
    const includeInactive = ['1', 'true', 'yes'].includes(String(req.query.includeInactive || '').toLowerCase());
    const rows = includeInactive
      ? await all('SELECT * FROM categories ORDER BY name ASC')
      : await all('SELECT * FROM categories WHERE status = ? ORDER BY name ASC', ['Active']);

    res.json({ data: rows });
  } catch (error) {
    console.error('categories index error', error);
    res.status(500).json({ error: 'DB error' });
  }
});

app.post('/api/categories', requireAuth, async (req, res) => {
  const { name, description = null, status = 'Active' } = req.body || {};
  const cleanName = normalizeRecordName(name);

  if (!cleanName) {
    res.status(400).json({ error: 'Category name is required.' });
    return;
  }

  try {
    const existing = await get('SELECT id FROM categories WHERE lower(name) = lower(?) LIMIT 1', [cleanName]);
    if (existing) {
      res.status(422).json({ error: 'This category already exists.' });
      return;
    }

    const result = await run(
      'INSERT INTO categories (name, description, status) VALUES (?, ?, ?)',
      [cleanName, description || null, normalizeStatus(status)],
    );
    const row = await get('SELECT * FROM categories WHERE id = ?', [result.lastID]);
    res.status(201).json(row);
  } catch (error) {
    console.error('categories create error', error);
    res.status(500).json({ error: 'DB error' });
  }
});

app.put('/api/categories/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { name, description = null, status = 'Active' } = req.body || {};
  const cleanName = normalizeRecordName(name);

  if (!cleanName) {
    res.status(400).json({ error: 'Category name is required.' });
    return;
  }

  try {
    const current = await get('SELECT * FROM categories WHERE id = ?', [id]);
    if (!current) {
      res.status(404).json({ error: 'Category not found.' });
      return;
    }

    const existing = await get('SELECT id FROM categories WHERE lower(name) = lower(?) AND id != ? LIMIT 1', [cleanName, id]);
    if (existing) {
      res.status(422).json({ error: 'This category already exists.' });
      return;
    }

    await run(
      'UPDATE categories SET name = ?, description = ?, status = ? WHERE id = ?',
      [cleanName, description || null, normalizeStatus(status), id],
    );

    if (current.name !== cleanName) {
      await run('UPDATE materials SET category = ? WHERE category = ?', [cleanName, current.name]);
    }

    const row = await get('SELECT * FROM categories WHERE id = ?', [id]);
    res.json(row);
  } catch (error) {
    console.error('categories update error', error);
    res.status(500).json({ error: 'DB error' });
  }
});

app.delete('/api/categories/:id', requireAuth, async (req, res) => {
  try {
    const current = await get('SELECT * FROM categories WHERE id = ?', [req.params.id]);
    if (!current) {
      res.status(404).json({ error: 'Category not found.' });
      return;
    }

    const usage = await get('SELECT COUNT(*) AS count FROM materials WHERE category = ?', [current.name]);
    if (Number(usage?.count || 0) > 0) {
      res.status(422).json({ error: 'This category is still used by materials. Reassign those materials first.' });
      return;
    }

    await run('DELETE FROM categories WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('categories delete error', error);
    res.status(500).json({ error: 'DB error' });
  }
});

app.get('/api/system/options', requireAuth, async (_req, res) => {
  try {
    const expenseRecords = await getSystemRecords('daily_expense_categories');
    const projectStatusRecords = await getSystemRecords('project_statuses');
    const unitRecords = await getSystemRecords('unit_categories');

    res.json({
      materials_categories: DEFAULT_MATERIAL_CATEGORIES,
      daily_expense_categories: activeSystemNames(expenseRecords),
      daily_expense_category_records: expenseRecords,
      supplier_categories: DEFAULT_SYSTEM_OPTIONS.supplier_categories,
      user_roles: DEFAULT_SYSTEM_OPTIONS.user_roles,
      project_statuses: activeSystemNames(projectStatusRecords),
      project_status_records: projectStatusRecords,
      payment_statuses: DEFAULT_SYSTEM_OPTIONS.payment_statuses,
      unit_categories: activeSystemNames(unitRecords),
      unit_category_records: unitRecords,
      transaction_types: DEFAULT_SYSTEM_OPTIONS.transaction_types,
      report_types: DEFAULT_SYSTEM_OPTIONS.report_types,
    });
  } catch (error) {
    console.error('system options error', error);
    res.status(500).json({ error: 'Unable to load system options' });
  }
});

app.post('/api/system/options/:group/items', requireAuth, async (req, res) => {
  const { group } = req.params;
  if (!MUTABLE_SYSTEM_GROUPS.includes(group)) {
    res.status(422).json({ error: 'This category group is not editable.' });
    return;
  }

  const name = normalizeRecordName(req.body?.name);
  const status = normalizeStatus(req.body?.status);
  if (!name) {
    res.status(400).json({ error: 'Category name is required.' });
    return;
  }

  try {
    const items = await getSystemRecords(group);
    const exists = items.some((item) => item.name.toLowerCase() === name.toLowerCase());
    if (exists) {
      res.status(422).json({ error: 'This category already exists.' });
      return;
    }

    const updated = [...items, { name, status }];
    await saveSystemRecords(group, updated);
    const records = await getSystemRecords(group);
    res.status(201).json({ group, items: activeSystemNames(records), records });
  } catch (error) {
    console.error('system option create error', error);
    res.status(500).json({ error: 'Unable to save category item.' });
  }
});

app.put('/api/system/options/:group/items/:item', requireAuth, async (req, res) => {
  const { group, item } = req.params;
  if (!MUTABLE_SYSTEM_GROUPS.includes(group)) {
    res.status(422).json({ error: 'This category group is not editable.' });
    return;
  }

  const currentName = decodeURIComponent(item);
  const nextName = normalizeRecordName(req.body?.name);
  const nextStatus = normalizeStatus(req.body?.status);
  if (!nextName) {
    res.status(400).json({ error: 'Category name is required.' });
    return;
  }

  try {
    const items = await getSystemRecords(group);
    const currentIndex = items.findIndex((entry) => entry.name.toLowerCase() === currentName.toLowerCase());
    if (currentIndex === -1) {
      res.status(404).json({ error: 'Category item not found.' });
      return;
    }

    const duplicate = items.some((entry, index) => index !== currentIndex && entry.name.toLowerCase() === nextName.toLowerCase());
    if (duplicate) {
      res.status(422).json({ error: 'This category already exists.' });
      return;
    }

    items[currentIndex] = { name: nextName, status: nextStatus };
    await renameReferenceUsage(group, currentName, nextName);
    await saveSystemRecords(group, items);
    const records = await getSystemRecords(group);
    res.json({ group, items: activeSystemNames(records), records });
  } catch (error) {
    console.error('system option update error', error);
    res.status(500).json({ error: 'Unable to update category item.' });
  }
});

app.delete('/api/system/options/:group/items/:item', requireAuth, async (req, res) => {
  const { group, item } = req.params;
  if (!MUTABLE_SYSTEM_GROUPS.includes(group)) {
    res.status(422).json({ error: 'This category group is not editable.' });
    return;
  }

  const currentName = decodeURIComponent(item);
  try {
    const usage = await getReferenceUsage(group, currentName);
    if (usage > 0) {
      res.status(422).json({ error: 'This category is still used by existing records. Reassign those records first.' });
      return;
    }

    const items = await getSystemRecords(group);
    const filtered = items.filter((entry) => entry.name.toLowerCase() !== currentName.toLowerCase());
    if (filtered.length === items.length) {
      res.status(404).json({ error: 'Category item not found.' });
      return;
    }

    await saveSystemRecords(group, filtered);
    const records = await getSystemRecords(group);
    res.json({ group, items: activeSystemNames(records), records });
  } catch (error) {
    console.error('system option delete error', error);
    res.status(500).json({ error: 'Unable to delete category item.' });
  }
});

app.get('/api/settings/company', requireAuth, async (_req, res) => {
  try {
    const settings = await get('SELECT * FROM company_settings WHERE id = 1');
    res.json({
      name: settings?.name || COMPANY_NAME,
      address: settings?.address || '',
      contact: settings?.contact || '',
      email: settings?.email || '',
    });
  } catch (error) {
    console.error('company settings load error', error);
    res.status(500).json({ error: 'Unable to load company profile' });
  }
});

app.put('/api/settings/company', requireAuth, async (req, res) => {
  const { name, address = '', contact = '', email = '' } = req.body || {};
  if (!name) {
    res.status(400).json({ error: 'Company name is required' });
    return;
  }

  try {
    const existing = await get('SELECT id FROM company_settings WHERE id = 1');
    const timestamp = nowIso();
    if (existing) {
      await run(
        'UPDATE company_settings SET name = ?, address = ?, contact = ?, email = ?, updated_at = ? WHERE id = 1',
        [name, address, contact, email, timestamp],
      );
    } else {
      await run(
        'INSERT INTO company_settings (id, name, address, contact, email, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [1, name, address, contact, email, timestamp, timestamp],
      );
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('company settings save error', error);
    res.status(500).json({ error: 'Unable to update company profile' });
  }
});

app.get('/api/admin/account', requireAdmin, async (_req, res) => {
  try {
    const user = await get('SELECT id, username, email, name FROM users WHERE id = 1');
    if (!user) {
      res.status(404).json({ error: 'Admin user not found' });
      return;
    }

    res.json(user);
  } catch (error) {
    console.error('admin account load error', error);
    res.status(500).json({ error: 'Unable to load account settings' });
  }
});

app.post('/api/admin/credentials', requireAdmin, async (req, res) => {
  const { username, email, password } = req.body || {};
  const cleanUsername = normalizeRecordName(username);
  const cleanEmail = normalizeRecordName(email);

  if (!cleanUsername) {
    res.status(400).json({ error: 'Username is required' });
    return;
  }

  if (!cleanEmail) {
    res.status(400).json({ error: 'Recovery Gmail is required' });
    return;
  }

  if (password && String(password).length < 3) {
    res.status(400).json({ error: 'New password must be at least 3 characters' });
    return;
  }

  try {
    const usernameTaken = await get('SELECT id FROM users WHERE lower(username) = lower(?) AND id != 1', [cleanUsername]);
    if (usernameTaken) {
      res.status(422).json({ error: 'That username is already in use.' });
      return;
    }

    const emailTaken = await get('SELECT id FROM users WHERE lower(email) = lower(?) AND id != 1', [cleanEmail]);
    if (emailTaken) {
      res.status(422).json({ error: 'That email is already in use.' });
      return;
    }

    const updates = ['username = ?', 'email = ?'];
    const params = [cleanUsername, cleanEmail];
    if (password) {
      const passwordHash = await bcrypt.hash(password, 10);
      updates.push('password = ?');
      params.push(passwordHash);
    }
    params.push(1);

    await run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
    res.json({ ok: true });
  } catch (error) {
    console.error('admin credentials save error', error);
    res.status(500).json({ error: 'Unable to update admin credentials' });
  }
});

app.post('/api/backup', requireAdmin, async (_req, res) => {
  try {
    const snapshot = await createBackupSnapshot();
    const filename = `backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    fs.writeFileSync(path.join(backupsDir, filename), JSON.stringify(snapshot, null, 2), 'utf8');
    res.json({ ok: true, file: filename });
  } catch (error) {
    console.error('backup create error', error);
    res.status(500).json({ error: 'Backup failed' });
  }
});

app.get('/api/backup/download', requireAdmin, async (_req, res) => {
  try {
    const files = fs.readdirSync(backupsDir)
      .filter((file) => file.endsWith('.json'))
      .map((file) => ({
        file,
        time: fs.statSync(path.join(backupsDir, file)).mtimeMs,
      }))
      .sort((left, right) => right.time - left.time);

    if (!files.length) {
      res.status(404).json({ error: 'No backups found' });
      return;
    }

    const latest = files[0].file;
    res.download(path.join(backupsDir, latest), latest);
  } catch (error) {
    console.error('backup download error', error);
    res.status(500).json({ error: 'No backups available' });
  }
});

app.post('/api/backup/cleanup', requireAdmin, async (req, res) => {
  try {
    const days = Math.max(1, Number.parseInt(req.query.days, 10) || 30);
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    let removed = 0;

    for (const file of fs.readdirSync(backupsDir)) {
      const fullPath = path.join(backupsDir, file);
      if (!file.endsWith('.json')) continue;
      const stat = fs.statSync(fullPath);
      if (stat.mtimeMs < cutoff) {
        fs.unlinkSync(fullPath);
        removed += 1;
      }
    }

    res.json({ ok: true, removed });
  } catch (error) {
    console.error('backup cleanup error', error);
    res.status(500).json({ error: 'Unable to read backups' });
  }
});

app.post('/api/backup/restore', requireAdmin, async (req, res) => {
  const snapshot = req.body?.snapshot;
  if (!snapshot || typeof snapshot !== 'object') {
    res.status(422).json({ error: 'Invalid backup file format.' });
    return;
  }

  for (const key of ['users', 'projects', 'materials', 'expenses']) {
    if (!Array.isArray(snapshot[key])) {
      res.status(422).json({ error: 'Backup file is missing required data.' });
      return;
    }
  }

  try {
    await restoreBackupSnapshot(snapshot);
    res.json({
      ok: true,
      message: 'Backup restored successfully. The system now reflects the uploaded snapshot.',
      restored_at: nowIso(),
    });
  } catch (error) {
    console.error('backup restore error', error);
    res.status(500).json({ error: 'Unable to restore backup' });
  }
});

if (hasBundledFrontend()) {
  app.use(express.static(clientDistPath));
  app.get(/^(?!\/api(?:\/|$)).*/, (_req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Offline BuildTrack server running on http://127.0.0.1:${PORT}`);
      if (hasBundledFrontend()) {
        console.log(`Bundled frontend detected. Open http://127.0.0.1:${PORT} on this PC.`);
      } else {
        console.log(`Frontend bundle not found yet. Run "npm run build" for single-server deployment.`);
      }
      if (JWT_SECRET === 'dev-secret-change-me') {
        console.warn('Security warning: JWT_SECRET is using the default value. Set a unique secret in server/.env before deployment.');
      }
      if (ADMIN_INITIAL_PASSWORD === '1234') {
        console.warn('Security warning: default admin password is still 1234. Change it in Settings before deployment.');
      }
    });
  })
  .catch((error) => {
    console.error('Failed to initialize offline database', error);
    process.exit(1);
  });
