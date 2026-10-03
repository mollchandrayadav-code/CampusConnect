const bcrypt = require('bcryptjs');
const database = require('./database');

function isAuthenticated(req) {
  return !!req.session && !!req.session.user;
}

function requireAuth(req, res, next) {
  if (!isAuthenticated(req)) {
    return res.redirect('/login');
  }
  next();
}

function requireRole(role) {
  return (req, res, next) => {
    if (!isAuthenticated(req)) {
      return res.redirect('/login');
    }

    if (req.session.user.role !== role) {
      return res.status(403).send('Access denied');
    }

    next();
  };
}

async function registerUser({ name, email, password, role, studentId }) {
  const normalizedEmail = (email || '').trim().toLowerCase();
  const existing = await database.findUserByEmail(normalizedEmail);

  if (existing) {
    throw new Error('User already exists.');
  }

  return database.createUser({
    name: (name || '').trim(),
    email: normalizedEmail,
    password,
    role,
    studentId: role === 'student' ? studentId : null
  });
}

async function validateUser(email, password) {
  const user = await database.findUserByEmail(email);
  if (!user) return null;

  const match = await bcrypt.compare(password, user.password);
  if (!match) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    studentId: user.studentId
  };
}

async function authenticateStudent({ email, password, studentId }) {
  const normalizedEmail = (email || '').trim().toLowerCase();
  const existing = await database.findUserByEmail(normalizedEmail);

  if (existing) {
    return {
      user: await validateUser(normalizedEmail, password),
      created: false
    };
  }

  try {
    const user = await database.createUser({
      name: normalizedEmail.split('@')[0],
      email: normalizedEmail,
      password,
      role: 'student',
      studentId: (studentId || '').trim()
    });

    return { user, created: true };
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT') {
      return {
        user: await validateUser(normalizedEmail, password),
        created: false
      };
    }

    throw error;
  }
}

module.exports = {
  registerUser,
  validateUser,
  authenticateStudent,
  requireAuth,
  requireRole,
  isAuthenticated
};
