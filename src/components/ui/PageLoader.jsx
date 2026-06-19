import React from 'react';
import { T } from '../../app/theme';

/** Visible loading shell (avoids blank black screen on protected routes). */
export default function PageLoader({ label = 'Loading…' }) {
  return (
    <div
      style={{
        flex: 1,
        minHeight: 'min(60vh, 480px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: 32,
        color: T.text,
        background: T.bg
      }}
    >
      <div
        className="auron-page-loader-spinner"
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          border: `3px solid ${T.border}`,
          borderTopColor: T.yellow
        }}
      />
      <span style={{ fontSize: 15 }}>{label}</span>
    </div>
  );
}
