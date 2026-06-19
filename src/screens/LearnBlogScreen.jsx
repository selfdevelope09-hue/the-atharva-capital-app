import React from 'react';
import { Link } from 'react-router-dom';
import { T } from '../app/theme';
import { getLearnBlogBySlug } from '../content/learnBlogs';
const CATS = {
  basics: 'Basics',
  trading: 'Trading',
  technical: 'Technical',
  risk: 'Risk'
};

function BlogBlock({ block }) {
  if (block.type === 'h2') {
    return (
      <h2 style={{ color: T.white, fontSize: 18, fontWeight: 800, margin: '22px 0 10px', lineHeight: 1.35 }}>
        {block.text}
      </h2>
    );
  }
  if (block.type === 'h3') {
    return (
      <h3 style={{ color: T.white, fontSize: 16, fontWeight: 700, margin: '16px 0 8px' }}>{block.text}</h3>
    );
  }
  if (block.type === 'ul') {
    return (
      <ul style={{ color: T.text, fontSize: 15, lineHeight: 1.65, margin: '0 0 14px', paddingLeft: 22 }}>
        {(block.items || []).map((item, i) => (
          <li key={i} style={{ marginBottom: 8 }}>
            {item}
          </li>
        ))}
      </ul>
    );
  }
  if (block.type === 'table') {
    return (
      <div style={{ overflowX: 'auto', margin: '0 0 18px', borderRadius: 10, border: `1px solid ${T.border}` }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'rgba(240,185,11,0.1)' }}>
              {(block.headers || []).map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: 'left',
                    padding: '10px 12px',
                    color: T.yellow,
                    fontWeight: 700,
                    borderBottom: `1px solid ${T.border}`
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(block.rows || []).map((row, ri) => (
              <tr key={ri} style={{ background: ri % 2 ? '#111' : '#0d0d0d' }}>
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    style={{
                      padding: '10px 12px',
                      color: T.text,
                      borderBottom: `1px solid ${T.border}`,
                      verticalAlign: 'top',
                      lineHeight: 1.5
                    }}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return (
    <p style={{ color: T.text, fontSize: 15, lineHeight: 1.7, margin: '0 0 14px' }}>{block.text}</p>
  );
}

export default function LearnBlogScreen({ slug }) {
  const blog = getLearnBlogBySlug(slug);

  if (!blog) {
    return (
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 14px', textAlign: 'center' }}>
        <p style={{ color: T.text }}>Lesson not found.</p>
        <Link to="/learn" style={{ color: T.yellow, fontWeight: 700 }}>
          ← Back to Learn
        </Link>
      </div>
    );
  }

  const catLabel = CATS[blog.category] || 'Learn';

  return (
    <article style={{ width: '100%', maxWidth: 720, margin: '0 auto', padding: '16px 14px 40px' }}>
      <Link
        to="/learn"
        style={{ color: T.text, textDecoration: 'none', fontSize: 13, display: 'inline-block', marginBottom: 14 }}
      >
        ← All lessons
      </Link>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: T.yellow,
            background: 'rgba(240,185,11,0.12)',
            border: `1px solid rgba(240,185,11,0.35)`,
            borderRadius: 6,
            padding: '4px 8px'
          }}
        >
          {catLabel}
        </span>
        <span style={{ fontSize: 12, color: T.text }}>
          {blog.level} · {blog.duration_minutes} min read
        </span>
      </div>

      <h1 style={{ margin: '0 0 12px', color: T.white, fontSize: 'clamp(22px, 4.5vw, 28px)', fontWeight: 900, lineHeight: 1.25 }}>
        {blog.title}
      </h1>

      {blog.summary ? (
        <p style={{ color: T.text, fontSize: 15, lineHeight: 1.6, margin: '0 0 20px', fontStyle: 'italic' }}>
          {blog.summary}
        </p>
      ) : null}

      <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 8 }}>
        {blog.sections.map((block, i) => (
          <BlogBlock key={`${blog.slug}-sec-${i}`} block={block} />
        ))}
      </div>

      <div
        style={{
          marginTop: 28,
          padding: 16,
          borderRadius: 12,
          border: `1px solid rgba(240,185,11,0.35)`,
          background: 'rgba(240,185,11,0.06)'
        }}
      >
        <div style={{ color: T.white, fontWeight: 800, marginBottom: 8 }}>Ready to practice?</div>
        <p style={{ color: T.text, fontSize: 14, lineHeight: 1.55, margin: '0 0 12px' }}>
          Apply what you learned on AuronX with virtual balance — no real money at risk.
        </p>
        <Link
          to="/trade"
          style={{
            display: 'inline-block',
            textDecoration: 'none',
            background: T.yellow,
            color: '#000',
            fontWeight: 800,
            fontSize: 14,
            padding: '10px 18px',
            borderRadius: 8
          }}
        >
          Open Trade
        </Link>
      </div>
    </article>
  );
}
