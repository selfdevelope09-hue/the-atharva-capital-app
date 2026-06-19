import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebaseClient';
import { isBffDataMode } from './config/dataBackend';
import { uploadMedia, formatMediaUploadError } from './api/mediaUpload';

const MAX_BYTES = 5 * 1024 * 1024;

/** Some Android pickers leave `type` empty — infer from filename. */
function resolveImageContentType(file) {
  const raw = (file.type || '').trim().toLowerCase();
  if (/^image\//i.test(raw)) return raw;
  const n = (file.name || '').toLowerCase();
  if (/\.jpe?g$/i.test(n)) return 'image/jpeg';
  if (/\.png$/i.test(n)) return 'image/png';
  if (/\.webp$/i.test(n)) return 'image/webp';
  return '';
}

export function formatProfilePhotoUploadError(err) {
  if (isBffDataMode()) return formatMediaUploadError(err);
  const code = err?.code || '';
  if (code === 'storage/unauthorized') return 'Upload blocked. Please sign in again.';
  if (code === 'storage/canceled') return 'Upload was cancelled.';
  if (code === 'storage/quota-exceeded') return 'Storage quota is full. Please try again later.';
  if (String(code).startsWith('storage/')) {
    return 'Photo upload failed. Enable Firebase Storage for this project and deploy storage rules.';
  }
  return err?.message || 'Photo upload failed.';
}

/**
 * Upload profile image (DigitalOcean when BFF mode, else Firebase Storage).
 */
export async function uploadProfilePhoto(ownerUid, file, subPrefix = '', { asUid } = {}) {
  if (!ownerUid || !file?.size) throw new Error('Photo missing');
  if (file.size > MAX_BYTES) throw new Error('Image must be 5 MB or smaller.');
  const ct = resolveImageContentType(file);
  if (!ct) throw new Error('Only gallery image files are supported (JPG, PNG, WebP).');

  if (isBffDataMode()) {
    const targetAs = asUid || ownerUid;
    const { url } = await uploadMedia({ kind: 'profile', file, asUid: targetAs });
    return url;
  }

  const ext = ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : 'jpg';
  const safeSub = String(subPrefix || '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 120);
  const name = safeSub ? `${safeSub}_${Date.now()}.${ext}` : `avatar_${Date.now()}.${ext}`;
  const path = `profile-photos/${ownerUid}/${name}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file, { contentType: ct });
  return getDownloadURL(storageRef);
}
