// client/js/admin.js
// 1) 축제 추가 요청 모달 (일반 사용자)
// 2) 관리자 패널 (admin 전용)
// 3) "지도에서 위치 찍기" - 지도 클릭으로 lat/lng 채움

const JEONNAM_REGIONS = [
  '목포시','여수시','순천시','나주시','광양시',
  '담양군','곡성군','구례군','고흥군','보성군','화순군',
  '장흥군','강진군','해남군','영암군','무안군','함평군',
  '영광군','장성군','완도군','진도군','신안군'
];

// region select 채우기
(function fillRegions(){
  const sel = document.getElementById('req-region');
  if (!sel) return;
  JEONNAM_REGIONS.forEach(r => {
    const o = document.createElement('option');
    o.value = r; o.textContent = r;
    sel.appendChild(o);
  });
})();

// ---------- 헤더 버튼 ----------
const requestBtn = document.getElementById('request-btn');
const adminBtn   = document.getElementById('admin-btn');
const requestModal = document.getElementById('request-modal');
const adminModal   = document.getElementById('admin-modal');

function syncAdminVisibility() {
  const u = Auth.getUser();
  adminBtn.hidden = !(u && u.role === 'admin');
}
syncAdminVisibility();
// auth UI가 갱신될 때마다 재확인
const origRefresh = window.refreshAuthUI;
if (typeof origRefresh === 'function') {
  window.refreshAuthUI = function() {
    origRefresh();
    syncAdminVisibility();
  };
}
// 폴링 안전장치 (로그인 직후 토큰 반영)
setInterval(syncAdminVisibility, 1500);

// ---------- 요청 모달 ----------
requestBtn.addEventListener('click', () => {
  if (!Auth.isLoggedIn()) {
    alert('로그인이 필요합니다.');
    document.getElementById('auth-btn').click();
    return;
  }
  requestModal.hidden = false;
});
document.getElementById('req-cancel').addEventListener('click', () => requestModal.hidden = true);
requestModal.addEventListener('click', (e) => { if (e.target === requestModal) requestModal.hidden = true; });

document.getElementById('req-submit').addEventListener('click', async () => {
  const name   = document.getElementById('req-name').value.trim();
  const region = document.getElementById('req-region').value;
  if (!name || !region) return alert('축제명과 지역은 필수입니다.');

  const fd = new FormData();
  fd.append('name', name);
  fd.append('region', region);
  fd.append('start_date', document.getElementById('req-start').value);
  fd.append('end_date',   document.getElementById('req-end').value);
  fd.append('venue',      document.getElementById('req-venue').value);
  fd.append('parking',    document.getElementById('req-parking').value);
  fd.append('lat',        document.getElementById('req-lat').value);
  fd.append('lng',        document.getElementById('req-lng').value);
  fd.append('official_url', document.getElementById('req-official').value);
  fd.append('description',  document.getElementById('req-desc').value);
  fd.append('schedule',     document.getElementById('req-schedule').value);
  const file = document.getElementById('req-thumb').files[0];
  if (file) fd.append('thumbnail', file);

  // 관리자면 바로 등록, 일반 사용자는 요청 큐로
  try {
    const u = Auth.getUser();
    if (u && u.role === 'admin') {
      await API.addFestivalAsAdmin(fd);
      alert('축제가 즉시 등록되었습니다.');
    } else {
      await API.submitRequest(fd);
      alert('요청을 보냈습니다. 관리자 승인 후 지도에 표시됩니다.');
    }
    requestModal.hidden = true;
    clearReqForm();
    // 지도 새로고침
    if (typeof reloadFestivals === 'function') reloadFestivals();
  } catch (e) {
    alert(e.message);
  }
});

function clearReqForm() {
  ['req-name','req-start','req-end','req-venue','req-parking',
   'req-lat','req-lng','req-official','req-desc','req-schedule','req-thumb']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('req-region').value = '';
}

// ---------- 지도에서 위치 찍기 ----------
let pickingCoord = false;
document.getElementById('req-coord-help').addEventListener('click', () => {
  pickingCoord = true;
  requestModal.hidden = true;
  alert('지도에서 축제 위치를 클릭하세요.');
});
// map.js의 map 객체는 전역 변수로 노출되어 있어야 함. (map.js에서 window.map = map)
function attachMapClick() {
  if (!window.map || typeof window.map.on !== 'function') {
    return setTimeout(attachMapClick, 300);
  }
  window.map.on('click', (e) => {
    if (!pickingCoord) return;
    document.getElementById('req-lat').value = e.latlng.lat.toFixed(6);
    document.getElementById('req-lng').value = e.latlng.lng.toFixed(6);
    pickingCoord = false;
    requestModal.hidden = false;
  });
}
attachMapClick();

// ---------- 관리자 패널 ----------
adminBtn.addEventListener('click', async () => {
  adminModal.hidden = false;
  await loadPending();
});
document.getElementById('admin-close').addEventListener('click', () => adminModal.hidden = true);
adminModal.addEventListener('click', (e) => { if (e.target === adminModal) adminModal.hidden = true; });
document.getElementById('admin-add-direct').addEventListener('click', () => {
  adminModal.hidden = true;
  requestModal.hidden = false;
});

async function loadPending() {
  const box = document.getElementById('admin-list');
  box.innerHTML = '<p class="muted">불러오는 중...</p>';
  try {
    const list = await API.listPendingRequests();
    if (!list.length) {
      box.innerHTML = '<p class="muted">대기 중인 요청이 없습니다.</p>';
      return;
    }
    box.innerHTML = '';
    list.forEach(r => box.appendChild(renderRequestCard(r)));
  } catch (e) {
    box.innerHTML = `<p class="muted">조회 실패: ${e.message}</p>`;
  }
}

function renderRequestCard(r) {
  const div = document.createElement('div');
  div.className = 'req-card';
  const thumb = r.thumbnail
    ? `<img src="${r.thumbnail}" alt="" class="req-thumb"/>`
    : `<div class="req-thumb req-thumb-empty">사진 없음</div>`;
  div.innerHTML = `
    ${thumb}
    <div class="req-body">
      <div class="req-meta">신청자: <b>${r.requester_nickname}</b> · ${r.requester_email}</div>
      <h4>${r.name}</h4>
      <p class="req-line"><b>${r.region}</b> · ${r.start_date || '-'} ~ ${r.end_date || '-'}</p>
      <p class="req-line">📍 ${r.venue || '-'}</p>
      <p class="req-line">🅿 ${r.parking || '-'}</p>
      <p class="req-line">위치: ${r.lat || '-'}, ${r.lng || '-'}</p>
      ${r.description ? `<p class="req-desc">${r.description}</p>` : ''}
      <div class="req-actions">
        <button class="btn-primary btn-approve" data-id="${r.id}">승인</button>
        <button class="btn-ghost btn-reject" data-id="${r.id}">거절</button>
      </div>
    </div>
  `;
  div.querySelector('.btn-approve').addEventListener('click', async (e) => {
    if (!confirm(`"${r.name}" 축제를 승인하시겠어요?`)) return;
    try {
      await API.approveRequest(r.id);
      div.remove();
      if (typeof reloadFestivals === 'function') reloadFestivals();
      if (!document.querySelectorAll('.req-card').length) loadPending();
    } catch (err) { alert(err.message); }
  });
  div.querySelector('.btn-reject').addEventListener('click', async () => {
    const reason = prompt('거절 사유 (선택)') || '';
    try {
      await API.rejectRequest(r.id, reason);
      div.remove();
      if (!document.querySelectorAll('.req-card').length) loadPending();
    } catch (err) { alert(err.message); }
  });
  return div;
}

// ---------- 축제 삭제 (관리자) ----------
function getDelBtn() { return document.getElementById('admin-delete-festival'); }

// 사이드바가 열릴 때마다 admin이면 삭제 버튼 노출
function syncDeleteBtn() {
  const btn = getDelBtn();
  if (!btn) return;
  const u = Auth.getUser();
  const isAdmin = !!(u && u.role === 'admin');
  const sbContent = document.getElementById('sidebar-content');
  const hasFestival = !!(window.Sidebar && Sidebar.current) && sbContent && !sbContent.hidden;
  btn.hidden = !(isAdmin && hasFestival);
}
// 사이드바 콘텐츠 표시 상태 감시
(function watchSidebar(){
  const sbContent = document.getElementById('sidebar-content');
  if (sbContent) {
    new MutationObserver(syncDeleteBtn).observe(sbContent, { attributes: true, attributeFilter: ['hidden'] });
  }
})();
setInterval(syncDeleteBtn, 1000);
window.syncDeleteBtn = syncDeleteBtn;

document.addEventListener('click', async (ev) => {
  if (ev.target.id !== 'admin-delete-festival') return;
  if (!window.Sidebar || !Sidebar.current) return;
  const f = Sidebar.current;
  if (!confirm(`정말 "${f.name}" 을(를) 삭제하시겠어요?\n이 작업은 되돌릴 수 없습니다.`)) return;
  try {
    await API.deleteFestival(f.id);
    alert('삭제되었습니다.');
    location.reload();
  } catch (e) {
    alert('삭제 실패: ' + e.message);
  }
});
