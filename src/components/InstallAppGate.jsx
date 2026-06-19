import React, { useCallback, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { T } from '../app/theme';
import { INSTALL_DISMISS_KEY, PLAY_STORE_URL } from '../config/appInstall';

function isStandaloneDisplay() {
  try {
    if (window.matchMedia('(display-mode: standalone)').matches) return true;
    if (window.matchMedia('(display-mode: fullscreen)').matches) return true;
    if (window.navigator.standalone === true) return true;
  } catch {
    /* ignore */
  }
  return false;
}

function isInstalledFlag() {
  try {
    return localStorage.getItem(INSTALL_DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

function markInstalled() {
  try {
    localStorage.setItem(INSTALL_DISMISS_KEY, '1');
  } catch {
    /* ignore */
  }
}

function isMobileWeb() {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
}

function isIos() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent || '');
}

function isAndroid() {
  return /Android/i.test(navigator.userAgent || '');
}

/**
 * Full-screen install gate on web until PWA install or Play Store open + confirm.
 * Hidden on Capacitor native and when already running installed PWA.
 */
export default function InstallAppGate() {
  const [visible, setVisible] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [busy, setBusy] = useState(false);
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) return undefined;
    if (isStandaloneDisplay() || isInstalledFlag()) {
      setVisible(false);
      return undefined;
    }
    setVisible(true);

    const onBip = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    const onInstalled = () => {
      markInstalled();
      setVisible(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', onBip);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBip);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const runPwaInstall = useCallback(async () => {
    if (!deferredPrompt) return false;
    setBusy(true);
    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      if (outcome === 'accepted') {
        markInstalled();
        setVisible(false);
        return true;
      }
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
    return false;
  }, [deferredPrompt]);

  const openStore = useCallback(() => {
    window.open(PLAY_STORE_URL, '_blank', 'noopener,noreferrer');
    setAwaitingConfirm(true);
  }, []);

  const onPrimary = useCallback(async () => {
    if (deferredPrompt) {
      const ok = await runPwaInstall();
      if (ok) return;
    }
    if (isAndroid() || !isIos()) {
      openStore();
      return;
    }
    setAwaitingConfirm(true);
  }, [deferredPrompt, openStore, runPwaInstall]);

  const confirmInstalled = useCallback(() => {
    markInstalled();
    setVisible(false);
    setAwaitingConfirm(false);
  }, []);

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="install-app-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10050,
        background: 'rgba(0,0,0,0.92)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom))'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 400,
          borderRadius: 16,
          border: `1px solid ${T.border}`,
          background: T.card,
          padding: '22px 20px',
          textAlign: 'center'
        }}
      >
        <img
          src="/auron-logo.jpg"
          alt=""
          style={{ width: 72, height: 72, borderRadius: 16, objectFit: 'cover', marginBottom: 14 }}
        />
        <h2 id="install-app-title" style={{ color: T.white, margin: '0 0 8px', fontSize: 20 }}>
          AuronX Trade app install karo
        </h2>
        <p style={{ color: T.text, fontSize: 14, lineHeight: 1.55, margin: '0 0 18px' }}>
          Best experience ke liye app install karo — trading, leaderboard aur chat mobile app mein smooth chalega.
        </p>

        {!awaitingConfirm ? (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={onPrimary}
              style={{
                width: '100%',
                padding: '14px 16px',
                borderRadius: 10,
                border: 'none',
                background: T.yellow,
                color: '#000',
                fontWeight: 800,
                fontSize: 15,
                cursor: busy ? 'wait' : 'pointer',
                marginBottom: 10
              }}
            >
              {busy
                ? 'Installing…'
                : deferredPrompt
                  ? 'Install app'
                  : isAndroid()
                    ? 'Google Play se download'
                    : isIos()
                      ? 'Add to Home Screen'
                      : 'Download Android app'}
            </button>
            {isIos() && !deferredPrompt ? (
              <p style={{ color: T.text, fontSize: 12, lineHeight: 1.5, margin: '0 0 12px' }}>
                Safari → Share → <strong style={{ color: T.white }}>Add to Home Screen</strong>
              </p>
            ) : null}
            {deferredPrompt && (isAndroid() || isMobileWeb()) ? (
              <button
                type="button"
                onClick={openStore}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: 10,
                  border: `1px solid ${T.yellow}`,
                  background: 'transparent',
                  color: T.yellow,
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: 'pointer'
                }}
              >
                Google Play se download
              </button>
            ) : null}
          </>
        ) : (
          <>
            <p style={{ color: T.text, fontSize: 13, lineHeight: 1.55, margin: '0 0 16px' }}>
              Install / download complete ho gaya? Neeche dabao — tab web version khulegi.
            </p>
            <button
              type="button"
              onClick={confirmInstalled}
              style={{
                width: '100%',
                padding: '14px 16px',
                borderRadius: 10,
                border: 'none',
                background: T.green,
                color: '#fff',
                fontWeight: 800,
                fontSize: 15,
                cursor: 'pointer'
              }}
            >
              Haan, app install ho gayi
            </button>
          </>
        )}
      </div>
    </div>
  );
}
