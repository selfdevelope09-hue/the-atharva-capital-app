import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { purgeAllAdstera, normalizeAdsteraPath } from '../utils/adsteraManager';

/**
 * One isolated iframe per page — exact Adstera code lives only inside public/ads/*.html.
 * Renders nothing unless the current route matches `forPaths`.
 */
export default function AdsteraPageFrame({ iframeSrc, forPaths, style, className = 'adstera-page-frame' }) {
  const { pathname } = useLocation();
  const path = normalizeAdsteraPath(pathname);
  const allowed = Array.isArray(forPaths) ? forPaths.map(normalizeAdsteraPath) : [];
  const active = allowed.includes(path);

  useEffect(() => {
    if (active) purgeAllAdstera();
  }, [active, path]);

  if (!active || !iframeSrc) return null;

  return (
    <div
      className={className}
      data-adstera-frame={iframeSrc}
      style={{
        width: '100%',
        overflow: 'hidden',
        display: 'flex',
        justifyContent: 'center',
        marginBottom: 12,
        ...style
      }}
    >
      <iframe
        key={iframeSrc}
        src={iframeSrc}
        title="Advertisement"
        scrolling="no"
        loading="lazy"
        style={{
          width: '100%',
          maxWidth: 728,
          height: 280,
          border: 'none',
          display: 'block',
          background: 'transparent'
        }}
      />
    </div>
  );
}
