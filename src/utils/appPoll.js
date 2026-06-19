export function currentPathname() {
  if (typeof window === 'undefined') return '/';
  return window.location.pathname || '/';
}

export function isTradePath(path = currentPathname()) {
  return path === '/trade' || path.startsWith('/trade/');
}

export function isChatPath(path = currentPathname()) {
  return path === '/chat' || path.startsWith('/chat/');
}

export function userMePollMs() {
  if (typeof document !== 'undefined' && document.hidden) return 120000;
  return isTradePath() ? 24000 : 38000;
}

export function dmThreadsPollMs() {
  if (typeof document !== 'undefined' && document.hidden) return 60000;
  return isChatPath() ? 12000 : 35000;
}

export function communityUnreadPollMs() {
  if (typeof document !== 'undefined' && document.hidden) return 60000;
  return isChatPath() ? 8000 : 28000;
}
