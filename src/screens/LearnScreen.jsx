import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebaseClient';
import { isFirestoreDisabled } from '../config/dataBackend';
import { LEARN_BLOGS } from '../content/learnBlogs';
import { T } from '../app/theme';
const CATS = [
  { id: 'basics', label: 'Basics', icon: '📘' },
  { id: 'trading', label: 'Trading', icon: '📈' },
  { id: 'technical', label: 'Technical', icon: '📊' },
  { id: 'risk', label: 'Risk', icon: '🛡️' }
];

function categoryLabel(id) {
  return CATS.find((x) => x.id === id)?.label || 'Learn';
}

export default function LearnScreen() {
  const [search, setSearch] = useState('');
  const [activeCat, setActiveCat] = useState('all');
  const [pdfRows, setPdfRows] = useState([]);

  useEffect(() => {
    if (isFirestoreDisabled()) {
      setPdfRows([]);
      return undefined;
    }
    const qy = query(collection(db, 'learnStrategies'), orderBy('created_at', 'desc'), limit(100));
    return onSnapshot(
      qy,
      (snap) => setPdfRows(snap.docs.map((d) => ({ id: d.id, ...d.data(), kind: 'pdf' }))),
      () => setPdfRows([])
    );
  }, []);

  const allItems = useMemo(() => {
    const blogs = LEARN_BLOGS.map((b) => ({
      id: b.id,
      slug: b.slug,
      title: b.title,
      category: b.category,
      level: b.level,
      duration_minutes: b.duration_minutes,
      summary: b.summary,
      kind: 'blog'
    }));
    return [...blogs, ...pdfRows];
  }, [pdfRows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allItems.filter((x) => {
      const byCat = activeCat === 'all' || String(x.category || '').toLowerCase() === activeCat;
      if (!byCat) return false;
      if (!q) return true;
      const blob = `${x.title || ''} ${x.summary || ''} ${x.category || ''}`.toLowerCase();
      return blob.includes(q);
    });
  }, [allItems, search, activeCat]);

  return (
    <div style={{ width: '100%', maxWidth: 840, margin: '0 auto', padding: '16px 14px 34px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
        <h1 style={{ margin: 0, color: T.white, fontSize: 26, fontWeight: 900 }}>Learn</h1>
        <Link to="/" style={{ color: T.text, textDecoration: 'none', fontSize: 13 }}>
          ← Home
        </Link>
      </div>

      <p style={{ color: T.text, fontSize: 14, lineHeight: 1.55, margin: '0 0 14px' }}>
        Crypto trading guides for beginners — read at your pace, then practice on virtual markets.
      </p>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          borderRadius: 12,
          border: `1px solid ${T.border}`,
          background: '#141414',
          padding: '10px 12px',
          marginBottom: 12
        }}
      >
        <span style={{ color: T.text }}>🔎</span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search lessons, topics..."
          style={{
            border: 'none',
            outline: 'none',
            width: '100%',
            background: 'transparent',
            color: T.white,
            fontSize: 14
          }}
        />
      </div>

      <div style={{ marginBottom: 12, color: T.white, fontWeight: 700, fontSize: 13 }}>Categories</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8, marginBottom: 18 }}>
        <button
          type="button"
          onClick={() => setActiveCat('all')}
          style={{
            borderRadius: 10,
            border: `1px solid ${activeCat === 'all' ? T.yellow : T.border}`,
            background: activeCat === 'all' ? 'rgba(240,185,11,0.12)' : '#141414',
            color: activeCat === 'all' ? T.yellow : T.text,
            padding: '10px 6px',
            fontWeight: 700,
            fontSize: 12,
            cursor: 'pointer'
          }}
        >
          All
        </button>
        {CATS.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setActiveCat(c.id)}
            style={{
              borderRadius: 10,
              border: `1px solid ${activeCat === c.id ? T.yellow : T.border}`,
              background: activeCat === c.id ? 'rgba(240,185,11,0.12)' : '#141414',
              color: activeCat === c.id ? T.yellow : T.text,
              padding: '10px 6px',
              fontWeight: 700,
              fontSize: 12,
              cursor: 'pointer'
            }}
          >
            {c.icon} {c.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h2 style={{ margin: 0, color: T.white, fontSize: 17 }}>Trading blogs</h2>
        <span style={{ color: T.text, fontSize: 12 }}>{filtered.length} lessons</span>
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        {filtered.map((item) => {
          const mins = Number(item.duration_minutes || 0);
          const isBlog = item.kind === 'blog';
          return (
            <div
              key={item.id}
              style={{
                background: '#121212',
                border: `1px solid ${T.border}`,
                borderRadius: 12,
                padding: '14px 14px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 12
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ color: T.white, fontWeight: 700, fontSize: 15, lineHeight: 1.4 }}>{item.title}</div>
                {item.summary ? (
                  <div style={{ color: T.text, fontSize: 13, marginTop: 6, lineHeight: 1.45 }}>{item.summary}</div>
                ) : null}
                <div style={{ color: T.text, fontSize: 12, marginTop: 6 }}>
                  {categoryLabel(item.category)} · {item.level || 'Beginner'} ·{' '}
                  {mins > 0 ? `${mins} min read` : 'Self-paced'}
                </div>
              </div>
              {isBlog ? (
                <Link
                  to={`/learn/${item.slug}`}
                  style={{
                    textDecoration: 'none',
                    border: `1px solid rgba(240,185,11,0.4)`,
                    color: T.yellow,
                    borderRadius: 9,
                    padding: '8px 12px',
                    fontSize: 12,
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    flexShrink: 0
                  }}
                >
                  Read
                </Link>
              ) : item.pdf_url ? (
                <a
                  href={item.pdf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    textDecoration: 'none',
                    border: `1px solid rgba(240,185,11,0.4)`,
                    color: T.yellow,
                    borderRadius: 9,
                    padding: '8px 12px',
                    fontSize: 12,
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    flexShrink: 0
                  }}
                >
                  PDF
                </a>
              ) : (
                <span style={{ color: T.text, fontSize: 12, whiteSpace: 'nowrap' }}>Soon</span>
              )}
            </div>
          );
        })}
        {filtered.length === 0 ? (
          <p style={{ color: T.text, textAlign: 'center', padding: 24 }}>No lessons match your search.</p>
        ) : null}
      </div>
    </div>
  );
}
