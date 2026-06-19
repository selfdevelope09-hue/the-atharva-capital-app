/** Preview line for community list / notifications. */
export function communityMessagePreview(msg) {
  if (!msg) return '';
  const text = String(msg.text || '').trim();
  if (text) return text.slice(0, 120);
  if (msg.imageUrl) return text ? text.slice(0, 80) : '📷 Photo';
  if (msg.fileUrl) {
    const fn = String(msg.fileName || '').trim();
    return text ? text.slice(0, 80) : fn ? `📎 ${fn.slice(0, 40)}` : '📎 File';
  }
  return 'New message';
}

export function isOnCommunityChatRoute() {
  if (typeof window === 'undefined') return false;
  if (window.location.pathname !== '/chat') return false;
  return new URLSearchParams(window.location.search).get('room') === 'community';
}

export function showCommunityBrowserNotification({ count, lastMessage }) {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;
  if (isOnCommunityChatRoute() && !document.hidden) return;

  const from = lastMessage?.fromName || 'Someone';
  const body =
    communityMessagePreview(lastMessage) ||
    (count === 1 ? 'New message in group chat' : `${count} new messages`);
  const title = count > 1 ? `AuronX Community (${count} new)` : `AuronX Community — ${from}`;

  try {
    const n = new Notification(title, {
      body,
      icon: '/auron-logo.jpg',
      tag: 'auron-community-chat',
      renotify: true
    });
    n.onclick = () => {
      window.focus();
      window.location.assign('/chat?room=community');
      n.close();
    };
  } catch {
    /* ignore */
  }
}

export function requestCommunityNotifyPermission() {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return;
  if (Notification.permission !== 'default') return;
  Notification.requestPermission().catch(() => {});
}
