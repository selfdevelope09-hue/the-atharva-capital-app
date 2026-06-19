import React from 'react';
import { Link } from 'react-router-dom';
import { T, BRAND_LOGO, BRAND_ALT } from '../app/theme';
function AboutFounderScreen() {
  return (
  <main style={{ padding: '32px 16px 48px', maxWidth: 720, margin: '0 auto' }}>
    <article itemScope itemType="https://schema.org/Article">
      <meta
        itemProp="headline"
        content="About AuronX — TRADE | LEARN | SAFE. Virtual trading simulator by Atharva Darshanwar"
      />
      <p style={{ marginBottom: 20 }}>
        <Link to="/" style={{ color: T.text, textDecoration: 'none', fontSize: 13 }}>
          ← Home
        </Link>
      </p>
      <div style={{ textAlign: 'center', marginBottom: 22 }}>
        <img
          src={BRAND_LOGO}
          alt={BRAND_ALT}
          width={280}
          height={160}
          decoding="async"
          style={{ maxWidth: 280, width: '100%', height: 'auto' }}
        />
      </div>
      <h1
        style={{
          color: T.white,
          fontSize: 'clamp(24px, 5vw, 32px)',
          fontWeight: 900,
          lineHeight: 1.2,
          marginBottom: 16
        }}
      >
        About <span style={{ color: T.yellow }}>AuronX</span>
      </h1>
      <div style={{ color: T.text, fontSize: 16, lineHeight: 1.75 }}>
        <p style={{ marginBottom: 16 }}>
          <strong style={{ color: T.white }}>AuronX</strong> is a next-generation virtual trading
          platform focused on helping individuals learn, practice, and grow with live market-data
          conditions without financial risk. Built to simplify trading for beginners and aspiring
          professionals, AuronX provides a simulated environment where users can develop strategies,
          gain experience, and improve consistency.
        </p>
        <p style={{ marginBottom: 16 }}>
          The platform is for education and practice only. It does not provide real-money trading.
          With plans to add advanced tools and AI-driven insights, AuronX focuses on improving
          trading skills in a safe simulated setup.
        </p>
        <h2
          style={{
            color: T.white,
            fontSize: 'clamp(18px, 4vw, 22px)',
            fontWeight: 800,
            marginTop: 28,
            marginBottom: 12
          }}
        >
          About the founder
        </h2>
        <p
          style={{
            color: T.yellow,
            fontWeight: 800,
            fontSize: 18,
            marginBottom: 8
          }}
          itemProp="author"
          itemScope
          itemType="https://schema.org/Person"
        >
          <span itemProp="name">Atharva Darshanwar</span>
        </p>
        <p style={{ color: T.text, fontSize: 14, marginBottom: 16 }}>
          <span itemProp="jobTitle">Founder</span>, AuronX · Nagpur, Maharashtra, India
        </p>
        <p style={{ marginBottom: 0 }}>
          AuronX is founded by <strong style={{ color: T.white }}>Atharva Darshanwar</strong>, a
          17-year-old entrepreneur from <strong style={{ color: T.white }}>Nagpur, Maharashtra</strong>
          , India, who is building a multi-startup ecosystem under{' '}
          <strong style={{ color: T.white }}>Connect</strong> with a vision to make trading skills
          accessible to everyone from an early stage.
        </p>
      </div>
    </article>
  </main>
  );
}

export default AboutFounderScreen;
