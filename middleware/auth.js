// middleware/auth.js
// Shared session-auth middleware. Previously requireAuth/requireAdmin were
// defined inline in server.js and requireAdmin was never actually wired to
// any route (it only ever got attached to app.locals, which nothing read) —
// meaning any logged-in account, including 'viewer' role, could hit every
// mutating endpoint in the API (masters, users, pathways, etc). Pulling
// these into their own module so route files can import requireAdmin
// directly and apply it per-route.

function requireAuth(req, res, next) {
  if (req.session && req.session.userId) return next();
  return res.status(401).json({ error: '未登录 / Not authenticated' });
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.role === 'admin') return next();
  return res.status(403).json({ error: '权限不足 / Insufficient permissions' });
}

module.exports = { requireAuth, requireAdmin };
