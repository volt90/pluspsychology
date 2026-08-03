// ============================================================
//  /api/admin-stats.js  —  관리자 대시보드 데이터
//  admin.html 이 로그인 후 이 주소를 호출합니다.
//
//  두 곳의 데이터를 서버에서 합쳐 내려줍니다:
//    · GA4 Data API — 방문자·페이지뷰·유입채널·이벤트
//    · Supabase     — 알림신청 · 문의 · 주문 · 앱 회원가입
//  전환율(= 접수 ÷ 방문자)은 두 쪽을 합쳐야 나오므로 여기서 계산합니다.
//
//  [인증]  Supabase Auth 토큰 + 이메일 허용목록. 둘 다 통과해야 합니다.
//    1) 브라우저가 Authorization: Bearer <access_token> 을 보냅니다
//    2) 서버가 Supabase 에 물어 토큰이 진짜인지, 누구인지 확인합니다
//    3) 그 이메일이 ADMIN_EMAILS 에 있어야 데이터를 돌려줍니다
//  → 로그인만 되면 통과하는 구조가 아닙니다. 앱 회원이 여기로 들어와도 막힙니다.
//
//  [필요한 환경변수]  Vercel → Settings → Environment Variables
//    SUPABASE_URL               : 프로젝트 URL
//    SUPABASE_SERVICE_ROLE_KEY  : service_role 키 — 서버 전용, 절대 노출 금지
//    SUPABASE_ANON_KEY          : anon 키 (토큰 검증용 — 공개돼도 되는 키)
//    ADMIN_EMAILS               : 쉼표로 구분한 허용 이메일
//                                 예: chaerim10@gmail.com,pluspsychology@gmail.com
//
//    GA4_PROPERTY_ID            : GA4 속성 ID — 숫자입니다 (G-... 측정ID 아님)
//                                 확인: GA4 → 관리 → 속성 설정 → 속성 ID
//    GOOGLE_SERVICE_ACCOUNT_EMAIL : ...@....iam.gserviceaccount.com
//    GOOGLE_PRIVATE_KEY         : 서비스계정 JSON 의 private_key 값 전체
//                                 (-----BEGIN PRIVATE KEY----- 부터 끝까지)
//
//  ※ GA4 설정이 없으면 GA 부분만 비우고 Supabase 수치는 그대로 내려줍니다.
//    대시보드가 통째로 죽지 않게 하기 위함입니다.
// ============================================================

import crypto from 'node:crypto';

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ANON_KEY     = process.env.SUPABASE_ANON_KEY || '';

const GA4_PROPERTY = (process.env.GA4_PROPERTY_ID || '').replace(/^properties\//, '');
const GA_EMAIL     = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '';
const GA_KEY       = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

const GA_SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('admin-stats: Supabase not configured');
    return res.status(503).json({ error: 'Not configured' });
  }

  // ── 인증 ──────────────────────────────────────────────────
  const auth = String(req.headers.authorization || '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return res.status(401).json({ error: 'Sign in required' });

  let email;
  try {
    email = await verifyToken(token);
  } catch (err) {
    console.error('admin-stats: token check failed:', err);
    return res.status(401).json({ error: 'Sign in required' });
  }

  const allowed = String(process.env.ADMIN_EMAILS || '')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

  if (!allowed.length) {
    console.error('admin-stats: ADMIN_EMAILS is empty — refusing to open the dashboard');
    return res.status(503).json({ error: 'Not configured' });
  }
  if (!allowed.includes(email.toLowerCase())) {
    // 어떤 이메일이 막혔는지는 응답에 담지 않습니다.
    console.warn('admin-stats: rejected', email);
    return res.status(403).json({ error: 'Not an admin account' });
  }

  // ── 기간 ──────────────────────────────────────────────────
  const days = clampDays(req.query && req.query.days);
  const since = new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  try {
    const [supa, ga] = await Promise.all([
      loadSupabase(days, since),
      loadGa4(since, today).catch(err => {
        console.error('GA4 unavailable:', err.message);
        return { available: false, reason: String(err.message).slice(0, 200) };
      })
    ]);

    const campaigns = joinCampaigns(supa.campaigns, ga);
    const switches = readSwitches(ga);
    const funnel = buildFunnel(ga, supa, switches);

    return res.status(200).json({
      ok: true,
      user: email,
      range: { days, since, until: today },
      ga,
      totals: supa.totals,
      daily: supa.daily,
      recent: supa.recent,
      inquiryTypes: supa.inquiryTypes,
      campaigns,
      switches,
      funnel
    });
  } catch (err) {
    console.error('admin-stats error:', err);
    return res.status(500).json({ error: 'Could not load stats' });
  }
}

// ── 인증 ────────────────────────────────────────────────────

// Supabase 에 토큰을 그대로 물어봅니다. 서명을 직접 검증하지 않는 이유는,
// 만료·폐기까지 Supabase 가 판단해 주는 쪽이 더 안전하기 때문입니다.
async function verifyToken(token) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: ANON_KEY || SERVICE_KEY, Authorization: `Bearer ${token}` }
  });
  if (!r.ok) throw new Error(`auth ${r.status}`);
  const u = await r.json();
  if (!u || !u.email) throw new Error('no email on token');
  return u.email;
}

// ── Supabase 집계 ───────────────────────────────────────────

function sbHeaders() {
  return { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };
}

async function sb(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: sbHeaders() });
  if (!r.ok) throw new Error(`supabase ${path} → ${r.status} ${await r.text()}`);
  return r.json();
}

// 테이블/뷰가 아직 없어도 대시보드가 죽지 않게 합니다.
async function sbSoft(path, fallback) {
  try { return await sb(path); }
  catch (err) { console.warn('optional query skipped:', err.message); return fallback; }
}

async function countSince(table, since, extra = '') {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}?select=id&created_at=gte.${since}${extra}`,
    { headers: { ...sbHeaders(), Prefer: 'count=exact', Range: '0-0' } }
  );
  if (!r.ok) return 0;
  const cr = r.headers.get('content-range') || '';   // 형식: "0-0/42"
  return Number(cr.split('/')[1]) || 0;
}

async function loadSupabase(days, since) {
  const [daily, appDaily, campaigns, recentSubs, recentInq, types] = await Promise.all([
    sbSoft(`admin_daily_counts?day=gte.${since}&order=day.asc`, []),
    sbSoft(`admin_daily_signups?day=gte.${since}&order=day.asc`, []),
    sbSoft('admin_campaign_totals?order=starts_at.desc', []),
    sbSoft('subscribers?select=email,campaign,created_at&order=created_at.desc&limit=8', []),
    sbSoft('inquiries?select=type,name,subject,status,created_at&order=created_at.desc&limit=8', []),
    sbSoft(`inquiries?select=type&created_at=gte.${since}&status=neq.spam`, [])
  ]);

  // 날짜별 표를 하나로 합칩니다 (앱 가입은 별도 뷰에서 옵니다)
  const appByDay = new Map((appDaily || []).map(r => [r.day, r.app_signups]));
  const merged = (daily || []).map(r => ({
    day: r.day,
    subscribers: Number(r.subscribers) || 0,
    inquiries: Number(r.inquiries) || 0,
    orders: Number(r.orders_paid) || 0,
    appSignups: Number(appByDay.get(r.day)) || 0
  }));

  const sum = k => merged.reduce((a, r) => a + r[k], 0);

  const [allSubs, allInq, allOrders, allApp] = await Promise.all([
    countSince('subscribers', '1970-01-01'),
    countSince('inquiries', '1970-01-01', '&status=neq.spam'),
    countSince('orders', '1970-01-01', '&status=eq.paid'),
    countSince('profiles', '1970-01-01').catch(() => 0)
  ]);

  const typeCount = {};
  for (const t of types || []) typeCount[t.type] = (typeCount[t.type] || 0) + 1;

  return {
    daily: merged,
    totals: {
      period: {
        subscribers: sum('subscribers'),
        inquiries: sum('inquiries'),
        orders: sum('orders'),
        appSignups: sum('appSignups')
      },
      allTime: {
        subscribers: allSubs,
        inquiries: allInq,
        orders: allOrders,
        appSignups: allApp
      }
    },
    campaigns: campaigns || [],
    recent: { subscribers: recentSubs || [], inquiries: recentInq || [] },
    inquiryTypes: typeCount
  };
}

// ── GA4 Data API ────────────────────────────────────────────

// 서비스계정 키로 JWT 를 만들어 액세스 토큰과 바꿉니다.
// 구글 SDK 를 쓰지 않는 이유는 이 저장소에 의존성이 없기 때문입니다.
async function gaAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  const enc = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = `${enc({ alg: 'RS256', typ: 'JWT' })}.${enc({
    iss: GA_EMAIL,
    scope: GA_SCOPE,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  })}`;

  const sig = crypto.createSign('RSA-SHA256').update(unsigned).sign(GA_KEY, 'base64url');

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${sig}`
    })
  });
  if (!r.ok) throw new Error(`google token ${r.status} ${await r.text()}`);
  return (await r.json()).access_token;
}

async function gaReport(token, body) {
  const r = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${GA4_PROPERTY}:runReport`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }
  );
  if (!r.ok) throw new Error(`GA4 ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

const rows = rep => (rep && rep.rows) || [];
const dim = (row, i) => (row.dimensionValues && row.dimensionValues[i]?.value) || '';
const met = (row, i) => Number(row.metricValues && row.metricValues[i]?.value) || 0;

async function loadGa4(since, until) {
  if (!GA4_PROPERTY || !GA_EMAIL || !GA_KEY) {
    throw new Error('GA4 environment variables are not set');
  }
  const token = await gaAccessToken();
  const range = [{ startDate: since, endDate: until }];

  const [trend, pages, channels, events, byPath] = await Promise.all([
    gaReport(token, {
      dateRanges: range,
      dimensions: [{ name: 'date' }],
      metrics: [{ name: 'activeUsers' }, { name: 'sessions' }, { name: 'screenPageViews' }],
      orderBys: [{ dimension: { dimensionName: 'date' } }]
    }),
    gaReport(token, {
      dateRanges: range,
      dimensions: [{ name: 'pagePath' }],
      metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }],
      orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
      limit: 12
    }),
    gaReport(token, {
      dateRanges: range,
      dimensions: [{ name: 'sessionDefaultChannelGroup' }],
      metrics: [{ name: 'sessions' }],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 8
    }),
    // 이벤트는 '몇 번'과 '몇 명'을 함께 받습니다.
    // 퍼널은 사람 수로 세야 하므로 activeUsers 가 필요합니다 —
    // 한 사람이 가격을 세 번 보면 eventCount 는 3, activeUsers 는 1 입니다.
    gaReport(token, {
      dateRanges: range,
      dimensions: [{ name: 'eventName' }],
      metrics: [{ name: 'eventCount' }, { name: 'activeUsers' }],
      orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
      limit: 20
    }),
    // 캠페인 페이지별 방문자 — 전환율의 분모가 됩니다
    gaReport(token, {
      dateRanges: range,
      dimensions: [{ name: 'pagePath' }],
      metrics: [{ name: 'activeUsers' }, { name: 'sessions' }],
      limit: 200
    })
  ]);

  const users = {};
  for (const r of rows(byPath)) {
    users[dim(r, 0)] = { users: met(r, 0), sessions: met(r, 1) };
  }

  const trendRows = rows(trend).map(r => ({
    day: `${dim(r, 0).slice(0, 4)}-${dim(r, 0).slice(4, 6)}-${dim(r, 0).slice(6, 8)}`,
    users: met(r, 0), sessions: met(r, 1), views: met(r, 2)
  }));

  return {
    available: true,
    trend: trendRows,
    totals: {
      users: trendRows.reduce((a, r) => a + r.users, 0),
      sessions: trendRows.reduce((a, r) => a + r.sessions, 0),
      views: trendRows.reduce((a, r) => a + r.views, 0)
    },
    pages: rows(pages).map(r => ({ path: dim(r, 0), views: met(r, 0), users: met(r, 1) })),
    channels: rows(channels).map(r => ({ name: dim(r, 0) || '(기타)', sessions: met(r, 0) })),
    events: rows(events).map(r => ({ name: dim(r, 0), count: met(r, 0), users: met(r, 1) })),
    usersByPath: users
  };
}

// ── 캠페인: Supabase 접수 건수 + GA4 방문자 = 전환율 ─────────

function joinCampaigns(list, ga) {
  const byPath = (ga && ga.usersByPath) || {};
  return (list || []).map(c => {
    const path = c.page_path || `/c/${c.slug}`;
    // /c/spring 과 /c/spring/ 처럼 표기가 갈리는 경우를 합칩니다.
    const hit = byPath[path] || byPath[path.replace(/\/$/, '')] || byPath[`${path}/`] || null;
    const visitors = hit ? hit.users : null;

    const subscribers = Number(c.subscribers) || 0;
    const inquiries   = Number(c.inquiries) || 0;
    const orders      = Number(c.orders_paid) || 0;
    const conversions = inquiries + orders;

    return {
      slug: c.slug,
      name: c.name,
      path,
      startsAt: c.starts_at,
      endsAt: c.ends_at,
      isActive: c.is_active,
      visitors,                       // null = GA4 에 해당 경로 기록이 아직 없음
      subscribers, inquiries, orders, conversions,
      // 방문자를 모르면 비율을 지어내지 않고 null 로 둡니다.
      signupRate:     visitors ? subscribers / visitors : null,
      conversionRate: visitors ? conversions / visitors : null
    };
  });
}

// ── 퍼널이 실제로 열려 있는지 ────────────────────────────────
//
//  퍼널 뒷단은 '사람이 안 와서' 가 아니라 '기능이 꺼져 있어서' 0 인 경우가
//  많습니다. 그걸 이탈로 읽으면 엉뚱한 곳을 고치게 되므로, 스위치 상태를
//  함께 내려보내 화면이 '아직 열지 않음' 으로 표시하게 합니다.
//  ⚠️ 값이 아니라 켜짐/꺼짐만 내려보냅니다. 키 자체는 절대 내보내지 마세요.
function readSwitches(ga) {
  return {
    emailCapture: Boolean(SUPABASE_URL && SERVICE_KEY),
    resendAudience: Boolean(process.env.RESEND_API_KEY && process.env.RESEND_AUDIENCE_ID),
    contactForm: Boolean(process.env.RESEND_API_KEY && process.env.FROM_EMAIL),
    payments: process.env.PAYMENTS_ENABLED === 'true',
    ga4: Boolean(ga && ga.available)
  };
}

// ── 퍼널 ────────────────────────────────────────────────────
//
//  방문 → 가격 확인 → 문의 버튼 클릭 까지는 GA4 의 '사람 수',
//  실제 접수 → 결제 는 Supabase 의 '건수' 입니다.
//  단위가 다르므로 단계마다 출처를 함께 내려보내고, 화면에도 적습니다.
//
//  🚨 앱 회원가입은 이 퍼널에 넣지 않습니다. 앱 가입에는 유입 경로가
//     기록되지 않아 랜딩에서 온 사람인지 알 수 없습니다. 넣으면 랜딩이
//     만든 성과처럼 보입니다.
function buildFunnel(ga, supa, sw) {
  const has = Boolean(ga && ga.available);
  const evUsers = {};
  if (has) for (const e of ga.events || []) evUsers[e.name] = e.users;
  const period = supa.totals.period;

  const steps = [
    { key: 'visit', label: '방문', source: 'GA4 · 활성 사용자', unit: '명',
      value: has ? ga.totals.users : null },
    { key: 'price', label: '가격 확인', source: 'GA4 · view_price', unit: '명',
      value: has ? (evUsers.view_price || 0) : null },
    { key: 'cta', label: '문의 버튼 클릭', source: 'GA4 · cta_click', unit: '명',
      value: has ? (evUsers.cta_click || 0) : null },
    // 문의 폼이 꺼져 있어도 알림신청은 들어오므로 '닫힘' 은 아닙니다.
    // 절반만 막힌 상태라 caveat 로만 알립니다.
    { key: 'receipt', label: '실제 접수', source: 'Supabase · 알림신청 + 문의', unit: '건',
      value: period.subscribers + period.inquiries,
      caveat: sw.contactForm ? null : '문의 폼이 꺼져 있어 이 숫자에는 알림신청만 들어 있습니다' },
    { key: 'paid', label: '결제 완료', source: 'Supabase · orders(paid)', unit: '건',
      value: period.orders,
      closed: sw.payments ? null : '아직 판매를 시작하지 않았습니다' }
  ];

  const top = steps[0].value;
  let prev = null;
  for (const s of steps) {
    s.ofTop = (top && s.value != null) ? s.value / top : null;
    // 직전 단계를 모르거나 0이면 비율을 지어내지 않고 비웁니다.
    s.fromPrev = (prev != null && prev > 0 && s.value != null) ? s.value / prev : null;
    s.lost = (prev != null && s.value != null) ? Math.max(0, prev - s.value) : null;
    prev = s.value;
  }

  // 가장 크게 새는 구간 — 닫아둔 단계는 이탈이 아니므로 제외합니다.
  let worst = null;
  for (let i = 1; i < steps.length; i++) {
    const s = steps[i];
    if (s.closed || s.fromPrev == null || !s.lost) continue;
    if (!worst || s.fromPrev < worst.rate) {
      worst = { from: steps[i - 1].label, to: s.label, rate: s.fromPrev,
                lost: s.lost, unit: steps[i - 1].unit };
    }
  }

  return { steps, bottleneck: worst };
}

function clampDays(v) {
  const n = Number(Array.isArray(v) ? v[0] : v);
  if (!Number.isFinite(n)) return 28;
  return Math.min(180, Math.max(7, Math.round(n)));
}
