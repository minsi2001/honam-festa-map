// server/db/connection.js
const mysql = require('mysql2/promise');
const url = require('url');
require('dotenv').config();

// Railway는 MYSQL_URL 또는 MYSQL_PUBLIC_URL 형식으로 제공
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

const fromUrl = parseUrl(process.env.MYSQL_URL || process.env.DATABASE_URL);

const pool = mysql.createPool({
  host:     fromUrl?.host     || process.env.DB_HOST     || 'localhost',
  port:     fromUrl?.port     || process.env.DB_PORT     || 3306,
  user:     fromUrl?.user     || process.env.DB_USER     || 'root',
  password: fromUrl?.password || process.env.DB_PASSWORD || '',
  database: fromUrl?.database || process.env.DB_NAME     || 'honam_festa',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
  typeCast: function (field, next) {
    if (field.type === 'JSON') {
      return JSON.parse(field.string('utf8'));
    }
    return next();
  }
});

module.exports = pool;
