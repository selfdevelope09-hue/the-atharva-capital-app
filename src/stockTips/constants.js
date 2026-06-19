export const TIP_CATEGORIES = [
  { id: '1day', label: 'Today / Short-Term (1 Day)', hint: 'Stocks expected to move today', cardTag: '1 Day' },
  { id: '10days', label: 'Swing (~10 days hold)', hint: 'Hold for around 10 trading sessions', cardTag: 'Swing' },
  { id: '1month', label: 'Positional (1 month+)', hint: 'Longer horizon ideas', cardTag: 'Positional' }
];

export const WA_STOCK_TIPS_NUMBER = '917972343530';

export function categoryMeta(id) {
  return TIP_CATEGORIES.find((c) => c.id === id) || TIP_CATEGORIES[0];
}

export const T = {
  bg: '#0b0e11',
  card: '#1e2329',
  card2: '#2b3139',
  yellow: '#f0b90b',
  green: '#02c076',
  red: '#f6465d',
  text: '#848e9c',
  white: '#ffffff',
  border: '#2b2f36',
  purple: '#a78bfa'
};
