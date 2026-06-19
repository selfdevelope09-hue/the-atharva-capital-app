import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { T, BRAND_LOGO, BRAND_ALT } from '../app/theme';

const POLICY_VERSION = '2026-05-30';

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
  marginBottom: 12
};

const listStyle = {
  color: T.text,
  fontSize: 15,
  lineHeight: 1.75,
  marginTop: 0,
  marginBottom: 12,
  paddingLeft: 22
};

function PrivacyPolicyScreen() {
  useEffect(() => {
    document.title = `Privacy Policy (${POLICY_VERSION}) – AuronX Trade`;
  }, []);

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
          marginBottom: 8,
          textAlign: 'center'
        }}
      >
        Privacy Policy for AuronX Trade
      </h1>
      <div
        style={{
          textAlign: 'center',
          marginBottom: 20,
          padding: '10px 14px',
          borderRadius: 10,
          border: `1px solid rgba(240,185,11,0.4)`,
          background: 'rgba(240,185,11,0.08)'
        }}
      >
        <p style={{ ...body, textAlign: 'center', marginBottom: 4, color: T.text }}>
          <strong style={{ color: T.white }}>Effective Date:</strong> May 30, 2026
        </p>
        <p style={{ ...body, textAlign: 'center', margin: 0, fontSize: 12, color: T.text }}>
          Policy version {POLICY_VERSION} — virtual trading &amp; educational use only
        </p>
      </div>

      <p style={body}>
        At AuronX Trade (accessible from{' '}
        <a
          href="https://www.theatharvacapital.com"
          style={{ color: T.yellow, textDecoration: 'none' }}
          target="_blank"
          rel="noopener noreferrer"
        >
          theatharvacapital.com
        </a>
        ), one of our main priorities is the privacy of our visitors. This Privacy Policy document
        contains types of information that is collected and recorded by AuronX Trade and how we use
        it.
      </p>
      <p style={body}>
        If you have additional questions or require more information about our Privacy Policy, do not
        hesitate to contact us.
      </p>

      <h2 style={sectionTitle}>1. Information We Collect</h2>
      <p style={body}>
        We collect information in the following ways to provide better services and a seamless
        virtual trading experience to all our users:
      </p>
      <ul style={listStyle}>
        <li style={{ marginBottom: 10 }}>
          <strong style={{ color: T.white }}>Log Files:</strong> AuronX Trade follows a standard
          procedure of using log files. These files log visitors when they visit websites. The
          information collected by log files includes internet protocol (IP) addresses, browser type,
          Internet Service Provider (ISP), date and time stamp, referring/exit pages, and possibly
          the number of clicks. These are not linked to any information that is personally
          identifiable.
        </li>
        <li>
          <strong style={{ color: T.white }}>User Input:</strong> Any basic information you
          voluntarily provide, such as account creation details or contact queries, is stored
          securely.
        </li>
      </ul>

      <h2 style={sectionTitle}>2. Cookies and Web Beacons</h2>
      <p style={body}>
        Like any other website, AuronX Trade uses &quot;cookies&quot;. These cookies are used to store
        information including visitors&apos; preferences, and the pages on the website that the visitor
        accessed or visited. The information is used to optimize the users&apos; experience by
        customizing our web page content based on visitors&apos; browser type and/or other information.
      </p>

      <h2 style={sectionTitle}>3. Google DoubleClick DART Cookie and AdSense</h2>
      <p style={body}>
        Google is one of the third-party vendors on our site. It also uses cookies, known as DART
        cookies, to serve ads to our site visitors based upon their visit to our site and other sites
        on the internet.
      </p>
      <p style={body}>
        Visitors may choose to decline the use of DART cookies by visiting the Google ad and content
        network Privacy Policy at the following URL –{' '}
        <a
          href="https://policies.google.com/technologies/ads"
          style={{ color: T.yellow, textDecoration: 'none' }}
          target="_blank"
          rel="noopener noreferrer"
        >
          https://policies.google.com/technologies/ads
        </a>
      </p>
      <p style={body}>
        Our advertising partners (like Google AdSense) may use cookies and web beacons on our site to
        track ad performance.
      </p>

      <h2 style={sectionTitle}>4. Third-Party Privacy Policies</h2>
      <p style={body}>
        AuronX Trade&apos;s Privacy Policy does not apply to other advertisers or websites. Thus, we are
        advising you to consult the respective Privacy Policies of these third-party ad servers for
        more detailed information. It may include their practices and instructions about how to
        opt-out of certain options.
      </p>
      <p style={body}>
        You can choose to disable cookies through your individual browser options. To know more
        detailed information about cookie management with specific web browsers, it can be found at
        the browsers&apos; respective websites.
      </p>

      <h2 style={sectionTitle}>5. Educational and Simulation Disclaimer</h2>
      <p style={body}>
        AuronX Trade is a virtual cryptocurrency trading platform designed strictly for educational
        and simulation purposes.
      </p>
      <ul style={listStyle}>
        <li style={{ marginBottom: 8 }}>We do not collect financial data, banking information, or credit/debit card details.</li>
        <li>
          We do not process real-world financial transactions or offer actual investment services. All
          trades executed on this platform use virtual, simulated currency.
        </li>
      </ul>

      <h2 style={sectionTitle}>6. Children&apos;s Information</h2>
      <p style={body}>
        Another part of our priority is adding protection for children while using the internet. We
        encourage parents and guardians to observe, participate in, and/or monitor and guide their
        online activity.
      </p>
      <p style={body}>
        AuronX Trade does not knowingly collect any Personal Identifiable Information from children
        under the age of 13. If you think that your child provided this kind of information on our
        website, we strongly encourage you to contact us immediately and we will do our best efforts
        to promptly remove such information from our records.
      </p>

      <h2 style={sectionTitle}>7. Consent</h2>
      <p style={body}>
        By using our website, you hereby consent to our Privacy Policy and agree to its Terms and
        Conditions.
      </p>

      <h2 style={sectionTitle}>8. Contact Us</h2>
      <p style={body}>
        If you have any questions or suggestions about our Privacy Policy, do not hesitate to contact
        us at:
      </p>
      <p style={body}>
        Email:{' '}
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

export default PrivacyPolicyScreen;
