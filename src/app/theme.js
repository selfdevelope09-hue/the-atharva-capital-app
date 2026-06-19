/** Shared UI palette (Binance-ish dark + aurum accent). */
export const T = {
  bg: '#0b0e11',
  yellow: '#f0b90b',
  white: '#ffffff',
  text: 'rgba(255,255,255,0.65)',
  textMuted: 'rgba(255,255,255,0.5)',
  border: 'rgba(255,255,255,0.1)',
  card: '#1e2329',
  card2: '#2b3139',
  red: '#f6465d',
  green: '#0ecb81',
  purple: '#a855f7'
};

const publicUrl = typeof process !== 'undefined' ? process.env.PUBLIC_URL || '' : '';

/** JPEG asset (correct extension — file was mislabeled .png and broke some CDNs). */
export const BRAND_LOGO = `${publicUrl}/auron-logo.jpg`;
export const BRAND_NAME = 'AuronX Trade';
export const BRAND_ALT = 'AuronX Trade';
export const BRAND_TAGLINE = 'Trade | Learn | Safe';
