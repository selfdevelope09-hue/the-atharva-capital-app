import { Capacitor } from '@capacitor/core';

/**
 * JS running inside shipped Capacitor iOS/Android shells (never treat as Snapchat/IG mini-browser).
 */
export function isCapacitorNativeShell() {
  if (typeof window === 'undefined') return false;

  try {
    const p = Capacitor.getPlatform();
    if (p === 'android' || p === 'ios') return true;
  } catch {
    /* ignore */
  }

  const proto = (window.location.protocol || '').toLowerCase();
  if (proto === 'capacitor:' || proto === 'ionic:') return true;

  const host = (window.location.hostname || '').toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1')
    return proto === 'https:' || proto === 'http:';

  return false;
}

/**
 * Google OAuth is intentionally blocked in many in-app browsers (Snapchat,
 * Instagram WebView, etc.) with 403 disallowed_useragent.
 *
 * We do NOT treat Capacitor's WebView as social IAB — its UA usually contains "; wv)";
 * that must not trigger prompts on the shipped Play/APK shell.
 *
 * @returns {null | { label: string }}
 */
export function embeddedBrowserBlockingGoogleOAuth() {
  if (typeof navigator === 'undefined') return null;
  if (isCapacitorNativeShell()) return null;

  const ua = navigator.userAgent || '';

  const patterns = [
    [/Instagram/i, "Instagram's browser"],
    [/\bSnapchat\b|\bSnapchat\s*\(/i, "Snapchat's browser"],
    [/FB_IAB|FBAN|FBAV|\bFB4A\b|MessengerLite/i, "Facebook / Messenger's browser"],
    [/ TikTok|TikTok|BytedanceWebview|Musical\.ly/i, "TikTok's browser"],
    [/\sLINE\//i, "LINE's browser"],
    [/LinkedInApp/i, "LinkedIn's browser"],
    [/\sThreads\b\/\d+/i, 'Threads'],
    [/Pinterest/i, "Pinterest's browser"],
    [/MicroMessenger/i, "WeChat's browser"],
    [/ Twitter/i, "Twitter/X's browser"]
  ];

  for (const [re, label] of patterns) {
    if (re.test(ua)) return { label };
  }

  // Android System WebViews (not Capacitor — already skipped above)
  if (/; wv\)/i.test(ua)) return { label: 'this in-app browser' };

  return null;
}
