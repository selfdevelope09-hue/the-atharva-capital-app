export const REMOVED_USER_LABEL = 'Removed user';

export function isAccountRemoved(row) {
  return row?.accountRemoved === true || row?.account_removed === true;
}

/** Live profile name — removed accounts always show REMOVED_USER_LABEL. */
export function displayTraderName(row, fallback = 'Trader') {
  if (isAccountRemoved(row)) return REMOVED_USER_LABEL;
  const n = row?.name ?? row?.fromName ?? row?.profileName;
  return (n && String(n).trim()) || fallback;
}
