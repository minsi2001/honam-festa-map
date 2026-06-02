// client/js/sidebar.js
// 사이드바 렌더링 + 주변 인프라(네이버 지도 딥링크)

const Sidebar = {
  current: null,    // 현재 표시 중인 축제 객체

  show(festival) {
    this.current = festival;
    document.getElementById('sidebar-empty').hidden = true;
    const c = document.getElementById('sidebar-content');
    c.hidden = false;

    document.getElementById('f-region').textContent = festival.region;
    document.getElementById('f-name').textContent   = festival.name;
    const startStr = festival.start_date || festival.period?.start;
    const endStr   = festival.end_date   || festival.period?.end;
    document.getElementById('f-period').textContent = `${startStr} ~ ${endStr}`;

    // 상태 배지 (오늘 기준)
    const badge = document.getElementById('f-status');
    if (badge) {
      const today = new Date(); today.setHours(0,0,0,0);
      const s = startStr ? new Date(startStr) : null;
      const e = endStr ? new Date(endStr) : null;
      let label = '예정', color = '#d9a441';
      if (s && e) {
        if (today < s)      { label = '예정';   color = '#d9a441'; }
        else if (today > e) { label = '종료';   color = '#c2cbc5'; }
        else                { label = '진행 중'; color = '#e35b4d'; }
      }
      badge.textContent = label;
      badge.style.background = color;
    }

    const thumb = document.getElementById('f-thumb');
    const thumbSrc = festival.thumbnail || '';
    thumb.style.display = 'block';
    thumb.src = thumbSrc;
    thumb.alt = festival.name;
    thumb.onerror = () => {
      // 이미지가 없으면 부드러운 그라디언트 플레이스홀더로 대체
      thumb.removeAttribute('src');
      thumb.style.display = 'block';
      thumb.style.background = 'linear-gradient(135deg, #aed8ef 0%, #e4f0e8 55%, #f4d6a8 100%)';
    };

    document.getElementById('f-desc').textContent    = festival.description || '';
    document.getElementById('f-venue').textContent   = festival.venue || '-';
    document.getElementById('f-parking').textContent = festival.parking || '-';

    // 일정
    let schedule = festival.schedule_json || festival.schedule || [];
    if (typeof schedule === 'string') {
      try { schedule = JSON.parse(schedule); } catch { schedule = []; }
    }
    const ol = document.getElementById('f-schedule');
    ol.innerHTML = schedule.length
      ? schedule.map(s => `<li><strong>${s.day}</strong> ${(s.events || []).join(' · ')}</li>`).join('')
      : '<li class="muted">일정 정보 준비 중</li>';

    // 주변 정보 (네이버 지도 검색 딥링크)
    const lat = festival.lat ?? festival.coords?.lat;
    const lng = festival.lng ?? festival.coords?.lng;
    const grid = document.getElementById('nearby-grid');
    grid.innerHTML = '';
    const categories = ['맛집', '카페', '주차장', '화장실', '관광지', '숙소'];
    categories.forEach(cat => {
      const a = document.createElement('a');
      a.className = 'nearby-card';
      a.target = '_blank';
      a.rel = 'noopener';
      a.href = `https://map.naver.com/p/search/${encodeURIComponent(festival.venue + ' ' + cat)}`;
      a.textContent = cat;
      grid.appendChild(a);
    });

    // 공식 링크
    const official = document.getElementById('f-official');
    official.href = festival.official_url || festival.officialUrl || '#';
    official.style.display = (festival.official_url || festival.officialUrl) ? 'block' : 'none';

    // 사진 목록
    this.loadPhotos(festival.id);
  },

  hide() {
    this.current = null;
    document.getElementById('sidebar-empty').hidden = false;
    document.getElementById('sidebar-content').hidden = true;
  },

  async loadPhotos(festivalId) {
    const grid = document.getElementById('photo-grid');
    grid.innerHTML = '<p class="muted">불러오는 중...</p>';
    try {
      const photos = await API.listPhotos(festivalId, 'popular');
      if (photos.length === 0) {
        grid.innerHTML = '<p class="muted">아직 업로드된 사진이 없어요.</p>';
        return;
      }
      grid.innerHTML = photos.map(p => `
        <div class="photo-card" data-photo-id="${p.id}">
          <img src="${p.image_url}" alt="${p.caption || ''}" />
          <span class="like">♥ ${p.like_count}</span>
        </div>
      `).join('');

      grid.querySelectorAll('.photo-card').forEach(card => {
        card.addEventListener('click', async () => {
          if (!Auth.isLoggedIn()) { alert('로그인이 필요합니다.'); return; }
          const id = card.dataset.photoId;
          try {
            await API.likePhoto(id);
            this.loadPhotos(festivalId);
          } catch (e) {
            if (e.message.includes('이미')) {
              await API.unlikePhoto(id);
              this.loadPhotos(festivalId);
            } else {
              alert(e.message);
            }
          }
        });
      });
    } catch (e) {
      grid.innerHTML = `<p class="muted">사진을 불러올 수 없어요. (${e.message})</p>`;
    }
  }
};

document.getElementById('sidebar-back').addEventListener('click', () => Sidebar.hide());

window.Sidebar = Sidebar;
