/**
 * Resize/compress images before chat upload (faster on mobile networks).
 * @param {File} file
 * @param {{ maxEdge?: number, quality?: number }} opts
 * @returns {Promise<File>}
 */
export async function compressImageForChat(file, opts = {}) {
  const maxEdge = opts.maxEdge ?? 1280;
  const quality = opts.quality ?? 0.82;
  const type = (file.type || '').toLowerCase();
  if (!type.startsWith('image/') || type.includes('gif')) return file;
  if (file.size < 180_000) return file;

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;

  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close?.();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  const outType = type.includes('png') ? 'image/jpeg' : type || 'image/jpeg';
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('compress failed'))), outType, quality);
  });
  const ext = outType.includes('png') ? '.png' : '.jpg';
  const base = (file.name || 'photo').replace(/\.[^.]+$/, '');
  return new File([blob], `${base}${ext}`, { type: outType, lastModified: Date.now() });
}
