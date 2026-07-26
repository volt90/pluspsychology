-- ============================================================
--  앱 연동 스키마 — 회원 · 이용권한 · 검사기록
--
--  실행: Supabase 대시보드 → SQL Editor → 붙여넣고 Run
--        (schema.sql을 먼저 실행한 뒤에 이 파일을 실행하세요)
--
--  ⚠️ 보안 모델이 schema.sql과 다릅니다.
--     · schema.sql의 테이블 → 서버(service_role) 전용, 정책 없음
--     · 이 파일의 테이블   → 모바일 앱이 anon 키로 직접 접근, RLS 정책으로 제어
--
--  모바일 앱에는 **anon 키만** 넣습니다. service_role 키를 앱에 넣으면
--  앱을 뜯어본 사람이 명단 전체를 읽고 지울 수 있습니다.
-- ============================================================


-- ── 1) 회원 프로필 ───────────────────────────────────────────
--  Supabase Auth의 auth.users를 확장합니다.
create table if not exists public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  email               text        not null,
  display_name        text,

  -- 만 14세 미만 가입 시 법정대리인 동의 (개인정보보호법 제22조의2)
  birth_date          date,
  guardian_consent    boolean     not null default false,
  guardian_consent_at timestamptz,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists profiles_email_idx on public.profiles (lower(email));


-- ── 2) 앱 이용 권한 ──────────────────────────────────────────
--  "워크북을 산 사람에게 앱 프로그램을 열어준다"를 표현합니다.
create table if not exists public.entitlements (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users(id) on delete cascade,
  product_code text        not null,
  source       text        not null default 'order'
                           check (source in ('order','manual','promo')),
  order_id     text        references public.orders(order_id),
  granted_at   timestamptz not null default now(),
  expires_at   timestamptz,              -- null이면 기간 제한 없음
  revoked      boolean     not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  unique (user_id, product_code)
);

create index if not exists entitlements_user_idx on public.entitlements (user_id);


-- ── 3) 심리검사 결과·기록 ────────────────────────────────────
create table if not exists public.assessment_results (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid        not null references auth.users(id) on delete cascade,
  assessment_code text        not null,      -- 예: 'mind-battery'
  answers         jsonb,                     -- 원자료
  scores          jsonb,                     -- 채점 결과
  completed_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists assessment_results_user_idx
  on public.assessment_results (user_id, assessment_code, created_at desc);


-- ── 4) updated_at 트리거 ─────────────────────────────────────
--  public.set_updated_at()은 schema.sql에서 이미 정의했습니다.
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists entitlements_set_updated_at on public.entitlements;
create trigger entitlements_set_updated_at before update on public.entitlements
  for each row execute function public.set_updated_at();

drop trigger if exists assessment_results_set_updated_at on public.assessment_results;
create trigger assessment_results_set_updated_at before update on public.assessment_results
  for each row execute function public.set_updated_at();


-- ── 5) 가입 시: 프로필 생성 + 기존 구매분 권한 부여 ──────────
--  구매를 먼저 하고 나중에 가입한 경우를 처리합니다.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;

  -- 같은 이메일로 결제 완료된 주문이 있으면 이용 권한을 붙입니다
  insert into public.entitlements (user_id, product_code, source, order_id)
  select new.id, o.product_code, 'order', o.order_id
    from public.orders o
   where lower(o.buyer_email) = lower(new.email)
     and o.status = 'paid'
  on conflict (user_id, product_code) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ── 6) 결제 완료 시: 이미 가입한 회원이면 즉시 권한 부여 ─────
--  가입을 먼저 하고 나중에 구매한 경우를 처리합니다.
create or replace function public.grant_entitlement_on_paid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'paid' and (old.status is distinct from 'paid') then
    insert into public.entitlements (user_id, product_code, source, order_id)
    select u.id, new.product_code, 'order', new.order_id
      from auth.users u
     where lower(u.email) = lower(new.buyer_email)
    on conflict (user_id, product_code) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists orders_grant_entitlement on public.orders;
create trigger orders_grant_entitlement
  after update on public.orders
  for each row execute function public.grant_entitlement_on_paid();


-- ============================================================
--  RLS — 앱이 anon 키로 접근하는 테이블에만 정책을 답니다
--
--  ⚠️ public.subscribers 에는 절대 정책을 만들지 마세요.
--     정책 하나만 열려도 알림 신청 명단 전체가 공개됩니다.
-- ============================================================

alter table public.profiles           enable row level security;
alter table public.entitlements       enable row level security;
alter table public.assessment_results enable row level security;

-- 프로필: 본인 것만 조회·수정
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated using (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- 이용권한: 본인 것만 조회. 부여·회수는 서버(service_role)만 — insert/update 정책 없음
drop policy if exists "entitlements_select_own" on public.entitlements;
create policy "entitlements_select_own" on public.entitlements
  for select to authenticated using (user_id = auth.uid());

-- 검사기록: 본인 것만 조회·생성·수정
drop policy if exists "assessment_select_own" on public.assessment_results;
create policy "assessment_select_own" on public.assessment_results
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "assessment_insert_own" on public.assessment_results;
create policy "assessment_insert_own" on public.assessment_results
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "assessment_update_own" on public.assessment_results;
create policy "assessment_update_own" on public.assessment_results
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());


-- ── 주문 내역 조회 (앱의 "내 구매내역") ──────────────────────
--  orders에 딱 하나, 본인 이메일 주문만 읽는 SELECT 정책을 답니다.
--
--  🚨 이 정책은 **이메일 확인(Email Confirmation)이 켜져 있어야만 안전합니다.**
--     확인 없이 가입을 허용하면 남의 이메일로 가입해 그 사람의 주문과
--     이용 권한을 가로챌 수 있습니다.
--     Supabase → Authentication → Sign In / Providers → Confirm email: ON
drop policy if exists "orders_select_own" on public.orders;
create policy "orders_select_own" on public.orders
  for select to authenticated
  using (lower(buyer_email) = lower(auth.jwt() ->> 'email'));

--  주소·IP까지 앱에 내려보낼 이유는 없으므로, 앱은 이 뷰를 읽게 합니다.
create or replace view public.my_orders with (security_invoker = on) as
  select order_id, status, product_name, quantity, amount, created_at, approved_at
    from public.orders;

comment on view public.my_orders is
  '앱에서 읽는 내 주문 내역. security_invoker라 orders의 RLS가 그대로 적용됩니다.';
