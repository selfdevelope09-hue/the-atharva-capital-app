export function ordinalPlace(rank) {
  const n = Number(rank);
  if (!Number.isFinite(n) || n < 1) return '';
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  const mod10 = n % 10;
  if (mod10 === 1) return `${n}st`;
  if (mod10 === 2) return `${n}nd`;
  if (mod10 === 3) return `${n}rd`;
  return `${n}th`;
}

export function winnerHeadline(winner) {
  if (!winner) return '';
  const place = winner.placeLabel || ordinalPlace(winner.rank);
  return `Congratulations — you placed ${place}`;
}

export function winnerPrizeLine(winner) {
  if (!winner) return '';
  const label = winner.prizeLabel || (winner.prizeInr != null ? `₹${Number(winner.prizeInr).toLocaleString('en-IN')}` : '');
  return label ? `You have won ${label} in the monthly leaderboard.` : '';
}

export function winnerSubline() {
  return 'Submit your payout details to claim your reward.';
}
