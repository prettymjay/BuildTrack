const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const PORT = process.env.PORT || 4000;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_INITIAL_PASSWORD = process.env.ADMIN_INITIAL_PASSWORD || crypto.randomBytes(12).toString('hex');
const RESET_TOKEN_TTL_MINUTES = Number(process.env.RESET_TOKEN_TTL_MINUTES || 15);

const dbPath = path.join(__dirname, 'auth.db');
const db = new sqlite3.Database(dbPath);
const backupsDir = path.join(__dirname, 'backups');

// ensure backups directory exists
try { fs.mkdirSync(backupsDir, { recursive: true }); } catch (e) { console.error('Could not create backups dir', e); }

function initDb() {
  db.serialize(() => {
    db.run('PRAGMA foreign_keys = ON');

    db.run(
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        name TEXT,
        reset_token_hash TEXT,
        reset_token_expires_at INTEGER
      )`
    );

      // Projects table
      db.run(
        `CREATE TABLE IF NOT EXISTS projects (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT,
          location TEXT,
          progress INTEGER,
          start_date TEXT,
          target_date TEXT,
          cost INTEGER,
          status TEXT
        )`
      );

      // Materials table
      db.run(
        `CREATE TABLE IF NOT EXISTS materials (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          code TEXT,
          name TEXT,
          category TEXT,
          quantity TEXT,
          cost TEXT,
          supplier TEXT
        )`
      );

      // Expenses table
      db.run(
        `CREATE TABLE IF NOT EXISTS expenses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT,
          project TEXT,
          category TEXT,
          description TEXT,
          amount INTEGER,
          status TEXT
        )`
      );

      ensureUsersColumns(() => {
        db.get('SELECT * FROM users WHERE id = 1', (err, row) => {
          if (err) return console.error('DB check error', err);
          if (!row) {
            bcrypt.hash(ADMIN_INITIAL_PASSWORD, 10, (hashErr, hash) => {
              if (hashErr) return console.error('Hash error', hashErr);
              db.run(
                'INSERT INTO users (id, username, password, name) VALUES (?,?,?,?)',
                [1, ADMIN_USERNAME, hash, 'Administrator'],
                (insertErr) => {
                  if (insertErr) return console.error('Admin seed error', insertErr);
                  console.log(`Seeded bootstrap admin user: ${ADMIN_USERNAME}`);
                }
              );
            });
          }
        });
      });
  });
}

function ensureColumn(table, column, definition, next) {
  db.all(`PRAGMA table_info(${table})`, (err, rows) => {
    if (err) return next(err);
    const exists = (rows || []).some((row) => row.name === column);
    if (exists) return next(null);
    db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`, next);
  });
}

function ensureUsersColumns(next) {
  ensureColumn('users', 'reset_token_hash', 'TEXT', (err) => {
    if (err) return next(err);
    ensureColumn('users', 'reset_token_expires_at', 'INTEGER', next);
  });
}

function hashValue(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function getBearerToken(req) {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

function requireAuth(req, res, next) {
  const token = getBearerToken(req);
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.auth = jwt.verify(token, JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function requireAdmin(req, res, next) {
  return requireAuth(req, res, () => {
    if (req.auth?.id !== 1) return res.status(403).json({ error: 'Admin access required' });
    return next();
  });
}

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Missing credentials' });

  db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!row) return res.status(401).json({ error: 'Invalid credentials' });

    bcrypt.compare(password, row.password, (err, ok) => {
      if (err) return res.status(500).json({ error: 'Auth error' });
      if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

      const token = jwt.sign({ username: row.username, id: row.id }, JWT_SECRET, { expiresIn: '8h' });
      res.json({ token, user: { username: row.username, name: row.name } });
    });
  });
});

app.post('/api/password/forgot', (req, res) => {
  const { username } = req.body || {};
  if (!username) return res.status(400).json({ error: 'Missing username' });

  db.get('SELECT id FROM users WHERE username = ?', [username], (err, row) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!row) return res.json({ ok: true });

    const resetToken = crypto.randomBytes(24).toString('hex');
    const resetTokenHash = hashValue(resetToken);
    const expiresAt = Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000;

    db.run(
      'UPDATE users SET reset_token_hash = ?, reset_token_expires_at = ? WHERE id = ?',
      [resetTokenHash, expiresAt, row.id],
      (updateErr) => {
        if (updateErr) return res.status(500).json({ error: 'Database error' });
        res.json({ ok: true, resetToken, expiresInMinutes: RESET_TOKEN_TTL_MINUTES });
      }
    );
  });
});

app.post('/api/password/reset', (req, res) => {
  const { username, token, password } = req.body || {};
  if (!username || !token || !password) return res.status(400).json({ error: 'Missing fields' });

  db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!row) return res.status(400).json({ error: 'Invalid reset request' });

    const tokenMatches = row.reset_token_hash && row.reset_token_hash === hashValue(token);
    const tokenActive = row.reset_token_expires_at && Number(row.reset_token_expires_at) > Date.now();
    if (!tokenMatches || !tokenActive) return res.status(400).json({ error: 'Invalid or expired reset token' });

    bcrypt.hash(password, 10, (hashErr, hash) => {
      if (hashErr) return res.status(500).json({ error: 'Hash error' });
      db.run(
        'UPDATE users SET password = ?, reset_token_hash = NULL, reset_token_expires_at = NULL WHERE id = ?',
        [hash, row.id],
        (updateErr) => {
          if (updateErr) return res.status(500).json({ error: 'Database error' });
          res.json({ ok: true });
        }
      );
    });
  });
});

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Projects endpoints
app.get('/api/projects', requireAuth, (req, res) => {
  // Support pagination, search and sorting
  const page = Math.max(1, parseInt(req.query.page)) || 1;
  const perPage = Math.max(1, parseInt(req.query.perPage)) || 10;
  const search = (req.query.search || '').trim();
  const status = (req.query.status || '').trim();
  const sort = (req.query.sort || 'recent');

  const filters = [];
  let where = '';
  if (search) {
    filters.push(`(title LIKE '%' || ? || '%' OR location LIKE '%' || ? || '%')`);
  }
  if (status && status !== 'All') {
    filters.push(`status = ?`);
  }
  if (filters.length) where = 'WHERE ' + filters.join(' AND ');

  const orderBy = sort === 'cost' ? 'cost DESC' : (sort === 'progress' ? 'progress DESC' : 'id DESC');

  // Count total
  const countSql = `SELECT COUNT(*) as cnt FROM projects ${where}`;
  const countParams = [];
  if (search) { countParams.push(search, search); }
  if (status && status !== 'All') { countParams.push(status); }

  db.get(countSql, countParams, (err, countRow) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    const total = countRow ? countRow.cnt : 0;

    const offset = (page - 1) * perPage;
    const dataSql = `SELECT * FROM projects ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`;
    const dataParams = [];
    if (search) { dataParams.push(search, search); }
    if (status && status !== 'All') { dataParams.push(status); }
    dataParams.push(perPage, offset);

    db.all(dataSql, dataParams, (err2, rows) => {
      if (err2) return res.status(500).json({ error: 'DB error' });
      res.json({ data: rows, total, page, perPage });
    });
  });
});

// Materials endpoint with pagination + optional category/search
app.get('/api/materials', requireAuth, (req, res) => {
  const page = Math.max(1, parseInt(req.query.page)) || 1;
  const perPage = Math.max(1, parseInt(req.query.perPage)) || 10;
  const search = (req.query.search || '').trim();
  const category = (req.query.category || '').trim();

  const filters = [];
  let where = '';
  if (search) filters.push(`(name LIKE '%' || ? || '%' OR code LIKE '%' || ? || '%')`);
  if (category && category !== 'All') filters.push(`category = ?`);
  if (filters.length) where = 'WHERE ' + filters.join(' AND ');

  const countSql = `SELECT COUNT(*) as cnt FROM materials ${where}`;
  const countParams = [];
  if (search) { countParams.push(search, search); }
  if (category && category !== 'All') { countParams.push(category); }

  db.get(countSql, countParams, (err, countRow) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    const total = countRow ? countRow.cnt : 0;
    const offset = (page - 1) * perPage;
    const dataSql = `SELECT * FROM materials ${where} ORDER BY id DESC LIMIT ? OFFSET ?`;
    const dataParams = [];
    if (search) { dataParams.push(search, search); }
    if (category && category !== 'All') { dataParams.push(category); }
    dataParams.push(perPage, offset);

    db.all(dataSql, dataParams, (err2, rows) => {
      if (err2) return res.status(500).json({ error: 'DB error' });
      res.json({ data: rows, total, page, perPage });
    });
  });
});

// Create material
app.post('/api/materials', requireAuth, (req, res) => {
  const { code = '', name = '', category = '', quantity = '', cost = '', supplier = '' } = req.body || {};
  if (!code || !name) return res.status(400).json({ error: 'Missing code or name' });
  db.run(
    'INSERT INTO materials (code, name, category, quantity, cost, supplier) VALUES (?,?,?,?,?,?)',
    [code, name, category, quantity, cost, supplier],
    function(err) {
      if (err) return res.status(500).json({ error: 'DB error' });
      db.get('SELECT * FROM materials WHERE id = ?', [this.lastID], (err2, row) => {
        if (err2) return res.status(500).json({ error: 'DB error' });
        res.status(201).json(row);
      });
    }
  );
});

// Update material
app.put('/api/materials/:id', requireAuth, (req, res) => {
  const id = req.params.id;
  const { code = '', name = '', category = '', quantity = '', cost = '', supplier = '' } = req.body || {};
  db.run(
    `UPDATE materials SET code=?, name=?, category=?, quantity=?, cost=?, supplier=? WHERE id=?`,
    [code, name, category, quantity, cost, supplier, id],
    function(err) {
      if (err) return res.status(500).json({ error: 'DB error' });
      db.get('SELECT * FROM materials WHERE id = ?', [id], (err2, row) => {
        if (err2) return res.status(500).json({ error: 'DB error' });
        res.json(row);
      });
    }
  );
});

// Delete material
app.delete('/api/materials/:id', requireAuth, (req, res) => {
  const id = req.params.id;
  db.run('DELETE FROM materials WHERE id = ?', [id], function(err) {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json({ success: true });
  });
});

app.post('/api/projects', requireAuth, (req, res) => {
  const { title, location, progress = 0, start_date = '', target_date = '', cost = 0, status = 'Initializing' } = req.body || {};
  if (!title) return res.status(400).json({ error: 'Missing title' });

  db.run(
    'INSERT INTO projects (title, location, progress, start_date, target_date, cost, status) VALUES (?,?,?,?,?,?,?)',
    [title, location, progress, start_date, target_date, cost, status],
    function(err) {
      if (err) return res.status(500).json({ error: 'DB error' });
      db.get('SELECT * FROM projects WHERE id = ?', [this.lastID], (err2, row) => {
        if (err2) return res.status(500).json({ error: 'DB error' });
        res.status(201).json(row);
      });
    }
  );
});

// Create backup: copy the sqlite DB file to backups folder with timestamp
app.post('/api/backup', requireAdmin, (req, res) => {
  const ts = new Date().toISOString().replace(/[:.]/g,'-');
  const dest = path.join(backupsDir, `backup-${ts}.db`);
  fs.copyFile(dbPath, dest, (err) => {
    if (err) {
      console.error('Backup error', err);
      return res.status(500).json({ error: 'Backup failed' });
    }
    res.json({ ok: true, file: path.basename(dest) });
  });
});

// Download latest backup
app.get('/api/backup/download', requireAdmin, (req, res) => {
  fs.readdir(backupsDir, (err, files) => {
    if (err) return res.status(500).json({ error: 'No backups available' });
    const dbFiles = files.filter(f => f.endsWith('.db'));
    if (!dbFiles.length) return res.status(404).json({ error: 'No backups found' });
    // find latest by mtime
    let latest = null;
    let latestMtime = 0;
    dbFiles.forEach(f => {
      try{
        const st = fs.statSync(path.join(backupsDir, f));
        const m = st.mtimeMs || st.ctimeMs || 0;
        if (m > latestMtime) { latestMtime = m; latest = f; }
      }catch(e){/*skip*/}
    });
    if (!latest) return res.status(404).json({ error: 'No backups found' });
    const p = path.join(backupsDir, latest);
    res.download(p, latest, (err2) => { if (err2) console.error('Download error', err2); });
  });
});

// Cleanup backups older than X days (default 30 days)
app.post('/api/backup/cleanup', requireAdmin, (req, res) => {
  const days = parseInt(req.query.days) || 30;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  fs.readdir(backupsDir, (err, files) => {
    if (err) return res.status(500).json({ error: 'Unable to read backups' });
    let removed = 0;
    files.forEach(f => {
      const p = path.join(backupsDir, f);
      try{
        const st = fs.statSync(p);
        if (st.mtimeMs < cutoff) { fs.unlinkSync(p); removed++; }
      }catch(e){/*ignore*/}
    });
    res.json({ ok: true, removed });
  });
});

// Admin credential update endpoint
app.post('/api/admin/credentials', requireAdmin, (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Missing username or password' });

  // find the first user (seeded admin) and update it. In production, require the current admin id.
  db.get('SELECT id FROM users ORDER BY id LIMIT 1', (err, row) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    if (!row) return res.status(404).json({ error: 'No user to update' });
    const id = row.id;
    bcrypt.hash(password, 10, (err2, hash) => {
      if (err2) return res.status(500).json({ error: 'Hash error' });
      db.run('UPDATE users SET username = ?, password = ? WHERE id = ?', [username, hash, id], function(err3) {
        if (err3) return res.status(500).json({ error: 'DB update error' });
        res.json({ ok: true });
      });
    });
  });
});

// Update project
app.put('/api/projects/:id', requireAuth, (req, res) => {
  const id = req.params.id;
  const { title, location, progress, start_date, target_date, cost, status } = req.body || {};
  db.run(
    `UPDATE projects SET title=?, location=?, progress=?, start_date=?, target_date=?, cost=?, status=? WHERE id=?`,
    [title, location, progress, start_date, target_date, cost, status, id],
    function(err) {
      if (err) return res.status(500).json({ error: 'DB error' });
      db.get('SELECT * FROM projects WHERE id = ?', [id], (err2, row) => {
        if (err2) return res.status(500).json({ error: 'DB error' });
        res.json(row);
      });
    }
  );
});

// Delete project
app.delete('/api/projects/:id', requireAuth, (req, res) => {
  const id = req.params.id;
  db.run('DELETE FROM projects WHERE id = ?', [id], function(err) {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json({ success: true });
  });
});

// Expenses endpoints (paginated + filters)
app.get('/api/expenses', requireAuth, (req, res) => {
  const page = Math.max(1, parseInt(req.query.page)) || 1;
  const perPage = Math.max(1, parseInt(req.query.perPage)) || 10;
  const search = (req.query.search || '').trim();
  const project = (req.query.project || '').trim();
  const category = (req.query.category || '').trim();
  const date = (req.query.date || '').trim();

  const filters = [];
  let where = '';
  if (search) filters.push(`(description LIKE '%' || ? || '%' OR project LIKE '%' || ? || '%')`);
  if (project && project !== 'All') filters.push(`project = ?`);
  if (category && category !== 'All') filters.push(`category = ?`);
  if (date) filters.push(`date = ?`);
  if (filters.length) where = 'WHERE ' + filters.join(' AND ');

  const countSql = `SELECT COUNT(*) as cnt FROM expenses ${where}`;
  const countParams = [];
  if (search) { countParams.push(search, search); }
  if (project && project !== 'All') { countParams.push(project); }
  if (category && category !== 'All') { countParams.push(category); }
  if (date) { countParams.push(date); }

  db.get(countSql, countParams, (err, countRow) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    const total = countRow ? countRow.cnt : 0;
    const offset = (page - 1) * perPage;
    const dataSql = `SELECT * FROM expenses ${where} ORDER BY id DESC LIMIT ? OFFSET ?`;
    const dataParams = [];
    if (search) { dataParams.push(search, search); }
    if (project && project !== 'All') { dataParams.push(project); }
    if (category && category !== 'All') { dataParams.push(category); }
    if (date) { dataParams.push(date); }
    dataParams.push(perPage, offset);

    db.all(dataSql, dataParams, (err2, rows) => {
      if (err2) return res.status(500).json({ error: 'DB error' });
      res.json({ data: rows, total, page, perPage });
    });
  });
});

// Create expense
app.post('/api/expenses', requireAuth, (req, res) => {
  const { date = '', project = '', category = '', description = '', amount = 0, status = 'Recorded' } = req.body || {};
  const amt = Math.round((parseFloat(amount) || 0) * 100);
  db.run(
    'INSERT INTO expenses (date, project, category, description, amount, status) VALUES (?,?,?,?,?,?)',
    [date, project, category, description, amt, status],
    function(err) {
      if (err) return res.status(500).json({ error: 'DB error' });
      db.get('SELECT * FROM expenses WHERE id = ?', [this.lastID], (err2, row) => {
        if (err2) return res.status(500).json({ error: 'DB error' });
        res.status(201).json(row);
      });
    }
  );
});

// Update expense
app.put('/api/expenses/:id', requireAuth, (req, res) => {
  const id = req.params.id;
  const { date = '', project = '', category = '', description = '', amount = 0, status = 'Recorded' } = req.body || {};
  const amt = Math.round((parseFloat(amount) || 0) * 100);
  db.run(
    `UPDATE expenses SET date=?, project=?, category=?, description=?, amount=?, status=? WHERE id=?`,
    [date, project, category, description, amt, status, id],
    function(err) {
      if (err) return res.status(500).json({ error: 'DB error' });
      db.get('SELECT * FROM expenses WHERE id = ?', [id], (err2, row) => {
        if (err2) return res.status(500).json({ error: 'DB error' });
        res.json(row);
      });
    }
  );
});

// Delete expense
app.delete('/api/expenses/:id', requireAuth, (req, res) => {
  const id = req.params.id;
  db.run('DELETE FROM expenses WHERE id = ?', [id], function(err) {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json({ success: true });
  });
});

initDb();

app.listen(PORT, () => {
  console.log(`Auth server running on http://localhost:${PORT}`);
});
