// server/routes/requests.js
// 일반 사용자: 축제 추가 요청 작성
// 관리자: 요청 목록 조회, 승인, 거절
const express = require('express');
const crypto = require('crypto');
const pool = require('../db/connection');
const upload = require('../middleware/upload');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// POST /api/requests  (인증 필요, multipart) - 일반 사용자가 새 축제 추가 요청
router.post('/', requireAuth, upload.single('thumbnail'), async (req, res) => {
  try {
    const {
      name, region, start_date, end_date, venue,
      lat, lng, parking, schedule, official_url, description
    } = req.body;

    if (!name || !region) {
      return res.status(400).json({ error: '축제명과 지역은 필수입니다.' });
    }

    const thumbnail = req.file ? `/uploads/${req.file.filename}` : null;
    let scheduleJson = null;
    if (schedule) {
      try { scheduleJson = JSON.stringify(JSON.parse(schedule)); }
      catch { scheduleJson = JSON.stringify([{ day: '1일차', events: [schedule] }]); }
    }

    const [result] = await pool.query(
      `INSERT INTO festival_requests
        (requester_id, name, region, start_date, end_date, venue,
         lat, lng, parking, schedule_json, thumbnail, official_url, description, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        req.user.id, name, region,
        start_date || null, end_date || null, venue || null,
        lat || null, lng || null, parking || null,
        scheduleJson, thumbnail, official_url || null, description || null
      ]
    );
    res.status(201).json({ id: result.insertId, status: 'pending' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '요청 등록 실패' });
  }
});

// GET /api/requests/mine - 내가 낸 요청들
router.get('/mine', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM festival_requests WHERE requester_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '조회 실패' });
  }
});

// GET /api/requests  (관리자) - status 필터 (기본 pending)
router.get('/', requireAdmin, async (req, res) => {
  try {
    const status = req.query.status || 'pending';
    const [rows] = await pool.query(
      `SELECT r.*, u.nickname AS requester_nickname, u.email AS requester_email
       FROM festival_requests r
       JOIN users u ON u.id = r.requester_id
       WHERE r.status = ?
       ORDER BY r.created_at DESC`,
      [status]
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '조회 실패' });
  }
});

// POST /api/requests/:id/approve  (관리자) - 승인 시 festivals로 복사
router.post('/:id/approve', requireAdmin, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
      'SELECT * FROM festival_requests WHERE id = ? AND status = "pending"',
      [req.params.id]
    );
    if (rows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: '대기 중인 요청이 없습니다.' });
    }
    const r = rows[0];
    const newId = 'req_' + crypto.randomBytes(6).toString('hex');

    await conn.query(
      `INSERT INTO festivals
        (id, name, region, start_date, end_date, venue, lat, lng, parking,
         schedule_json, thumbnail, official_url, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newId, r.name, r.region, r.start_date, r.end_date, r.venue,
        r.lat, r.lng, r.parking, r.schedule_json, r.thumbnail,
        r.official_url, r.description
      ]
    );
    await conn.query(
      `UPDATE festival_requests SET status='approved', reviewed_at=NOW() WHERE id=?`,
      [req.params.id]
    );
    await conn.commit();
    res.json({ ok: true, festival_id: newId });
  } catch (e) {
    await conn.rollback();
    console.error(e);
    res.status(500).json({ error: '승인 처리 실패' });
  } finally {
    conn.release();
  }
});

// POST /api/requests/:id/reject  (관리자)
router.post('/:id/reject', requireAdmin, async (req, res) => {
  try {
    const reason = req.body.reason || '';
    const [result] = await pool.query(
      `UPDATE festival_requests
       SET status='rejected', reject_reason=?, reviewed_at=NOW()
       WHERE id=? AND status='pending'`,
      [reason, req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '대기 중인 요청이 없습니다.' });
    }
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '거절 처리 실패' });
  }
});

module.exports = router;
