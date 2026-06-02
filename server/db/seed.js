// server/db/seed.js
// CLI: node server/db/seed.js
// 또는 app.js가 시작 시 호출

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const url = require('url');
require('dotenv').config();

function parseUrl(u) {
  if (!u) return null;
  const p = new url.URL(u);
  return {
    host: p.hostname,
    port: parseInt(p.port || '3306', 10),
    user: decodeURIComponent(p.username),
    password: decodeURIComponent(p.password),
    database: p.pathname.replace(/^\//, '')
  };
}

async function runSeed({ silent = false } = {}) {
  const log = silent ? () => {} : (...a) => console.log(...a);
  const fromUrl = parseUrl(process.env.MYSQL_URL || process.env.DATABASE_URL);

  const schemaSQL = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  // 로컬 개발: DB 생성 권한 있으니 schema 그대로 실행
  // Railway: 이미 데이터베이스가 있으므로 CREATE/USE 라인 제거하고 실행
  const isManaged = !!fromUrl;
  const cleanedSchema = isManaged
    ? schemaSQL
        .replace(/CREATE DATABASE[^;]+;/i, '')
        .replace(/USE[^;]+;/i, '')
    : schemaSQL;

  const conn = await mysql.createConnection({
    host:     fromUrl?.host     || process.env.DB_HOST     || 'localhost',
    port:     fromUrl?.port     || process.env.DB_PORT     || 3306,
    user:     fromUrl?.user     || process.env.DB_USER     || 'root',
    password: fromUrl?.password || process.env.DB_PASSWORD || '',
    database: isManaged ? fromUrl.database : undefined,
    multipleStatements: true,
    charset: 'utf8mb4'
  });

  log('▶ 스키마 적용 중...');
  await conn.query(cleanedSchema);
  log('✓ 스키마 적용 완료');

  await conn.query("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");

  if (!isManaged) {
    await conn.changeUser({ database: process.env.DB_NAME || 'honam_festa' });
  }

  const festivalsPath = path.join(__dirname, '../../client/data/festivals.json');
  const festivals = JSON.parse(fs.readFileSync(festivalsPath, 'utf8'));

  log(`▶ 축제 ${festivals.length}건 주입 중...`);
  for (const f of festivals) {
    await conn.execute(
      `INSERT INTO festivals
        (id, name, region, region_code, start_date, end_date,
         venue, lat, lng, parking, schedule_json, thumbnail,
         official_url, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         name=VALUES(name), start_date=VALUES(start_date), end_date=VALUES(end_date),
         venue=VALUES(venue), lat=VALUES(lat), lng=VALUES(lng),
         parking=VALUES(parking), schedule_json=VALUES(schedule_json),
         thumbnail=VALUES(thumbnail), official_url=VALUES(official_url),
         description=VALUES(description)`,
      [
        f.id, f.name, f.region, f.regionCode || null,
        f.period.start, f.period.end,
        f.venue, f.coords.lat, f.coords.lng,
        f.parking, JSON.stringify(f.schedule),
        f.thumbnail, f.officialUrl, f.description
      ]
    );
  }
  log('✓ 축제 데이터 주입 완료');

  log('▶ 관리자 계정 생성 중...');
  const adminHash = await bcrypt.hash('admin', 10);
  await conn.execute(
    `INSERT INTO users (email, password_hash, nickname, role)
     VALUES (?, ?, ?, 'admin')
     ON DUPLICATE KEY UPDATE password_hash=VALUES(password_hash), role='admin'`,
    ['admin@local', adminHash, 'admin']
  );
  log('✓ 관리자 계정: admin@local / admin');

  await conn.end();
  log('🎉 seed 완료');
}

// CLI 실행 시
if (require.main === module) {
  runSeed().catch(err => {
    console.error('❌ seed 실패:', err);
    process.exit(1);
  });
}

module.exports = { runSeed };
