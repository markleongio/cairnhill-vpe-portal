// server.js
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const path = require('path');
const { buildSslConfig } = require('./db/db');

const authRoutes = require('./routes/auth');
const memberRoutes = require('./routes/members');
const meetingRoutes = require('./routes/meetings');
const pathwayRoutes = require('./routes/pathways');
const excoRoutes = require('./routes/exco');
const resourceRoutes = require('./routes/resources');
const usersRoutes = require('./routes/users');
const mastersRoutes = require('./routes/masters');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Sessions are stored in MySQL (table auto-created as `sessions`) rather
// than in-memory, since Render's free tier can restart/sleep the process —
// an in-memory store would silently log everyone out on every restart.
const sessionStore = new MySQLStore({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: buildSslConfig(),
  createDatabaseTable: true,
});

sessionStore.onReady().then(() => {
  console.log('Session store connected.');
}).catch((err) => {
  console.error('Session store failed to connect:', err.message);
  console.error('Logins will not persist correctly until this is resolved — check DB_* env vars.');
});

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'cairnhill-vpe-dev-secret-change-in-prod',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 12, // 12 hours
      sameSite: 'lax',
    },
  })
);

// --- Auth gate for API routes -----------------------------------------------
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) return next();
  return res.status(401).json({ error: '未登录 / Not authenticated' });
}
function requireAdmin(req, res, next) {
  if (req.session && (req.session.role === 'admin' || req.session.role === 'exco')) return next();
  return res.status(403).json({ error: '权限不足 / Insufficient permissions' });
}

app.use('/api/auth', authRoutes);
app.use('/api/members', requireAuth, memberRoutes);
app.use('/api/meetings', requireAuth, meetingRoutes);
app.use('/api/pathways', requireAuth, pathwayRoutes);
app.use('/api/exco', requireAuth, excoRoutes);
app.use('/api/resources', requireAuth, resourceRoutes);
app.use('/api/users', requireAuth, usersRoutes);
app.use('/api/masters', requireAuth, mastersRoutes);

app.locals.requireAdmin = requireAdmin;

// --- Static frontend ---------------------------------------------------------
app.use(express.static(path.join(__dirname, 'public')));

app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log('Cairnhill VPE Portal running on port ' + PORT);
});
