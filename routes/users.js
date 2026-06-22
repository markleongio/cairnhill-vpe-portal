// routes/users.js
const express = require('express');
const bcrypt = require('bcryptjs');
const { all, get, run } = require('../db/db');

const router = express.Router();

// List all user accounts (never returns password_hash)
router.get('/', async (req, res) => {
  try {
    const rows = await all(
      'SELECT u.id, u.username, u.role, u.member_id, u.created_at, u.last_login_at, m.full_name AS member_name ' +
      'FROM users u LEFT JOIN members m ON u.member_id = m.id ORDER BY u.username'
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const b = req.body;
    if (!b.username || !b.password) {
      return res.status(400).json({ error: '用户名和密码必填 / username and password required' });
    }
    const existing = await get('SELECT id FROM users WHERE username = ?', [b.username]);
    if (existing) {
      return res.status(409).json({ error: '用户名已存在 / Username already taken' });
    }
    const hash = bcrypt.hashSync(b.password, 10);
    const result = await run(
      'INSERT INTO users (username, password_hash, member_id, role) VALUES (?,?,?,?)',
      [b.username, hash, b.member_id || null, b.role || 'admin']
    );
    res.json({ id: result.lastInsertRowid });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update username / role / linked member / (optionally) password
router.put('/:id', async (req, res) => {
  try {
    const b = req.body;
    const updates = [];
    const params = [];

    if (b.username !== undefined) { updates.push('username = ?'); params.push(b.username); }
    if (b.role !== undefined) { updates.push('role = ?'); params.push(b.role); }
    if (b.member_id !== undefined) { updates.push('member_id = ?'); params.push(b.member_id || null); }
    if (b.password) { updates.push('password_hash = ?'); params.push(bcrypt.hashSync(b.password, 10)); }

    if (!updates.length) return res.status(400).json({ error: 'No fields to update' });
    params.push(req.params.id);
    await run('UPDATE users SET ' + updates.join(', ') + ' WHERE id = ?', params);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete a user account. Admins can delete other admins (per requirement),
// but we block deleting your own currently-logged-in account to avoid
// accidentally locking yourself out with no one left to log back in as.
router.delete('/:id', async (req, res) => {
  try {
    if (Number(req.params.id) === req.session.userId) {
      return res.status(400).json({ error: '不能删除自己当前登录的账号 / Cannot delete the account you are currently logged in as' });
    }
    await run('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
