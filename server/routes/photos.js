// server/routes/photos.js
const express = require('express');
const pool = require('../db/connection');
const upload = require('../middleware/upload');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/photos?festival_id=xxx&sort=popular|recent
router.get('/', async (req, res) => {
  try {
    const { festival_id, sort = 'recent' } = req.query;
    const params = [];
    let sql = `
      SELECT p.*, u.nickname,
             (SELECT COUNT(*) FROM photo_likes pl WHERE pl.photo_id = p.id) AS like_count
      FROM photos p
      JOIN users u ON u.id = p.user_id
    `;
    if (festival_id) {
      sql += ' WHERE p.festival_id = ?';
      params.push(festival_id);
    }
    sql += sort === 'popular'
      ? ' ORDER BY like_count DESC, p.created_at DESC'
      : ' ORDER BY p.created_at DESC';
    sql += ' LIMIT 50';
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '사진 조회 실패' });
  }
});

// POST /api/photos  (인증 필요, multipart)
router.post('/', requireAuth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '이미지를 업로드해주세요.' });
    }
    const { festival_id, caption } = req.body;
    if (!festival_id) {
      return res.status(400).json({ error: 'festival_id 누락' });
    }
    const imageUrl = `/uploads/${req.file.filename}`;
    const [result] = await pool.query(
      'INSERT INTO photos (festival_id, user_id, image_url, caption) VALUES (?, ?, ?, ?)',
      [festival_id, req.user.id, imageUrl, caption || null]
    );
    res.status(201).json({ id: result.insertId, image_url: imageUrl });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '업로드 실패' });
  }
});

// POST /api/photos/:id/like
router.post('/:id/like', requireAuth, async (req, res) => {
  const photoId = req.params.id;
  const userId  = req.user.id;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // 본인 사진 추천 차단
    const [photo] = await conn.query('SELECT user_id FROM photos WHERE id = ?', [photoId]);
    if (photo.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: '사진을 찾을 수 없습니다.' });
    }
    if (photo[0].user_id === userId) {
      await conn.rollback();
      return res.status(400).json({ error: '본인이 올린 사진은 추천할 수 없습니다.' });
    }
    try {
      await conn.query(
        'INSERT INTO photo_likes (photo_id, user_id) VALUES (?, ?)',
        [photoId, userId]
      );
      // 사진 작성자에게 포인트 +1
      await conn.query('UPDATE users SET points = points + 1 WHERE id = ?', [photo[0].user_id]);
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        await conn.rollback();
        return res.status(409).json({ error: '이미 추천하셨습니다.' });
      }
      throw err;
    }
    await conn.commit();
    res.json({ ok: true });
  } catch (e) {
    await conn.rollback();
    console.error(e);
    res.status(500).json({ error: '추천 실패' });
  } finally {
    conn.release();
  }
});

// DELETE /api/photos/:id/like  (추천 취소)
router.delete('/:id/like', requireAuth, async (req, res) => {
  const photoId = req.params.id;
  const userId  = req.user.id;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.query(
      'DELETE FROM photo_likes WHERE photo_id = ? AND user_id = ?',
      [photoId, userId]
    );
    if (result.affectedRows > 0) {
      const [photo] = await conn.query('SELECT user_id FROM photos WHERE id = ?', [photoId]);
      if (photo.length > 0) {
        await conn.query(
          'UPDATE users SET points = GREATEST(points - 1, 0) WHERE id = ?',
          [photo[0].user_id]
        );
      }
    }
    await conn.commit();
    res.json({ ok: true });
  } catch (e) {
    await conn.rollback();
    console.error(e);
    res.status(500).json({ error: '추천 취소 실패' });
  } finally {
    conn.release();
  }
});

module.exports = router;
