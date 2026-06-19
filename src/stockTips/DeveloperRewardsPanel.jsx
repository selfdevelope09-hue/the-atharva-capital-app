import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseClient';
import { AuthContext } from '../authContext';
import { Card } from '../components/ui/AppPrimitives';

const DEFAULT_BANNERS = [
  {
    title: 'Monthly top 10',
    subtitle: '₹2500 / ₹1100 / ₹500 / ₹100 / ₹100 / ₹50×5',
    imageUrl: ''
  },
  { title: '8 opens today', subtitle: '$1000 USDT when you hit 8 opens (IST)', imageUrl: '' },
  { title: 'Month-end settlement', subtitle: 'Positions auto-close; leaderboard locks', imageUrl: '' },
];

function normalizeBanners(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return DEFAULT_BANNERS;
  return raw.map((b, i) => ({
    title: String(b?.title || `Banner ${i + 1}`),
    subtitle: String(b?.subtitle || ''),
    imageUrl: String(b?.imageUrl || ''),
  }));
}

export default function DeveloperRewardsPanel() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [banners, setBanners] = useState(DEFAULT_BANNERS);
  const [error, setError] = useState('');

  const uid = user?.uid;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const snap = await getDoc(doc(db, 'config', 'rewardsContent'));
      if (snap.exists()) {
        const d = snap.data() || {};
        setBanners(normalizeBanners(d.banners));
      } else {
        setBanners(DEFAULT_BANNERS);
      }
    } catch (e) {
      setError(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!uid) {
        setAllowed(false);
        setLoading(false);
        return;
      }
      try {
        const ed = await getDoc(doc(db, 'config', 'stockTipEditors'));
        const list = Array.isArray(ed.data()?.uids) ? ed.data().uids : [];
        if (!cancelled) setAllowed(list.includes(uid));
      } catch {
        if (!cancelled) setAllowed(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid]);

  useEffect(() => {
    if (allowed) load();
  }, [allowed, load]);

  const canSave = allowed && !saving;

  const updateBanner = (idx, field, value) => {
    setBanners((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const addBanner = () => {
    setBanners((prev) => [...prev, { title: 'New banner', subtitle: '', imageUrl: '' }]);
  };

  const removeBanner = (idx) => {
    setBanners((prev) => prev.filter((_, i) => i !== idx));
  };

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setError('');
    try {
      await setDoc(
        doc(db, 'config', 'rewardsContent'),
        {
          banners: normalizeBanners(banners),
          updatedAt: serverTimestamp(),
          updatedBy: uid || null,
        },
        { merge: true }
      );
    } catch (e) {
      setError(e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const preview = useMemo(() => normalizeBanners(banners), [banners]);

  if (loading) {
    return (
      <div className="screen-pad" style={{ color: 'var(--muted)' }}>
        Loading…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="screen-pad">
        <p style={{ color: 'var(--muted)' }}>Sign in to access the developer panel.</p>
        <Link to="/login">Go to login</Link>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="screen-pad">
        <p style={{ color: 'var(--danger, #f87171)' }}>You do not have access to edit rewards content.</p>
        <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="screen-pad" style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.35rem' }}>Rewards CMS</h1>
          <p className="muted" style={{ margin: '6px 0 0', fontSize: 13 }}>
            Banners rotate on <Link to="/rewards">/rewards</Link>. Use image URLs (HTTPS). Firestore: <code>config/rewardsContent</code>.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Link to="/developer/platform" style={{ color: 'var(--yellow, #f0b90b)', fontWeight: 800, fontSize: 13, textDecoration: 'none' }}>
            Platform admin →
          </Link>
          <button type="button" className="btn btn-ghost" onClick={load} disabled={saving}>
            Reload
          </button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={!canSave}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {error ? (
        <div className="card" style={{ borderColor: 'var(--danger, #f87171)', marginBottom: 12, padding: 12 }}>
          {error}
        </div>
      ) : null}

      <Card title="Banner carousel" style={{ marginBottom: 16 }}>
        <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
          Each row is one slide. Empty image shows gradient only.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {banners.map((b, idx) => (
            <div
              key={idx}
              style={{
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: 12,
                background: 'var(--surface-2, rgba(255,255,255,0.03))',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <strong>Banner {idx + 1}</strong>
                <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => removeBanner(idx)}>
                  Remove
                </button>
              </div>
              <label className="muted" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                Title
              </label>
              <input
                className="input"
                value={b.title}
                onChange={(e) => updateBanner(idx, 'title', e.target.value)}
                style={{ width: '100%', marginBottom: 8 }}
              />
              <label className="muted" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                Subtitle
              </label>
              <input
                className="input"
                value={b.subtitle}
                onChange={(e) => updateBanner(idx, 'subtitle', e.target.value)}
                style={{ width: '100%', marginBottom: 8 }}
              />
              <label className="muted" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                Image URL
              </label>
              <input
                className="input"
                value={b.imageUrl}
                onChange={(e) => updateBanner(idx, 'imageUrl', e.target.value)}
                placeholder="https://..."
                style={{ width: '100%' }}
              />
            </div>
          ))}
        </div>
        <button type="button" className="btn btn-ghost" style={{ marginTop: 12 }} onClick={addBanner}>
          + Add banner
        </button>
      </Card>

      <Card title="Preview (first slide)">
        <div
          className="rewards-hero-banner"
          style={{
            minHeight: 120,
            backgroundImage: preview[0]?.imageUrl ? `url(${preview[0].imageUrl})` : undefined,
          }}
        >
          <div className="rewards-hero-overlay" />
          <div className="rewards-hero-text">
            <div className="rewards-hero-title">{preview[0]?.title}</div>
            <div className="rewards-hero-sub">{preview[0]?.subtitle}</div>
          </div>
        </div>
      </Card>
    </div>
  );
}
