import React from 'react';
import { T } from '../app/theme';
import { Card } from '../components/ui/AppPrimitives';

export default function DisclaimerScreen() {
  return (
    <div style={{ padding: '20px 16px 40px', maxWidth: 820, margin: '0 auto' }}>
      <Card style={{ border: `1px solid ${T.border}` }}>
        <h1 style={{ color: T.white, marginTop: 0, marginBottom: 12 }}>Disclaimer</h1>
        <p style={{ color: T.text, lineHeight: 1.7 }}>
          AuronX is for virtual trading practice and educational use only.
        </p>
        <p style={{ color: T.text, lineHeight: 1.7 }}>
          No real-money trading, investment advisory, guaranteed returns, or financial promises are provided.
        </p>
        <p style={{ color: T.text, lineHeight: 1.7, marginBottom: 0 }}>
          All prices and results are for simulation and learning purposes.
        </p>
      </Card>
    </div>
  );
}
