// ============================================================
//  /api/subscribe.js  —  이메일 알림 신청 처리
//  Vercel에 배포하면 https://내사이트/api/subscribe 로 동작합니다.
//
//  [필요한 환경변수]  Vercel → Settings → Environment Variables
//    RESEND_API_KEY   : Resend에서 발급받은 API 키 (re_ 로 시작)
//    RESEND_AUDIENCE_ID : Resend → Audiences 에서 만든 명단의 ID
//    FROM_EMAIL       : 인증한 도메인의 발신 주소
//                       (예: 김심리월드 <hello@simriworld.com>)
//    NOTIFY_EMAIL     : 신청 알림을 받을 내 주소 (선택)
//
//  ※ API 키는 절대 HTML/프론트엔드에 넣지 마세요. 여기(서버)에만 둡니다.
// ============================================================

const RESEND_API = 'https://api.resend.com';

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
  if (!apiKey || !from) {
    console.error('Missing RESEND_API_KEY or FROM_EMAIL');
    return res.status(500).json({ error: 'Server not configured' });
  }

  // --- 입력 검증 ---
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const email = String((body && body.email) || '').trim().toLowerCase();
  const lang = (body && body.lang) === 'en' ? 'en' : 'ko';

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 254) {
    return res.status(400).json({ error: 'Invalid email' });
  }

  const authHeaders = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  };

  try {
    // --- 1) 명단(Audience)에 연락처 추가 ---
    if (audienceId) {
      const addRes = await fetch(`${RESEND_API}/audiences/${audienceId}/contacts`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ email, unsubscribed: false })
      });

      if (!addRes.ok) {
        const errText = await addRes.text();
        // 이미 등록된 이메일이면 409로 알려주기
        if (addRes.status === 409 || /already exists/i.test(errText)) {
          return res.status(409).json({ error: 'Already subscribed' });
        }
        console.error('Resend contact error:', addRes.status, errText);
        return res.status(502).json({ error: 'Could not save contact' });
      }
    }

    // --- 2) 신청자에게 확인 메일 발송 ---
    const subject = lang === 'en'
      ? "You're on the list — A User's Manual for Your Mind"
      : '(광고) 알림 신청이 완료되었습니다 — 마음 사용 설명서';

    const html = lang === 'en' ? enTemplate() : koTemplate();

    const sendRes = await fetch(`${RESEND_API}/emails`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ from, to: [email], subject, html })
    });

    if (!sendRes.ok) {
      // 명단 저장은 성공했으므로 사용자에겐 성공으로 응답하되 로그는 남김
      console.error('Resend send error:', sendRes.status, await sendRes.text());
    }

    // --- 3) 나에게 신청 알림 (선택) ---
    if (process.env.NOTIFY_EMAIL) {
      fetch(`${RESEND_API}/emails`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          from,
          to: [process.env.NOTIFY_EMAIL],
          subject: '[김심리월드] 새 알림 신청',
          html: `<p>새 신청: <strong>${escapeHtml(email)}</strong> (${lang})</p>`
        })
      }).catch(() => {});
    }

    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error('subscribe error:', err);
    return res.status(500).json({ error: 'Unexpected error' });
  }
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
