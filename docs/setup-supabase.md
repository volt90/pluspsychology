# Supabase 연결하기 — 이메일 수집 켜는 순서

지금 랜딩페이지의 알림 신청 폼은 **눌러도 저장되지 않습니다.** 서버에 저장소가 연결돼 있지 않아서입니다.
아래 4단계를 마치면 바로 수집이 시작됩니다. 전부 대시보드에서 클릭으로 하는 작업입니다.

> 🔒 **service_role 키는 명단 전체를 읽고 지울 수 있는 키입니다.**
> 채팅창·깃 저장소·프런트엔드 코드에 붙여넣지 마세요. Vercel 환경변수에만 넣습니다.

---

## 1단계 — Supabase 프로젝트 만들기

1. [supabase.com](https://supabase.com) 접속 → 로그인 (GitHub 계정으로 가능)
2. **New project** 클릭
3. 입력값
   | 항목 | 값 |
   |---|---|
   | Name | `pluspsychology` (자유) |
   | Database Password | 강한 비밀번호 — **비밀번호 관리자에 저장하세요.** 분실 시 재설정만 가능 |
   | Region | **Northeast Asia (Seoul)** — 국내 방문자 응답속도 |
4. **Create new project** → 준비까지 1~2분 걸립니다

---

## 2단계 — 테이블 만들기

1. 왼쪽 메뉴 **SQL Editor** → **New query**
2. 저장소의 [`supabase/schema.sql`](../supabase/schema.sql) 내용을 **전부 복사해서 붙여넣기**
3. **Run** (또는 Ctrl+Enter)
4. 성공하면 왼쪽 **Table Editor**에 `subscribers`와 `orders` 두 테이블이 보입니다

> 여러 번 실행해도 안전합니다 (전부 `if not exists` / `or replace`).
> 나중에 스키마를 고칠 때도 같은 방법으로 다시 실행하면 됩니다.

---

## 3단계 — 키 두 개 복사하기

1. 왼쪽 아래 **Project Settings**(톱니바퀴) → **API**
2. 두 값을 복사합니다

   | 화면의 이름 | 우리가 쓰는 환경변수 |
   |---|---|
   | **Project URL** (`https://xxxxx.supabase.co`) | `SUPABASE_URL` |
   | **service_role** / `secret` (Reveal 눌러야 보임) | `SUPABASE_SERVICE_ROLE_KEY` |

> ⚠️ 바로 위에 있는 **anon / publishable 키가 아닙니다.** service_role(secret) 쪽입니다.
> 화면에 "This key has the ability to bypass Row Level Security. Never share it publicly."
> 라는 경고가 붙어 있는 그 키가 맞습니다.

---

## 4단계 — Vercel에 넣고 재배포

1. [vercel.com](https://vercel.com) → `pluspsychology` 프로젝트 → **Settings** → **Environment Variables**
2. 두 개를 추가합니다. Environments는 **Production / Preview / Development 모두 체크**

   | Key | Value |
   |---|---|
   | `SUPABASE_URL` | 3단계의 Project URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | 3단계의 service_role 키 |

3. **⚠️ 반드시 재배포하세요.** 환경변수는 *새로 만들어지는 배포*에만 적용됩니다.
   - **Deployments** 탭 → 맨 위 배포의 `⋯` → **Redeploy**

---

## 5단계 — 확인

1. https://www.pluspsychology.ai 접속 → 하단 CTA에서 본인 이메일로 알림 신청
2. "신청 완료!" 메시지가 뜨면 성공
3. Supabase → **Table Editor** → `subscribers` 에 행이 생겼는지 확인
4. 같은 이메일로 한 번 더 신청 → "이미 신청된 이메일이에요" 가 떠야 정상 (중복 차단)

### 저장되는 값
`email` · `lang` · `source` · `consent` · `consented_at` · `consent_ip` · `consent_user_agent` ·
`status` · `created_at`

`status`는 확인 메일 발송 결과입니다. Resend를 아직 연결하지 않았다면 `pending`으로 남습니다 — 정상입니다.

---

## 잘 안 될 때

| 증상 | 원인 |
|---|---|
| "전송에 실패했어요" | 환경변수 추가 후 **재배포를 안 함**. Redeploy 하세요 |
| 502 응답 | 2단계 SQL을 실행하지 않아 테이블이 없음 |
| 500 응답 | 환경변수 이름 오타. `SUPABASE_SERVICE_ROLE_KEY` 철자 확인 |
| 행은 생기는데 메일이 안 옴 | 정상입니다. Resend 연결 전이라 메일은 나가지 않습니다 |

Vercel → **Deployments** → 해당 배포 → **Functions** 탭에서 `/api/subscribe` 로그를 보면
서버가 남긴 오류 메시지를 직접 확인할 수 있습니다.

---

## 다음 단계

- **Resend 연결** — 신청자에게 확인 메일을 보내려면 필요합니다.
  `RESEND_API_KEY` · `RESEND_AUDIENCE_ID` · `FROM_EMAIL` (+ 선택 `NOTIFY_EMAIL`)
  도메인 인증(pluspsychology.ai)이 선행되어야 합니다.
- **결제 켜기** — 토스 계약 후 `TOSS_CLIENT_KEY` · `TOSS_SECRET_KEY` · `PAYMENTS_ENABLED=true`
  (자세한 내용은 CLAUDE.md의 "결제" 절)
