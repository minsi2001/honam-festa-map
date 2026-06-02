// server/middleware/auth.js
const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: '로그인이 필요합니다.' });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;            // { id, email, nickname }
    next();
  } catch (e) {
    return res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
  }
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
    }
    next();
  });
}

module.exports = { requireAuth, requireAdmin };
