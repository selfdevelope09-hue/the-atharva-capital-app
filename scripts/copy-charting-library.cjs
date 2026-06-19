/**
 * Copy licensed Charting Library from repo root into public/ for production build.
 * Place files at: charting_library/charting_library.js (from TradingView zip)
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = path.join(root, 'charting_library');
const dest = path.join(root, 'public', 'charting_library');
const marker = path.join(src, 'charting_library.js');

if (!fs.existsSync(marker)) {
  console.log('copy-charting-library: skip (no charting_library/charting_library.js at repo root)');
  process.exit(0);
}

fs.mkdirSync(dest, { recursive: true });
fs.cpSync(src, dest, { recursive: true });
console.log('copy-charting-library: copied to public/charting_library/');
