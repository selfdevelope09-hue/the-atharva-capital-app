import React from 'react';
import { T, BRAND_LOGO, BRAND_ALT } from '../../app/theme';

export const TaglineLine = ({ style }) => (
  <p
    style={{
      textAlign: 'center',
      margin: 0,
      fontSize: 11,
      letterSpacing: '0.2em',
      fontWeight: 700,
      color: T.yellow,
      ...style
    }}
  >
    TRADE | LEARN | SAFE
  </p>
);

export const AuthBrandHeader = () => (
  <div style={{ marginBottom: 4 }}>
    <div style={{ textAlign: 'center', marginBottom: 10 }}>
      <img
        src={BRAND_LOGO}
        alt={BRAND_ALT}
        width={220}
        height={88}
        decoding="async"
        style={{ maxWidth: 220, width: '100%', height: 'auto', display: 'inline-block' }}
      />
    </div>
  </div>
);
