import React, { useState, useEffect, useContext } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { auth } from '../firebaseClient';
import { AuthContext } from '../authContext';
import { T } from '../app/theme';
import { Card, Input, Btn, PasswordInput } from '../components/ui/AppPrimitives';
import { AuthBrandHeader } from '../components/brand/TaglineBrand';
import { GoogleSignInWebEnvironmentNotice } from '../components/GoogleSignInWebEnvironmentNotice';

export const LoginScreen = () => {
  const { login, signInWithGoogle, signInWithAppLogin, user, loading: authLoading } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from || '/dashboard';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showEmailLogin, setShowEmailLogin] = useState(false);
  const [showAppLogin, setShowAppLogin] = useState(false);
  const [appLoginId, setAppLoginId] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [appLoginLoading, setAppLoginLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && user) navigate(redirectTo, { replace: true });
  }, [authLoading, user, navigate, redirectTo]);

  const handleGoogle = async () => {
    setGoogleLoading(true);
    setError('');
    try {
      await signInWithGoogle();
      const u = auth.currentUser;
      if (u) navigate(redirectTo, { replace: true });
    } catch (e) {
      const code = e?.code || '';
      const msg = String(e?.message || '');
      const lc = msg.toLowerCase();
      setError(
        code === 'auth/popup-closed-by-user'
          ? 'Sign-in cancelled.'
          : code === 'auth/unauthorized-domain'
            ? 'Add this domain in Firebase Console → Authentication → Settings → Authorized domains (theatharvacapital.com).'
            : code === 'auth/embedded-browser-blocked'
              ? msg ||
                'Open this page in Chrome or Safari, or launch the installed Auron app from your app drawer (not from in-app link previews).'
              : code === 'auth/missing-google-id-token' ||
                  code === 'auth/invalid-credential' ||
                  code === 'auth/google-native-token-fetch' ||
                  code === 'auth/configuration-not-found'
                ? msg ||
                  'Google token/config error. For native builds, update Firebase Android SHA-1 values (upload keystore + Play App Signing), refresh `google-services.json`, then rebuild the app bundle.'
                : lc.includes('disallowed_useragent') ||
                    lc.includes('use secure browsers') ||
                    lc.includes("doesn't comply with google") ||
                    code === 'auth/web-storage-unsupported'
                  ? 'Google sign-in is blocked in embedded browsers (disallowed_useragent). Open this page in Chrome/Safari, or launch the installed app from your app drawer.'
                  : code === 'auth/popup-blocked' ||
                      code === 'auth/cancelled-popup-request' ||
                      code === 'auth/operation-not-supported-in-this-environment'
                    ? msg || 'The browser popup was blocked. Try redirect flow or use email sign-in.'
                    : msg || 'Google sign-in failed.'
      );
    }
    setGoogleLoading(false);
  };

  const handleAppLogin = async () => {
    if (!appLoginId.trim() || !appPassword) return setError('Enter AuronX ID and password.');
    setAppLoginLoading(true);
    setError('');
    try {
      await signInWithAppLogin(appLoginId.trim().toLowerCase(), appPassword);
      navigate(redirectTo, { replace: true });
    } catch (e) {
      setError(e?.message || 'Invalid AuronX ID or password.');
    }
    setAppLoginLoading(false);
  };

  const handleLogin = async () => {
    if (!email || !password) return setError('Enter email and password.');
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      navigate(redirectTo, { replace: true });
    } catch (e) {
      setError(
        e.code === 'auth/invalid-credential' || e.code === 'auth/wrong-password'
          ? 'Invalid email or password.'
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
        <div style={{ color: T.text, textAlign: 'center', marginBottom: 10, fontSize: 14 }}>
          Welcome back
        </div>
        <div style={{ color: T.text, textAlign: 'center', marginBottom: 22, fontSize: 12, lineHeight: 1.5 }}>
          Sign in with Google, AuronX ID (any phone), or email below.
        </div>
        <GoogleSignInWebEnvironmentNotice />
        <Btn
          type="button"
          onClick={handleGoogle}
          disabled={googleLoading || loading || appLoginLoading}
          style={{
            backgroundColor: '#fff',
            color: '#1f1f1f',
            marginBottom: 14,
            padding: '15px 20px',
            fontSize: 16
          }}
        >
          {googleLoading ? 'Opening Google…' : 'Continue with Google'}
        </Btn>
        <button
          type="button"
          onClick={() => {
            setShowAppLogin((v) => !v);
            setShowEmailLogin(false);
            setError('');
          }}
          style={{
            display: 'block',
            width: '100%',
            marginBottom: showAppLogin ? 14 : 6,
            padding: '10px 0',
            border: 'none',
            background: 'transparent',
            color: T.yellow,
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
            textDecoration: 'underline',
            textUnderlineOffset: 3
          }}
        >
          {showAppLogin ? 'Hide AuronX ID login' : 'Login with AuronX ID & password'}
        </button>
        {showAppLogin ? (
          <>
            <label style={{ color: T.text, fontSize: 12, display: 'block', marginBottom: 4 }}>AuronX ID</label>
            <Input
              placeholder="e.g. axtrader123"
              value={appLoginId}
              onChange={(e) => setAppLoginId(e.target.value)}
              autoCapitalize="off"
              autoCorrect="off"
              style={{ marginBottom: 14 }}
            />
            <label style={{ color: T.text, fontSize: 12, display: 'block', marginBottom: 4 }}>Password</label>
            <PasswordInput
              placeholder="••••••••"
              value={appPassword}
              onChange={(e) => setAppPassword(e.target.value)}
              style={{ marginBottom: 14 }}
              onKeyDown={(e) => e.key === 'Enter' && handleAppLogin()}
            />
            {error && <div style={{ color: T.red, fontSize: 13, marginBottom: 12 }}>{error}</div>}
            <Btn onClick={handleAppLogin} disabled={appLoginLoading || googleLoading || loading}>
              {appLoginLoading ? 'Logging in…' : 'Login with AuronX ID'}
            </Btn>
            <p style={{ color: T.text, fontSize: 11, marginTop: 10, lineHeight: 1.45 }}>
              ID & password are on your Profile after Google sign-in. Same account on every device.
            </p>
          </>
        ) : null}
        <button
          type="button"
          onClick={() => {
            setShowEmailLogin((v) => !v);
            setShowAppLogin(false);
            setError('');
          }}
          style={{
            display: 'block',
            width: '100%',
            marginTop: showAppLogin ? 14 : 0,
            marginBottom: showEmailLogin ? 14 : 6,
            padding: '10px 0',
            border: 'none',
            background: 'transparent',
            color: T.yellow,
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
            textDecoration: 'underline',
            textUnderlineOffset: 3
          }}
        >
          {showEmailLogin ? 'Hide email sign-in' : 'Use email & password instead'}
        </button>
        {showEmailLogin ? (
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
              email
              <div style={{ flex: 1, height: 1, backgroundColor: T.border }} />
            </div>
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
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ marginBottom: 18 }}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />
            {error && <div style={{ color: T.red, fontSize: 13, marginBottom: 12 }}>{error}</div>}
            <Btn onClick={handleLogin} disabled={loading}>
              {loading ? 'Logging in...' : 'Login'}
            </Btn>
          </>
        ) : (
          error && <div style={{ color: T.red, fontSize: 13, marginBottom: 12 }}>{error}</div>
        )}
        <div style={{ textAlign: 'center', marginTop: 18, color: T.text, fontSize: 13 }}>
          New here?{' '}
          <Link to="/signup" style={{ color: T.yellow, fontWeight: 600, textDecoration: 'none' }}>
            Create Account
          </Link>
        </div>
      </Card>
    </div>
  );
};
