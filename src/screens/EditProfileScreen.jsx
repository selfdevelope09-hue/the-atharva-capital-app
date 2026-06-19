import React, { useState, useEffect, useRef, useContext } from 'react';
import { Link } from 'react-router-dom';
import { doc, updateDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { AuthContext } from '../authContext';
import { auth, db } from '../firebaseClient';
import { isBffDataMode, isFirestoreDisabled } from '../config/dataBackend';
import { bff } from '../api/serverBff';
import { uploadProfilePhoto, formatProfilePhotoUploadError } from '../profilePhotoUpload';
import { resolveProfilePhotoFromUser } from '../utils/profilePhotoUrl';
import LeaderboardRowAvatar from '../components/LeaderboardRowAvatar';
import { T } from '../app/theme';
import { Card, Input, Btn } from '../components/ui/AppPrimitives';
import { sanitizeDisplayNameInput, displayNameValidationMessage } from '../utils/displayName';

async function persistUserProfile(uid, { name, photoURL, bio }, { forShowcase = false } = {}) {
  const payload = {
    name: String(name || '').trim().slice(0, 80),
    photoURL: String(photoURL || '').trim().slice(0, 2048),
    bio: String(bio || '').trim().slice(0, 500)
  };
  if (forShowcase) payload.forUid = uid;
  if (isBffDataMode() || isFirestoreDisabled()) {
    await bff('/api/data/me', { method: 'PATCH', body: JSON.stringify(payload) });
    return;
  }
  await updateDoc(doc(db, 'users', uid), {
    name: payload.name,
    photoURL: payload.photoURL,
    bio: payload.bio
  });
}

export const EditProfileScreen = () => {
  const { user, userData, refreshUser, isActingAsShowcase } = useContext(AuthContext);
  const profileUid = user?.uid;
  const [name, setName] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [bio, setBio] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoBlobUrl, setPhotoBlobUrl] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const photoInputRef = useRef(null);

  useEffect(() => {
    if (!userData) return;
    setName(userData.name || '');
    setPhotoURL(userData.photoURL || user?.photoURL || '');
    setBio(userData.bio || '');
    setPhotoFile(null);
  }, [userData, user?.photoURL]);

  useEffect(() => {
    if (!photoFile) {
      setPhotoBlobUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(photoFile);
    setPhotoBlobUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photoFile]);

  const save = async () => {
    if (!user || !profileUid) return;
    setSaving(true);
    setMsg(null);
    const nm = name.trim().slice(0, 80);
    const nameErr = displayNameValidationMessage(nm);
    if (nameErr) {
      setMsg({ t: 'e', m: nameErr });
      setSaving(false);
      return;
    }
    try {
      let nextPhoto = (photoURL || '').trim();
      if (photoFile) {
        try {
          nextPhoto = await uploadProfilePhoto(profileUid, photoFile, '', {
            asUid: isActingAsShowcase ? profileUid : undefined
          });
        } catch (e) {
          setMsg({ t: 'e', m: formatProfilePhotoUploadError(e) });
          setSaving(false);
          return;
        }
        setPhotoURL(nextPhoto);
        setPhotoFile(null);
        if (photoInputRef.current) photoInputRef.current.value = '';
      }
      await persistUserProfile(
        profileUid,
        { name: nm, photoURL: nextPhoto, bio },
        { forShowcase: isActingAsShowcase }
      );
      if (nextPhoto && auth.currentUser?.uid === profileUid && !isActingAsShowcase) {
        try {
          await updateProfile(auth.currentUser, { photoURL: nextPhoto });
        } catch {
          /* non-fatal */
        }
      }
      await refreshUser();
      window.dispatchEvent(new CustomEvent('auron-firestore-user-sync'));
      setMsg({ t: 'ok', m: 'Profile saved — photo uploaded.' });
    } catch (e) {
      setMsg({ t: 'e', m: e.message || 'Save failed' });
    }
    setSaving(false);
  };

  return (
    <div style={{ padding: '20px 16px 40px', maxWidth: 480, margin: '0 auto' }}>
      <div style={{ marginBottom: 16, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <Link to="/dashboard" style={{ color: T.text, fontSize: 13, textDecoration: 'none' }}>
          ← Dashboard
        </Link>
        {user && (
          <Link
            to={`/profile/${encodeURIComponent(user.uid)}`}
            style={{ color: T.yellow, fontSize: 13, textDecoration: 'none', fontWeight: 600 }}
          >
            Public profile
          </Link>
        )}
      </div>
      <h2 style={{ color: T.white, marginBottom: 8 }}>Edit profile</h2>
      <p style={{ color: T.text, fontSize: 13, marginBottom: 20, lineHeight: 1.5 }}>
        Display name (letters and spaces only), profile photo, and bio.
      </p>
      <Card>
        <label style={{ color: T.text, fontSize: 12, display: 'block', marginBottom: 4 }}>Display name</label>
        <Input
          value={name}
          onChange={(e) => setName(sanitizeDisplayNameInput(e.target.value))}
          placeholder="Your name"
          style={{ marginBottom: 14 }}
        />
        <label style={{ color: T.text, fontSize: 12, display: 'block', marginBottom: 8 }}>
          Profile photo (gallery — max 5 MB, JPG/PNG/WebP)
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
          {photoBlobUrl ? (
            <img
              src={photoBlobUrl}
              alt=""
              style={{
                width: 96,
                height: 96,
                borderRadius: '50%',
                objectFit: 'cover',
                border: `2px solid ${T.yellow}`
              }}
            />
          ) : (
            <LeaderboardRowAvatar
              photoURL={resolveProfilePhotoFromUser({ photoURL }, { user, userData, isSelf: true })}
              name={name || userData?.name || 'You'}
              seed={profileUid}
              size={96}
            />
          )}
        </div>
        <input
          ref={photoInputRef}
          id="edit-profile-photo-input"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/*"
          onChange={(e) => {
            const f = e.target.files?.[0] || null;
            setPhotoFile(f);
            if (!f && photoInputRef.current) photoInputRef.current.value = '';
          }}
          style={{ display: 'none' }}
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 14 }}>
          <label
            htmlFor="edit-profile-photo-input"
            style={{
              padding: '10px 16px',
              borderRadius: 8,
              border: `1px solid ${T.yellow}`,
              background: T.card2,
              color: T.yellow,
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
              display: 'inline-block'
            }}
          >
            Choose photo from gallery
          </label>
          {photoFile ? (
            <span style={{ color: T.text, fontSize: 12 }}>
              {photoFile.name}
              <button
                type="button"
                onClick={() => {
                  setPhotoFile(null);
                  if (photoInputRef.current) photoInputRef.current.value = '';
                }}
                style={{
                  marginLeft: 8,
                  background: 'none',
                  border: 'none',
                  color: T.red,
                  cursor: 'pointer',
                  fontSize: 12,
                  textDecoration: 'underline',
                  padding: 0
                }}
              >
                hatao
              </button>
            </span>
          ) : null}
        </div>
        <label style={{ color: T.text, fontSize: 12, display: 'block', marginBottom: 4 }}>Bio</label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={4}
          placeholder="Short intro…"
          style={{
            backgroundColor: T.card2,
            border: `1px solid ${T.border}`,
            color: T.white,
            padding: '12px 14px',
            borderRadius: 6,
            width: '100%',
            fontSize: 14,
            outline: 'none',
            boxSizing: 'border-box',
            resize: 'vertical',
            marginBottom: 16,
            fontFamily: 'inherit'
          }}
        />
        {msg && (
          <div
            style={{
              color: msg.t === 'ok' ? T.green : T.red,
              fontSize: 13,
              marginBottom: 12
            }}
          >
            {msg.m}
          </div>
        )}
        <Btn onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save profile'}
        </Btn>
      </Card>
    </div>
  );
};