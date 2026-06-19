const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const UPLOAD_ROOT = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
const MAX_BYTES = Math.min(16 * 1024 * 1024, parseInt(process.env.UPLOAD_MAX_BYTES || '8388608', 10) || 8388608);

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const FILE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
]);

function extForType(ct, fileName) {
  const n = String(fileName || '').toLowerCase();
  if (/\.jpe?g$/i.test(n)) return '.jpg';
  if (/\.png$/i.test(n)) return '.png';
  if (/\.webp$/i.test(n)) return '.webp';
  if (/\.gif$/i.test(n)) return '.gif';
  if (/\.pdf$/i.test(n)) return '.pdf';
  if (/\.txt$/i.test(n)) return '.txt';
  if (/\.docx?$/i.test(n)) return '.doc';
  if (ct.includes('png')) return '.png';
  if (ct.includes('webp')) return '.webp';
  if (ct.includes('gif')) return '.gif';
  if (ct.includes('pdf')) return '.pdf';
  if (ct.includes('jpeg')) return '.jpg';
  return '.bin';
}

function publicBase(req) {
  const env = String(process.env.PUBLIC_UPLOAD_BASE_URL || '').replace(/\/$/, '');
  if (env) return env;
  const host = req.get('x-forwarded-host') || req.get('host') || '';
  const proto = req.get('x-forwarded-proto') || 'http';
  if (host) return `${proto}://${host}`;
  return 'http://64.227.188.248:3000';
}

function saveBuffer({ uid, kind, buffer, contentType, fileName, threadId, req }) {
  const ct = String(contentType || 'application/octet-stream').toLowerCase();
  if (!FILE_TYPES.has(ct) && !ct.startsWith('image/')) {
    throw new Error('File type not allowed');
  }
  if (buffer.length > MAX_BYTES) {
    throw new Error(`File must be ${Math.round(MAX_BYTES / (1024 * 1024))} MB or smaller`);
  }
  const mediaKind = IMAGE_TYPES.has(ct) || ct.startsWith('image/') ? 'image' : 'file';
  const ext = extForType(ct, fileName);
  const safe = `${Date.now()}_${crypto.randomBytes(8).toString('hex')}${ext}`;
  let rel;
  if (kind === 'profile') rel = path.join('profile', String(uid), safe);
  else if (kind === 'chat') rel = path.join('chat', String(threadId || 'misc'), String(uid), safe);
  else throw new Error('Invalid upload kind');
  const full = path.join(UPLOAD_ROOT, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, buffer);
  const urlPath = rel.split(path.sep).join('/');
  return {
    url: `${publicBase(req)}/uploads/${urlPath}`,
    mediaKind,
    fileName: String(fileName || safe).slice(0, 200)
  };
}

function readBase64Payload(body) {
  const raw = String(body.base64 || body.data || '');
  const m = raw.match(/^data:([^;]+);base64,(.+)$/);
  if (m) {
    return { contentType: m[1], buffer: Buffer.from(m[2], 'base64') };
  }
  return {
    contentType: String(body.contentType || 'application/octet-stream'),
    buffer: Buffer.from(raw, 'base64')
  };
}

module.exports = { UPLOAD_ROOT, saveBuffer, readBase64Payload, MAX_BYTES };
