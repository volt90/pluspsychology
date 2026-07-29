// ============================================================
//  /api/contact.js  —  문의 폼 접수 → 내 메일함으로 전달
//  contact.html의 폼이 여기로 POST 합니다.
//
//  Supabase(inquiries)에 먼저 저장하고, 그 다음 메일로 전달합니다.
//  순서가 중요합니다 — 메일이 스팸으로 가거나 실수로 지워져도 원본이 남습니다.
//  저장이 실패해도 접수는 막지 않습니다(메일은 나갑니다). 반대로 메일이
//  실패하면 실패로 응답하되, 이미 저장된 행이 email_sent=false 로 남습니다.
//
//  답장은 메일 클라이언트의 '회신'을 누르면 문의자에게 바로 갑니다
//  — reply_to 를 문의자 주소로 넣기 때문입니다.
//
//  [필요한 환경변수]  Vercel → Settings → Environment Variables
//    RESEND_API_KEY    : Resend API 키 (re_ 로 시작)
//    FROM_EMAIL        : 인증한 도메인의 발신 주소
//                        (예: 김심리월드 <hello@pluspsychology.ai>)
//    CONTACT_TO_EMAIL  : 문의를 받을 주소 (선택 — 없으면 NOTIFY_EMAIL,
//                        그것도 없으면 아래 DEFAULT_TO 로 갑니다)
//    SUPABASE_URL              : 프로젝트 URL (선택 — 없으면 저장만 건너뜁니다)
//    SUPABASE_SERVICE_ROLE_KEY : service_role 키 (RLS 우회 — 서버 전용)
//
//  ※ 위 설정이 없으면 503을 돌려줍니다. 그러면 contact.html이
//    "이메일로 보내주세요" 안내로 바꿔 보여주므로, 설정 전에도
//    문의자가 길을 잃지 않습니다. (거짓 성공을 보여주지 않기 위함)
//  ※ 키는 절대 HTML/프런트엔드에 넣지 마세요. 여기(서버)에만 둡니다.
// ============================================================

const RESEND_API = 'https://api.resend.com';
const DEFAULT_TO = 'pluspsychology@gmail.com';

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const INQUIRIES_TABLE = 'inquiries';

// 첨부 제한 — contact.html의 MAX_FILES / MAX_TOTAL과 같은 값이어야 합니다.
const MAX_FILES = 3;
const MAX_TOTAL_BYTES = 3 * 1024 * 1024;
const ALLOWED_EXT = [
  'pdf', 'doc', 'docx', 'hwp', 'hwpx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt',
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'zip'
];

const TYPE_LABEL = {
  purchase:    '워크북 구매·주문',
  bulk:        '기관·단체 도입 (학교·기업·상담센터)',
  partnership: '강연·워크숍·협업 제안',
  press:       '언론·인터뷰',
  etc:         '기타 문의'
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.FROM_EMAIL;
  const to = process.env.CONTACT_TO_EMAIL || process.env.NOTIFY_EMAIL || DEFAULT_TO;

  // 보낼 수단이 없으면 접수했다고 말하지 않습니다.
  if (!apiKey || !from) {
    console.error('Contact form: RESEND_API_KEY / FROM_EMAIL not configured');
    return res.status(503).json({ error: 'Contact form not configured' });
  }

  // --- 입력 파싱 ---
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  if (!body || typeof body !== 'object') body = {};

  // 봇 함정(honeypot) — 사람에게는 보이지 않는 칸입니다.
  // 채워져 있으면 조용히 성공으로 응답해 스팸이 실패를 학습하지 못하게 합니다.
  if (String(body.website || '').trim()) {
    return res.status(200).json({ ok: true });
  }

  const type    = String(body.type || '').trim();
  const name    = String(body.name || '').trim().slice(0, 80);
  const email   = String(body.email || '').trim().toLowerCase().slice(0, 254);
  const phone   = String(body.phone || '').trim().slice(0, 40);
  const subject = String(body.subject || '').trim().slice(0, 120);
  const message = String(body.message || '').trim().slice(0, 5000);
  const lang    = body.lang === 'en' ? 'en' : 'ko';
  const consent = body.consent === true;

  if (!TYPE_LABEL[type])  return res.status(400).json({ error: 'Invalid type' });
  if (!name)              return res.status(400).json({ error: 'Name required' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return res.status(400).json({ error: 'Invalid email' });
  if (!subject)           return res.status(400).json({ error: 'Subject required' });
  if (!message)           return res.status(400).json({ error: 'Message required' });
  if (!consent)           return res.status(400).json({ error: 'Consent required' });

  // --- 첨부 검증 ---
  const rawAttachments = Array.isArray(body.attachments) ? body.attachments : [];
  if (rawAttachments.length > MAX_FILES) {
    return res.status(400).json({ error: 'Too many attachments' });
  }

  const attachments = [];
  const attachmentBytes = [];        // 파일별 원본 바이트 (DB 에 목록으로 남깁니다)
  let totalBytes = 0;
  for (const a of rawAttachments) {
    const filename = String((a && a.name) || '').trim().replace(/[\r\n"]/g, '').slice(0, 120);
    const content = String((a && a.content) || '');
    if (!filename || !content) return res.status(400).json({ error: 'Invalid attachment' });

    const ext = filename.split('.').pop().toLowerCase();
    if (!ALLOWED_EXT.includes(ext)) {
      return res.status(400).json({ error: 'Attachment type not allowed' });
    }
    if (!/^[A-Za-z0-9+/=\s]+$/.test(content)) {
      return res.status(400).json({ error: 'Invalid attachment encoding' });
    }

    // base64 길이로 원본 바이트 수를 계산 (4글자 → 3바이트)
    const clean = content.replace(/\s/g, '');
    const pad = (clean.match(/=+$/) || [''])[0].length;
    const bytes = Math.floor(clean.length * 3 / 4) - pad;
    totalBytes += bytes;
    if (totalBytes > MAX_TOTAL_BYTES) {
      return res.status(413).json({ error: 'Attachments too large' });
    }
    attachments.push({ filename, content: clean });
    attachmentBytes.push(bytes);
  }

  // --- 먼저 저장 ---
  // 여기서 실패해도 접수를 막지 않습니다. 저장은 사본이고, 문의자에게는
  // 메일이 전달되는 것이 우선입니다. 실패는 로그로 남깁니다.
  let inquiryId = null;
  if (SUPABASE_URL && SUPABASE_KEY) {
    try {
      inquiryId = await insertInquiry({
        type, name, email, phone: phone || null, subject, message, lang,
        attachments: attachments.map((a, i) => ({
          name: a.filename,
          bytes: attachmentBytes[i]
        })),
        consent: true,
        consented_at: new Date().toISOString(),
        consent_ip: clientIp(req),
        consent_user_agent: String(req.headers['user-agent'] || '').slice(0, 500)
      });
    } catch (err) {
      console.error('inquiry save failed:', err);
    }
  }

  // --- 메일 발송 ---
  try {
    const payload = {
      from,
      to: [to],
      reply_to: email,                       // 회신하면 문의자에게 바로 갑니다
      subject: `[김심리월드 문의] ${TYPE_LABEL[type]} — ${subject}`,
      html: buildHtml({ type, name, email, phone, subject, message, lang, ip: clientIp(req) })
    };
    if (attachments.length) payload.attachments = attachments;

    const sendRes = await fetch(`${RESEND_API}/emails`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!sendRes.ok) {
      const detail = await sendRes.text();
      console.error('Contact send error:', sendRes.status, detail);
      await markEmail(inquiryId, { email_sent: false, email_error: `${sendRes.status} ${detail}`.slice(0, 500) });
      return res.status(502).json({ error: 'Could not deliver inquiry' });
    }

    const sent = await sendRes.json().catch(() => null);
    await markEmail(inquiryId, { email_sent: true, email_id: (sent && sent.id) || null });
    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error('contact error:', err);
    await markEmail(inquiryId, { email_sent: false, email_error: String(err).slice(0, 500) });
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

async function insertInquiry(row) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${INQUIRIES_TABLE}`, {
    method: 'POST',
    headers: { ...supabaseHeaders(), 'Prefer': 'return=representation' },
    body: JSON.stringify(row)
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const rows = await res.json().catch(() => null);
  return Array.isArray(rows) && rows[0] ? rows[0].id : null;
}

// 발송 결과 기록. 저장이 없었거나 여기서 실패해도 응답에는 영향을 주지 않습니다.
async function markEmail(id, patch) {
  if (!id || !SUPABASE_URL || !SUPABASE_KEY) return;
  try {
    const url = `${SUPABASE_URL}/rest/v1/${INQUIRIES_TABLE}?id=eq.${encodeURIComponent(id)}`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { ...supabaseHeaders(), 'Prefer': 'return=minimal' },
      body: JSON.stringify(patch)
    });
    if (!res.ok) console.error('inquiry patch failed:', res.status, await res.text());
  } catch (err) {
    console.error('inquiry patch failed:', err);
  }
}

// ── 유틸 ─────────────────────────────────────────────────────

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  const raw = Array.isArray(fwd) ? fwd[0] : (fwd || '');
  return String(raw).split(',')[0].trim().slice(0, 45) || '-';
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function row(label, value) {
  if (!value) return '';
  return `
    <tr>
      <th style="text-align:left;vertical-align:top;padding:8px 12px 8px 0;font-size:13px;color:#6E6658;white-space:nowrap">${escapeHtml(label)}</th>
      <td style="padding:8px 0;font-size:14px;color:#2B2620">${escapeHtml(value)}</td>
    </tr>`;
}

function buildHtml({ type, name, email, phone, subject, message, lang, ip }) {
  return `
  <div style="font-family:'Apple SD Gothic Neo',Arial,sans-serif;max-width:620px;margin:0 auto;padding:28px 24px;background:#FBF6EA;color:#2B2620;line-height:1.7">
    <h1 style="font-size:19px;margin:0 0 4px">새 문의가 도착했습니다</h1>
    <p style="font-size:13px;color:#A79E8E;margin:0 0 18px">pluspsychology.ai · 문의 폼</p>

    <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #ECE2CD;border-radius:12px;padding:6px 14px">
      ${row('문의 유형', TYPE_LABEL[type])}
      ${row('이름(기관명)', name)}
      ${row('이메일', email)}
      ${row('연락처', phone || '(미입력)')}
      ${row('제목', subject)}
      ${row('화면 언어', lang === 'en' ? 'English' : '한국어')}
    </table>

    <h2 style="font-size:14px;margin:22px 0 8px;color:#2F6FA8">문의 내용</h2>
    <div style="background:#fff;border:1px solid #ECE2CD;border-radius:12px;padding:16px;font-size:14px;white-space:pre-wrap;word-break:break-word">${escapeHtml(message)}</div>

    <p style="font-size:11.5px;color:#A79E8E;margin:22px 0 0;border-top:1px solid #ECE2CD;padding-top:14px">
      이 메일에 그대로 <strong>회신</strong>하면 문의자(${escapeHtml(email)})에게 바로 전달됩니다.<br>
      접수 IP ${escapeHtml(ip)} · 개인정보 수집·이용 동의 완료<br>
      ⓒ 2025 SIMRI KIM · 김심리월드
    </p>
  </div>`;
}
