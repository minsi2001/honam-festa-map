// server/app.js
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const festivalsRoute = require('./routes/festivals');
const authRoute      = require('./routes/auth');
const photosRoute    = require('./routes/photos');
const requestsRoute  = require('./routes/requests');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 정적 파일: 클라이언트
app.use(express.static(path.join(__dirname, '../client')));
// 정적 파일: 업로드된 이미지
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API
app.use('/api/festivals', festivalsRoute);
app.use('/api/auth',      authRoute);
app.use('/api/photos',    photosRoute);
app.use('/api/requests',  requestsRoute);

// 헬스체크
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// 에러 핸들러
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || '서버 오류' });
});

// Railway/원격 환경: 첫 부팅 시 자동 seed
async function autoSeedIfNeeded() {
  if (process.env.AUTO_SEED !== '1') return;
  try {
    const pool = require('./db/connection');
    const [rows] = await pool.query("SHOW TABLES LIKE 'festivals'");
    if (rows.length === 0) {
      console.log('▶ 자동 seed 실행 (첫 부팅)');
      const { runSeed } = require('./db/seed');
      await runSeed();
    }
  } catch (e) {
    console.error('자동 seed 실패:', e.message);
  }
}

autoSeedIfNeeded().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`✓ Honam Festa Map 서버 실행 중: http://localhost:${PORT}`);
  });
});
