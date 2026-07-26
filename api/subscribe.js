// ============================================================
//  /api/subscribe.js  —  이메일 알림 신청 처리
//  Vercel에 배포하면 https://내사이트/api/subscribe 로 동작합니다.
//
//  저장은 Supabase(원본 명단), 발송은 Resend가 담당합니다.
//  둘 중 하나만 설정돼 있어도 동작합니다.
//
//  [필요한 환경변수]  Vercel → Settings → Environment Variables
//    SUPABASE_URL              : 프로젝트 URL (https://xxxx.supabase.co)
//    SUPABASE_SERVICE_ROLE_KEY : service_role 키 (RLS 우회 — 서버 전용)
//
//    RESEND_API_KEY     : Resend에서 발급받은 API 키 (re_ 로 시작)
//    RESEND_AUDIENCE_ID : Resend → Audiences 에서 만든 명단의 ID
//    FROM_EMAIL         : 인증한 도메인의 발신 주소
//                         (예: 김심리월드 <hello@pluspsychology.ai>)
//    NOTIFY_EMAIL       : 신청 알림을 받을 내 주소 (선택)
//
//  ※ 키는 절대 HTML/프런트엔드에 넣지 마세요. 여기(서버)에만 둡니다.
//     특히 service_role 키는 노출되면 명단 전체를 읽고 지울 수 있습니다.
// ============================================================

const RESEND_API = 'https://api.resend.com';
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SUBSCRIBERS_TABLE = 'subscribers';

export default async function handler(req, res) {
  // --- CORS (같은 도메인에서 쓰면 없어도 되지만, 안전하게) ---
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const audienceId = process.env.RESEND_AUDIENCE_ID;
  const from = process.env.FROM_EMAIL;

  const hasSupabase = Boolean(SUPABASE_URL && SUPABASE_KEY);
  const hasResend = Boolean(apiKey && from);

  // 저장할 곳도 보낼 곳도 없으면 접수 자체가 불가능
  if (!hasSupabase && !hasResend) {
    console.error('Missing both Supabase and Resend configuration');
    return res.status(500).json({ error: 'Server not configured' });
  }

  // --- 입력 검증 ---
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  if (!body || typeof body !== 'object') body = {};

  const email = String(body.email || '').trim().toLowerCase();
  const lang = body.lang === 'en' ? 'en' : 'ko';
  const source = String(body.source || 'unknown').slice(0, 100);
  // 구버전 HTML이 캐시된 방문자는 consent를 안 보냅니다.
  // 폼이 체크박스를 강제하므로, 명시적 false만 거부합니다.
  const consent = body.consent !== false;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 254) {
    return res.status(400).json({ error: 'Invalid email' });
  }
  if (!consent) {
    return res.status(400).json({ error: 'Consent required' });
  }

  let rowId = null;
  let stored = false;

  try {
    // --- 1) Supabase에 저장 (원본 명단) ---
    if (hasSupabase) {
      const saved = await insertSubscriber({
        email,
        lang,
        source,
        consent: true,
        consented_at: new Date().toISOString(),
        consent_ip: clientIp(req),
        consent_user_agent: String(req.headers['user-agent'] || '').slice(0, 500) || null
      });

      if (saved.duplicate) {
        return res.status(409).json({ error: 'Already subscribed' });
      }
      if (saved.ok) {
        stored = true;
        rowId = saved.id;
      } else {
        // 저장 실패해도 Resend 쪽은 시도합니다 — 신청자를 잃지 않기 위해
        console.error('Supabase insert failed:', saved.error);
      }
    }

    // --- 2) Resend 명단(Audience)에 연락처 추가 ---
    let resendSynced = false;
    if (hasResend && audienceId) {
      const addRes = await fetch(`${RESEND_API}/audiences/${audienceId}/contacts`, {
        method: 'POST',
        headers: resendHeaders(apiKey),
        body: JSON.stringify({ email, unsubscribed: false })
      });

      if (addRes.ok) {
        resendSynced = true;
        stored = true;
      } else {
        const errText = await addRes.text();
        const isDup = addRes.status === 409 || /already exists/i.test(errText);
        if (isDup) {
          // Supabase가 없을 때만 중복 판정의 근거로 씁니다.
          if (!hasSupabase) return res.status(409).json({ error: 'Already subscribed' });
          resendSynced = true;
        } else {
          console.error('Resend contact error:', addRes.status, errText);
        }
      }
    }

    // 어디에도 남지 않았으면 성공이라고 답하면 안 됩니다.
    if (!stored) {
      return res.status(502).json({ error: 'Could not save contact' });
    }

    // --- 3) 신청자에게 확인 메일 발송 ---
    let mailSent = false;
    if (hasResend) {
      const subject = lang === 'en'
        ? "You're on the list — A User's Manual for Your Mind"
        : '(광고) 알림 신청이 완료되었습니다 — 마음 사용 설명서';

      const html = lang === 'en' ? enTemplate() : koTemplate();

      const sendRes = await fetch(`${RESEND_API}/emails`, {
        method: 'POST',
        headers: resendHeaders(apiKey),
        body: JSON.stringify({ from, to: [email], subject, html })
      });

      mailSent = sendRes.ok;
      if (!sendRes.ok) {
        // 명단 저장은 성공했으므로 사용자에겐 성공으로 응답하되 로그는 남김
        console.error('Resend send error:', sendRes.status, await sendRes.text());
      }

      // --- 4) 나에게 신청 알림 (선택) ---
      if (process.env.NOTIFY_EMAIL) {
        fetch(`${RESEND_API}/emails`, {
          method: 'POST',
          headers: resendHeaders(apiKey),
          body: JSON.stringify({
            from,
            to: [process.env.NOTIFY_EMAIL],
            subject: '[김심리월드] 새 알림 신청',
            html: `<p>새 신청: <strong>${escapeHtml(email)}</strong> (${lang})</p>`
          })
        }).catch(() => {});
      }
    }

    // --- 5) 발송 결과를 Supabase 행에 반영 (실패해도 응답엔 영향 없음) ---
    if (rowId) {
      updateSubscriber(rowId, {
        status: hasResend ? (mailSent ? 'confirmed' : 'failed') : 'pending',
        resend_synced: resendSynced
      }).catch(err => console.error('Supabase status update failed:', err));
    }

    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error('subscribe error:', err);
    return res.status(500).json({ error: 'Unexpected error' });
  }
}

// ── Supabase (PostgREST REST API — SDK 의존성 없음) ──────────

function supabaseHeaders() {
  return {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json'
  };
}

async function insertSubscriber(row) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${SUBSCRIBERS_TABLE}`, {
    method: 'POST',
    headers: { ...supabaseHeaders(), 'Prefer': 'return=representation' },
    body: JSON.stringify(row)
  });

  if (res.ok) {
    const rows = await res.json().catch(() => null);
    return { ok: true, id: Array.isArray(rows) && rows[0] ? rows[0].id : null };
  }

  const errText = await res.text();
  // 23505 = unique_violation (이미 신청된 이메일)
  if (res.status === 409 || /23505|duplicate key/i.test(errText)) {
    return { ok: false, duplicate: true };
  }
  return { ok: false, error: `${res.status} ${errText}` };
}

async function updateSubscriber(id, patch) {
  const url = `${SUPABASE_URL}/rest/v1/${SUBSCRIBERS_TABLE}?id=eq.${encodeURIComponent(id)}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { ...supabaseHeaders(), 'Prefer': 'return=minimal' },
    body: JSON.stringify(patch)
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
}

// ── 유틸 ─────────────────────────────────────────────────────

function resendHeaders(apiKey) {
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  };
}

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  const raw = Array.isArray(fwd) ? fwd[0] : (fwd || '');
  const ip = String(raw).split(',')[0].trim();
  return ip.slice(0, 45) || null;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function koTemplate() {
  return `
  <div style="font-family:'Apple SD Gothic Neo',Arial,sans-serif;max-width:520px;margin:0 auto;padding:28px 24px;background:#FBF6EA;color:#2B2620;line-height:1.7">
    <h1 style="font-size:20px;margin:0 0 14px">알림 신청이 완료되었어요 🎉</h1>
    <p style="font-size:14px;color:#6E6658;margin:0 0 12px">
      <strong>〈마음 사용 설명서〉</strong> 워크북이 출시되면 가장 먼저 알려드릴게요.
    </p>
    <p style="font-size:14px;color:#6E6658;margin:0 0 20px">
      마음 배터리가 1%일 때, 나를 이해하는 시간. 곧 찾아뵙겠습니다.
    </p>
    <p style="font-size:12px;color:#A79E8E;margin:22px 0 0;border-top:1px solid #ECE2CD;padding-top:14px">
      본 메일은 수신 동의하신 분께 발송되었습니다.<br>
      수신을 원하지 않으시면 <a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color:#2F6FA8">수신거부</a>를 눌러주세요.<br>
      ⓒ 2025 SIMRI KIM · 김심리월드
    </p>
  </div>`;
}

function enTemplate() {
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:28px 24px;background:#FBF6EA;color:#2B2620;line-height:1.7">
    <h1 style="font-size:20px;margin:0 0 14px">You're on the list 🎉</h1>
    <p style="font-size:14px;color:#6E6658;margin:0 0 12px">
      We'll let you know first when <strong>A User's Manual for Your Mind</strong> launches.
    </p>
    <p style="font-size:14px;color:#6E6658;margin:0 0 20px">
      When your heart is at 1% — time to understand yourself. See you soon.
    </p>
    <p style="font-size:12px;color:#A79E8E;margin:22px 0 0;border-top:1px solid #ECE2CD;padding-top:14px">
      You received this because you signed up for launch updates.<br>
      <a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color:#2F6FA8">Unsubscribe</a><br>
      &copy; 2025 SIMRI KIM · Kim Simri World
    </p>
  </div>`;
}
