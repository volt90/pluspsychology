# 김심리월드 — 워크북 랜딩페이지 (프로젝트 인수인계)

## 개요
심리 워크북 **〈마음 사용 설명서〉** 판매/리드수집용 단일 페이지.
- 브랜드: 김심리월드 (심리교육 캐릭터 IP)
- 운영자: 김심리 (심리학 박사 · 임상심리사 1급)
- 타깃: 자기심리를 알고 싶은 10대·20대 + 교사/학부모
- 라이브: https://www.pluspsychology.ai  (Vercel 배포, GitHub: volt90/pluspsychology)

## 파일 구조
```
index.html          # Home 탭 — 랜딩페이지 전체 (CSS·JS·이미지 base64 모두 인라인, 약 400KB)
about.html          # About 탭 — 김심리월드 브랜드 소개 (자체 완결형)
contact.html        # Contact 탭 — 문의 폼 (자체 완결형)
privacy.html        # 개인정보처리방침 (한/영)
terms.html          # 이용약관 (한/영)
checkout.html       # 주문/결제 페이지 (noindex)
checkout-result.html # 결제 성공·실패 화면 (토스 리다이렉트 목적지, noindex)
api/subscribe.js    # 이메일 알림신청 처리 (Vercel 서버리스 함수)
api/contact.js      # 문의 폼 접수 → Resend로 메일 전달 (첨부 지원)
api/order.js        # 주문 생성 — 결제 금액을 서버가 계산
api/confirm.js      # 토스페이먼츠 결제 승인
supabase/schema.sql # subscribers · orders 테이블 정의 (Supabase SQL Editor에서 실행)
supabase/schema-app.sql # 앱 연동 스키마 (회원·이용권한·검사기록 + RLS)
docs/setup-supabase.md # Supabase 연결 순서 (이메일 수집 켜기)
docs/app-integration.md # 모바일 앱 연동 (같은 Supabase 프로젝트 공유)
docs/commerce-plan.md  # 판매 개시 준비 (결제·환불·회원 정책 설계)
admin.html          # 관리자 대시보드 (noindex · 로그인 필요)
api/admin-stats.js  # 대시보드 데이터 — GA4 + Supabase 를 서버에서 합침
api/public-config.js # 프런트가 쓸 공개 설정(anon 키)만 내려줌 — admin·login·account 공용
login.html          # 회원 로그인·가입 (noindex)
guardian.html       # 보호자(법정대리인) 동의 (noindex · 로그인 필요)
supabase/schema-guardian.sql # 생년월일 + 보호자 동의 표
account.html        # 내 정보·구매·이용권한 (noindex · 로그인 필요)
api/account.js      # 내 정보 조회 — 토큰 검증 후 본인 것만
supabase/schema-admin.sql # campaigns 표 + 캠페인 컬럼 + 집계 뷰
assets/img/char-simri.png # 김심리 캐릭터 (Store 판매처 준비중 안내에 사용)
exhibitions/*.html  # 전시별 상세 페이지 (/exhibitions/<slug>) — projects.html 에서 생성
topics.html         # 마음 이야기 허브 (/topics)
topics/*.html       # 키워드별 랜딩페이지 (/topics/<slug>) — index.html 에서 생성
og.png              # 링크 미리보기 이미지 1200×630 (기본)
og-store.png        # 링크 미리보기 — Store 탭 (굿즈)
og-projects.png     # 링크 미리보기 — Projects 탭 (전시)
vercel.json         # Vercel 설정 — cleanUrls (주소에서 .html 제거)
.vercelignore       # 배포에서 제외할 내부 문서 목록
robots.txt
sitemap.xml
```

### ⚠️ 저장소 파일은 그대로 URL로 공개됩니다
정적 배포라 루트의 파일이 확장자와 무관하게 서비스됩니다.
실제로 `/CLAUDE.md`가 공개된 적이 있습니다 (2026-07-26, `.vercelignore`로 차단).
**내부 문서·스키마·메모를 추가할 때는 반드시 `.vercelignore`에 함께 등록하세요.**
> `privacy.html` / `terms.html`은 index.html과 **별도 파일이며 자체 완결형**입니다.
> 디자인 토큰(색·폰트·`.page`·`.langsw`)을 각 파일에 복사해 두었으므로,
> index.html의 색이나 폰트를 바꾸면 두 파일도 함께 고쳐야 합니다.
> index.html은 자체 완결형입니다. 캐릭터·로고·표지 이미지가 base64로 박혀 있어
> 외부 이미지 의존성이 없습니다. 파일이 큰 것은 정상입니다.

## 판매 방향 (2026-07-26 확정)
- **1단계 실물 인쇄본 → 2단계 앱 기반 프로그램(디지털, 회원 전용)**
- 국내 + 해외 판매. 결제 직전 만 19세 미만 법정대리인 동의 체크박스 필수
- 상세 설계와 미해결 과제는 [docs/commerce-plan.md](docs/commerce-plan.md)
- ⚠️ 실물과 디지털은 **쓸 수 있는 결제사가 다릅니다** (Paddle·Lemon Squeezy는 디지털 전용)
- ⚠️ 연령 기준이 둘: **가입 14세**(개인정보보호법) / **결제 19세**(민법). 헷갈리기 쉬움

## 페이지 구성

### 상단 헤더 — 로고가 맨 왼쪽, 그 오른쪽에 탭
다섯 페이지(index·about·projects·store·contact)가 같은 헤더를 공유합니다.
**한 줄짜리 `<header class="siteheader">` 하나**이며, 안쪽 순서가 고정입니다:

```
[로고] [Home About Projects Store Contact] ······ [로그인] [🌐 한국어 ⌄]
 .brand            nav.tabs                        .tbright
```

- 🚨 **헤더는 `.page` 바깥에 있습니다.** 띠(`.siteheader`)는 화면 끝까지 가고,
  안쪽 `.hdr` 만 `--page` 폭으로 묶여 본문과 왼쪽 끝이 맞습니다.
  그래서 좌우 여백(20px)을 `.hdr` 이 따로 갖고 있습니다.
- 로고는 `flex:0 0 auto` 로 **항상 제일 왼쪽**, 오른쪽 도구는 `margin-left:auto` 로
  항상 줄 끝입니다. 순서를 바꾸지 마세요.
- 좁은 화면(≤760px)에서는 `flex-wrap` + `order` 로 **윗줄 = 로고·오른쪽 도구,
  아랫줄 = 탭** 으로 접힙니다. 이때도 로고가 제일 왼쪽·제일 위입니다.
- 헤더가 `position:sticky` 이므로 앵커 이동용 `scroll-margin-top:70px` 이
  헤더 높이와 짝입니다. **헤더 높이를 바꾸면 이 값도 함께** 고치세요.
- 옛 `.topbar` + `.tabsbar` 2단 구조는 없어졌습니다. 두 클래스는 이제
  **탭이 없는 페이지(privacy·terms·checkout·login 등)에만** 남아 있습니다.

| 탭 | 파일 | 내용 |
|---|---|---|
| Home | `index.html` | 워크북 랜딩 (기존 페이지 그대로) |
| About | `about.html` | 김심리월드 브랜드 소개 (원본 `김심리월드_bio.html` 내용 재배치) |
| Contact | `contact.html` | 문의 폼 |

> ⚠️ **탭 이름은 한국어 화면에서도 영어(Home/About/Contact)로 고정입니다.**
> 그래서 `nav.tabs`의 `<a>`에는 **`data-en`을 붙이지 않았습니다.** 붙이는 순간
> 언어 전환 JS가 문구를 바꿔치기하므로, 번역을 추가하지 마세요.
> 활성 탭에는 `class="on"` + `aria-current="page"` 를 둡니다.
> 탭은 세 파일에 각각 복사돼 있으므로 **항목을 추가·변경하면 세 파일을 함께** 고치세요.

### Home(index.html) 섹션 순서 (고정)
히어로 → 문제 정의 → 해결 방법(3단계) → 가격 → 증거 → CTA(이메일 수집 + 문의)

### Store 하단 '판매처 준비중' 안내
굿즈 목록 아래·푸터 위에 `<div class="soonbox panel">` 이 있습니다 —
`준비중` 알약 + "네이버 스마트스토어 준비중입니다." + 김심리 캐릭터.

- 스토어가 열리면 **이 상자를 스마트스토어 링크로 바꾸면** 됩니다.
- 캐릭터는 `assets/img/char-simri.png` 파일입니다 (index·about 처럼 base64 인라인이 아님).
  굿즈 사진과 같은 방식이라 `onerror` 로 `placeholder.svg` 를 대신 띄웁니다.
- 알림 신청 같은 **약속은 넣지 않았습니다.** 굿즈 출시 알림을 받는 장치가 아직 없어서,
  "열리면 알려드릴게요" 라고 쓰면 지키지 못할 말이 됩니다.

### 키워드 랜딩페이지 — /topics
검색에서 들어올 자리입니다. 주제 6개 + 허브 1개.

| 주소 | 노리는 검색어 |
|---|---|
| `/topics` | (허브 — 6개를 모아 링크) |
| `/topics/psychological-test` | 심리검사 |
| `/topics/psychology` | 심리 |
| `/topics/mindfulness` | 마음챙김 |
| `/topics/self-care` | 마음돌봄 |
| `/topics/depression` | 우울 |
| `/topics/anxiety` | 불안 |

- **본문 폭만 660px** 입니다 (보관해 둔 좁은 레이아웃). 🚨 헤더(`.hdr`)는 960px 그대로 두세요 —
  좁히면 탭이 잘리고 탭을 옮길 때 로고가 들썩입니다.
- 🚨 **모든 페이지에 `.notice`(의료행위 아님 고지)가 들어갑니다.** 지우지 마세요.
  `우울`·`불안` 두 페이지에는 `.crisis`(위기상담 전화)까지 있습니다. 번호는
  `terms.html` 제8조와 같은 것을 씁니다 — 다른 번호를 새로 쓰지 마세요.
- **효과·완화·치료 같은 표현을 쓰지 마세요.** 의료법·표시광고법에 걸립니다.
  지금 문구는 전부 '교육·자기이해' 범위로 맞춰져 있습니다.
- `FAQPage` + `Article` 구조화 데이터가 있습니다. 저자는 김심리(심리학 박사·임상심리사 1급) —
  건강 주제는 저자 정보가 검색 신뢰도에 직접 영향을 줍니다.
- 🚨 **`index.html` 에서 머리말을 떼어 쓰므로 생성기가 title·canonical·og 를 걷어냅니다.**
  안 걷어내면 canonical 이 전부 `/` 로 잡혀 **한 페이지도 색인되지 않습니다.**
- 페이지를 더할 때: 생성기의 `TOPICS` 에 항목을 넣고 `sitemap.xml` 에 주소를 더하세요.

## 디자인 규칙
- 색: 크림 `#FBF6EA` 배경 / 신뢰의 파랑 `#4C8CCB` / 골드 `#F2B620` / 코랄 `#E86B5E`
- 폰트: 제목·본문 `Noto Sans KR`, 포인트만 `Jua`(주아체)
- 시그니처 모티프: **마음 배터리** — 히어로 1%(빨강) → 3단계 33/66/100% → CTA 만충(초록)
- 톤: 담백하고 신뢰감 있게. 과장 광고 표현 금지.
- About 탭은 원본 bio의 시그니처 두 가지를 사이트 팔레트로 옮겨 씁니다:
  **말풍선**(`.bubble`, 굵은 잉크 테두리 + 골드 배경)과 **형광펜 강조**(`.mk` 골드 / `.mk-b` 하늘).
  bio 원본의 자체 팔레트(#FFF6D7·노랑 워드마크)는 쓰지 않습니다 — 탭 간 톤을 맞추기 위함입니다.
- 캐릭터 4종(`.frow`)은 **김심리·루비·세루만 `.fr-lg`로 1.5배**(74px→111px),
  아르는 기본 크기입니다. `.fimg` 칸 높이를 가장 큰 쪽(111px)에 맞춰 두었기 때문에
  크기가 달라도 이름·설명 줄이 나란히 맞습니다. 칸 높이를 줄이면 정렬이 깨집니다.
  휴대폰(≤440px)에서는 4칸을 유지하면 폭이 모자라 1.5배가 잘리므로 **2×2로 접힙니다.**
  같은 규칙이 `index.html`과 `about.html` 양쪽에 있습니다 — 함께 고치세요.

### 전시는 목록(projects) + 상세(exhibitions/*) 두 층입니다
`/projects` 는 전시 세 개를 카드로 보여주고, 카드를 누르면 **각 전시의 실제 페이지**로 갑니다.

| 주소 | 파일 |
|---|---|
| `/projects` | `projects.html` — 카드 목록 |
| `/exhibitions/busan-2025` | `exhibitions/busan-2025.html` |
| `/exhibitions/seongsu-2025` | `exhibitions/seongsu-2025.html` |
| `/exhibitions/squareone-2025` | `exhibitions/squareone-2025.html` |

- 🚨 **주소가 `/projects/...` 가 아니라 `/exhibitions/...` 입니다.** `projects.html` 과
  `projects/` 폴더가 같은 이름으로 겹치는 걸 피하려고 일부러 다른 이름을 썼습니다.
  breadcrumb 은 그래도 `Home / Projects / 전시명` 입니다 (구조화 데이터가 관계를 알려줍니다).
- 예전에는 사진을 **겹쳐 뜨는 창(lightbox)** 으로 보여줬습니다. 그 화면은 주소가 없어
  검색에 잡히지 않았습니다. 그래서 전시마다 페이지를 따로 두었습니다.
  lightbox 는 이제 **상세 페이지에서 사진 한 장을 크게 볼 때만** 씁니다 (`data-lb`).
- 각 상세 페이지에는 `BreadcrumbList` + **`ExhibitionEvent`** 구조화 데이터가 있습니다.
  🚨 **모르는 값은 넣지 마세요.** 날짜를 아는 건 성수 팝업뿐이라 나머지에는
  `startDate` 를 넣지 않았습니다. 지어내면 검색결과에 틀린 날짜가 표시됩니다.
- `og:image` 는 그 전시의 대표 사진(실제 파일)입니다. 1200×630 이 아니라 잘려 보이지만,
  전시마다 다른 카드가 뜨는 편이 낫다고 판단했습니다.
- **전시를 추가할 때**: 상세 페이지 하나를 만들고, `projects.html` 의 `.exlist` 에 카드를
  더하고, `sitemap.xml` 에 주소를 넣으세요. 셋을 함께 고쳐야 합니다.

### 전시 부스 사진의 톤 (projects.html)
`assets/img/exhibitions/` 의 **부스 운영사진 5장**은 서로 톤이 달라서 한 번 맞춰 두었습니다
(`busan-2025` · `seongsu-2025-1·2·3` · `squareone-2025`).
초대장(`*-invite-*`)은 사진이 아니라 디자인이라 손대지 않았습니다.

맞춘 기준 — **새 사진을 추가할 때 같은 값으로 맞추세요:**

| 항목 | 목표 | 재는 법 |
|---|---|---|
| 화이트밸런스 | R/G `1.010` · B/G `0.972` | 밝기 65~93 백분위 + 채도 0.16 미만 화소(흰 진열대·종이)의 선형 평균 |
| 밝기 | 밝기 중간값(p50) `0.640` | |
| 대비 | p90 − p10 `0.440` | 야외 사진은 원래 대비가 커서 **60%만** 이동 |

- 🚨 **대비는 밝기(luminance)에만 걸고 RGB 는 비율로 따라가게** 했습니다.
  채널마다 따로 걸면 채도까지 올라가 사진이 튑니다.
- 양 끝은 자르지 않고 지수로 눕혀(soft clip) 흰 소품이 뭉치지 않게 했습니다.
- 원본은 커밋 이력에 있습니다 — 되돌리려면 이 커밋 직전 버전을 꺼내세요.
- 🚨 **`og-projects.png` 안에도 같은 사진 3장이 들어 있습니다.** 사진 톤을 다시 바꾸면
  이 카드도 함께 고치세요. 안 그러면 링크 미리보기만 옛 톤으로 남습니다.

## 다국어 (한/영 토글)
- 상단 우측 **`🌐 한국어 ⌄` 버튼 → 누르면 목록(한국어 / English)이 펼쳐집니다.**
  - 접힌 버튼(`.lgtrig`)의 글자는 **지금 언어 이름**입니다. `setLang` 이 `.lgnow` 를 갱신합니다.
  - 실제 전환 버튼은 메뉴 안(`.lgmenu button[data-lang]`)에 있습니다.
    🚨 JS 의 선택자가 `.langsw button` 이 아니라 **`.lgmenu button[data-lang]`** 입니다.
    `.langsw button` 으로 되돌리면 접는 버튼까지 잡혀 `data-lang` 이 없는 클릭이 섞입니다.
  - 바깥을 누르거나 `Esc` 를 누르면 닫힙니다. 7개 공개 페이지에 같은 코드가 복사돼 있습니다.
- JS가 아래 속성을 바꿔치기합니다.
  - `data-en`      : 요소 내부 HTML (영문)
  - `data-en-alt`  : 이미지 alt
  - `data-en-href` : 링크 (메일 제목 영문판)
  - `data-en-ph`   : input placeholder
  - `data-en-aria` : aria-label
- **문구를 고칠 때는 한글 원문과 `data-en` 값을 반드시 함께 수정**하세요.
- **예외: 상단 탭(Home/About/Contact)은 일부러 `data-en`이 없습니다.** 한국어 화면에서도
  영어 이름 그대로 두기 위한 것이니 번역을 추가하지 마세요.
- 한국어 원문은 페이지 로드 시 JS가 `data-ko`에 자동 보관합니다 (HTML에 직접 쓰지 않음).

## 설치된 추적 코드 (`<head>`)
| 도구 | 상태 | 값 |
|---|---|---|
| GA4 | ✅ 완료 | `G-7HK4CQK6ZW` |
| Meta Pixel | ✅ 완료 | `2057112328550152` — 공개 페이지 전부 + checkout·confirm |
| 네이버 전환추적 | ⏳ 미완 | `YOUR_NAVER_KEY`, `YOUR_DOMAIN` 교체 필요 — **index.html + contact.html** |

> - **GA4**: 공개 페이지 8개 (index·about·projects·store·contact·exhibitions/*)
> - **Meta Pixel**: 위 8개 + privacy·terms·checkout·checkout-result·confirm
> - **네이버 전환추적**: `index.html` · `contact.html` 두 곳뿐 (전환이 일어나는 자리)
> - `admin`·`login`·`account`·`guardian` 에는 넣지 않았습니다 — 내 방문이 통계를 오염시키므로.

### 이벤트는 퍼널 역할별로 분리되어 있음 (뭉치지 말 것)
| 시점 | GA4 | Meta | 네이버 |
|---|---|---|---|
| 방문 | page_view | PageView | PV(wcs_do) |
| 가격 확인 | view_price | ViewContent | view_content |
| 문의 버튼 클릭 | cta_click | InitiateCheckout | custom001 |
| 실제 문의/이메일 신청 | contact_click / signup_email | Contact / Lead | lead |
| 언어 전환 | language_switch | — | — |

> ⚠️ 네이버는 **신 스크립트(`wcs.trans`) 전용**입니다.
> 구 스크립트(`wcs.cnv`)를 절대 함께 넣지 마세요 — 전환이 영구 필터링됩니다.

## 이메일 수집 (Supabase 저장 + Resend 발송)
**저장은 Supabase, 발송은 Resend**로 역할이 나뉘어 있습니다.
둘 중 하나만 설정돼 있어도 동작하며, 어디에도 저장되지 않으면 502로 실패시킵니다
(신청자에게 거짓 성공을 보여주지 않기 위함).

- 프론트: CTA의 `#subForm` → `POST /api/subscribe`
  (JSON: `email`, `lang`, `source`, `consent`)
- 백엔드: `api/subscribe.js`
  1. Supabase `subscribers` 테이블에 저장 (원본 명단 · 중복이면 409)
  2. Resend Audience에 연락처 추가
  3. 신청자에게 확인메일 발송 → 결과를 `status` 컬럼에 반영
- Supabase 접근은 **PostgREST REST API를 fetch로 직접 호출**합니다.
  `@supabase/supabase-js` 의존성이 없으므로 `package.json`도 필요 없습니다.

### 필요한 Vercel 환경변수 (Settings → Environment Variables)
| 변수 | 용도 |
|---|---|
| `SUPABASE_URL` | 프로젝트 URL (`https://xxxx.supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role 키 — **서버 전용** |
| `RESEND_API_KEY` | Resend API 키 (re_로 시작) |
| `RESEND_AUDIENCE_ID` | Resend Audiences에서 만든 명단 ID |
| `FROM_EMAIL` | 예: `김심리월드 <hello@pluspsychology.ai>` |
| `NOTIFY_EMAIL` | 신청 알림 받을 주소 (선택) |

- 출시 발송은 Resend **Broadcasts**에서 해당 Audience에 일괄 전송.
- 명단 백업/확인은 Supabase 대시보드 → Table Editor → `subscribers`.

### Supabase 테이블 (`supabase/schema.sql`)
- `subscribers` — 이메일 · 언어 · 유입경로 · **동의 증적**(consent / consented_at /
  consent_ip / consent_user_agent) · 발송상태 · 수신거부 여부
- `lower(email)` 유니크 인덱스로 중복 신청 차단 (위반 시 409 → 프론트가 "이미 신청됨" 표시)
- **RLS를 켜고 정책은 하나도 만들지 않았습니다.** anon 키로는 읽기·쓰기가 전부 막히고,
  서버의 service_role 키만 RLS를 우회합니다. → 프런트엔드에 Supabase 키를 넣을 일이 없습니다.
- 스키마를 바꿀 때도 **정책을 추가하지 마세요.** 정책 하나만 열려도 명단 전체가 공개됩니다.

### 🔒 보안 원칙 (반드시 지킬 것)
**API 키·시크릿을 index.html이나 프론트엔드 코드에 절대 넣지 마세요.**
소스 보기로 노출됩니다. 키는 Vercel 환경변수에만 둡니다.
특히 `SUPABASE_SERVICE_ROLE_KEY`는 RLS를 통째로 우회하므로, 노출되면
신청자 명단 전체를 읽고 지울 수 있습니다. 서버 코드 밖으로 절대 내보내지 마세요.

## 문의 폼 (contact.html → api/contact.js → Resend)

Contact 탭의 폼이 `POST /api/contact`로 보내고, 서버가 **Resend로 내 메일함에 전달**합니다.
**DB에 저장하지 않습니다** (문의는 명단이 아니므로). 받은 메일에 그대로 '회신'하면
문의자에게 바로 갑니다 — `reply_to`에 문의자 주소를 넣기 때문입니다.

| 항목 | 필수 | 비고 |
|---|---|---|
| 문의 유형 | ✅ | 5종 고정값. 서버가 화이트리스트로 검증 |
| 이름 (기관명) | ✅ | |
| 이메일 | ✅ | 답변받을 주소 |
| 연락처 | — | 전화 답변을 원할 때만 |
| 문의 제목 | ✅ | |
| 문의 내용 | ✅ | |
| 첨부파일 | — | 최대 3개 · 합계 3MB |
| 개인정보 수집·이용 동의 | ✅ | 개인정보보호법상 필수 (삭제 금지) |

### 필요한 Vercel 환경변수
| 변수 | 용도 |
|---|---|
| `RESEND_API_KEY` | 이메일 수집과 공용 |
| `FROM_EMAIL` | 이메일 수집과 공용 |
| `CONTACT_TO_EMAIL` | 문의를 받을 주소 (선택 — 없으면 `NOTIFY_EMAIL`, 그것도 없으면 `pluspsychology@gmail.com`) |

### 반드시 지킬 것
- **설정이 없으면 503을 돌려줍니다.** 그러면 화면이 "이메일로 보내주세요" 안내로 바뀝니다.
  접수되지 않았는데 성공했다고 보여주지 않기 위한 장치입니다. 200으로 바꾸지 마세요.
- 첨부 제한은 **`contact.html`의 `MAX_FILES`/`MAX_TOTAL`과 `api/contact.js`의
  `MAX_FILES`/`MAX_TOTAL_BYTES`가 같은 값**이어야 합니다. 한쪽만 올리면 조용히 잘립니다.
  3MB를 넘기지 마세요 — base64로 부풀면 Vercel 요청 본문 한도(4.5MB)에 걸립니다.
- 확장자는 **화이트리스트**입니다 (`ALLOWED_EXT`). 실행파일(.exe 등)은 차단됩니다.
- 폼에 **봇 함정(honeypot) `#website` 칸**이 있습니다. 화면 밖으로 숨긴 칸이라
  사람은 채울 수 없고, 채워져 오면 서버가 조용히 버립니다. 지우지 마세요.
- 메일 본문의 사용자 입력은 전부 `escapeHtml`을 거칩니다.

## 모바일 앱과 같은 Supabase 프로젝트를 씁니다
회원 계정·구매 이력·검사기록을 한 DB에서 관리합니다. 상세는 [docs/app-integration.md](docs/app-integration.md).

**앱 저장소: `G:\내 드라이브\BioHealthFinalDev` (Flutter)**
**Supabase 프로젝트 `syxwnbqsozdgmogeidtq`** — 앱이 이미 쓰는 DB를 공유합니다.

앱이 `profiles`·`consents`·`workbooks`·`workbook_purchases`·`assessments` 등 22개 테이블을
이미 갖고 있습니다. **랜딩이 추가하는 건 `subscribers`·`orders` 둘뿐**이고,
`schema-app.sql`은 새 테이블 없이 **트리거 2개**로 둘을 잇습니다.

- 이용권한은 앱의 **`workbook_purchases`** 를 씁니다 (별도 entitlements 만들지 않음)
- 청소년 처리도 앱이 이미 함 — `profiles.role='teen'`, `consents.teen_payment`
- 가입 트리거는 `auth.users`가 아니라 **`profiles`에 겁니다** (FK가 profiles를 참조)
- 랜딩 상품은 앱 5종과 별개인 **6번째 상품 `mind-manual`** (실물 전용).
  `schema-app.sql`이 `workbooks`에 `is_active=false`로 넣어 앱 목록에는 안 보입니다
  (RLS가 `using (authenticated and is_active)`). 트리거는 security definer라 매칭됨

**보안 모델이 테이블마다 다릅니다. 이걸 헷갈리면 명단이 통째로 새어나갑니다.**

| 테이블 | RLS 정책 | 접근 |
|---|---|---|
| `subscribers` | **없음 (절대 만들지 말 것)** | 서버 service_role 전용 |
| `orders` | 본인 이메일 SELECT 하나만 | 앱은 `my_orders` 뷰로 조회 |
| `profiles`·`entitlements`·`assessment_results` | `auth.uid()` 기준 | 앱이 anon 키로 직접 접근 |

- **모바일 앱에는 anon 키만.** service_role 키를 앱에 넣으면 바이너리에서 추출됩니다.
- 🚨 **Authentication → Confirm email 을 반드시 켜세요.** 구매자와 회원을 이메일로 매칭하는
  구조라, 확인이 꺼져 있으면 남의 이메일로 가입해 구매 권한을 가로챌 수 있습니다.
- 구매↔가입 순서가 어느 쪽이든 DB 트리거가 `entitlements`를 자동으로 채웁니다.

## 결제 (토스페이먼츠)

### 🔒 기본은 꺼져 있습니다
`PAYMENTS_ENABLED` 환경변수가 `'true'`일 때만 `/api/order`와 `/api/confirm`이 동작합니다.
그 전에는 503을 돌려주고, checkout.html은 "아직 판매를 시작하지 않았습니다" 안내로 바뀝니다.
**키만 넣는다고 결제가 열리지 않습니다.** 실수로 실결제가 열리는 것을 막기 위한 장치입니다.

### 흐름
```
checkout.html
  → POST /api/order      서버가 금액 계산 · orders 행 생성(pending) · clientKey 반환
  → 토스 결제창 (SDK v2)
  → checkout-result.html  ?paymentKey&orderId&amount 로 리다이렉트
  → POST /api/confirm    금액 대조 후 토스 승인 API 호출 · orders 행 paid로 갱신
```

### 반드시 지킬 것
- **금액은 클라이언트에서 받지 않습니다.** `api/order.js`의 `PRODUCT.unitPrice`와
  `SHIPPING_FEE`로 서버가 계산해 DB에 저장하고, 승인 시 그 값과 대조합니다.
  화면의 금액 표시는 안내용일 뿐입니다.
- **`TOSS_SECRET_KEY`는 `api/confirm.js`에만** 둡니다. `api/order.js`는 클라이언트 키만 다룹니다.
- 리다이렉트 도착 시점에는 **아직 결제가 안 끝난 상태**입니다. `/api/confirm`이 성공해야 확정입니다.
- 이미 `paid`인 주문은 200 + `alreadyConfirmed`를 돌려줍니다 (새로고침 중복 승인 방지).

### 환경변수
| 변수 | 용도 |
|---|---|
| `PAYMENTS_ENABLED` | `'true'`여야 결제 동작 (안전장치) |
| `TOSS_CLIENT_KEY` | 클라이언트 키 (공개용 — 프런트로 내려감) |
| `TOSS_SECRET_KEY` | 시크릿 키 — **서버 전용, 절대 노출 금지** |

### 아직 안 된 것
- 토스페이먼츠 **상점 계약·심사** (사업자등록증 필요) → 지금은 테스트 키로만 연동 확인 가능
- 주문 확인 메일 발송 (Resend 연동 예정)
- 환불·취소 처리 (현재는 토스 관리자 화면에서 수동)
- 해외 배송 (`SHIPPING_FEE`에 KR만 있음 — 국가 추가 시 자동으로 열림)
- 가격 ₩16,900은 임시값

## 법적 문서 (privacy.html · terms.html)
현재는 **사업 개시 전(아이디어 반응 검증) 모드**입니다.
사업자 정보는 화면에 나오지 않고, 상호와 이메일만 표시됩니다.

### 사업 시작하면 이렇게 켭니다
각 파일 하단 `<script>`의 `BUSINESS` 객체에 값을 채우고 `active: true`로 바꾸면 됩니다.
**두 파일을 모두 고쳐야 합니다** (파일이 자체 완결형이라 설정이 각각 들어 있음).

```js
var BUSINESS = {
  active: true,          // ← false에서 true로
  representative: '홍길동',
  regNo: '123-45-67890',
  mailOrderNo: '',       // 신고 면제면 빈 값 → 해당 행이 자동으로 숨겨짐
  address: '...',
  phone: '...'
};
```

| 파일 | active:false (현재) | active:true |
|---|---|---|
| terms.html 제12조 | 상호·이메일 + "판매 개시 시 게시" 안내 | 대표자·사업자등록번호·주소·전화 전체 표 |
| privacy.html 제10조 | 보호책임자 "대표자" + 이메일 | 보호책임자 실명 + 연락처 행 추가 |

- 기본 HTML이 **사업 개시 전 상태**이므로, JS가 꺼져 있어도 빈 표가 보이지 않습니다.
- 보호책임자를 직책("대표자")으로 표기하는 것은 소상공인의 경우 허용됩니다
  (개인정보보호법 시행령 제32조 — 대표자가 자동으로 보호책임자).
- 전자상거래법상 사업자정보 표시 의무는 **실제 판매를 시작할 때** 발생합니다.
  지금은 이메일 수집만 하므로 처리방침만 있으면 됩니다.

> ⚠️ 두 문서는 실무 초안이며 법률 자문이 아닙니다. **판매 개시 전 전문가 검토를 권장합니다.**
> (이 문구는 내부용입니다 — 공개 페이지에는 넣지 마세요)

- 두 문서는 index.html과 **같은 data-en 방식**으로 한/영을 전환합니다.
  문구를 고칠 때 `data-en` 값도 반드시 함께 수정하세요.
- **`data-en` 안에 링크가 있으면 `<a>` 태그째로 넣어야 합니다.** 평문으로 넣으면
  영문 모드에서 링크가 사라집니다 (한 번 발생했던 실수).
- 약관 제8조는 **의료행위·심리치료가 아님**을 명시하고 위기상담 전화(109 등)를
  안내합니다. 심리 콘텐츠의 핵심 면책이므로 삭제하지 마세요.
- 약관 제11조에 **한국어본 우선** 조항이 있습니다. 영문은 참고용입니다.
- 국외이전 표(privacy.html 제6조)는 Supabase·Resend·Vercel·Google을 명시합니다.
  **수탁사를 추가·교체하면 이 표와 제5조를 반드시 갱신**하세요.

### ⚖️ 한국 법규 (정보통신망법)
광고성 이메일이므로 아래는 제거하면 안 됩니다:
- 폼의 **사전 수신동의 체크박스** (옵트인 필수)
- 메일 **제목의 `(광고)` 표기**
- 메일 본문의 **수신거부 링크** (`{{{RESEND_UNSUBSCRIBE_URL}}}`)
- 21시~08시 발송은 별도 동의 필요 → 낮에 발송

## 나중에 다시 물어볼 것 (사용자 보류)
회원 퍼널 개선안 중 아래 둘은 **논의 후 진행하기로 미뤄둔 항목**입니다.
다음에 로그인·가입 작업을 할 때 다시 여쭤보세요.

- [ ] **가입 이유를 화면에 보이기** (원래 1순위) — 지금 `/login` 은 "앱과 같은 계정으로
      로그인합니다"라는 기능 설명뿐이라, 가입해서 뭘 얻는지가 없습니다.
      가입 혜택 3줄(앱·웹 공유 / 구매한 워크북이 앱에서 열림 / 주문 상태 확인)을
      로그인 카드 상단에 넣는 안.
- [ ] **구매 → 가입 연결** (원래 5순위) — 가장 자연스러운 가입 동기는 구매인데
      지금 `/store` 와 `/login` 이 서로 모릅니다. `checkout-result` 에서
      "이 주문을 계정에 연결하면 앱에서 바로 열려요 → 가입하기" 를 붙이는 안.
      `orders.buyer_email` 로 이미 매칭되는 구조라 데이터는 준비돼 있습니다.

## 남은 작업 (TODO)
- [ ] **후기(`.revs`)가 화면에서 빠져 있습니다** — 있던 후기 3개가 지어낸 예시였고
      별점과 함께 걸면 표시광고법 위반 소지가 있어 2026-08-03 에 지웠습니다.
      **실제 후기가 생기면** `index.html` 의 `.proof` 섹션에 다시 넣으세요 (스타일은 그대로 있습니다).
      🚨 커밋 이력의 옛 문구를 되살리지 마세요 — 지어낸 문장입니다.
- [ ] **가격 ₩16,900은 임시값** — 실제 판매가 확인 후 수정 (`.amount` 및 추적 코드의 `value:16900`)
- [ ] About 탭의 **유튜브·블로그 링크** — 원본 `김심리월드_bio.html`에 `href="#"`
      자리표시자로만 있어서 넣지 않았습니다. 실제 주소가 생기면 `.contacts`에 추가하세요.
- [ ] **문의 폼 켜기** — `RESEND_API_KEY` · `FROM_EMAIL` · `CONTACT_TO_EMAIL` 설정.
      그 전까지 `/api/contact`는 503을 돌려주고 화면은 "이메일로 보내주세요" 안내가 뜹니다
      (Resend 도메인 인증이 선행되어야 합니다)
- [ ] 네이버 전환추적 신청 → 네이버공통키 발급 후 `YOUR_NAVER_KEY` / `YOUR_DOMAIN` 교체
      (**index.html·contact.html 두 파일**)
      (새 광고주센터: 도구 → 전환 추적 관리. 비즈채널 등록·검수 선행 필요)
- [ ] 🚨 **service_role 키 재발급** — 채팅으로 전달된 이력이 있어 신뢰할 수 없음.
      재발급 방법과 주의사항은 [docs/app-integration.md](docs/app-integration.md) "설정 순서"
- [ ] **Supabase 연결 → 이메일 수집 켜기** — 순서는 [docs/setup-supabase.md](docs/setup-supabase.md)
      (앱이 쓰는 기존 프로젝트이므로 위 "모바일 앱" 절의 충돌 주의사항을 먼저 읽으세요)
      (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) — 이것만 해도 이메일 수집이 동작합니다
- [ ] 사업 시작 시점에 두 파일의 `BUSINESS.active`를 true로 전환 (위 "법적 문서" 참고)
- [ ] 🚨 **해외 매출을 주식(증권)계좌로 받을 수 없음** → 사업자 외화 은행계좌 개설 가능 여부와
      사업용계좌 신고 방법을 은행·세무사에 확인. 이게 안 풀리면 해외 결제 설계가 막힘
      (소득세법 제160조의5 — 사업용계좌는 은행 계좌여야 함)
- [ ] 실물 해외 배송 경제성 검토 — ₩16,900 책 1권 국제배송비가 상품가에 육박
      (`api/order.js`의 `SHIPPING_FEE`에 국가를 추가하면 해당 국가 배송이 열립니다)
- [ ] 토스페이먼츠 상점 계약·심사 (사업자등록증 필요) → 테스트 키 검증 후 라이브 키 전환
- [ ] 통신판매업 신고 + 약관 제10조 채우기 (현재 "구매 페이지에 별도 고지"로 위임)
- [ ] 주문 확인 메일 발송 연동 (Resend) — 현재 주문 후 메일이 나가지 않음
- [ ] 환불·취소 처리 절차 (현재는 토스 관리자 화면에서 수동)
- [ ] 판매 준비 전반은 [docs/commerce-plan.md](docs/commerce-plan.md) 참고
- [ ] Resend 도메인 인증(pluspsychology.ai) + 환경변수 4개 설정
- [ ] **Search Console 인증 파일 `googlee928fd2a17217f2b.html`이 저장소에 없음** →
      루트에 추가해야 소유권 확인 가능 (내용 한 줄: `google-site-verification: googlee928fd2a17217f2b.html`)
- [ ] sitemap.xml이 현재 페이지 상태와 맞는지 확인 (about/contact는 추가해 두었습니다)

## 관리자 대시보드 (`/admin`)

로그인해야 보이는 내부 화면입니다. `noindex` + `robots.txt` 차단이 걸려 있습니다.

### 보이는 것
| 구역 | 내용 | 출처 |
|---|---|---|
| 접수 현황 | 이메일 알림신청 · 문의 · 구매 · 앱 회원가입 **4종을 각각** 카드 + 꺾은선 | Supabase |
| 퍼널 현황 | 방문 → 가격 확인 → 문의 버튼 → 접수 → 결제, 단계별 잔존율·이탈 수 | 둘을 합침 |
| 방문 통계 | 활성 사용자 · 세션 · 페이지뷰 추이, 유입 채널, 페이지별 조회수, 이벤트 | GA4 Data API |
| 캠페인 | 캠페인별 방문자 · 신청 · 문의 · 결제 · **가입률 · 전환율** | 둘을 합침 |
| 최근 접수 | 최근 알림신청/문의 8건 (이메일은 마스킹) | Supabase |

### 퍼널 현황 — 어디서 새는지 보는 곳
`api/admin-stats.js` 의 `buildFunnel()` 이 단계를 만들고, `admin.html` 의 `renderFunnel()` 이 그립니다.

| 단계 | 출처 | 단위 |
|---|---|---|
| 방문 | GA4 활성 사용자 | 명 |
| 가격 확인 | GA4 `view_price` **사용자 수** | 명 |
| 문의 버튼 클릭 | GA4 `cta_click` **사용자 수** | 명 |
| 실제 접수 | Supabase 알림신청 + 문의 | 건 |
| 결제 완료 | Supabase `orders(paid)` | 건 |

- 🚨 **앞 3단계는 '사람 수', 뒤 2단계는 '건수'** 입니다. 개인 단위로 이어붙인 퍼널이 아니라
  규모 비교입니다. 화면에도 그렇게 적어 두었으니 지우지 마세요.
- 이벤트는 `eventCount` 가 아니라 **`activeUsers`** 로 셉니다. 한 사람이 가격을 세 번 보면
  eventCount 는 3, 사람은 1 입니다. 퍼널을 eventCount 로 바꾸면 잔존율이 100%를 넘습니다.
- 🚨 **앱 회원가입은 이 퍼널에 넣지 않았습니다.** 앱 가입에는 유입 경로가 없어서
  랜딩이 만든 가입인지 알 수 없습니다. 넣으면 랜딩 성과처럼 보입니다.
- **비율은 분모를 모르면 비웁니다.** GA4 가 없으면 앞 3단계가 `—` 로 남습니다.
- **꺼져 있는 기능은 이탈이 아닙니다.** `PAYMENTS_ENABLED` 가 없으면 결제 단계는
  `아직 열지 않음` 으로 표시되고 병목 계산에서 빠집니다. 이걸 없애면 "결제에서 100% 이탈"
  이라는 잘못된 진단이 나옵니다.

#### 퍼널을 여는 스위치
`readSwitches()` 가 환경변수의 **켜짐/꺼짐만** 내려보냅니다.
🚨 **키 값 자체는 절대 응답에 담지 마세요.** 이 화면은 로그인 뒤지만 값이 필요하지 않습니다.

#### 개선 과제 목록은 손으로 관리합니다
`admin.html` 의 `TASKS` 배열입니다 (`done` / `hold` / `todo`).
자동 갱신되지 않으니 **항목을 끝내면 직접 고치세요.** 화면에도 그렇게 적어 두었습니다.

### 🔒 인증은 2단계입니다 — 한쪽만 통과하면 안 됩니다
1. **Supabase Auth 토큰** — 브라우저가 로그인해 받은 토큰을 서버가 Supabase에 되물어 검증
2. **이메일 허용목록** — 그 이메일이 `ADMIN_EMAILS` 에 있어야 데이터를 내려줍니다

앱 회원과 같은 Supabase를 쓰므로 **로그인만으로 통과시키면 앱 사용자 누구나 들어옵니다.**
2단계를 하나로 줄이지 마세요. `ADMIN_EMAILS` 가 비어 있으면 서버가 503으로 막습니다
(실수로 전체 공개되는 것을 방지).

### 필요한 Vercel 환경변수
| 변수 | 용도 |
|---|---|
| `SUPABASE_URL` · `SUPABASE_SERVICE_ROLE_KEY` | 집계 조회 (기존과 공용) |
| `SUPABASE_ANON_KEY` | 로그인·토큰검증용 — **공개돼도 되는 키** |
| `ADMIN_EMAILS` | 쉼표 구분 허용 이메일. 비면 대시보드가 열리지 않습니다 |
| `GA4_PROPERTY_ID` | **숫자 속성 ID** (`G-7HK4CQK6ZW` 측정ID가 아닙니다) |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` · `GOOGLE_PRIVATE_KEY` | GA4 Data API 서비스계정 |

- GA4 설정이 없어도 **Supabase 수치는 그대로 나옵니다.** 방문자 칸만 `—` 로 비고
  전환율은 계산하지 않습니다 (분모를 모르면서 비율을 지어내지 않기 위함).
- `api/public-config.js` 는 anon 키만 내려줍니다. **service_role 키를 여기 넣지 마세요.**

### 캠페인 등록 방법
`supabase/schema-admin.sql` 을 SQL Editor에서 한 번 실행한 뒤,
`campaigns` 표에 행을 추가하면 대시보드에 나타납니다.

- `slug='spring-2026'` → 방문자를 `/c/spring-2026` 경로에서 셉니다 (`page_path` 로 덮어쓸 수 있음)
- 🚨 **캠페인 페이지의 폼은 `campaign` 값을 함께 보내야 합니다.** 안 보내면 방문자만 잡히고
  신청·문의가 그 캠페인에 연결되지 않아 전환율이 0으로 보입니다.
  `subscribers`·`inquiries`·`orders` 세 표 모두 `campaign` 컬럼을 갖고 있습니다.
- `source` 와 `campaign` 은 역할이 다릅니다 — `source`=사이트 어디서, `campaign`=어느 캠페인.
- 앱 회원가입은 **캠페인별로 나눌 수 없습니다.** 앱 가입에 유입 경로가 기록되지 않기 때문입니다.
  랜딩에서 앱으로 보낼 때 campaign 을 넘겨 `profiles` 에 저장하면 그때 나뉩니다.

## 웹 로그인 — 앱과 같은 계정 (`/login` · `/account`)

**같은 Supabase 프로젝트를 쓰므로 계정은 원래 공유됩니다.** 앱에서 가입한 사람은
웹에서 같은 이메일·비밀번호로 그대로 로그인됩니다. 별도 '연동' 코드가 없습니다.

### 가입할 때 앱과 똑같은 두 줄을 만들어야 합니다
앱(`auth_controller.dart`)은 가입 직후 **클라이언트에서** 이 둘을 만듭니다.
DB 트리거가 아니므로 웹도 같은 일을 해야 합니다.

```
profiles  : { id, birth_year(필수), role: 'teen' | 'member' }
consents  : { user_id, consent_type:'service', granted:true }
```

- `role` 판정은 앱과 같은 규칙 — **(올해 − 출생연도) < 19 이면 `teen`**
- 🚨 **`auth.users` 에 프로필 생성 트리거를 걸지 마세요.** 앱이 `profiles.insert` 를
  직접 하므로 트리거가 먼저 만들면 중복키로 **앱 가입이 깨집니다.**

### 🚨 확인메일 복귀 주소는 쿼리스트링입니다 (본문에 넣으면 무시됩니다)
`/auth/v1/signup` 을 REST 로 직접 부르므로 **JS SDK 문법이 통하지 않습니다.**

```js
// ❌ SDK 문법 — GoTrue 가 본문의 options 를 통째로 무시합니다
body: { email, password, options: { emailRedirectTo: '.../confirm' } }

// ✅ REST 문법 — 쿼리스트링으로 보냅니다
fetch(url + '/auth/v1/signup?redirect_to=' + encodeURIComponent(origin + '/confirm'), …)
```

틀리면 **오류 없이 조용히** 확인메일 링크가 Supabase 의 **Site URL** 로 갑니다.
Site URL 이 기본값(`http://localhost:3000`)이면 링크를 눌러도 확인이 끝나지 않아
"가입이 안 된다"로 보입니다. `login.html` 의 `RETURN_TO` 상수 한 곳에 모아뒀습니다.

**Supabase 쪽에도 두 가지가 맞아야 합니다** (Authentication → URL Configuration):
- **Site URL** = `https://www.pluspsychology.ai`
- **Redirect URLs** 에 `https://www.pluspsychology.ai/confirm` 등록
  — 등록되지 않은 주소는 무시되고 Site URL 로 대체됩니다.

⚠️ **비밀번호 재설정은 아직 미완성입니다.** `/auth/v1/recover` 는 복귀 주소를 보내지
않고, 새 비밀번호를 입력받을 화면도 없습니다. 재설정 링크는 Site URL 로만 갑니다.

### 이메일 확인이 켜지면 가입 순서가 달라집니다
확인이 켜져 있으면 `signup` 응답에 **세션이 없습니다.** 그 시점에는 RLS
(`profiles_insert_own`)가 막아 프로필을 만들 수 없습니다. 그래서 웹은:

1. 가입할 때 출생연도를 **계정 메타데이터(`user_metadata.birth_year`)** 에 실어 보냄
2. 확인 메일 → 로그인 → `/account` 가 프로필이 없으면 그 값으로 자동 생성
3. 메타데이터도 없으면(앱 OAuth 등) 연령 확인 칸을 보여주고 입력받아 생성

앱도 프로필 없는 계정을 `SplashGateScreen` → 연령 확인으로 복구하므로,
**웹에서 가입하고 앱을 먼저 열어도 정상 동작합니다.**

### 읽기는 서버, 쓰기는 브라우저
- **읽기**(`api/account.js`) — `orders` 는 RLS 정책이 하나도 없어 service_role 로만
  읽힙니다. `profiles`·`workbook_purchases` 만 브라우저로 읽으면 경로가 둘로
  갈리므로 **읽기는 전부 서버**로 모았습니다. 서버는 토큰을 검증해 **본인 것만** 돌려줍니다.
- **쓰기**(프로필 생성) — 앱과 똑같이 브라우저에서 본인 토큰으로. RLS 가 지켜줍니다.

### 비밀번호 규칙 — 세 조건을 모두 채워야 합니다
`8자 이상` · `숫자 포함` · `특수문자 포함`. 입력하는 동안 **어떤 조건이 아직 안 맞는지
실시간으로** 보여주고, 제출을 눌렀을 때만 못 채운 것을 빨갛게 표시합니다.
다 쓴 뒤에 한꺼번에 혼내지 않기 위한 순서입니다.
- 세 조건은 `login.html` 의 `PW` 객체 한 곳에만 있습니다. 규칙을 바꾸면 문구도 함께 바뀝니다.
- ⚠️ Supabase 쪽 최소 길이(기본 6자)와 별개입니다. 화면 규칙이 더 엄격합니다.

### 나이 — 기준이 두 개이고 근거 법이 다릅니다
| 기준 | 근거 | 언제 |
|---|---|---|
| 만 **14세** 미만 | 개인정보보호법 제22조의2 | **가입 차단** (법정대리인 동의를 웹에서 받을 수 없음) |
| 만 **19세** 미만 | 민법 제5조 | **결제 전 보호자 동의** 필요 (없으면 미성년자가 취소 가능) |

- 출생 '연도'만으로는 만 나이를 알 수 없어 **생년월일 전체**를 받습니다 (`profiles.birth_date`).
- 🚨 **`role` 판정은 앱과 같은 규칙(연도 기준)을 씁니다.** 웹만 정확한 만 나이로 판정하면
  같은 사람이 앱에서는 teen, 웹에서는 member 가 되는 일이 생깁니다.
  만 나이는 **가입 차단과 보호자 동의 판정에만** 씁니다.
- `birth_year` 는 앱이 not null 로 쓰므로 계속 채웁니다. 지우지 마세요.
- 🚨 **계산한 만 나이는 화면에 띄우지 않습니다** (2026-08-06, 사용자 요청).
  생년월일 아래에 실시간으로 나이를 보여주던 `showAgeHint()` 를 지웠고,
  만 14세 미만 오류 문구도 `'만 14세 미만은…'` 이라고만 말합니다.
  **`koreanAge()` 는 그대로 두세요** — 가입 차단과 보호자 동의 판정이 이 함수에 걸려 있습니다.
- 가입 탭에서는 카드 위 안내문구(`#lead`)를 감춥니다. 로그인 탭으로 돌아오면 다시 보입니다.

### 보호자(법정대리인) 동의 — `/guardian`
미성년 회원이 **결제하기 전에** 한 번 받습니다. 가입 시점이 아닙니다
(만 14세 이상은 가입 자체는 본인 동의로 됩니다).

- `guardian_consents` 에 증적(보호자 성함·관계·연락처·IP·시각)을 남기고,
  앱이 읽는 `consents.teen_payment` 에도 함께 씁니다.
- `method='self_report'` — 지금은 웹 폼 입력입니다. 보호자 메일 확인을 붙이면
  `'email_verified'` 로 올라갑니다. **분쟁 대비로는 메일 확인까지 받는 편이 안전합니다.**
- 결제를 열 때는 `payment_eligibility` 뷰로 `is_minor` 와 `has_guardian_consent` 를
  확인하고 주문을 받으세요.

### 그 밖에
- 세션은 `sessionStorage` 에만 둡니다 — 탭을 닫으면 로그아웃됩니다.
- 확인 메일 화면에 **재발송(60초 쿨다운)** 과 **주소 고치기**가 있습니다. 여기가 이탈이
  가장 큰 지점이라, 되돌아갈 길을 막지 마세요.
- 이메일 도메인 **오타를 감지해 제안**합니다 (`gmial.com` → `gmail.com`). 편집거리 2 이하로
  흔한 도메인과 비교합니다. 도메인을 추가하려면 `DOMAINS` 배열에 넣으세요.
- 비밀번호 재설정은 **가입된 주소인지 알려주지 않습니다** (계정 존재 여부 노출 방지).
- 카카오 로그인은 웹에 넣지 않았습니다. 앱도 지금 버튼을 숨긴 상태입니다.
- `account.html` 의 `APP_URL` 이 앱 딥링크입니다. 스토어 주소가 생기면 여기만 고치세요.

## 화면 폭 — 컨테이너는 넓게, 글은 읽기 좋게

`:root` 에 두 값이 있고, 7개 공개 페이지가 **같은 값**을 씁니다.

| 변수 | 값 | 무엇 |
|---|---|---|
| `--page` | `960px` | 화면 전체 폭 (`.page`) |
| `--read` | `660px` | 글이 담긴 요소의 최대 폭 |

- 🚨 **`--page` 를 페이지마다 다르게 두지 마세요.** 헤더 안쪽(`.hdr`)도 같은 값을 쓰므로,
  값이 다르면 탭을 옮길 때 로고 위치와 헤더 폭이 들썩입니다.
- 제목·본문·`.lede` 는 `--read` 로 묶여 가운데 정렬됩니다. 카드·그리드·사진은
  `--page` 폭을 그대로 씁니다. **컨테이너를 넓혔다고 글줄까지 길어지면 읽기 어려워집니다.**
- `privacy` · `terms` 는 글이 전부이므로 `.doc` 자체를 `--read` 로 묶었습니다.

### 옛 레이아웃으로 되돌리려면
넓히기 직전(좁은 660px 단일 컬럼) 상태가 브랜치로 보존돼 있습니다.

```
브랜치: layout/narrow-660   (커밋 0212dd4)
```

- 통째로 되돌리기: `git checkout layout/narrow-660 -- index.html about.html projects.html store.html contact.html privacy.html terms.html`
- 폭만 되돌리기: `:root` 의 `--page` 를 `660px` 로 바꾸면 거의 같아집니다.
- 비교해 보기: `git diff layout/narrow-660 -- index.html`

## 페이지 위치 표시 (breadcrumb)
헤더 바로 아래, **본문과 같은 왼쪽 끝에서 시작하는** `Home / 현재페이지` 한 줄입니다.
**홈에는 없습니다** (자기 자신이므로).

- 🚨 `<nav class="crumb">` 는 헤더 **바깥**, `.page` 의 첫 줄에 두세요.
  헤더 안(`.tbright`·`.topbar`)에 들어가면 오른쪽 도구들과 같은 줄에 끼어
  **오른쪽으로 밀립니다** (실제로 그렇게 들어가 있던 것을 고쳤습니다).
- 탭이 있는 페이지(About·Projects·Store·Contact)는 **탭 이름 그대로 영어**입니다 —
  사이트 규칙대로 `data-en` 을 붙이지 마세요.
- 약관·방침은 한글 이름이라 `data-en` 이 있습니다 (`이용약관` ↔ `Terms of Service`).
- 각 페이지 `<head>` 에 **`BreadcrumbList` 구조화 데이터**가 함께 들어 있습니다.
  검색결과에 `pluspsychology.ai › Store` 처럼 경로가 표시됩니다.
  **breadcrumb 문구를 바꾸면 이 JSON-LD 도 함께 고치세요.**

## 주소에 `.html`을 붙이지 않습니다
`vercel.json`의 `"cleanUrls": true` 로 `/about.html` 이 아니라 **`/about`** 으로 서비스됩니다.
옛 주소로 들어와도 Vercel이 308로 새 주소에 보내주며, **쿼리스트링은 보존**됩니다
(토스 결제 복귀 주소 `?paymentKey=...&orderId=...` 가 여기 의존합니다).

- **새 링크를 넣을 때 `.html`을 붙이지 마세요.** 붙여도 동작은 하지만 리다이렉트가 한 번 더 돕니다.
- 홈은 `/index`가 아니라 **`/`** 입니다.
- `canonical` 태그와 `sitemap.xml`도 `.html` 없는 주소로 맞춰져 있습니다. 한쪽만 고치면
  검색엔진에 중복 주소로 잡힙니다 — **함께 고치세요.**
- `api/*` 경로는 영향받지 않습니다 (`.html`이 아니므로).

## 링크 미리보기 (Open Graph · Twitter Card)
카카오톡·페이스북·슬랙 등에 주소를 붙였을 때 보이는 카드입니다.
`index` · `about` · `projects` · `store` · `contact` · `privacy` · `terms` 일곱 페이지에
들어 있습니다 (`confirm`·`checkout`은 noindex라 넣지 않았습니다).

| 페이지 | og:image |
|---|---|
| Store | `og-store.png` (굿즈 6종) |
| Projects | `og-projects.png` (전시 사진 3장) |
| 나머지 | `og.png` (워크북 표지 + 로고 + 캐릭터) |

- 🚨 **`og:image`는 반드시 실제 파일의 절대 URL이어야 합니다.** 이 사이트는 캐릭터·표지를
  base64로 인라인하지만, **`data:` URI는 크롤러가 읽지 못합니다.** 그래서 `og*.png` 세 장만
  실제 파일로 두었습니다. 지우거나 `.vercelignore`에 넣지 마세요.
- 세 장 모두 1200×630입니다. 크기를 바꾸면 `og:image:width`/`height`도 함께 고치세요.
- **크롤러는 JS를 실행하지 않습니다.** 언어 전환(`data-en`)과 무관하게 항상 한국어 값이
  쓰이므로 영문 미리보기는 나오지 않습니다. 문구를 고칠 때 `<title>`·`description`·
  `og:title`·`og:description`·`twitter:*` 를 **함께** 고치세요 (한 페이지에 5군데).
- **`content` 값에 ASCII `<` `>` 를 쓰지 마세요.** 일부 스크래퍼가 태그로 오인해 문장을
  잘라먹습니다. 책 제목은 전각 꺾쇠 `〈마음 사용 설명서〉`를 씁니다.
- 미리보기가 갱신되지 않으면 각 플랫폼 캐시 때문입니다 —
  페이스북 [Sharing Debugger](https://developers.facebook.com/tools/debug/) 에서 Scrape Again,
  카카오톡은 [캐시 초기화](https://developers.kakao.com/tool/clear/og).

## 주의사항
- 광고 연결 URL에 `#`(앵커)를 넣지 마세요. 네이버 NaPm 파라미터가 무시되어 전환추적이 깨집니다.
  (페이지 내부 버튼이 `#contact`를 쓰는 것은 무관합니다)
- 브라우저 저장소(localStorage 등) 미사용. 언어 선택은 새로고침 시 한국어로 초기화됩니다.
- `prefers-reduced-motion` 대응됨. 애니메이션만 꺼지고 기능은 정상 동작해야 합니다.
