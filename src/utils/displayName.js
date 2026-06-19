/** Display names: letters and spaces only (no emoji, numbers, or symbols). */

const LETTER_SPACE_RE = /^[\p{L}\s]+$/u;
const NON_LETTER_SPACE_RE = /[^\p{L}\s]/gu;

export function sanitizeDisplayNameInput(value) {
  return String(value || '')
    .replace(NON_LETTER_SPACE_RE, '')
    .replace(/\s{2,}/g, ' ')
    .slice(0, 80);
}

export function isValidDisplayName(name) {
  const trimmed = String(name || '').trim();
  if (!trimmed || trimmed.length < 2) return false;
  return LETTER_SPACE_RE.test(trimmed);
}

export function displayNameValidationMessage(name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) return 'Display name is required.';
  if (trimmed.length < 2) return 'Name must be at least 2 characters.';
  if (!LETTER_SPACE_RE.test(trimmed)) {
    return 'Use letters and spaces only — no emoji, numbers, or symbols.';
  }
  return null;
}
