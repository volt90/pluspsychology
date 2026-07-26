# 김심리월드 — 워크북 랜딩페이지 (프로젝트 인수인계)

## 개요
심리 워크북 **〈마음 사용 설명서〉** 판매/리드수집용 단일 페이지.
- 브랜드: 김심리월드 (심리교육 캐릭터 IP)
- 운영자: 김심리 (심리학 박사 · 임상심리사 1급)
- 타깃: 자기심리를 알고 싶은 10대·20대 + 교사/학부모
- 라이브: https://www.pluspsychology.ai  (Vercel 배포, GitHub: volt90/pluspsychology)

## 파일 구조
```
index.html          # 랜딩페이지 전체 (CSS·JS·이미지 base64 모두 인라인, 약 400KB)
privacy.html        # 개인정보처리방침 (한/영)
terms.html          # 이용약관 (한/영)
checkout.html       # 주문/결제 페이지 (noindex)
checkout-result.html # 결제 성공·실패 화면 (토스 리다이렉트 목적지, noindex)
api/subscribe.js    # 이메일 알림신청 처리 (Vercel 서버리스 함수)
api/order.js        # 주문 생성 — 결제 금액을 서버가 계산
api/confirm.js      # 토스페이먼츠 결제 승인
supabase/schema.sql # subscribers · orders 테이블 정의 (Supabase SQL Editor에서 실행)
docs/commerce-plan.md  # 판매 개시 준비 (결제·환불·회원 정책 설계)
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

## 페이지 구성 (순서 고정)
히어로 → 문제 정의 → 해결 방법(3단계) → 가격 → 증거 → CTA(이메일 수집 + 문의)

## 디자인 규칙
- 색: 크림 `#FBF6EA` 배경 / 신뢰의 파랑 `#4C8CCB` / 골드 `#F2B620` / 코랄 `#E86B5E`
- 폰트: 제목·본문 `Noto Sans KR`, 포인트만 `Jua`(주아체)
- 시그니처 모티프: **마음 배터리** — 히어로 1%(빨강) → 3단계 33/66/100% → CTA 만충(초록)
- 톤: 담백하고 신뢰감 있게. 과장 광고 표현 금지.

## 다국어 (한/영 토글)
- 상단 우측 `한국어 | EN` 버튼. JS가 아래 속성을 바꿔치기합니다.
  - `data-en`      : 요소 내부 HTML (영문)
  - `data-en-alt`  : 이미지 alt
  - `data-en-href` : 링크 (메일 제목 영문판)
  - `data-en-ph`   : input placeholder
  - `data-en-aria` : aria-label
- **문구를 고칠 때는 한글 원문과 `data-en` 값을 반드시 함께 수정**하세요.
- 한국어 원문은 페이지 로드 시 JS가 `data-ko`에 자동 보관합니다 (HTML에 직접 쓰지 않음).

## 설치된 추적 코드 (`<head>`)
| 도구 | 상태 | 값 |
|---|---|---|
| GA4 | ✅ 완료 | `G-7HK4CQK6ZW` |
| Meta Pixel | ⏳ 미완 | `YOUR_PIXEL_ID` 2곳 교체 필요 |
| 네이버 전환추적 | ⏳ 미완 | `YOUR_NAVER_KEY`, `YOUR_DOMAIN` 교체 필요 |

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
- [ ] Meta 픽셀 ID 발급 후 `YOUR_PIXEL_ID` 교체
- [ ] 네이버 전환추적 신청 → 네이버공통키 발급 후 `YOUR_NAVER_KEY` / `YOUR_DOMAIN` 교체
      (새 광고주센터: 도구 → 전환 추적 관리. 비즈채널 등록·검수 선행 필요)
- [ ] **Supabase 프로젝트 생성 → `supabase/schema.sql` 실행 → 환경변수 2개 설정**
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
- [ ] sitemap.xml이 현재 페이지 상태와 맞는지 확인

## 주의사항
- 광고 연결 URL에 `#`(앵커)를 넣지 마세요. 네이버 NaPm 파라미터가 무시되어 전환추적이 깨집니다.
  (페이지 내부 버튼이 `#contact`를 쓰는 것은 무관합니다)
- 브라우저 저장소(localStorage 등) 미사용. 언어 선택은 새로고침 시 한국어로 초기화됩니다.
- `prefers-reduced-motion` 대응됨. 애니메이션만 꺼지고 기능은 정상 동작해야 합니다.
