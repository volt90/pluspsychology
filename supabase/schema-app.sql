-- ============================================================
--  랜딩 ↔ 앱 연결 — 새 테이블 없음. 트리거 2개뿐.
--
--  실행: schema.sql 실행 후, Supabase SQL Editor에서 Run
--
--  앱(BioHealthFinalDev)이 이미 다 갖고 있어서 새로 만들 게 없습니다.
--    profiles            — 회원 (birth_year, role: member/teen/admin)
--    consents            — 동의 (teen_payment 포함)
--    workbooks           — 워크북 5종 (slug, price_krw)
--    workbook_purchases  — 구매·이용권한 (digital/physical, paid/refunded)
--    assessments         — 검사 기록
--
--  랜딩이 추가하는 것은 subscribers·orders(schema.sql)뿐이고,
--  이 파일은 "랜딩에서 결제된 주문"을 앱의 workbook_purchases에 꽂아줍니다.
--
--  매칭 규칙:  orders.product_code  ==  workbooks.slug
--             orders.buyer_email    ==  auth.users.email
-- ============================================================


-- ── 0) 랜딩 실물 워크북을 6번째 상품으로 등록 ────────────────
--  앱의 5종(self-criticism 외)과 별개인 실물 전용 상품입니다.
--
--  is_active = false 인 이유:
--    workbooks의 RLS가 `using (authenticated and is_active)` 라서
--    false면 앱에 아예 보이지 않습니다. 실물 전용이라 앱 안에서
--    풀 단계(workbook_steps)가 없으므로 목록에 뜨면 안 됩니다.
--    아래 트리거는 security definer라 RLS를 우회해 정상 매칭됩니다.
--
--  나중에 앱에서도 노출하려면 is_active를 true로 바꾸고
--  workbook_steps를 채우세요.
insert into public.workbooks (slug, title, subtitle, price_krw, sort_order, is_active)
values ('mind-manual', '마음 사용 설명서', '실물 워크북', 16900, 6, false)
on conflict (slug) do nothing;


-- ── 1) 주문이 결제 완료되면 → 이미 가입한 회원에게 권한 부여 ──
create or replace function public.link_order_to_workbook_purchase()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'paid' and (old.status is distinct from 'paid') then
    insert into public.workbook_purchases (user_id, workbook_id, purchase_type, status)
    select p.id, w.id, 'physical', 'paid'
      from auth.users u
      join public.profiles p on p.id = u.id
      join public.workbooks w on w.slug = new.product_code
     where lower(u.email) = lower(new.buyer_email)
    on conflict (user_id, workbook_id, purchase_type) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists orders_link_workbook_purchase on public.orders;
create trigger orders_link_workbook_purchase
  after update on public.orders
  for each row execute function public.link_order_to_workbook_purchase();


-- ── 2) 가입하면 → 이미 결제한 주문이 있으면 권한 부여 ─────────
--  트리거를 auth.users가 아니라 profiles에 겁니다.
--  workbook_purchases.user_id가 profiles(id)를 참조하므로,
--  auth.users에 걸면 profiles가 아직 없어 FK 위반이 납니다.
create or replace function public.claim_orders_on_profile_create()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.workbook_purchases (user_id, workbook_id, purchase_type, status)
  select new.id, w.id, 'physical', 'paid'
    from public.orders o
    join public.workbooks w on w.slug = o.product_code
    join auth.users u on u.id = new.id
   where lower(o.buyer_email) = lower(u.email)
     and o.status = 'paid'
  on conflict (user_id, workbook_id, purchase_type) do nothing;
  return new;
end;
$$;

drop trigger if exists profiles_claim_orders on public.profiles;
create trigger profiles_claim_orders
  after insert on public.profiles
  for each row execute function public.claim_orders_on_profile_create();


-- ============================================================
--  RLS는 건드리지 않습니다.
--    · subscribers / orders — 정책 없음 유지 (랜딩 서버 전용)
--    · 앱 테이블 전부       — 앱 마이그레이션의 정책 그대로
--
--  앱은 이용권한을 workbook_purchases에서 읽습니다 (기존 정책 그대로).
--  랜딩의 orders를 앱이 직접 읽을 이유는 없습니다.
-- ============================================================


-- ── 확인용 ───────────────────────────────────────────────────
--  실행 후 아래로 트리거 2개가 붙었는지 확인:
--
--    select tgname, relname from pg_trigger t
--      join pg_class c on c.oid = t.tgrelid
--     where tgname in ('orders_link_workbook_purchase', 'profiles_claim_orders');
