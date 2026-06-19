export const TIP_CATEGORIES = [
  { id: '1day', label: 'Today / Short-Term (1 Day)', hint: 'Stocks expected to move today', shortLabel: 'Short-term (1 Day)' },
  { id: '10days', label: 'Swing (~10 days hold)', hint: 'Hold for around 10 days', shortLabel: 'Swing (~10 days)' },
  { id: '1month', label: 'Positional (1 month+)', hint: 'Hold for more than a month', shortLabel: 'Positional (1 month+)' }
];

export function categoryShort(id) {
  return TIP_CATEGORIES.find((c) => c.id === id)?.shortLabel || id;
}

/** WhatsApp (E.164, no +) — queries / tips */
export const WA_TIP_NUMBER = '917972343530';

export function buildWhatsAppTipUrl({ stock_name, category, entry_price, target_price, user_message }) {
  const tf = categoryShort(category);
  const msg = `Hello, I have a query about this stock:

Stock: ${stock_name}
Timeframe: ${tf}
Entry: ${entry_price}
Target: ${target_price}

My Question:
${user_message || ''}`;
  return `https://wa.me/${WA_TIP_NUMBER}?text=${encodeURIComponent(msg)}`;
}

export function buildAdminPrompt({ stock_name, category, entry_price, target_price, stop_loss, user_message }) {
  return `User Query on Stock Tip:

Stock: ${stock_name}
Category: ${categoryShort(category)}
Entry: ${entry_price}
Target: ${target_price}
SL: ${stop_loss}

User Question:
${user_message || ''}`;
}
