// client/js/map.js
// Leaflet 지도, 전남 시군 폴리곤, 호버/클릭 처리

// 전남 시군 GeoJSON URL (남한 시군구 GeoJSON에서 전남만 필터)
// 사용: 외부 GitHub 리포에서 받아 client/data/jeonnam.geojson 로 저장 후 경로 변경 권장.
// 로컬에 없으면 fallback으로 마커만 표시한다.
const JEONNAM_GEOJSON_URL = '/data/jeonnam.geojson';

let map;
let regionLayer;
let festivalsByRegion = {};

async function init() {
  map = L.map('map', {
    zoomControl: false,
    attributionControl: false
  }).setView([34.73, 126.49], 9);
  L.control.zoom({ position: 'bottomright' }).addTo(map);

  // 배경 타일 없음: 전남 시군 폴리곤만 흰 배경에 표시

  // 1) 축제 데이터 로드
  let festivals = [];
  try {
    festivals = await API.listFestivals();
  } catch (e) {
    console.warn('백엔드 미연결, 로컬 JSON으로 폴백:', e.message);
    festivals = await fetch('/data/festivals.json').then(r => r.json());
  }

  // 지역별 그룹핑
  festivalsByRegion = festivals.reduce((acc, f) => {
    (acc[f.region] = acc[f.region] || []).push(f);
    return acc;
  }, {});

  // 2) GeoJSON 로드 시도
  try {
    const geo = await fetch(JEONNAM_GEOJSON_URL).then(r => {
      if (!r.ok) throw new Error('GeoJSON 없음');
      return r.json();
    });
    addRegionPolygons(geo);
    addFestivalMarkers(festivals);   // 축제 위치 마커
  } catch (e) {
    console.warn('GeoJSON 로드 실패, 마커로 폴백:', e.message);
    addFallbackMarkers(festivals);
    showGeoJsonHint();
  }
}

function addRegionPolygons(geo) {
  regionLayer = L.geoJSON(geo, {
    style: (feature) => styleFor(feature),
    onEachFeature: (feature, layer) => bindRegionInteractions(feature, layer)
  }).addTo(map);
  map.fitBounds(regionLayer.getBounds(), { padding: [30, 30] });

  // 각 시군 이름 라벨
  regionLayer.eachLayer((layer) => {
    const name = regionNameOf(layer.feature);
    const c = layer.getBounds().getCenter();
    L.marker(c, {
      interactive: false,
      icon: L.divIcon({ className: 'region-label', html: name, iconSize: [0, 0] })
    }).addTo(map);
  });

  // 줌/이동 시작 시 확대 상태 초기화 (좌표 어긋남 방지)
  map.on('zoomstart movestart', () => {
    regionLayer.eachLayer((l) => lowerRegion(l));
    hideHoverTip();
  });
}

function regionNameOf(feature) {
  // GeoJSON 속성명은 출처마다 다름. 흔한 키들 시도.
  const p = feature.properties || {};
  return p.SIG_KOR_NM || p.name || p.NAME_2 || p.sggnm || p.NM || '';
}

function styleFor(feature) {
  const name = regionNameOf(feature);
  const has = !!festivalsByRegion[name];
  return {
    fillColor: has ? '#8fc4e6' : '#cfe6f4',  // 축제 보유 지역만 살짝 진하게
    fillOpacity: 0.9,
    color: '#ffffff',                          // 흰 경계선
    weight: 1.6,
    opacity: 1
  };
}

function bindRegionInteractions(feature, layer) {
  const name = regionNameOf(feature);
  const fests = festivalsByRegion[name] || [];

  layer.on('mouseover', (e) => {
    layer.setStyle({ fillColor: '#4f9bc4', fillOpacity: 1, weight: 2.2 });
    layer.bringToFront();           // 떠오르는 느낌: 다른 폴리곤 위로
    raiseRegion(layer, name);       // CSS scale 로 살짝 확대
    showHoverTip(e.originalEvent, name, fests);
  });
  layer.on('mousemove', (e) => positionHoverTip(e.originalEvent));
  layer.on('mouseout', () => {
    regionLayer.resetStyle(layer);
    lowerRegion(layer);
    hideHoverTip();
  });
  layer.on('click', () => {
    if (fests.length === 0) {
      alert(`${name}에는 등록된 축제가 아직 없어요.`);
      return;
    }
    if (fests.length === 1) {
      Sidebar.show(fests[0]);
    } else {
      // 여러 개면 첫 번째 표시 후 사이드바에서 선택할 수도 있게 확장 가능
      Sidebar.show(fests[0]);
    }
    map.fitBounds(layer.getBounds(), { padding: [40, 40], maxZoom: 11 });
  });
}

// ---------- 축제 위치 마커 ----------
function addFestivalMarkers(festivals) {
  festivals.forEach(f => {
    const lat = f.coords?.lat ?? f.lat;
    const lng = f.coords?.lng ?? f.lng;
    if (lat == null || lng == null) return;

    const icon = L.divIcon({
      className: 'festival-pin',
      html: '<div class="pin-dot"></div>',
      iconSize: [18, 18],
      iconAnchor: [9, 9]
    });

    const m = L.marker([lat, lng], { icon, zIndexOffset: 1000 }).addTo(map);
    m.bindTooltip(f.name, { direction: 'top', offset: [0, -10] });
    m.on('click', (e) => {
      L.DomEvent.stopPropagation(e);
      Sidebar.show(f);
    });
  });
}

// ---------- 떠오르는 확대 효과 ----------
// 폴리곤의 SVG <path> 에 transform-origin(폴리곤 중심) + scale 을 걸어
// 마우스 호버 시 살짝 떠오르듯 확대시킨다.
function raiseRegion(layer, name) {
  const el = layer._path;
  if (!el) return;
  // 화면 좌표 기준 폴리곤 중심을 transform-origin 으로
  const c = layer.getBounds().getCenter();
  const pt = map.latLngToLayerPoint(c);
  el.style.transformOrigin = `${pt.x}px ${pt.y}px`;
  el.style.transition = 'transform .18s ease-out, filter .18s ease-out';
  el.style.transform = 'scale(1.06)';
  el.style.filter = 'drop-shadow(0 6px 10px rgba(0,0,0,.35))';
  el.classList.add('region-raised');
}

function lowerRegion(layer) {
  const el = layer._path;
  if (!el) return;
  el.style.transform = 'scale(1)';
  el.style.filter = 'none';
  el.classList.remove('region-raised');
}

// ---------- Hover Tip ----------
const tip = document.getElementById('hover-tip');
function showHoverTip(ev, name, fests) {
  tip.hidden = false;
  tip.innerHTML = `
    <strong>${name}</strong>
    ${fests.length
      ? `<ul>${fests.slice(0, 3).map(f => `<li>· ${f.name}</li>`).join('')}</ul>`
      : '<span style="opacity:.7">등록된 축제 없음</span>'}
  `;
  positionHoverTip(ev);
}
function positionHoverTip(ev) {
  const x = ev.clientX + 14;
  const y = ev.clientY + 14;
  tip.style.left = x + 'px';
  tip.style.top  = y + 'px';
}
function hideHoverTip() { tip.hidden = true; }

// ---------- Fallback: 마커만 표시 ----------
function addFallbackMarkers(festivals) {
  festivals.forEach(f => {
    const lat = f.lat ?? f.coords?.lat;
    const lng = f.lng ?? f.coords?.lng;
    if (!lat || !lng) return;
    const m = L.circleMarker([lat, lng], {
      radius: 9,
      color: '#1f4d3f',
      weight: 2,
      fillColor: '#c0392b',
      fillOpacity: 0.85
    }).addTo(map);
    m.bindTooltip(`<strong>${f.name}</strong><br/>${f.region}`, { direction: 'top' });
    m.on('click', () => Sidebar.show(f));
  });
}

function showGeoJsonHint() {
  const hint = L.control({ position: 'topright' });
  hint.onAdd = () => {
    const div = L.DomUtil.create('div');
    div.style.cssText = 'background:#fff7e0;padding:8px 12px;border-radius:4px;font-size:12px;color:#8a6d1c;box-shadow:0 2px 6px rgba(0,0,0,.1);max-width:260px;';
    div.innerHTML = '⚠ <strong>jeonnam.geojson</strong> 파일이 없어 마커 모드로 표시 중입니다. README의 안내를 참고해 GeoJSON을 추가하세요.';
    return div;
  };
  hint.addTo(map);
}

// 페이지 로드 후 시작
window.addEventListener('DOMContentLoaded', () => {
  const wait = setInterval(() => {
    if (window.L) {
      clearInterval(wait);
      init().then(() => {
        window.map = map;
        window.reloadFestivals = () => location.reload();
      });
    }
  }, 30);
});
