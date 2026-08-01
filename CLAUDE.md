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

### 상단 탭 (Home / About / Contact)
세 페이지가 같은 상단바 + 탭 내비게이션을 공유합니다 (`.topbar` → `nav.tabs`).

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

## 다국어 (한/영 토글)
- 상단 우측 `한국어 | EN` 버튼. JS가 아래 속성을 바꿔치기합니다.
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
| Meta Pixel | ⏳ 미완 | `YOUR_PIXEL_ID` 교체 필요 — **index.html 2곳 + contact.html 2곳** |
| 네이버 전환추적 | ⏳ 미완 | `YOUR_NAVER_KEY`, `YOUR_DOMAIN` 교체 필요 — **index.html + contact.html** |

> 추적 스크립트가 들어간 페이지: `index.html`(GA4+Meta+네이버) ·
> `contact.html`(GA4+Meta+네이버 — 핵심 전환인 문의 접수가 여기서 일어나므로) ·
> `about.html`(GA4만). 나머지 페이지에는 넣지 않았습니다.

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

## 남은 작업 (TODO)
- [ ] **후기 3개가 지어낸 예시임** — 실제 후기로 교체 전까지 공개 시 표시광고법 위반 소지.
      실제 후기가 없으면 `.revs` 블록을 임시 제거 권장.
- [ ] **가격 ₩16,900은 임시값** — 실제 판매가 확인 후 수정 (`.amount` 및 추적 코드의 `value:16900`)
- [ ] About 탭의 **유튜브·블로그 링크** — 원본 `김심리월드_bio.html`에 `href="#"`
      자리표시자로만 있어서 넣지 않았습니다. 실제 주소가 생기면 `.contacts`에 추가하세요.
- [ ] **문의 폼 켜기** — `RESEND_API_KEY` · `FROM_EMAIL` · `CONTACT_TO_EMAIL` 설정.
      그 전까지 `/api/contact`는 503을 돌려주고 화면은 "이메일로 보내주세요" 안내가 뜹니다
      (Resend 도메인 인증이 선행되어야 합니다)
- [ ] Meta 픽셀 ID 발급 후 `YOUR_PIXEL_ID` 교체 (**index.html·contact.html 두 파일**)
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
