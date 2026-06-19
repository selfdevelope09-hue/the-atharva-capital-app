function normalizeUnreadMap(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw)) {
    const n = Number(v);
    out[String(k)] = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  }
  return out;
}

module.exports = { normalizeUnreadMap };
