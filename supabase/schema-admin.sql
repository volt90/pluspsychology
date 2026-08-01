-- ============================================================
--  schema-admin.sql — 관리자 대시보드용 스키마
--
--  Supabase 대시보드 → SQL Editor 에 붙여넣고 실행하세요.
--  여러 번 실행해도 안전합니다 (if not exists / if exists 로 감쌌습니다).
--
--  하는 일 두 가지:
--    1) campaigns 표를 만듭니다 — 진행 중인 캠페인 목록
--    2) subscribers · inquiries · orders 에 campaign 컬럼을 붙입니다
--       → 캠페인별 전환율·가입률을 계산할 수 있게 됩니다
--
--  ⚠️ RLS 는 켜되 정책은 만들지 않습니다.
--     anon 키로는 아무것도 못 읽고, 서버의 service_role 키만 통과합니다.
--     정책을 하나라도 열면 신청자 명단이 통째로 공개됩니다. 추가하지 마세요.
-- ============================================================


-- ── 1. 캠페인 목록 ──────────────────────────────────────────
--  캠페인 페이지를 하나 만들 때마다 여기에 행을 하나 추가합니다.
--  slug 는 페이지 주소와 맞춥니다:  slug='spring-2026'  →  /c/spring-2026
create table if not exists public.campaigns (
  id          uuid primary key default gen_random_uuid(),

  slug        text        not null unique,   -- 캠페인 식별자 (주소에 쓰임)
  name        text        not null,          -- 화면에 보일 이름
  description text,                          -- 내부 메모

  -- 방문자 수를 셀 GA4 페이지 경로. 비워두면 '/c/' || slug 로 간주합니다.
  page_path   text,

  -- 기간. ends_at 이 비어 있으면 '종료일 미정'입니다.
  starts_at   timestamptz not null default now(),
  ends_at     timestamptz,

  -- false 로 두면 대시보드의 '진행 중' 목록에서 빠집니다.
  is_active   boolean     not null default true,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists campaigns_active_idx on public.campaigns (is_active, starts_at desc);

alter table public.campaigns enable row level security;
-- 정책 없음 = service_role 전용. (위 경고 참고)


-- ── 2. 기존 표에 campaign 컬럼 붙이기 ────────────────────────
--  campaigns.slug 를 그대로 담습니다. 외래키를 걸지 않는 이유는,
--  캠페인 행을 지워도 과거 신청 기록이 사라지면 안 되기 때문입니다.
--
--  ※ subscribers 에는 이미 source 가 있습니다. 역할이 다릅니다:
--      source   = 사이트 어디에서 신청했나 (예: workbook_landing)
--      campaign = 어느 캠페인을 통해 들어왔나 (예: spring-2026)
alter table public.subscribers add column if not exists campaign text;
alter table public.inquiries   add column if not exists campaign text;
alter table public.orders      add column if not exists campaign text;

create index if not exists subscribers_campaign_idx on public.subscribers (campaign, created_at desc);
create index if not exists inquiries_campaign_idx   on public.inquiries   (campaign, created_at desc);
create index if not exists orders_campaign_idx      on public.orders      (campaign, created_at desc);

-- 날짜별 집계를 자주 하므로 생성일 인덱스도 확인해 둡니다.
create index if not exists subscribers_created_at_idx on public.subscribers (created_at desc);
create index if not exists orders_created_at_idx      on public.orders      (created_at desc);


-- ── 3. 관리자 대시보드용 집계 뷰 ────────────────────────────
--  서버가 이 뷰들을 읽어 대시보드를 그립니다. service_role 전용입니다.

-- 3-1. 날짜별 접수 건수 (최근 180일)
create or replace view public.admin_daily_counts as
select
  d::date                                              as day,
  coalesce(s.n, 0)                                     as subscribers,
  coalesce(i.n, 0)                                     as inquiries,
  coalesce(o.n, 0)                                     as orders_paid
from generate_series(
       (current_date - interval '179 days')::date,
       current_date,
       interval '1 day'
     ) d
left join (
  select created_at::date as day, count(*) as n
  from public.subscribers group by 1
) s on s.day = d::date
left join (
  select created_at::date as day, count(*) as n
  from public.inquiries where status <> 'spam' group by 1
) i on i.day = d::date
left join (
  select created_at::date as day, count(*) as n
  from public.orders where status = 'paid' group by 1
) o on o.day = d::date;

-- 3-2. 캠페인별 성과 (방문자 수는 GA4 에서 와서 서버가 합칩니다)
create or replace view public.admin_campaign_totals as
select
  c.slug,
  c.name,
  c.page_path,
  c.starts_at,
  c.ends_at,
  c.is_active,
  coalesce(s.n, 0) as subscribers,     -- 이메일 알림신청 (= 가입)
  coalesce(i.n, 0) as inquiries,       -- 문의 접수 (= 전환)
  coalesce(o.n, 0) as orders_paid      -- 결제 완료 (= 전환)
from public.campaigns c
left join (
  select campaign, count(*) as n from public.subscribers
  where campaign is not null group by 1
) s on s.campaign = c.slug
left join (
  select campaign, count(*) as n from public.inquiries
  where campaign is not null and status <> 'spam' group by 1
) i on i.campaign = c.slug
left join (
  select campaign, count(*) as n from public.orders
  where campaign is not null and status = 'paid' group by 1
) o on o.campaign = c.slug;


-- ── 4. 앱 회원가입 집계 (선택) ──────────────────────────────
--  앱과 같은 Supabase 프로젝트를 쓰므로 profiles 를 그대로 셉니다.
--  profiles 가 아직 없는 환경에서도 스크립트가 실패하지 않도록 감쌌습니다.
--
--  ⚠️ 캠페인별로 나눌 수는 아직 없습니다. 앱 가입에는 유입 경로가
--     기록되지 않기 때문입니다. 랜딩에서 앱으로 보낼 때 campaign 을
--     같이 넘겨 profiles 에 저장하면 그때 나눌 수 있습니다.
do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'public' and table_name = 'profiles') then
    execute $v$
      create or replace view public.admin_daily_signups as
      select d::date as day, coalesce(p.n, 0) as app_signups
      from generate_series(
             (current_date - interval '179 days')::date,
             current_date, interval '1 day') d
      left join (
        select created_at::date as day, count(*) as n
        from public.profiles group by 1
      ) p on p.day = d::date;
    $v$;
  end if;
end $$;
