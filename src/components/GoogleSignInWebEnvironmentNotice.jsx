import React, { useMemo, useState } from 'react';
import { T } from '../app/theme';
import { embeddedBrowserBlockingGoogleOAuth } from '../utils/googleSignInEnvironment';

export function GoogleSignInWebEnvironmentNotice() {
  const block = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return embeddedBrowserBlockingGoogleOAuth();
  }, []);

  const [copied, setCopied] = useState(false);

  if (!block) return null;

  const copyLink = async () => {
    const href = window.location.href.split('#')[0];
    try {
      await navigator.clipboard?.writeText?.(href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = href;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        /* ignore */
      }
    }
  };

  return (
    <div
      role="status"
      style={{
        marginBottom: 16,
        padding: '12px 14px',
        borderRadius: 10,
        border: `1px solid ${T.border}`,
        backgroundColor: 'rgba(240, 185, 11, 0.08)',
        color: T.textMuted,
        fontSize: 12,
        lineHeight: 1.55,
        textAlign: 'left'
      }}
    >
      <strong style={{ color: T.yellow }}>Google sign-in is blocked here</strong>
      <p style={{ margin: '8px 0 10px', color: T.text }}>
        Google OAuth is not allowed inside {block.label} (policy:&nbsp;
        <code style={{ fontSize: 11, color: T.white }}>disallowed_useragent</code>). This is not a Firebase/SHA
        configuration issue.
      </p>
      <p style={{ margin: '0 0 10px', color: T.text }}>
        Use the menu (⋯) and tap <strong style={{ color: T.yellow }}>Open in Chrome / browser</strong>, or launch
        the Play Store-installed Auron app from your <strong style={{ color: T.yellow }}>app drawer</strong>.
      </p>
      <button
        type="button"
        onClick={copyLink}
        style={{
          width: '100%',
          padding: '10px 12px',
          borderRadius: 8,
          border: `1px solid ${T.border}`,
          background: T.card2,
          color: T.yellow,
          fontWeight: 600,
          fontSize: 13,
          cursor: 'pointer'
        }}
      >
        {copied ? 'Copied' : 'Copy site link'}
      </button>
    </div>
  );
}
