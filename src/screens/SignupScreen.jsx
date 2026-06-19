import React, { useState, useEffect, useContext } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { auth } from '../firebaseClient';
import { AuthContext } from '../authContext';
import { T } from '../app/theme';
import { Card, Input, Btn, PasswordInput } from '../components/ui/AppPrimitives';
import { AuthBrandHeader } from '../components/brand/TaglineBrand';
import { GoogleSignInWebEnvironmentNotice } from '../components/GoogleSignInWebEnvironmentNotice';

export const SignupScreen = () => {
  const { signUp, signInWithGoogle, user, loading: authLoading } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from || '/dashboard';
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [useEmailSignup, setUseEmailSignup] = useState(false);

  useEffect(() => {
    if (!authLoading && user) navigate(redirectTo, { replace: true });
  }, [authLoading, user, navigate, redirectTo]);

  const handleGoogle = async () => {
    setGoogleLoading(true);
    setError('');
    try {
      await signInWithGoogle();
      if (auth.currentUser) navigate(redirectTo, { replace: true });
    } catch (e) {
      const code = e?.code || '';
      const msg = String(e?.message || '');
      const lc = msg.toLowerCase();
      setError(
        code === 'auth/popup-closed-by-user'
          ? 'Sign-in cancelled.'
          : code === 'auth/unauthorized-domain'
            ? 'Add this domain in Firebase Console → Authentication → Authorized domains.'
            : code === 'auth/embedded-browser-blocked'
              ? msg ||
                'Use Chrome/Safari or the installed Auron app. Google sign-in is blocked in embedded browsers.'
              : code === 'auth/missing-google-id-token' ||
                  code === 'auth/invalid-credential' ||
                  code === 'auth/google-native-token-fetch' ||
                  code === 'auth/configuration-not-found'
                ? msg ||
                  'Update Firebase Android SHA-1 values (upload + Play signing), refresh `google-services.json`, then rebuild.'
                : lc.includes('disallowed_useragent') ||
                    lc.includes('use secure browsers') ||
                    lc.includes("doesn't comply with google") ||
                    code === 'auth/web-storage-unsupported'
                  ? 'Google sign-in is blocked in embedded browsers. Open in Chrome or launch the installed app from your app drawer.'
                  : code === 'auth/popup-blocked' ||
                      code === 'auth/cancelled-popup-request' ||
                      code === 'auth/operation-not-supported-in-this-environment'
                    ? msg || 'Popup/environment issue. Retry or use email signup.'
                    : msg || 'Google sign-in failed.'
      );
    }
    setGoogleLoading(false);
  };

  const handleSignup = async () => {
    if (!email || !password) return setError('Fill in all fields.');
    if (password.length < 6) return setError('Password must be at least 6 characters.');
    setLoading(true);
    setError('');
    try {
      await signUp(email, password, name);
      navigate(redirectTo, { replace: true });
    } catch (e) {
      setError(
        e.code === 'auth/email-already-in-use'
          ? 'This email is already registered.'
          : e.message
      );
    }
    setLoading(false);
  };

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '80vh',
        padding: 16
      }}
    >
      <Card style={{ width: '100%', maxWidth: 380 }}>
        <AuthBrandHeader />
        <div style={{ color: T.text, textAlign: 'center', marginBottom: 20, fontSize: 14 }}>
          Get $10,000 virtual USDT — create your account in one tap with Google.
        </div>
        <GoogleSignInWebEnvironmentNotice />
        <Btn
          type="button"
          onClick={handleGoogle}
          disabled={googleLoading || loading}
          style={{
            backgroundColor: '#fff',
            color: '#1f1f1f',
            marginBottom: 10
          }}
        >
          {googleLoading ? 'Opening Google…' : 'Continue with Google'}
        </Btn>
        <p style={{ color: T.text, fontSize: 12, textAlign: 'center', margin: '0 0 18px', lineHeight: 1.5 }}>
          No manual form required — sign up or log in instantly with Google.
        </p>
        {error ? <div style={{ color: T.red, fontSize: 13, marginBottom: 14 }}>{error}</div> : null}
        {!useEmailSignup ? (
          <button
            type="button"
            onClick={() => {
              setError('');
              setUseEmailSignup(true);
            }}
            style={{
              width: '100%',
              padding: 12,
              background: 'transparent',
              border: `1px solid ${T.border}`,
              borderRadius: 6,
              color: T.yellow,
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer'
            }}
          >
            Register with email &amp; password instead
          </button>
        ) : (
          <>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                marginBottom: 16,
                color: T.text,
                fontSize: 12
              }}
            >
              <div style={{ flex: 1, height: 1, backgroundColor: T.border }} />
              Manual registration
              <div style={{ flex: 1, height: 1, backgroundColor: T.border }} />
            </div>
            <label style={{ color: T.text, fontSize: 12, display: 'block', marginBottom: 4 }}>
              Your Name
            </label>
            <Input
              placeholder="Atharva"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ marginBottom: 14 }}
            />
            <label style={{ color: T.text, fontSize: 12, display: 'block', marginBottom: 4 }}>
              Email
            </label>
            <Input
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              style={{ marginBottom: 14 }}
            />
            <label style={{ color: T.text, fontSize: 12, display: 'block', marginBottom: 4 }}>
              Password
            </label>
            <PasswordInput
              placeholder="Min 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ marginBottom: 14 }}
              onKeyDown={(e) => e.key === 'Enter' && handleSignup()}
            />
            <Btn onClick={handleSignup} disabled={loading}>
              {loading ? 'Creating account...' : 'Create Account & Get $10,000'}
            </Btn>
            <button
              type="button"
              onClick={() => {
                setError('');
                setUseEmailSignup(false);
              }}
              style={{
                marginTop: 12,
                width: '100%',
                padding: 10,
                background: 'transparent',
                border: 'none',
                color: T.text,
                fontSize: 12,
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              ← Back to Google sign-up
            </button>
          </>
        )}
        <div style={{ textAlign: 'center', marginTop: 18, color: T.text, fontSize: 13 }}>
          Already registered?{' '}
          <Link to="/login" style={{ color: T.yellow, fontWeight: 600, textDecoration: 'none' }}>
            Login
          </Link>
        </div>
      </Card>
    </div>
  );
};
