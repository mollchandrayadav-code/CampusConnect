const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'campusconnect.db');
const db = new sqlite3.Database(dbPath);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

async function init() {
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('student','admin')),
      studentId TEXT,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const existingCount = await get('SELECT COUNT(*) AS count FROM users');

  if (existingCount.count === 0) {
    const studentHash = await bcrypt.hash('student123', 10);
    const adminHash = await bcrypt.hash('admin123', 10);

    await run(
      'INSERT INTO users (name, email, password, role, studentId) VALUES (?, ?, ?, ?, ?)',
      ['Student User', 'student@college.edu', studentHash, 'student', 'STU-1001']
    );

    await run(
      'INSERT INTO users (name, email, password, role, studentId) VALUES (?, ?, ?, ?, ?)',
      ['Admin User', 'admin@college.edu', adminHash, 'admin', null]
    );
  }
}

async function findUserByEmail(email) {
  const normalizedEmail = (email || '').trim().toLowerCase();
  return get('SELECT * FROM users WHERE email = ?', [normalizedEmail]);
}

async function createUser({ name, email, password, role, studentId }) {
  const normalizedEmail = (email || '').trim().toLowerCase();
  const hashedPassword = await bcrypt.hash(password, 10);

  const result = await run(
    'INSERT INTO users (name, email, password, role, studentId) VALUES (?, ?, ?, ?, ?)',
    [name, normalizedEmail, hashedPassword, role, studentId || null]
  );

  return {
    id: result.id,
    name,
    email: normalizedEmail,
    role,
    studentId: studentId || null
  };
}

async function getUserById(id) {
  return get('SELECT * FROM users WHERE id = ?', [id]);
}

async function getStudents() {
  return all(
    'SELECT id, name, email, studentId, createdAt FROM users WHERE role = ? ORDER BY name',
    ['student']
  );
}

module.exports = {
  db,
  init,
  run,
  get,
  all,
  findUserByEmail,
  createUser,
  getUserById,
  getStudents
};
