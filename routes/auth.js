// routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const { get, run } = require('../db/db');

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: '请输入用户名和密码 / Username and password required' });
    }

    const user = await get('SELECT * FROM users WHERE username = ?', [username]);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: '用户名或密码错误 / Invalid username or password' });
    }

    req.session.userId = user.id;
    req.session.role = user.role;
    req.session.username = user.username;

    await run('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);

    const member = user.member_id
      ? await get('SELECT full_name, chinese_name FROM members WHERE id = ?', [user.member_id])
      : null;

    res.json({
      ok: true,
      user: { id: user.id, username: user.username, role: user.role, memberName: member ? member.full_name : null },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: '服务器错误 / Server error' });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

router.get('/session', (req, res) => {
  if (!req.session.userId) return res.json({ authenticated: false });
  res.json({
    authenticated: true,
    user: { id: req.session.userId, username: req.session.username, role: req.session.role },
  });
});

module.exports = router;
