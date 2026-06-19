import React, { useEffect, useState } from 'react';
import { T } from '../app/theme';
import { Card, Input, Btn, PasswordInput } from './ui/AppPrimitives';
import { bff } from '../api/serverBff';

export function AppLoginCredentials({ userData, onUpdated }) {
  const loginId = userData?.appLoginId || '';
  const shownPassword = userData?.appLoginPassword || '';
  const mustChange = userData?.appPasswordMustChange !== false;

  const [currentPw, setCurrentPw] = useState('');
  const [newLoginId, setNewLoginId] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    setNewLoginId('');
    setErr('');
    setMsg('');
  }, [loginId]);

  const refresh = () => onUpdated?.();

  const handleChangeLoginId = async () => {
    setErr('');
    setMsg('');
    const nextId = newLoginId.trim().toLowerCase();
    if (!currentPw) return setErr('Enter your current password to change ID.');
    if (!nextId) return setErr('Enter a new AuronX ID.');
    if (nextId.length < 4) return setErr('AuronX ID must be at least 4 characters.');
    setBusy('id');
    try {
      await bff('/api/data/change-app-login', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: currentPw, newLoginId: nextId })
      });
      setNewLoginId('');
      setMsg('AuronX ID updated.');
      refresh();
    } catch (e) {
      setErr(e?.message || 'Could not change AuronX ID.');
    }
    setBusy('');
  };

  const handleChangePassword = async () => {
    setErr('');
    setMsg('');
    if (!currentPw || !newPw) return setErr('Enter current and new password.');
    if (newPw.length < 6) return setErr('New password must be at least 6 characters.');
    if (newPw !== confirmPw) return setErr('New passwords do not match.');
    setBusy('pw');
    try {
      await bff('/api/data/change-app-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw })
      });
      setNewPw('');
      setConfirmPw('');
      setMsg('Password updated. Use it on other phones too.');
      refresh();
    } catch (e) {
      setErr(e?.message || 'Could not change password.');
    }
    setBusy('');
  };

  return (
    <Card style={{ marginTop: 16, padding: 16 }}>
      <h3 style={{ color: T.white, margin: '0 0 8px', fontSize: 16, fontWeight: 800 }}>AuronX ID login</h3>
      <p style={{ color: T.text, fontSize: 12, lineHeight: 1.5, margin: '0 0 12px' }}>
        Kisi bhi phone par <strong style={{ color: T.white }}>Login → AuronX ID</strong> se same account khulega. Google
        alag hai — ye ID/password alag hai.
      </p>
      <div style={{ display: 'grid', gap: 10, marginBottom: 14 }}>
        <div>
          <div style={{ color: T.text, fontSize: 11, marginBottom: 4 }}>Your AuronX ID</div>
          <div
            style={{
              color: loginId ? T.yellow : T.text,
              fontWeight: 800,
              fontSize: 18,
              letterSpacing: '0.04em',
              fontFamily: 'ui-monospace, monospace'
            }}
          >
            {loginId || 'Loading…'}
          </div>
        </div>
        <div>
          <div style={{ color: T.text, fontSize: 11, marginBottom: 4 }}>Password</div>
          <div
            style={{
              color: shownPassword ? T.white : T.text,
              fontWeight: 700,
              fontSize: 16,
              fontFamily: 'ui-monospace, monospace'
            }}
          >
            {shownPassword || (loginId ? '•••••••• (set — change below to see new one)' : '—')}
          </div>
          {mustChange && shownPassword ? (
            <div style={{ color: T.yellow, fontSize: 11, marginTop: 6 }}>
              Apna ID ya password neeche change kar lo before sharing.
            </div>
          ) : null}
        </div>
      </div>

      <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 12, marginBottom: 14 }}>
        <div style={{ color: T.white, fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Change AuronX ID</div>
        <Input
          placeholder="New AuronX ID (letters, numbers, _)"
          value={newLoginId}
          onChange={(e) => setNewLoginId(e.target.value.toLowerCase())}
          autoCapitalize="off"
          autoCorrect="off"
          style={{ marginBottom: 8 }}
        />
        <PasswordInput
          placeholder="Current password (required)"
          value={currentPw}
          onChange={(e) => setCurrentPw(e.target.value)}
          style={{ marginBottom: 10 }}
        />
        <Btn type="button" onClick={handleChangeLoginId} disabled={!!busy} style={{ marginBottom: 4 }}>
          {busy === 'id' ? 'Saving…' : 'Update AuronX ID'}
        </Btn>
      </div>

      <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
        <div style={{ color: T.white, fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Change password</div>
        <PasswordInput
          placeholder="New password (min 6)"
          value={newPw}
          onChange={(e) => setNewPw(e.target.value)}
          style={{ marginBottom: 8 }}
        />
        <PasswordInput
          placeholder="Confirm new password"
          value={confirmPw}
          onChange={(e) => setConfirmPw(e.target.value)}
          style={{ marginBottom: 10 }}
        />
        {err ? <div style={{ color: T.red, fontSize: 12, marginBottom: 8 }}>{err}</div> : null}
        {msg ? <div style={{ color: '#6ee7b7', fontSize: 12, marginBottom: 8 }}>{msg}</div> : null}
        <Btn type="button" onClick={handleChangePassword} disabled={!!busy}>
          {busy === 'pw' ? 'Saving…' : 'Update password'}
        </Btn>
      </div>
    </Card>
  );
}
