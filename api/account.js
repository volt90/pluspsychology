// ============================================================
//  /api/account.js  —  로그인한 회원의 내 정보 · 구매 · 이용권한
//  account.html 이 로그인 후 이 주소를 호출합니다.
//
//  [왜 서버를 거치나]
//  profiles · workbook_purchases 는 RLS 가 본인 것만 열어주므로 브라우저가
//  직접 읽어도 됩니다. 그런데 랜딩의 orders 표는 **정책이 하나도 없어**
//  service_role 로만 읽힙니다(명단 보호). 두 곳을 각각 다른 방법으로 읽으면
//  헷갈리므로, 읽기는 전부 여기로 모았습니다.
//  → 반대로 '쓰기'(프로필 생성)는 앱과 똑같이 브라우저에서 본인 토큰으로
//    합니다. RLS(profiles_insert_own)가 그대로 지켜주기 때문입니다.
//
//  [인증]  Supabase Auth 토큰을 Supabase 에 되물어 검증합니다.
//          관리자와 달리 허용목록은 없습니다 — 회원 누구나 '자기 것'만 봅니다.
//
//  [필요한 환경변수]
//    SUPABASE_URL · SUPABASE_SERVICE_ROLE_KEY · SUPABASE_ANON_KEY
// ============================================================

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ANON_KEY     = process.env.SUPABASE_ANON_KEY || '';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('account: Supabase not configured');
    return res.status(503).json({ error: 'Not configured' });
  }

  const auth = String(req.headers.authorization || '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return res.status(401).json({ error: 'Sign in required' });

  let user;
  try {
    user = await verifyToken(token);
  } catch (err) {
    console.error('account: token check failed:', err.message);
    return res.status(401).json({ error: 'Sign in required' });
  }

  try {
    const [profile, purchases, orders, guardianConsent] = await Promise.all([
      one(`profiles?id=eq.${user.id}&select=id,birth_year,birth_date,role,onboarding_completed,created_at`),
      // workbooks 를 함께 붙여 제목까지 한 번에 가져옵니다.
      sbSoft(`workbook_purchases?user_id=eq.${user.id}` +
             `&select=id,purchase_type,status,created_at,workbooks(slug,title,subtitle)` +
             `&order=created_at.desc`, []),
      sbSoft(`orders?buyer_email=eq.${encodeURIComponent(user.email)}` +
             `&select=order_id,status,product_name,quantity,amount,currency,` +
             `ship_country,payment_method,approved_at,created_at` +
             `&order=created_at.desc&limit=20`, []),
      // 보호자(법정대리인) 동의 — 미성년 회원의 결제 전에 필요합니다.
      one(`guardian_consents?user_id=eq.${user.id}&purpose=eq.payment&granted=is.true` +
          `&select=guardian_name,guardian_relation,consented_at,method`)
    ]);

    return res.status(200).json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        emailConfirmed: Boolean(user.email_confirmed_at || user.confirmed_at),
        createdAt: user.created_at
      },
      // 프로필이 없으면 null — 화면이 연령 확인 단계를 먼저 띄웁니다.
      profile: profile || null,
      purchases: (purchases || []).map(p => ({
        id: p.id,
        type: p.purchase_type,
        status: p.status,
        createdAt: p.created_at,
        slug: p.workbooks ? p.workbooks.slug : null,
        title: p.workbooks ? p.workbooks.title : '워크북',
        subtitle: p.workbooks ? p.workbooks.subtitle : null
      })),
      orders: orders || [],
      // 동의가 없으면 null — 화면이 '동의 남기기' 안내를 띄웁니다.
      guardianConsent: guardianConsent || null
    });
  } catch (err) {
    console.error('account error:', err);
    return res.status(500).json({ error: 'Could not load account' });
  }
}

// ── 유틸 ─────────────────────────────────────────────────────

async function verifyToken(token) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: ANON_KEY || SERVICE_KEY, Authorization: `Bearer ${token}` }
  });
  if (!r.ok) throw new Error(`auth ${r.status}`);
  const u = await r.json();
  if (!u || !u.id || !u.email) throw new Error('incomplete user');
  return u;
}

function sbHeaders() {
  return { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };
}

async function sb(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: sbHeaders() });
  if (!r.ok) throw new Error(`supabase ${path} → ${r.status} ${await r.text()}`);
  return r.json();
}

// 표가 아직 없는 환경에서도 화면이 통째로 죽지 않게 합니다.
async function sbSoft(path, fallback) {
  try { return await sb(path); }
  catch (err) { console.warn('optional query skipped:', err.message); return fallback; }
}

async function one(path) {
  const rows = await sbSoft(path, []);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}
