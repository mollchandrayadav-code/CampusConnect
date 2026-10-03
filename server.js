const express = require('express');
const session = require('express-session');
const path = require('path');
const auth = require('./auth');
const database = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

const companyCatalog = [
  {
    name: 'TCS',
    role: 'Software Engineer',
    package: '6-12 LPA',
    location: 'Noida',
    skills: ['c', 'java', 'sql', 'data structures', 'oop']
  },
  {
    name: 'Infosys',
    role: 'System Engineer',
    package: '5-10 LPA',
    location: 'Bangalore',
    skills: ['python', 'java', 'dbms', 'oops', 'problem solving']
  },
  {
    name: 'Wipro',
    role: 'IT Services',
    package: '4-9 LPA',
    location: 'Gurgaon',
    skills: ['python', 'html', 'css', 'excel', 'c']
  },
  {
    name: 'Microsoft',
    role: 'Product Engineer',
    package: '12-25 LPA',
    location: 'Hyderabad',
    skills: ['c++', 'dsa', 'system design', 'cloud', 'python']
  },
  {
    name: 'Google',
    role: 'SDE Intern',
    package: '18-30 LPA',
    location: 'Bangalore',
    skills: ['dsa', 'c++', 'java', 'system design']
  }
];

function normalizeSkill(skill = '') {
  return String(skill).trim().toLowerCase();
}

function getProfileSkills(req) {
  const savedSkills = req.session && req.session.profileSkills ? req.session.profileSkills : [
    'c', 'python', 'java', 'html', 'css'
  ];

  return Array.isArray(savedSkills) ? savedSkills : String(savedSkills).split(',');
}

function scoreCompanyMatch(company, profileSkills) {
  const normalizedProfile = profileSkills.map(normalizeSkill).filter(Boolean);
  const normalizedCompanySkills = company.skills.map(normalizeSkill).filter(Boolean);

  const overlap = normalizedCompanySkills.filter((skill) => normalizedProfile.includes(skill)).length;
  const total = normalizedCompanySkills.length || 1;
  const match = Math.round((overlap / total) * 100);

  return {
    ...company,
    match,
    overlap
  };
}

(async () => {
  await database.init();

  app.use((req, res, next) => {
    const origin = req.headers.origin;
    const isLocalOrigin = origin === 'null' || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin || '');

    if (isLocalOrigin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    }

    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(session({
    secret: 'campusconnect-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 8
    }
  }));

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'CampusConnect backend is running.' });
  });

  app.post('/api/register', async (req, res) => {
    const { name, email, password, role, studentId } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'Please fill in all required fields.'
      });
    }

    try {
      const user = await auth.registerUser({
        name,
        email,
        password,
        role,
        studentId
      });

      return res.status(201).json({
        success: true,
        message: 'Registration successful! Please login.',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message || 'Registration failed.'
      });
    }
  });

  app.post('/api/login', async (req, res) => {
    const { email = '', password = '', role = '', studentId = '' } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please enter both email and password.'
      });
    }

    if (role === 'student' && !studentId.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Please enter your Student ID.'
      });
    }

    try {
      let user;
      let accountCreated = false;

      if (role === 'student') {
        const result = await auth.authenticateStudent({ email, password, studentId });
        user = result.user;
        accountCreated = result.created;
      } else {
        user = await auth.validateUser(email, password);
      }

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'That email already has an account. Enter the password you chose when you first signed in.'
        });
      }

      if (role && user.role !== role) {
        return res.status(403).json({
          success: false,
          message: 'This account does not match the selected role.'
        });
      }

      req.session.user = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      };

      const redirectMap = {
        student: '/student-dashboard',
        admin: '/admin-dashboard'
      };

      return res.json({
        success: true,
        message: accountCreated ? 'Student account created. You are now logged in.' : 'Login successful!',
        role: user.role,
        accountCreated,
        redirect: redirectMap[user.role] || '/'
      });
    } catch (error) {
      console.error('Login request failed:', error);
      return res.status(500).json({
        success: false,
        message: 'The login service had an error. Please restart the server and try again.'
      });
    }
  });

  app.post('/api/logout', (req, res) => {
    req.session.destroy(() => {
      res.json({ success: true, message: 'Logged out successfully.' });
    });
  });

  app.get('/api/session', (req, res) => {
    if (!req.session.user) {
      return res.json({ loggedIn: false });
    }

    return res.json({
      loggedIn: true,
      user: req.session.user
    });
  });

  app.get('/api/admin/students', async (req, res) => {
    if (!req.session.user) {
      return res.status(401).json({ success: false, message: 'Please sign in.' });
    }

    if (req.session.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required.' });
    }

    try {
      return res.json({ success: true, students: await database.getStudents() });
    } catch (error) {
      console.error('Student list request failed:', error);
      return res.status(500).json({ success: false, message: 'Unable to load students.' });
    }
  });

  app.get('/api/recommendations', (req, res) => {
    const profileSkills = req.query.skills
      ? String(req.query.skills).split(',')
      : getProfileSkills(req);
    const ranked = companyCatalog
      .map((company) => scoreCompanyMatch(company, profileSkills))
      .sort((a, b) => b.match - a.match || b.overlap - a.overlap)
      .slice(0, 3);

    return res.json({
      success: true,
      recommendations: ranked.map((company) => ({
        name: company.name,
        role: company.role,
        package: company.package,
        location: company.location,
        match: company.match,
        skills: company.skills
      }))
    });
  });

  app.use(express.static(__dirname));

  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'code.html'));
  });

  app.get('/login', (req, res) => {
    if (req.session.user) {
      return res.redirect(req.session.user.role === 'admin' ? '/admin-dashboard' : '/student-dashboard');
    }
    res.sendFile(path.join(__dirname, 'login.html'));
  });

  app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'register.html'));
  });

  app.get('/student-dashboard', auth.requireAuth, (req, res) => {
    if (req.session.user.role !== 'student') return res.redirect('/admin-dashboard');
    res.sendFile(path.join(__dirname, 'student dashboard.html'));
  });

  app.get('/admin-dashboard', (req, res) => {
    if (req.session.user && req.session.user.role !== 'admin') {
      return res.redirect('/student-dashboard');
    }
    res.sendFile(path.join(__dirname, 'admin dashboard.html'));
  });

  app.get('/companies', auth.requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'companies.html'));
  });

  app.get('/drives', auth.requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'drives.html'));
  });

  app.get('/applications', auth.requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'applications.html'));
  });

  app.get('/profile', auth.requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'profile.html'));
  });

  app.get('/home', (req, res) => {
    res.redirect('/');
  });

  app.get('*', (req, res) => {
    res.redirect('/');
  });

  app.listen(PORT, () => {
    console.log(`CampusConnect running at http://localhost:${PORT}`);
  });
})();
