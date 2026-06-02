// server/routes/festivals.js
const express = require('express');
const crypto = require('crypto');
const pool = require('../db/connection');
const upload = require('../middleware/upload');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/festivals  - 전체 또는 region 필터
router.get('/', async (req, res) => {
  try {
    const { region } = req.query;
    let sql = 'SELECT * FROM festivals';
    const params = [];
    if (region) {
      sql += ' WHERE region = ?';
      params.push(region);
    }
    sql += ' ORDER BY start_date ASC';
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'DB 조회 실패' });
  }
});

// GET /api/festivals/:id
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM festivals WHERE id = ?',
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: '축제를 찾을 수 없습니다.' });
    }
    res.json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'DB 조회 실패' });
  }
});

// GET /api/festivals/region/:region  - 지역명으로 묶어서
router.get('/region/:region', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM festivals WHERE region = ? ORDER BY start_date ASC',
      [req.params.region]
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'DB 조회 실패' });
  }
});

// POST /api/festivals  (관리자만) - 직접 추가
router.post('/', requireAdmin, upload.single('thumbnail'), async (req, res) => {
  try {
    const {
      name, region, start_date, end_date, venue,
      lat, lng, parking, schedule, official_url, description
    } = req.body;
    if (!name || !region) {
      return res.status(400).json({ error: '축제명과 지역은 필수입니다.' });
    }
    const id = 'adm_' + crypto.randomBytes(6).toString('hex');
    const thumbnail = req.file ? `/uploads/${req.file.filename}` : null;
    let scheduleJson = null;
    if (schedule) {
      try { scheduleJson = JSON.stringify(JSON.parse(schedule)); }
      catch { scheduleJson = JSON.stringify([{ day: '1일차', events: [schedule] }]); }
    }
    await pool.query(
      `INSERT INTO festivals
        (id, name, region, start_date, end_date, venue, lat, lng, parking,
         schedule_json, thumbnail, official_url, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, name, region,
        start_date || null, end_date || null, venue || null,
        lat || null, lng || null, parking || null,
        scheduleJson, thumbnail, official_url || null, description || null
      ]
    );
    res.status(201).json({ id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '축제 추가 실패' });
  }
});

// DELETE /api/festivals/:id  (관리자만)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM festivals WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '축제를 찾을 수 없습니다.' });
    }
    res.json({ ok: true });
  } catch (e) {
    console.error('축제 삭제 실패:', e);
    res.status(500).json({ error: `축제 삭제 실패: ${e.code || e.message}` });
  }
});

module.exports = router;
