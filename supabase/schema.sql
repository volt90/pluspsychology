-- ============================================================
--  김심리월드 — 방문자 이메일 수집 테이블
--
--  실행 방법: Supabase 대시보드 → SQL Editor → 이 파일 내용 붙여넣고 Run
--  (여러 번 실행해도 안전합니다 — 모두 if not exists / or replace)
-- ============================================================

create table if not exists public.subscribers (
  id                uuid primary key default gen_random_uuid(),

  -- 수집 정보
  email             text        not null,
  lang              text        not null default 'ko' check (lang in ('ko', 'en')),
  source            text,                       -- 예: workbook_landing

  -- 수신 동의 증적 (정보통신망법 대응 — 삭제 금지)
  consent           boolean     not null default false,
  consented_at      timestamptz,
  consent_ip        text,                       -- 동의 시점 IP (개인정보 — 처리방침에 명시 필요)
  consent_user_agent text,

  -- 발송 상태
  status            text        not null default 'pending'
                                check (status in ('pending', 'confirmed', 'failed')),
  resend_synced     boolean     not null default false,  -- Resend Audience 등록 성공 여부
  unsubscribed      boolean     not null default false,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- 같은 이메일 중복 신청 방지 (대소문자 무시)
create unique index if not exists subscribers_email_lower_idx
  on public.subscribers (lower(email));

-- 최신순 조회용
create index if not exists subscribers_created_at_idx
  on public.subscribers (created_at desc);


-- ── updated_at 자동 갱신 ────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists subscribers_set_updated_at on public.subscribers;
create trigger subscribers_set_updated_at
  before update on public.subscribers
  for each row execute function public.set_updated_at();


-- ── 보안: RLS 켜고 정책은 만들지 않음 ───────────────────────
--  정책이 하나도 없으면 anon / authenticated 키로는 읽기·쓰기가 전부 막힙니다.
--  서버(api/subscribe.js)는 service_role 키를 쓰므로 RLS를 우회해 정상 동작합니다.
--  → 프런트엔드에 Supabase 키를 넣을 필요가 아예 없습니다.
alter table public.subscribers enable row level security;

comment on table public.subscribers is
  '워크북 출시 알림 신청자 명단. 서버(service_role)에서만 접근. 프런트엔드 직접 접근 금지.';


-- ============================================================
--  주문 (토스페이먼츠 결제)
-- ============================================================

create table if not exists public.orders (
  id                uuid primary key default gen_random_uuid(),

  -- 주문번호 (토스에 전달하는 값). 서버가 발급합니다.
  order_id          text        not null unique,
  status            text        not null default 'pending'
                                check (status in ('pending','paid','failed','canceled','refunded')),

  -- 상품 (가격은 주문 시점 값을 그대로 남깁니다 — 나중에 가격이 바뀌어도 주문 기록은 불변)
  product_code      text        not null,
  product_name      text        not null,
  quantity          int         not null check (quantity >= 1),
  unit_price        int         not null check (unit_price >= 0),
  shipping_fee      int         not null default 0 check (shipping_fee >= 0),
  amount            int         not null check (amount >= 0),   -- 실제 결제 금액 (서버 계산값)
  currency          text        not null default 'KRW',

  -- 구매자
  buyer_name        text        not null,
  buyer_email       text        not null,
  buyer_phone       text,

  -- 배송지
  ship_country      text        not null default 'KR',
  ship_postcode     text,
  ship_address1     text,
  ship_address2     text,
  ship_memo         text,

  -- 동의 증적 (전자상거래법·민법 대응 — 삭제 금지)
  agree_terms       boolean     not null default false,  -- 구매조건 확인 및 결제진행 동의
  agree_minor       boolean     not null default false,  -- 만 19세 미만 법정대리인 동의 확인
  agreed_at         timestamptz,
  agree_ip          text,

  -- 결제 결과
  payment_key       text,
  payment_method    text,
  approved_at       timestamptz,
  fail_code         text,
  fail_message      text,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists orders_status_idx     on public.orders (status);
create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_buyer_email_idx on public.orders (lower(buyer_email));

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- subscribers와 동일하게 RLS만 켜고 정책은 만들지 않습니다 (서버 전용)
alter table public.orders enable row level security;

comment on table public.orders is
  '워크북 주문·결제 기록. 서버(service_role)에서만 접근. 전자상거래법상 5년 보존 대상.';
