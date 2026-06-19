import React, { memo, useEffect, useState } from 'react';
import { T } from '../app/theme';
import { profilePhotoReferrerPolicy, resolveProfilePhotoURL } from '../utils/profilePhotoUrl';
import { avatarLetterGradient, avatarLetterTextColor } from '../utils/avatarLetterColor';

const LeaderboardRowAvatar = memo(function LeaderboardRowAvatar({
  photoURL,
  name,
  seed,
  size = 28,
  className = ''
}) {
  const initial = (name || 'T').charAt(0).toUpperCase();
  const colorSeed = seed || name || 'T';
  const [broken, setBroken] = useState(false);
  const fontPx = Math.max(10, Math.round(size * 0.42));
  const src = resolveProfilePhotoURL(photoURL);

  useEffect(() => {
    setBroken(false);
  }, [src]);

  const shellStyle = {
    width: size,
    height: size,
    flexShrink: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 0
  };

  if (src && !broken) {
    return (
      <span className={className} style={shellStyle} aria-hidden>
        <img
          src={src}
          alt=""
          referrerPolicy={profilePhotoReferrerPolicy(src)}
          width={size}
          height={size}
          decoding="async"
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            objectFit: 'cover',
            display: 'block',
            border: `1px solid ${T.border}`
          }}
          onError={() => setBroken(true)}
        />
      </span>
    );
  }

  return (
    <span className={className} style={shellStyle} aria-hidden>
      <span
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: avatarLetterGradient(colorSeed),
          color: avatarLetterTextColor(),
          fontSize: fontPx,
          fontWeight: 900,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {initial}
      </span>
    </span>
  );
});

export default LeaderboardRowAvatar;
