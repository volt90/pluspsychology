-- ============================================================
--  schema-guardian.sql — 생년월일 + 보호자(법정대리인) 동의
--
--  Supabase 대시보드 → SQL Editor 에 붙여넣고 실행하세요.
--  여러 번 실행해도 안전합니다.
--
--  [왜 필요한가]
--  연령 기준이 서로 다른 두 법에서 나옵니다.
--    · 만 14세 미만 — 개인정보보호법 제22조의2 → **가입**에 법정대리인 동의 필요
--    · 만 19세 미만 — 민법 제5조             → **결제**에 법정대리인 동의 필요
--                                              (없으면 미성년자가 취소할 수 있음)
--  출생 '연도'만으로는 만 나이를 알 수 없어 두 판정 모두 부정확합니다.
--  그래서 생년월일을 따로 받습니다.
--
--  ⚠️ profiles.birth_year 는 그대로 둡니다. 앱이 not null 로 쓰고 있고,
--     role 판정도 birth_year 기준입니다. 지우면 앱이 깨집니다.
-- ============================================================


-- ── 1. 생년월일 ─────────────────────────────────────────────
--  기존 회원은 값이 없으므로 nullable 입니다.
--  birth_year 는 계속 채워집니다(앱 호환). birth_date 는 추가 정보입니다.
alter table public.profiles add column if not exists birth_date date;

comment on column public.profiles.birth_date is
  '생년월일. 만 나이 판정용(가입 14세 / 결제 19세). birth_year 는 앱 호환을 위해 유지.';

-- 연도가 서로 어긋나지 않게 막아둡니다.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_birth_date_matches_year') then
    alter table public.profiles
      add constraint profiles_birth_date_matches_year
      check (birth_date is null or extract(year from birth_date)::int = birth_year);
  end if;
end $$;


-- ── 2. 만 나이 계산 ─────────────────────────────────────────
--  생일이 지났는지까지 반영합니다. 앱·웹·서버가 같은 답을 쓰도록 함수로 둡니다.
create or replace function public.korean_age(birth date)
returns int language sql immutable as $$
  select case
    when birth is null then null
    else date_part('year', age(current_date, birth))::int
  end;
$$;


-- ── 3. 보호자(법정대리인) 동의 증적 ─────────────────────────
--  consents 표는 '동의했다'는 사실만 담습니다. 분쟁에 대비해
--  누가·언제·어떻게 동의했는지는 여기에 남깁니다.
create table if not exists public.guardian_consents (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,

  -- 무엇에 대한 동의인가
  purpose       text not null default 'payment'
                     check (purpose in ('signup', 'payment')),

  -- 보호자 정보 (분쟁 시 연락처)
  guardian_name     text not null,
  guardian_relation text not null
                         check (guardian_relation in ('mother','father','grandparent','guardian','other')),
  guardian_phone    text,
  guardian_email    text,

  -- 증적
  granted       boolean     not null default true,
  consented_at  timestamptz not null default now(),
  consent_ip    text,
  consent_user_agent text,
  -- 확인 방법. 지금은 웹 폼 입력('self_report')만 씁니다.
  -- 보호자 메일 확인을 붙이면 'email_verified' 로 올라갑니다.
  method        text not null default 'self_report'
                     check (method in ('self_report','email_verified','document')),

  created_at    timestamptz not null default now(),
  unique (user_id, purpose)
);

create index if not exists guardian_consents_user_idx on public.guardian_consents (user_id);

alter table public.guardian_consents enable row level security;

-- 본인 것만 읽고 쓸 수 있습니다. 앱·웹 모두 anon 키로 접근합니다.
do $$
begin
  if not exists (select 1 from pg_policies
                 where tablename='guardian_consents' and policyname='guardian_consents_select_own') then
    create policy "guardian_consents_select_own" on public.guardian_consents
      for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies
                 where tablename='guardian_consents' and policyname='guardian_consents_insert_own') then
    create policy "guardian_consents_insert_own" on public.guardian_consents
      for insert with check (auth.uid() = user_id);
  end if;
end $$;


-- ── 4. consents 에 'guardian' 종류 추가 ─────────────────────
--  앱이 이미 쓰는 표입니다. check 제약만 넓힙니다 — 기존 값은 그대로 유효합니다.
do $$
declare c text;
begin
  select conname into c from pg_constraint
   where conrelid = 'public.consents'::regclass and contype = 'c'
     and pg_get_constraintdef(oid) like '%consent_type%';
  if c is not null then
    execute format('alter table public.consents drop constraint %I', c);
  end if;
  alter table public.consents add constraint consents_consent_type_check
    check (consent_type in ('service','ai_improvement','public_card',
                            'notification','teen_payment','guardian'));
end $$;


-- ── 5. 결제 전 확인용 뷰 ────────────────────────────────────
--  주문을 받기 전에 이 뷰로 '법정대리인 동의가 필요한 계정인지' 확인하세요.
create or replace view public.payment_eligibility as
select
  p.id                                   as user_id,
  p.birth_date,
  public.korean_age(p.birth_date)        as age,
  -- 생년월일이 없으면 앱과 같은 보수적 규칙으로 대체합니다.
  coalesce(public.korean_age(p.birth_date) < 19,
           (extract(year from current_date)::int - p.birth_year) < 19) as is_minor,
  exists (select 1 from public.guardian_consents g
           where g.user_id = p.id and g.purpose = 'payment' and g.granted) as has_guardian_consent
from public.profiles p;
