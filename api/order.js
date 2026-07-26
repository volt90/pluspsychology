// ============================================================
//  /api/order.js  —  주문 생성 (결제 요청 직전 단계)
//
//  ⚠️ 결제 금액은 반드시 서버가 계산합니다.
//     클라이언트가 보낸 금액은 절대 신뢰하지 않습니다.
//     (승인 단계에서 여기 저장한 금액과 대조합니다 → api/confirm.js)
//
//  [필요한 환경변수]
//    PAYMENTS_ENABLED          : 'true'일 때만 동작 (기본 비활성 — 실수로 열리는 것 방지)
//    TOSS_CLIENT_KEY           : 토스페이먼츠 클라이언트 키 (공개용 — 프런트에 내려줌)
//    SUPABASE_URL              : 프로젝트 URL
//    SUPABASE_SERVICE_ROLE_KEY : service_role 키 (서버 전용)
//
//  ※ TOSS_SECRET_KEY는 여기서 쓰지 않습니다. 승인 단계(api/confirm.js)에만 있습니다.
// ============================================================

// ── 판매 상품 설정 ───────────────────────────────────────────
//  ⚠️ unitPrice는 임시값입니다. 실제 판매가 확정 시 수정하세요.
//     index.html의 표시 가격, 추적 코드의 value도 함께 맞춰야 합니다.
const PRODUCT = {
  code: 'workbook-mind-manual',
  name: '마음 사용 설명서',
  unitPrice: 16900,
  maxQty: 5
};

// 배송비 (국가코드: 금액). 여기 없는 국가는 배송 불가로 처리됩니다.
//  해외 배송은 아직 열지 않았습니다 — 국제배송비가 상품가에 육박해
//  단가 정책을 먼저 정해야 합니다 (docs/commerce-plan.md 4장).
const SHIPPING_FEE = {
  KR: 3000
};

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // --- 안전장치: 명시적으로 켜기 전까지는 결제가 열리지 않습니다 ---
  if (process.env.PAYMENTS_ENABLED !== 'true') {
    return res.status(503).json({ error: 'Payments not enabled', code: 'PAYMENTS_DISABLED' });
  }

  const clientKey = process.env.TOSS_CLIENT_KEY;
  if (!clientKey || !SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing TOSS_CLIENT_KEY or Supabase configuration');
    return res.status(500).json({ error: 'Server not configured' });
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  if (!body || typeof body !== 'object') body = {};

  // --- 입력 검증 ---
  const quantity = Number.parseInt(body.quantity, 10);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > PRODUCT.maxQty) {
    return res.status(400).json({ error: `수량은 1~${PRODUCT.maxQty}권까지 가능합니다.` });
  }

  const buyerName = str(body.buyerName, 50);
  const buyerEmail = str(body.buyerEmail, 254).toLowerCase();
  const buyerPhone = str(body.buyerPhone, 30);
  if (!buyerName) return res.status(400).json({ error: '받는 분 이름을 입력해 주세요.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(buyerEmail)) {
    return res.status(400).json({ error: '이메일 주소를 다시 확인해 주세요.' });
  }
  if (!/^[0-9+\-\s()]{8,}$/.test(buyerPhone)) {
    return res.status(400).json({ error: '연락처를 다시 확인해 주세요.' });
  }

  const shipCountry = (str(body.shipCountry, 2) || 'KR').toUpperCase();
  const shippingFee = SHIPPING_FEE[shipCountry];
  if (shippingFee === undefined) {
    return res.status(400).json({ error: '현재 해당 국가로는 배송이 불가합니다.', code: 'COUNTRY_NOT_SUPPORTED' });
  }

  const shipPostcode = str(body.shipPostcode, 20);
  const shipAddress1 = str(body.shipAddress1, 200);
  const shipAddress2 = str(body.shipAddress2, 200);
  if (!shipPostcode || !shipAddress1) {
    return res.status(400).json({ error: '배송지 주소를 입력해 주세요.' });
  }

  // --- 동의 (둘 다 필수) ---
  if (body.agreeTerms !== true) {
    return res.status(400).json({ error: '구매조건 확인 및 결제진행에 동의해 주세요.' });
  }
  if (body.agreeMinor !== true) {
    return res.status(400).json({ error: '만 19세 미만인 경우 법정대리인 동의 확인이 필요합니다.' });
  }

  // --- 금액 계산 (서버 권한) ---
  const amount = PRODUCT.unitPrice * quantity + shippingFee;
  const orderId = makeOrderId();
  const orderName = quantity > 1
    ? `${PRODUCT.name} 외 ${quantity - 1}권`
    : PRODUCT.name;

  try {
    const saved = await insertOrder({
      order_id: orderId,
      status: 'pending',
      product_code: PRODUCT.code,
      product_name: PRODUCT.name,
      quantity,
      unit_price: PRODUCT.unitPrice,
      shipping_fee: shippingFee,
      amount,
      currency: 'KRW',
      buyer_name: buyerName,
      buyer_email: buyerEmail,
      buyer_phone: buyerPhone,
      ship_country: shipCountry,
      ship_postcode: shipPostcode,
      ship_address1: shipAddress1,
      ship_address2: shipAddress2 || null,
      ship_memo: str(body.shipMemo, 200) || null,
      agree_terms: true,
      agree_minor: true,
      agreed_at: new Date().toISOString(),
      agree_ip: clientIp(req)
    });

    if (!saved.ok) {
      console.error('Order insert failed:', saved.error);
      return res.status(502).json({ error: '주문을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.' });
    }

    // 프런트가 토스 결제창을 띄우는 데 필요한 값만 내려줍니다
    return res.status(200).json({
      ok: true,
      orderId,
      orderName,
      amount,
      currency: 'KRW',
      clientKey,
      customerName: buyerName,
      customerEmail: buyerEmail,
      breakdown: {
        unitPrice: PRODUCT.unitPrice,
        quantity,
        shippingFee
      }
    });

  } catch (err) {
    console.error('order error:', err);
    return res.status(500).json({ error: 'Unexpected error' });
  }
}

// ── 유틸 ─────────────────────────────────────────────────────

function str(v, max) {
  return String(v == null ? '' : v).trim().slice(0, max);
}

// 토스 orderId 규격: 6~64자, 영문/숫자/-/_
function makeOrderId() {
  const t = Date.now().toString(36).toUpperCase();
  const r = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `KSW-${t}-${r}`;
}

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  const raw = Array.isArray(fwd) ? fwd[0] : (fwd || '');
  return String(raw).split(',')[0].trim().slice(0, 45) || null;
}

async function insertOrder(row) {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/orders`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(row)
  });
  if (resp.ok) {
    const rows = await resp.json().catch(() => null);
    return { ok: true, id: Array.isArray(rows) && rows[0] ? rows[0].id : null };
  }
  return { ok: false, error: `${resp.status} ${await resp.text()}` };
}
