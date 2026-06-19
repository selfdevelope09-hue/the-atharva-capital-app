import { communityMessagePreview } from './communityChatNotify';

function canNotify() {
  return typeof window !== 'undefined' && typeof Notification !== 'undefined';
}

export function requestBrowserNotificationPermission() {
  if (!canNotify()) return;
  if (Notification.permission !== 'default') return;
  Notification.requestPermission().catch(() => {});
}

function openPath(pathname) {
  if (typeof window === 'undefined') return;
  const path = String(pathname || '/');
  try {
    window.focus();
    window.location.assign(path);
  } catch {
    /* ignore */
  }
}

function isOnChatPage() {
  if (typeof window === 'undefined') return false;
  return window.location.pathname === '/chat';
}

export function showDmBrowserNotification({ unreadCount = 0, thread }) {
  if (!canNotify() || Notification.permission !== 'granted') return;
  if (isOnChatPage() && !document.hidden) return;
  if (!thread) return;

  const otherUid = (thread.participants || []).find((p) => p !== thread.viewerUid) || '';
  const name =
    thread?.names?.[otherUid] ||
    thread?.lastFromName ||
    'Trader';
  const preview = String(thread?.lastPreview || '').trim() || 'New message';
  const title = unreadCount > 1 ? `AuronX Chats (${unreadCount} unread)` : `New message from ${name}`;

  try {
    const n = new Notification(title, {
      body: preview.slice(0, 140),
      icon: '/auron-logo.jpg',
      tag: 'auron-dm-chat',
      renotify: true
    });
    n.onclick = () => {
      openPath(otherUid ? `/chat?with=${encodeURIComponent(otherUid)}` : '/chat');
      n.close();
    };
  } catch {
    /* ignore */
  }
}

export function showTradeCloseBrowserNotification(trade) {
  if (!canNotify() || Notification.permission !== 'granted') return;
  const pnl = Number(trade?.realizedPnl);
  if (!Number.isFinite(pnl)) return;
  if (typeof document !== 'undefined' && !document.hidden && window.location.pathname === '/dashboard') return;

  const symbol = String(trade?.symbol || 'Trade');
  const profit = pnl >= 0;
  const title = profit ? 'Trade closed in profit' : 'Trade closed';
  const body = `${symbol} ${profit ? '+' : ''}$${pnl.toFixed(2)}`;

  try {
    const n = new Notification(title, {
      body,
      icon: '/auron-logo.jpg',
      tag: `auron-trade-close-${symbol}`,
      renotify: true
    });
    n.onclick = () => {
      openPath('/dashboard');
      n.close();
    };
  } catch {
    /* ignore */
  }
}

export function showCommunityNotificationFromUnreadDelta({ deltaCount = 0, lastMessage }) {
  if (!canNotify() || Notification.permission !== 'granted') return;
  const from = lastMessage?.fromName || 'Someone';
  const body =
    communityMessagePreview(lastMessage) ||
    (deltaCount === 1 ? 'New message in group chat' : `${deltaCount} new messages`);
  const title = deltaCount > 1 ? `AuronX Community (${deltaCount} new)` : `AuronX Community - ${from}`;

  try {
    const n = new Notification(title, {
      body,
      icon: '/auron-logo.jpg',
      tag: 'auron-community-chat',
      renotify: true
    });
    n.onclick = () => {
      openPath('/chat?room=community');
      n.close();
    };
  } catch {
    /* ignore */
  }
}
