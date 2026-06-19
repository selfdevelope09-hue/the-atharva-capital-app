const crypto = require('crypto');
const { getFirestore } = require('../../_lib/firebaseAdmin');

const PREMIUM_DURATION_DAYS = 30;
const PREMIUM_PLAN_CODE = 'monthly-inr-100';
const PREMIUM_PRODUCT_CODE = 'tips_premium_monthly';
const RESET_PRODUCT_CODE = 'account_reset_50';
const RESET_START_BALANCE = 10000;

function json(res, status, payload) {
  res.status(status).setHeader('content-type', 'application/json');
  res.end(JSON.stringify(payload));
}

function safeDateMs(v, fallbackMs) {
  const ms = new Date(v || '').getTime();
  return Number.isFinite(ms) ? ms : fallbackMs;
}

function verifyHmac(rawBody, headerSignature, secret) {
  if (!secret) return true;
  if (!headerSignature) return false;
  const digest = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(String(headerSignature)));
  } catch (e) {
    return false;
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return json(res, 405, { ok: false, error: 'Method not allowed' });
  }

  const webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET || '';
  const signature = req.headers['x-webhook-signature'];
  const headerSecret = req.headers['x-webhook-secret'];
  const rawBody = JSON.stringify(req.body || {});

  if (webhookSecret) {
    const secretOk = headerSecret && String(headerSecret) === webhookSecret;
    const hmacOk = verifyHmac(rawBody, signature, webhookSecret);
    if (!secretOk && !hmacOk) {
      return json(res, 401, { ok: false, error: 'Invalid webhook signature' });
    }
  }

  const body = req.body || {};
  const status = String(body.status || '').toLowerCase();
  const userUid = String(body.user_uid || body.userUid || '').trim();
  const productCode = String(body.product_code || body.productCode || '').trim();
  const orderId = String(body.order_id || body.orderId || body.merchantOrderId || '').trim();
  const txId = String(body.transaction_id || body.transactionId || '').trim();
  const paymentId = orderId || txId;

  if (!paymentId) return json(res, 400, { ok: false, error: 'Missing order_id/transaction_id' });
  if (!userUid) return json(res, 400, { ok: false, error: 'Missing user_uid' });

  try {
    const db = getFirestore();
    const nowIso = new Date().toISOString();
    const paymentRef = db.collection('payments').doc(paymentId);
    const paymentPayload = {
      user_uid: userUid,
      status,
      product_code: productCode || PREMIUM_PRODUCT_CODE,
      amount_paise: Number(body.amount_paise || body.amountPaise || 0) || 0,
      gateway: 'phonepe',
      raw: body,
      updated_at: nowIso,
      created_at: body.created_at || body.createdAt || nowIso,
      paid_at: body.paid_at || body.paidAt || nowIso
    };

    await paymentRef.set(paymentPayload, { merge: true });

    if (status === 'success' && (productCode || PREMIUM_PRODUCT_CODE) === PREMIUM_PRODUCT_CODE) {
      const paidAtMs = safeDateMs(paymentPayload.paid_at, Date.now());
      const expiresAt = new Date(
        paidAtMs + PREMIUM_DURATION_DAYS * 24 * 60 * 60 * 1000
      ).toISOString();
      const userRef = db.collection('users').doc(userUid);
      await userRef.set(
        {
          tipsPremiumUntil: expiresAt,
          tipsPremiumPlan: PREMIUM_PLAN_CODE,
          tipsPremiumActivatedAt: nowIso,
          tipsLastProcessedPaymentId: paymentId
        },
        { merge: true }
      );
    }

    if (status === 'success' && (productCode || '') === RESET_PRODUCT_CODE) {
      const userRef = db.collection('users').doc(userUid);
      await userRef.set(
        {
          virtualBalance: RESET_START_BALANCE,
          positions: [],
          closedPositions: [],
          lifetimeRealizedPnl: 0,
          portfolio: [],
          resetAt: nowIso,
          lastProcessedResetPaymentId: paymentId
        },
        { merge: true }
      );
    }

    return json(res, 200, { ok: true });
  } catch (e) {
    return json(res, 500, { ok: false, error: e.message || 'Webhook processing failed' });
  }
};
