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

## 데이터 구조

```
auth.users              ← Supabase Auth가 관리 (회원 계정)
  └ profiles            ← 프로필 · 생년월일 · 법정대리인 동의
  └ entitlements        ← 앱 이용 권한 (어떤 상품을 쓸 수 있는가)
  └ assessment_results  ← 심리검사 결과·기록

orders                  ← 랜딩에서 만든 주문 (이메일로 회원과 연결)
subscribers             ← 알림 신청 명단 (앱에서 접근 불가)
```

### 테이블별 접근 권한

| 테이블 | 앱(anon+로그인) | 랜딩 서버(service_role) |
|---|---|---|
| `profiles` | 본인 것 조회·수정 | 전체 |
| `entitlements` | 본인 것 **조회만** | 전체 (부여·회수) |
| `assessment_results` | 본인 것 조회·생성·수정 | 전체 |
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

## 앱 설정 순서

1. [`supabase/schema.sql`](../supabase/schema.sql) 실행 (아직 안 했다면)
2. [`supabase/schema-app.sql`](../supabase/schema-app.sql) 실행
3. **Authentication → Confirm email: ON** (위 경고 참고)
4. 앱에 넣을 값 두 개
   - `SUPABASE_URL` — 랜딩과 같은 값
   - `SUPABASE_ANON_KEY` — **anon** 키 (service_role 아님)
5. 앱에서 Supabase 클라이언트 초기화 후 로그인 붙이기

### 만 14세 미만 처리
가입 화면에서 생년월일을 받아 만 14세 미만이면 법정대리인 동의 절차로 분기하고,
`profiles.guardian_consent` / `guardian_consent_at`에 기록하세요.
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
