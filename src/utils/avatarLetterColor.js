/** Deterministic avatar background from uid/name — Gmail-style varied colors. */

const PALETTE = [
  ['#e53935', '#b71c1c'],
  ['#43a047', '#1b5e20'],
  ['#1e88e5', '#0d47a1'],
  ['#8e24aa', '#4a148c'],
  ['#fb8c00', '#e65100'],
  ['#00acc1', '#006064'],
  ['#d81b60', '#880e4f'],
  ['#3949ab', '#1a237e'],
  ['#7cb342', '#33691e'],
  ['#f4511e', '#bf360c'],
  ['#5e35b1', '#311b92'],
  ['#00897b', '#004d40']
];

function hashSeed(seed) {
  const s = String(seed || 'trader');
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function avatarLetterGradient(seed) {
  const pair = PALETTE[hashSeed(seed) % PALETTE.length];
  return `linear-gradient(135deg, ${pair[0]}, ${pair[1]})`;
}

export function avatarLetterTextColor() {
  return '#ffffff';
}
