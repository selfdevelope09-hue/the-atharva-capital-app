import React, { useState } from 'react';
import { T } from '../../app/theme';

export const Input = ({ style, ...props }) => (
  <input
    style={{
      backgroundColor: T.card2,
      border: `1px solid ${T.border}`,
      color: T.white,
      padding: '12px 14px',
      borderRadius: 6,
      width: '100%',
      fontSize: 14,
      outline: 'none',
      boxSizing: 'border-box',
      ...style
    }}
    {...props}
  />
);

function EyeIcon({ open }) {
  if (open) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M3 3l18 18M10.58 10.58A2 2 0 0012 14a2 2 0 001.42-.58M9.88 4.24A10.94 10.94 0 0112 5c5 0 9.27 3.11 11 7.5a11.8 11.8 0 01-4.12 4.88M6.1 6.1C3.67 7.56 2 9.33 1 12c1.73 4.39 6 7.5 11 7.5 1.61 0 3.15-.33 4.55-.92"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

/** Password field with show/hide eye toggle. */
export function PasswordInput({ style, inputStyle, ...props }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: 'relative', width: '100%', ...style }}>
      <Input
        {...props}
        type={show ? 'text' : 'password'}
        style={{ paddingRight: 46, ...inputStyle }}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? 'Hide password' : 'Show password'}
        title={show ? 'Hide password' : 'Show password'}
        style={{
          position: 'absolute',
          right: 8,
          top: '50%',
          transform: 'translateY(-50%)',
          border: 'none',
          background: 'transparent',
          color: T.text,
          cursor: 'pointer',
          padding: 6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 6
        }}
      >
        <EyeIcon open={show} />
      </button>
    </div>
  );
}

export const Btn = ({ children, style, color, ...props }) => (
  <button
    style={{
      backgroundColor: color || T.yellow,
      color: color ? T.white : '#000',
      border: 'none',
      padding: '13px 20px',
      borderRadius: 6,
      fontWeight: 'bold',
      fontSize: 15,
      cursor: 'pointer',
      width: '100%',
      opacity: props.disabled ? 0.6 : 1,
      ...style
    }}
    {...props}
  >
    {children}
  </button>
);

export const Card = ({ children, style }) => (
  <div style={{ backgroundColor: T.card, borderRadius: 12, padding: 20, ...style }}>{children}</div>
);
