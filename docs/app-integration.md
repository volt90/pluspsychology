# 모바일 앱 연동 — 하나의 Supabase 프로젝트 공유하기

랜딩페이지와 앱이 **같은 Supabase 프로젝트**를 씁니다.
그래서 워크북을 산 사람이 앱에 가입하면 이용 권한이 자동으로 붙습니다.

---

## 🔑 가장 중요한 규칙: 키를 헷갈리지 마세요

Supabase 키는 두 종류이고, **쓰는 곳이 완전히 다릅니다.**

| 키 | 쓰는 곳 | 성격 |
|---|---|---|
| **anon** (publishable) | **모바일 앱** | 공개돼도 됨. RLS가 접근을 막아줌 |
| **service_role** (secret) | **랜딩 서버(`api/*.js`)만** | RLS를 통째로 무시. 노출되면 전부 털림 |

> 🚨 **모바일 앱에 service_role 키를 넣으면 안 됩니다.**
> 앱 바이너리는 누구나 뜯어볼 수 있습니다. `.env`에 넣어도, 난독화해도 추출됩니다.
> 앱에는 anon 키만 넣고, 권한 제어는 전부 RLS에 맡깁니다.

---

## 🚨 반드시 켜야 하는 설정: 이메일 확인

**Supabase → Authentication → Sign In / Providers → Confirm email: ON**

구매자와 앱 회원을 **이메일로 매칭**하는 구조라, 이메일 확인이 꺼져 있으면
남의 이메일로 가입해서 **그 사람의 구매 권한을 가로챌 수 있습니다.**
이것 하나만은 예외 없이 켜두세요.

---

## ⚠️ 이 프로젝트는 이미 앱이 쓰고 있습니다

2026-07-26 점검 결과, Supabase 프로젝트 `syxwnbqsozdgmogeidtq`에는
**앱이 만든 테이블이 이미 있습니다.**

| 이미 있는 것 | 아직 없는 것 |
|---|---|
| `profiles` · `entries` · `consents` · `analytics_events` | `subscribers` · `orders` · `entitlements` |

즉 **랜딩 쪽 스키마가 아직 실행되지 않았습니다.** 그리고 앱 테이블과 겹치는 부분이 있어
`schema-app.sql`을 처음 만든 그대로 실행했다면 앱이 깨졌을 것입니다. 지금은 아래처럼 고쳐두었습니다.

- **`profiles`를 만들지 않습니다** — 앱이 소유합니다. RLS 정책도 건드리지 않습니다.
- **가입 트리거 이름을 `on_auth_user_created_grant_entitlements`로 바꿨습니다** —
  흔히 쓰는 `on_auth_user_created`로 만들면 앱의 기존 가입 트리거를 덮어써서 가입이 깨집니다.
- **`assessment_results`는 보류** — 앱의 `entries`가 이미 검사 기록 역할을 한다면 만들지 마세요.

### 실행 전에 확인할 것
- [ ] 앱의 `profiles`에 `id`, `email` 컬럼이 있는가 (권한 부여 트리거가 이메일로 매칭)
- [ ] 앱이 `auth.users`에 이미 트리거를 걸어두었는가 — 있다면 이름이 겹치지 않는지
- [ ] `entries`가 심리검사 기록인가, 다른 용도인가

## 데이터 구조

```
auth.users              ← Supabase Auth가 관리 (회원 계정)
  └ profiles            ← 앱이 소유 (랜딩은 건드리지 않음)
  └ entitlements        ← 앱 이용 권한 (랜딩이 추가)
  └ entries / consents / analytics_events  ← 앱이 소유

orders                  ← 랜딩에서 만든 주문 (이메일로 회원과 연결)
subscribers             ← 알림 신청 명단 (앱에서 접근 불가)
```

### 테이블별 접근 권한

| 테이블 | 앱(anon+로그인) | 랜딩 서버(service_role) |
|---|---|---|
| `profiles` | 앱의 기존 정책 그대로 (랜딩이 건드리지 않음) | 전체 |
| `entitlements` | 본인 것 **조회만** | 전체 (부여·회수) |
| `assessment_results` | 본인 것 조회·생성·수정 (만들었다면) | 전체 |
| `my_orders` (뷰) | 본인 주문만 조회 | 전체 |
| `orders` | 본인 주문만 조회 | 전체 |
| `subscribers` | ❌ **접근 불가** | 전체 |

> `subscribers`에는 정책이 하나도 없습니다. **앞으로도 만들지 마세요.**
> 정책 하나만 열려도 알림 신청 명단 전체가 공개됩니다.
> 앱이 명단을 다뤄야 할 일이 생기면 서버 엔드포인트를 거치게 하세요.

---

## 구매 → 이용 권한이 붙는 방식

두 방향 모두 DB 트리거로 자동 처리됩니다. 앱이 따로 할 일은 없습니다.

**구매 먼저 → 나중에 가입**
```
주문 결제 완료 (orders.status = 'paid')
  → 나중에 같은 이메일로 앱 가입
  → on_auth_user_created 트리거가 결제 완료 주문을 찾아 entitlements 생성
```

**가입 먼저 → 나중에 구매**
```
앱 가입 완료
  → 나중에 같은 이메일로 워크북 구매
  → orders_grant_entitlement 트리거가 즉시 entitlements 생성
```

앱은 이것만 확인하면 됩니다.

```js
const { data } = await supabase
  .from('entitlements')
  .select('product_code, expires_at, revoked')
  .eq('product_code', 'workbook-mind-manual')
  .maybeSingle();

const canUse = data && !data.revoked &&
  (!data.expires_at || new Date(data.expires_at) > new Date());
```

---

## 설정 순서

1. **service_role 키 재발급** — 채팅으로 전달된 적이 있어 이미 신뢰할 수 없습니다 (아래 참고)
2. 위 "실행 전에 확인할 것" 체크리스트로 앱의 기존 스키마를 확인
3. [`supabase/schema.sql`](../supabase/schema.sql) 실행 → `subscribers`·`orders` 생성
4. [`supabase/schema-app.sql`](../supabase/schema-app.sql) 실행 → `entitlements` + 트리거 + RLS
5. **Authentication → Confirm email: ON** (위 경고 참고)
6. 랜딩(Vercel)에 넣을 값 — [setup-supabase.md](setup-supabase.md) 4단계
   - `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` (**재발급한** 키)
7. 앱에 넣을 값
   - `SUPABASE_URL` — 랜딩과 같은 값
   - `SUPABASE_ANON_KEY` — **anon** 키 (service_role 아님)

### 🚨 service_role 키 재발급
service_role 키가 채팅으로 전달된 이력이 있으면, 그 키는 대화 기록과 로컬 세션 파일에
평문으로 남습니다. RLS를 통째로 무시하는 키이므로 **반드시 재발급하세요.**

- Supabase → **Project Settings → API Keys** — secret key가 개별 관리되는 프로젝트라면
  해당 키를 **Revoke / Rotate**
- 구형(JWT 기반) 프로젝트라면 **Project Settings → API → JWT Settings → JWT Secret 재생성**
  ⚠️ 이 방법은 **anon 키와 로그인 세션까지 전부 무효화**됩니다. 앱 배포 중이면 영향 범위를
  먼저 확인하세요
- 재발급 후 Vercel 환경변수를 새 키로 바꾸고 **Redeploy**

앞으로 키는 채팅에 붙여넣지 말고 **Supabase → Vercel 대시보드로 직접 복사**하세요.
제가 키를 알아야 할 일은 없습니다.

### 만 14세 미만 처리
가입 화면에서 생년월일을 받아 만 14세 미만이면 법정대리인 동의 절차로 분기하고 기록하세요.
앱의 `profiles`에 해당 컬럼이 없다면 `schema-app.sql` 1절의 `alter table` 예시를 참고하세요.
개인정보보호법 제22조의2 요건이며, 타깃이 10대라 실제로 발생합니다.
(결제의 만 19세 기준과는 **별개**입니다 — [commerce-plan.md](commerce-plan.md) 5장)

---

## 스키마를 고칠 때

`supabase/*.sql`이 **두 프로젝트의 공용 원본**입니다.
앱 저장소에서 테이블을 바꾸더라도 이 파일에 반영해서 한 곳만 보면 되게 유지하세요.
양쪽이 같은 DB를 보고 있어서, 한쪽에서 컬럼을 지우면 다른 쪽이 즉시 깨집니다.

### 새 테이블을 추가할 때 체크리스트
- [ ] RLS를 켰는가 (`enable row level security`)
- [ ] 앱이 접근해야 하면 `auth.uid()` 기준 정책을 달았는가
- [ ] 서버 전용이면 **정책을 만들지 않았는가**
- [ ] `updated_at` 트리거를 달았는가
