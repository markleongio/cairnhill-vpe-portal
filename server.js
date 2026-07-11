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
const clubRoutes = require('./routes/club');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Sessions are stored in MySQL (table auto-created as `sessions`) rather
// than in-memory, since Render's free tier can restart/sleep the process —
// an in-memory store would silently log everyone out on every restart.
// Pass the existing pool to MySQLStore instead of creating a new connection.
// This avoids a separate SSL negotiation inside express-mysql-session that
// doesn't inherit our SSL config correctly on TiDB Cloud Serverless.
const { pool: dbPool } = require('./db/db');
const sessionStore = new MySQLStore({ createDatabaseTable: true }, dbPool);

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
const { requireAuth, requireAdmin } = require('./middleware/auth');

app.use('/api/auth', authRoutes);
app.use('/api/members', requireAuth, memberRoutes);
app.use('/api/meetings', requireAuth, meetingRoutes);
app.use('/api/pathways', requireAuth, pathwayRoutes);
app.use('/api/exco', requireAuth, excoRoutes);
app.use('/api/resources', requireAuth, resourceRoutes);
app.use('/api/users', requireAuth, usersRoutes);
app.use('/api/masters', requireAuth, mastersRoutes);
app.use('/api/club', requireAuth, clubRoutes);

app.locals.requireAdmin = requireAdmin;

// --- Static frontend ---------------------------------------------------------
app.use(express.static(path.join(__dirname, 'public')));

app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log('Cairnhill VPE Portal running on port ' + PORT);
});