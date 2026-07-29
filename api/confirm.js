// ============================================================
//  /api/confirm.js  —  토스페이먼츠 결제 승인
//
//  결제창에서 성공하면 토스가 successUrl로 리다이렉트하며
//  paymentKey / orderId / amount 를 넘겨줍니다.
//  **이 시점에는 아직 결제가 완료된 것이 아닙니다.**
//  서버가 승인 API를 호출해야 실제로 대금이 청구됩니다.
//
//  ⚠️ 승인 전에 반드시 확인하는 것
//     1) 주문이 우리 DB에 있는가
//     2) 저장된 금액과 넘어온 금액이 같은가  ← 금액 위변조 방지
//     3) 이미 처리된 주문이 아닌가          ← 중복 승인 방지
//
//  [필요한 환경변수]
//    PAYMENTS_ENABLED          : 'true'일 때만 동작
//    TOSS_SECRET_KEY           : 토스 시크릿 키 — **서버 전용, 절대 노출 금지**
//    SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
// ============================================================

const TOSS_API = 'https://api.tosspayments.com/v1/payments/confirm';
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (process.env.PAYMENTS_ENABLED !== 'true') {
    return res.status(503).json({ error: 'Payments not enabled', code: 'PAYMENTS_DISABLED' });
  }

  const secretKey = process.env.TOSS_SECRET_KEY;
  if (!secretKey || !SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing TOSS_SECRET_KEY or Supabase configuration');
    return res.status(500).json({ error: 'Server not configured' });
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  if (!body || typeof body !== 'object') body = {};

  const paymentKey = String(body.paymentKey || '').trim();
  const orderId = String(body.orderId || '').trim();
  const amount = Number.parseInt(body.amount, 10);

  if (!paymentKey || !orderId || !Number.isInteger(amount)) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  try {
    // --- 1) 주문 조회 ---
    const order = await findOrder(orderId);
    if (!order) {
      console.error('Unknown orderId on confirm:', orderId);
      return res.status(404).json({ error: '주문을 찾을 수 없습니다.' });
    }

    // --- 2) 이미 승인된 주문이면 그대로 성공 응답 (새로고침 대응) ---
    if (order.status === 'paid') {
      return res.status(200).json({ ok: true, alreadyConfirmed: true, order: publicOrder(order) });
    }
    if (order.status !== 'pending') {
      return res.status(409).json({ error: '처리할 수 없는 주문 상태입니다.', status: order.status });
    }

    // --- 3) 금액 대조 (위변조 방지) ---
    if (order.amount !== amount) {
      console.error('Amount mismatch:', { orderId, stored: order.amount, received: amount });
      await updateOrder(orderId, {
        status: 'failed',
        fail_code: 'AMOUNT_MISMATCH',
        fail_message: `stored=${order.amount} received=${amount}`
      }).catch(() => {});
      return res.status(400).json({ error: '결제 금액이 일치하지 않습니다.', code: 'AMOUNT_MISMATCH' });
    }

    // --- 4) 토스 승인 요청 ---
    const auth = Buffer.from(`${secretKey}:`).toString('base64');
    const tossRes = await fetch(TOSS_API, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': orderId
      },
      body: JSON.stringify({ paymentKey, orderId, amount })
    });

    const payload = await tossRes.json().catch(() => ({}));

    if (!tossRes.ok) {
      console.error('Toss confirm failed:', tossRes.status, payload);
      await updateOrder(orderId, {
        status: 'failed',
        fail_code: payload.code || String(tossRes.status),
        fail_message: (payload.message || '').slice(0, 500)
      }).catch(() => {});
      return res.status(400).json({
        error: payload.message || '결제 승인에 실패했습니다.',
        code: payload.code || null
      });
    }

    // --- 5) 승인 성공 → 주문 확정 ---
    await updateOrder(orderId, {
      status: 'paid',
      payment_key: paymentKey,
      payment_method: payload.method || null,
      approved_at: payload.approvedAt || new Date().toISOString()
    });

    return res.status(200).json({
      ok: true,
      order: publicOrder({ ...order, status: 'paid', payment_method: payload.method }),
      receiptUrl: (payload.receipt && payload.receipt.url) || null
    });

  } catch (err) {
    console.error('confirm error:', err);
    return res.status(500).json({ error: 'Unexpected error' });
  }
}

// ── Supabase ─────────────────────────────────────────────────

function headers(extra) {
  return Object.assign({
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json'
  }, extra || {});
}

async function findOrder(orderId) {
  const url = `${SUPABASE_URL}/rest/v1/orders?order_id=eq.${encodeURIComponent(orderId)}&limit=1`;
  const resp = await fetch(url, { headers: headers() });
  if (!resp.ok) throw new Error(`${resp.status} ${await resp.text()}`);
  const rows = await resp.json().catch(() => []);
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

async function updateOrder(orderId, patch) {
  const url = `${SUPABASE_URL}/rest/v1/orders?order_id=eq.${encodeURIComponent(orderId)}`;
  const resp = await fetch(url, {
    method: 'PATCH',
    headers: headers({ 'Prefer': 'return=minimal' }),
    body: JSON.stringify(patch)
  });
  if (!resp.ok) throw new Error(`${resp.status} ${await resp.text()}`);
}

// 주문 정보 중 화면에 보여줘도 되는 항목만 골라냅니다
function publicOrder(o) {
  return {
    orderId: o.order_id,
    status: o.status,
    productCode: o.product_code,   // 완료 페이지의 Purchase 이벤트가 content_ids 로 씁니다
    productName: o.product_name,
    quantity: o.quantity,
    unitPrice: o.unit_price,
    shippingFee: o.shipping_fee,
    amount: o.amount,
    buyerName: o.buyer_name,
    buyerEmail: o.buyer_email,
    paymentMethod: o.payment_method || null
  };
}
