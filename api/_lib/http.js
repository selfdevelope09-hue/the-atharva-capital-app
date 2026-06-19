/** Comma-separated origins for local dev / Capacitor when API is on another host (e.g. Vercel). */
function parseCorsOrigins() {
  const raw =
    process.env.BFF_CORS_ORIGINS ||
    'http://localhost:3000,http://127.0.0.1:3000,https://localhost,https://www.theatharvacapital.com,https://theatharvacapital.com';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Cross-origin BFF (localhost → prod API, or Capacitor https://localhost → API).
 * Same-origin browser requests often omit Origin; then we skip ACAO.
 */
function applyApiCors(req, res) {
  const origin = req.headers.origin;
  const allowed = parseCorsOrigins();
  if (origin && allowed.some((o) => o === origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Vary', 'Origin');
}

function handleCorsPreflight(req, res) {
  if (req.method !== 'OPTIONS') return false;
  res.statusCode = 204;
  res.end();
  return true;
}

function json(res, status, payload) {
  res.status(status).setHeader('content-type', 'application/json');
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  const b = req.body;
  if (b && typeof b === 'object' && !Buffer.isBuffer(b)) return b;
  if (typeof b === 'string' && b.trim()) {
    try {
      return JSON.parse(b);
    } catch {
      return Object.fromEntries(new URLSearchParams(b).entries());
    }
  }
  return {};
}

module.exports = { json, readBody, applyApiCors, handleCorsPreflight };
