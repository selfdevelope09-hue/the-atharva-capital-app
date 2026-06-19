import { bff } from './serverBff';

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Upload profile photo or chat attachment via DigitalOcean (base64 JSON).
 * @param {{ kind: 'profile'|'chat', file: File, threadId?: string }} opts
 */
export async function uploadMedia({ kind, file, threadId, asUid }) {
  if (!file?.size) throw new Error('File missing');
  const base64 = await fileToDataUrl(file);
  const body = {
    kind,
    threadId: threadId || '',
    fileName: file.name || 'file',
    contentType: file.type || '',
    base64
  };
  if (asUid) body.asUid = asUid;
  const payload = await bff('/api/upload/media', {
    method: 'POST',
    timeoutMs: 55000,
    body: JSON.stringify(body)
  });
  if (!payload?.ok || !payload.url) {
    throw new Error(payload?.error || 'Upload failed');
  }
  return {
    url: payload.url,
    mediaKind: payload.mediaKind || 'file',
    fileName: payload.fileName || file.name || 'file'
  };
}

export function formatMediaUploadError(err) {
  return err?.message || 'Upload failed';
}
