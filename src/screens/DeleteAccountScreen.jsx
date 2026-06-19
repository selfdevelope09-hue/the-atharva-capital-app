                                        import React from 'react';
import { Link } from 'react-router-dom';
import { T, BRAND_LOGO, BRAND_ALT } from '../app/theme';

const sectionTitle = {
  color: T.white,
  fontSize: 17,
  fontWeight: 800,
  marginTop: 24,
  marginBottom: 10
};

const body = {
  color: T.text,
  fontSize: 15,
  lineHeight: 1.75,
  marginTop: 0,
  marginBottom: 0
};

const listStyle = {
  color: T.text,
  fontSize: 15,
  lineHeight: 1.75,
  marginTop: 0,
  marginBottom: 0,
  paddingLeft: 22
};

function DeleteAccountScreen() {
  return (
    <main style={{ padding: '32px 16px 48px', maxWidth: 720, margin: '0 auto' }}>
      <p style={{ marginBottom: 20 }}>
        <Link to="/" style={{ color: T.text, textDecoration: 'none', fontSize: 13 }}>
          ← Home
        </Link>
      </p>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <img
          src={BRAND_LOGO}
          alt={BRAND_ALT}
          width={280}
          height={160}
          decoding="async"
          style={{ maxWidth: 280, width: '100%', height: 'auto', display: 'inline-block' }}
        />
      </div>
      <h1
        style={{
          color: T.white,
          fontSize: 'clamp(22px, 4.5vw, 28px)',
          fontWeight: 900,
          lineHeight: 1.25,
          marginBottom: 18,
          textAlign: 'center'
        }}
      >
        Account Deletion – AuronX Trade
      </h1>
      <div style={{ ...body, marginBottom: 20 }}>
        If you wish to delete your account and associated data from AuronX Trade, follow the steps
        below:
      </div>
      <ol style={{ ...listStyle, marginBottom: 16 }}>
        <li style={{ marginBottom: 8 }}>
          Send an email request to:{' '}
          <a
            href="mailto:connect2535in@gmail.com?subject=Account%20Deletion%20Request"
            style={{ color: T.yellow, fontWeight: 600, textDecoration: 'none' }}
          >
            connect2535in@gmail.com
          </a>
        </li>
        <li style={{ marginBottom: 8 }}>Use the subject: &quot;Account Deletion Request&quot;</li>
        <li>Include your registered email ID or phone number</li>
      </ol>
      <p style={{ ...body, marginBottom: 20 }}>
        We will process your request within 3-5 working days.
      </p>

      <h2 style={sectionTitle}>Data Deletion</h2>
      <ul style={{ ...listStyle, listStyleType: 'disc' }}>
        <li style={{ marginBottom: 8 }}>Your account data will be permanently deleted</li>
        <li>Some data may be retained for legal or security purposes</li>
      </ul>

      <h2 style={sectionTitle}>Contact</h2>
      <p style={body}>
        For any queries, contact us at:{' '}
        <a
          href="mailto:connect2535in@gmail.com"
          style={{ color: T.yellow, fontWeight: 600, textDecoration: 'none' }}
        >
          connect2535in@gmail.com
        </a>
      </p>
    </main>
  );
}

export default DeleteAccountScreen;
