# 앱 연동 — 랜딩 ↔ 김심리월드 앱

앱 저장소: `G:\내 드라이브\BioHealthFinalDev` (Flutter)
Supabase 프로젝트: `syxwnbqsozdgmogeidtq` — **앱이 이미 쓰고 있는 DB를 그대로 공유**합니다.

---

## 앱이 이미 갖고 있는 것 (새로 만들지 마세요)

| 테이블 | 역할 |
|---|---|
| `profiles` | 회원. `birth_year`, `role`(member/teen/admin) |
| `consents` | 동의. `teen_payment` 타입 포함 |
| `workbooks` | 워크북 5종. `slug`, `price_krw` |
| `workbook_purchases` | **구매·이용권한.** digital/physical × dev_granted/paid/refunded |
| `assessments` · `entries` · `cards` | 검사·기록·카드 |
| `analytics_events` · `community_*` · `safety_events` | 나머지 |

랜딩이 추가하는 건 `subscribers`와 `orders` 둘뿐입니다 (`schema.sql`).

> 청소년 처리도 앱이 이미 합니다 — `profiles.role = 'teen'`, `consents.teen_payment`.
> 랜딩에서 따로 만들지 마세요.

---

## 연결 방식 — 트리거 2개

`schema-app.sql`이 하는 일 전부입니다. 새 테이블 없습니다.

```
랜딩 orders.status → 'paid'
  └→ workbook_purchases (physical, paid)   ← 이미 가입한 회원이면 즉시

앱에서 회원가입 (profiles 생성)
  └→ workbook_purchases (physical, paid)   ← 결제해둔 주문이 있으면
```

매칭 기준 두 가지:
- `orders.product_code` == `workbooks.slug`
- `orders.buyer_email` == `auth.users.email`

앱은 지금처럼 `workbook_purchases`만 읽으면 됩니다. **앱 코드 변경 없음.**

> 가입 쪽 트리거는 `auth.users`가 아니라 `profiles`에 겁니다.
> `workbook_purchases.user_id`가 `profiles(id)`를 참조해서, `auth.users`에 걸면
> 프로필이 아직 없어 FK 위반이 납니다.

---

## 🚨 지금 안 맞는 것 두 개

| | 랜딩 | 앱 |
|---|---|---|
| 상품 코드 | `workbook-mind-manual` | `self-criticism` 외 4종 |
| 가격 | ₩16,900 | ₩12,000 |

**랜딩이 파는 실물 워크북이 앱의 5종 중 무엇인지 정해야 합니다.**
정해지면 `api/order.js`의 `PRODUCT.code`를 그 slug로 바꾸세요.
안 맞으면 결제는 되지만 앱 권한이 안 붙습니다 (트리거가 조용히 no-op).

5종: `self-criticism` · `shaky-relationships` · `burnout-rest` · `facing-anxiety` · `caring-boundaries`

별개 상품이라면 `workbooks`에 행을 추가하고 그 slug를 쓰면 됩니다.

---

## 키

| 키 | 넣는 곳 |
|---|---|
| **anon** | 앱 (이미 설정돼 있음) |
| **service_role** | 랜딩 Vercel 환경변수만 |

🚨 **service_role 키는 재발급하세요.** 채팅으로 전달된 이력이 있어 신뢰할 수 없습니다.
Supabase → Project Settings → API Keys에서 rotate. 구형 JWT 방식이면 JWT Secret 재생성이지만
**anon 키와 로그인 세션까지 전부 무효화**되니 앱 배포 상태를 먼저 확인하세요.

---

## 실행 순서

1. service_role 키 재발급
2. `supabase/schema.sql` — `subscribers`·`orders` 생성 (앱과 안 겹침)
3. Vercel 환경변수 2개 + Redeploy → 이메일 수집 켜짐
4. `PRODUCT.code`를 실제 slug로 확정
5. `supabase/schema-app.sql` — 트리거 2개

3번까지만 해도 이메일 수집은 동작합니다. 4~5번은 결제를 열 때 하면 됩니다.
