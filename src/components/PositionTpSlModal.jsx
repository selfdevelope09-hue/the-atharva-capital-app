import React, { useEffect, useState } from 'react';
import { doc, runTransaction } from 'firebase/firestore';
import { T } from '../app/theme';
import { Btn, Input } from './ui/AppPrimitives';
import { bffTrade } from '../api/serverBff';
import { isBffTradeMode, isFirestoreDisabled } from '../config/dataBackend';
import { isRealtimeTradeMode } from '../config/tradeBackend';
import { db } from '../firebaseClient';
import { socketUpdatePositionTpSl } from '../api/realtimeTrade';
import { coerceJsonArray } from '../utils/userDoc';
import { findFirestorePositionIndex } from '../utils/positionUtils';
import { validateTpSlForPosition, normalizeTpSl } from '../utils/tpSl';
import { withTradeAsBody } from '../utils/chatAsUid';

export default function PositionTpSlModal({
  open,
  position,
  uiIndex,
  walletUid,
  actingAsUid,
  isActingAsShowcase,
  onClose,
  onSaved
}) {
  const [tp, setTp] = useState('');
  const [sl, setSl] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!open || !position) return;
    const t = normalizeTpSl(position.tp);
    const s = normalizeTpSl(position.sl);
    setTp(t != null ? String(t) : '');
    setSl(s != null ? String(s) : '');
    setErr('');
  }, [open, position]);

  if (!open || !position) return null;

  const save = async () => {
    const validation = validateTpSlForPosition({
      type: position.type,
      entryPrice: position.entryPrice,
      tp: tp.trim() ? tp : null,
      sl: sl.trim() ? sl : null
    });
    if (validation) {
      setErr(validation);
      return;
    }
    const tpVal = tp.trim() ? normalizeTpSl(tp) : null;
    const slVal = sl.trim() ? normalizeTpSl(sl) : null;
    setBusy(true);
    setErr('');
    const body = withTradeAsBody(
      {
        enriched: position,
        uiIndex,
        tp: tpVal,
        sl: slVal
      },
      actingAsUid,
      isActingAsShowcase
    );
    try {
      if (isRealtimeTradeMode()) {
        await socketUpdatePositionTpSl(body);
      } else if (isBffTradeMode()) {
        await bffTrade('/api/trade/update-position', { method: 'POST', body: JSON.stringify(body) });
      } else if (isFirestoreDisabled()) {
        throw new Error('Trading backend unavailable.');
      } else {
        const userRef = doc(db, 'users', walletUid);
        await runTransaction(db, async (tx) => {
          const snap = await tx.get(userRef);
          if (!snap.exists()) throw new Error('User not found');
          const positions = coerceJsonArray(snap.data().positions);
          const idx = findFirestorePositionIndex(positions, position, uiIndex);
          if (idx < 0) throw new Error('Position not found');
          const next = positions.map((p, i) =>
            i === idx ? { ...p, tp: tpVal, sl: slVal } : p
          );
          tx.update(userRef, { positions: next });
        });
      }
      onSaved?.();
      onClose();
    } catch (e) {
      setErr(e?.message || 'Could not save TP/SL');
    } finally {
      setBusy(false);
    }
  };

  const clearAll = async () => {
    setTp('');
    setSl('');
    setBusy(true);
    setErr('');
    const body = withTradeAsBody({ enriched: position, uiIndex, tp: null, sl: null }, actingAsUid, isActingAsShowcase);
    try {
      if (isRealtimeTradeMode()) {
        await socketUpdatePositionTpSl(body);
      } else if (isBffTradeMode()) {
        await bffTrade('/api/trade/update-position', { method: 'POST', body: JSON.stringify(body) });
      } else {
        const userRef = doc(db, 'users', walletUid);
        await runTransaction(db, async (tx) => {
          const snap = await tx.get(userRef);
          if (!snap.exists()) throw new Error('User not found');
          const positions = coerceJsonArray(snap.data().positions);
          const idx = findFirestorePositionIndex(positions, position, uiIndex);
          if (idx < 0) throw new Error('Position not found');
          const next = positions.map((p, i) => (i === idx ? { ...p, tp: null, sl: null } : p));
          tx.update(userRef, { positions: next });
        });
      }
      onSaved?.();
      onClose();
    } catch (e) {
      setErr(e?.message || 'Could not clear TP/SL');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Edit take profit and stop loss"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 11000,
        background: 'rgba(0,0,0,0.72)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 400,
          background: T.card,
          border: `1px solid ${T.border}`,
          borderRadius: 14,
          padding: 18
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ color: T.white, margin: '0 0 4px', fontSize: 17 }}>TP / SL</h3>
        <p style={{ color: T.text, fontSize: 12, margin: '0 0 14px', lineHeight: 1.45 }}>
          {position.symbol} {position.type} · entry ${Number(position.entryPrice).toFixed(2)} — closes automatically
          when mark price hits your levels.
        </p>
        <label style={{ display: 'block', color: T.text, fontSize: 12, marginBottom: 6 }}>Take profit (USDT)</label>
        <Input
          type="number"
          step="any"
          min="0"
          placeholder="e.g. 70000"
          value={tp}
          onChange={(e) => setTp(e.target.value)}
          style={{ marginBottom: 12 }}
        />
        <label style={{ display: 'block', color: T.text, fontSize: 12, marginBottom: 6 }}>Stop loss (USDT)</label>
        <Input
          type="number"
          step="any"
          min="0"
          placeholder="e.g. 65000"
          value={sl}
          onChange={(e) => setSl(e.target.value)}
          style={{ marginBottom: 12 }}
        />
        {err ? (
          <p style={{ color: T.red, fontSize: 12, margin: '0 0 10px' }}>{err}</p>
        ) : null}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <Btn type="button" onClick={save} disabled={busy} style={{ flex: 1, minWidth: 100 }}>
            {busy ? 'Saving…' : 'Save'}
          </Btn>
          <button
            type="button"
            disabled={busy}
            onClick={clearAll}
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              border: `1px solid ${T.border}`,
              background: 'transparent',
              color: T.text,
              fontWeight: 600,
              cursor: busy ? 'wait' : 'pointer'
            }}
          >
            Clear
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              border: `1px solid ${T.border}`,
              background: T.card2,
              color: T.white,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
