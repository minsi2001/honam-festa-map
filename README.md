# Honam Festa Map

전라남도 축제 지도 기반 관광 플랫폼 (Sprint 1 보일러플레이트)

## 폴더 구조

```
honam-festa-map/
├── client/                    # 프론트엔드 (정적)
│   ├── index.html
│   ├── css/style.css
│   ├── js/
│   │   ├── api.js            # 백엔드 호출 + JWT
│   │   ├── map.js            # Leaflet 지도
│   │   ├── sidebar.js        # 축제 상세
│   │   └── upload.js         # 사진/로그인 모달
│   ├── data/
│   │   ├── festivals.json    # 초기 더미 축제 10개
│   │   └── jeonnam.geojson   # ⚠ 직접 추가 필요 (아래 안내)
│   └── images/               # 축제 썸네일 자리 (선택)
└── server/
    ├── app.js                # Express 진입점
    ├── routes/
    ├── middleware/
    ├── db/
    │   ├── schema.sql        # MySQL 테이블 정의
    │   └── seed.js           # 스키마 + 더미데이터 주입
    └── uploads/              # 사용자 업로드 사진 저장
```

## 1. 사전 준비

- Node.js 18+
- MySQL 8+
- (선택) MySQL 서버 미리 띄워두고 root 비밀번호 알아두기

## 2. 설치

```bash
npm install
cp .env.example .env
# .env 열어서 DB_PASSWORD, JWT_SECRET 등 채우기
```

## 3. DB 초기화 + 더미 데이터 주입

```bash
npm run seed
```

이 한 줄이 수행하는 일:
1. `honam_festa` 데이터베이스 생성
2. 테이블 4개 생성 (festivals, users, photos, photo_likes)
3. `client/data/festivals.json` → festivals 테이블에 주입

## 4. 전남 GeoJSON 추가 (지도 폴리곤용)

GeoJSON이 없으면 마커 모드로 동작하지만, 호버/클릭 진가는 폴리곤에서 나옴.

**받는 방법 (택1):**

- **방법 A** — `southkorea/southkorea-maps` 저장소의 시군구 GeoJSON에서 `CTPRVN_CD == "46"` (전남) 또는 `CTP_KOR_NM == "전라남도"` 인 feature만 필터링
- **방법 B** — 행정안전부 행정표준코드 또는 통계청 SGIS Open Platform 에서 시군구 경계 다운로드 후 전남만 추출
- **방법 C** — QGIS 등으로 전국 시군구 shapefile 열어 전남만 export → GeoJSON 변환

추출된 파일을 `client/data/jeonnam.geojson` 에 저장.

각 feature의 `properties` 안에 시군 이름이 다음 키 중 하나로 들어 있어야 함 (`map.js`의 `regionNameOf` 함수가 자동 인식):
`SIG_KOR_NM`, `name`, `NAME_2`, `sggnm`, `NM`

`festivals.json`의 `region` 값 (`여수시`, `담양군` 등)과 정확히 일치해야 호버/클릭 매칭됨.

## 5. 실행

```bash
npm start         # 또는 npm run dev (nodemon)
```

브라우저에서 http://localhost:3000 접속.

## 6. 동작 흐름

1. 메인: 전남 지도 + 시군 폴리곤
2. 호버: 해당 지역 축제 미리보기 (최대 3개)
3. 클릭: 사이드바에 축제 상세 + 주변 정보 (네이버 지도 검색 딥링크)
4. 회원가입/로그인 → 사진 업로드 → 다른 사용자가 추천 → 사진 작성자에게 포인트 적립

## 7. API 요약

| Method | Path | 설명 |
|---|---|---|
| GET    | `/api/festivals`           | 전체 축제 (region 필터 가능) |
| GET    | `/api/festivals/:id`       | 단일 축제 |
| POST   | `/api/auth/register`       | 회원가입 |
| POST   | `/api/auth/login`          | 로그인 (JWT 발급) |
| GET    | `/api/photos?festival_id=` | 사진 목록 (sort=popular/recent) |
| POST   | `/api/photos`              | 사진 업로드 (인증, multipart) |
| POST   | `/api/photos/:id/like`     | 추천 (인증) |
| DELETE | `/api/photos/:id/like`     | 추천 취소 (인증) |

## 8. 다음 단계 (Sprint 2~)

- [ ] 카카오/네이버 지도 API로 주변 인프라 직접 호출 (현재는 검색 페이지 딥링크)
- [ ] 축제 데이터 공공데이터포털 API 연동 (한국관광공사 국문 관광정보)
- [ ] 추천/조회수 기반 인기 페이지
- [ ] 월별/계절별 필터
- [ ] 사진 업로드 어뷰징 방지 (rate limit, IP 단위 제한)
- [ ] S3로 사진 스토리지 이전
