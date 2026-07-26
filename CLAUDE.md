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
api/subscribe.js    # 이메일 알림신청 처리 (Vercel 서버리스 함수)
robots.txt
sitemap.xml
```
> index.html은 자체 완결형입니다. 캐릭터·로고·표지 이미지가 base64로 박혀 있어
> 외부 이미지 의존성이 없습니다. 파일이 큰 것은 정상입니다.

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

## 이메일 수집 (Resend)
- 프론트: CTA의 `#subForm` → `POST /api/subscribe` (JSON: email, lang, source)
- 백엔드: `api/subscribe.js` — Resend Audience에 연락처 저장 + 확인메일 발송
- **필요한 Vercel 환경변수** (Settings → Environment Variables)
  - `RESEND_API_KEY`      — Resend API 키 (re_로 시작)
  - `RESEND_AUDIENCE_ID`  — Resend Audiences에서 만든 명단 ID
  - `FROM_EMAIL`          — 예: `김심리월드 <hello@pluspsychology.ai>`
  - `NOTIFY_EMAIL`        — 신청 알림 받을 주소 (선택)
- 출시 발송은 Resend **Broadcasts**에서 해당 Audience에 일괄 전송.

### 🔒 보안 원칙 (반드시 지킬 것)
**API 키·시크릿을 index.html이나 프론트엔드 코드에 절대 넣지 마세요.**
소스 보기로 노출됩니다. 키는 Vercel 환경변수에만 둡니다.

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
- [ ] Resend 도메인 인증(pluspsychology.ai) + 환경변수 4개 설정
- [ ] **Search Console 인증 파일 `googlee928fd2a17217f2b.html`이 저장소에 없음** →
      루트에 추가해야 소유권 확인 가능 (내용 한 줄: `google-site-verification: googlee928fd2a17217f2b.html`)
- [ ] sitemap.xml이 현재 페이지 상태와 맞는지 확인

## 주의사항
- 광고 연결 URL에 `#`(앵커)를 넣지 마세요. 네이버 NaPm 파라미터가 무시되어 전환추적이 깨집니다.
  (페이지 내부 버튼이 `#contact`를 쓰는 것은 무관합니다)
- 브라우저 저장소(localStorage 등) 미사용. 언어 선택은 새로고침 시 한국어로 초기화됩니다.
- `prefers-reduced-motion` 대응됨. 애니메이션만 꺼지고 기능은 정상 동작해야 합니다.
