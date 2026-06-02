// server/routes/auth.js
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db/connection');

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password, nickname } = req.body;
    if (!email || !password || !nickname) {
      return res.status(400).json({ error: '이메일, 비밀번호, 닉네임은 필수입니다.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: '비밀번호는 8자 이상이어야 합니다.' });
    }

    const [exists] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (exists.length > 0) {
      return res.status(409).json({ error: '이미 가입된 이메일입니다.' });
    }

    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (email, password_hash, nickname) VALUES (?, ?, ?)',
      [email, hash, nickname]
    );
    res.status(201).json({ id: result.insertId, email, nickname });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '회원가입 실패' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0) {
      return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }
    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }
    const token = jwt.sign(
      { id: user.id, email: user.email, nickname: user.nickname, role: user.role || 'user' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
    res.json({
      token,
      user: { id: user.id, email: user.email, nickname: user.nickname, role: user.role || 'user', points: user.points }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '로그인 실패' });
  }
});

module.exports = router;
