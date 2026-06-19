const LETTER_SPACE_RE = /^[\p{L}\s]+$/u;

function sanitizeDisplayName(name) {
  return String(name || '')
    .replace(/[^\p{L}\s]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 80);
}

function validateDisplayName(name) {
  const trimmed = sanitizeDisplayName(name);
  if (!trimmed || trimmed.length < 2) {
    return { ok: false, error: 'Display name must be at least 2 letters.' };
  }
  if (!LETTER_SPACE_RE.test(trimmed)) {
    return { ok: false, error: 'Use letters and spaces only — no emoji, numbers, or symbols.' };
  }
  return { ok: true, name: trimmed };
}

module.exports = { sanitizeDisplayName, validateDisplayName };
