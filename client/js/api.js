// client/js/api.js
// 백엔드 API 호출 래퍼 + JWT 토큰 보관

const API_BASE = '/api';
const TOKEN_KEY = 'honam_token';
const USER_KEY  = 'honam_user';

const Auth = {
  getToken() { return localStorage.getItem(TOKEN_KEY); },
  getUser()  { try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { return null; } },
  set(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
  isLoggedIn() { return !!this.getToken(); }
};

async function apiFetch(path, opts = {}) {
  const headers = opts.headers || {};
  if (Auth.getToken()) headers['Authorization'] = `Bearer ${Auth.getToken()}`;
  if (opts.body && !(opts.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(API_BASE + path, { ...opts, headers });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

const API = {
  // festivals
  listFestivals: (region) => apiFetch(`/festivals${region ? `?region=${encodeURIComponent(region)}` : ''}`),
  getFestival:   (id)     => apiFetch(`/festivals/${id}`),

  // auth
  register: (body) => apiFetch('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login:    (body) => apiFetch('/auth/login',    { method: 'POST', body: JSON.stringify(body) }),

  // photos
  listPhotos: (festivalId, sort = 'recent') =>
    apiFetch(`/photos?festival_id=${festivalId}&sort=${sort}`),
  uploadPhoto: (formData) =>
    apiFetch('/photos', { method: 'POST', body: formData }),
  likePhoto:   (id) => apiFetch(`/photos/${id}/like`,   { method: 'POST' }),
  unlikePhoto: (id) => apiFetch(`/photos/${id}/like`,   { method: 'DELETE' }),

  // 축제 추가 요청
  submitRequest: (formData) =>
    apiFetch('/requests', { method: 'POST', body: formData }),
  listMyRequests: () => apiFetch('/requests/mine'),

  // 관리자
  listPendingRequests: () => apiFetch('/requests?status=pending'),
  approveRequest: (id) => apiFetch(`/requests/${id}/approve`, { method: 'POST' }),
  rejectRequest: (id, reason) =>
    apiFetch(`/requests/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }),
  addFestivalAsAdmin: (formData) =>
    apiFetch('/festivals', { method: 'POST', body: formData }),
  deleteFestival: (id) => apiFetch(`/festivals/${id}`, { method: 'DELETE' }),
};

// 전역 노출
window.API = API;
window.Auth = Auth;
