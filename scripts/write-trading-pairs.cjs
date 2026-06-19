/** Writes src + server tradingPairs.js from Binance 24h volume. */
const fs = require('fs');
const path = require('path');

const SKIP = new Set([
  'USDCUSDT',
  'FDUSDUSDT',
  'USD1USDT',
  'TUSDUSDT',
  'BUSDUSDT',
  'USDPUSDT',
  'DAIUSDT',
  'EURUSDT',
  'GBPUSDT',
  'AUDUSDT',
  'PAXGUSDT',
  'XAUTUSDT',
  'RLUSDUSDT',
  'XUSDUSDT',
  'WBTCUSDT',
  'WBETHUSDT',
  'EURIUSDT',
  'USTCUSDT',
  'USDEUSDT',
  'NEARUSDT',
  'MORPHOUSDT'
]);

function ok(sym) {
  const base = sym.replace(/USDT$/, '');
  return (
    sym.endsWith('USDT') &&
    base.length >= 3 &&
    /^[A-Z0-9]+$/.test(sym) &&
    sym.length <= 14 &&
    !SKIP.has(sym) &&
    !/(UP|DOWN|BULL|BEAR)USDT$/.test(sym)
  );
}

const MUST = [
  'BTCUSDT',
  'ETHUSDT',
  'BNBUSDT',
  'SOLUSDT',
  'XRPUSDT',
  'DOGEUSDT',
  'ADAUSDT',
  'AVAXUSDT',
  'LINKUSDT',
  'DOTUSDT',
  'POLUSDT',
  'LTCUSDT',
  'ATOMUSDT',
  'APTUSDT',
  'ARBUSDT',
  'OPUSDT',
  'INJUSDT',
  'SUIUSDT',
  'PEPEUSDT',
  'SHIBUSDT',
  'TRXUSDT',
  'BCHUSDT',
  'FILUSDT',
  'ETCUSDT',
  'TONUSDT',
  'WLDUSDT',
  'SEIUSDT',
  'FETUSDT',
  'RENDERUSDT',
  'UNIUSDT',
  'ICPUSDT',
  'STXUSDT',
  'IMXUSDT',
  'GRTUSDT',
  'LDOUSDT',
  'AAVEUSDT',
  'MKRUSDT',
  'SANDUSDT',
  'MANAUSDT',
  'AXSUSDT',
  'XLMUSDT',
  'ALGOUSDT',
  'VETUSDT',
  'HBARUSDT',
  'EGLDUSDT',
  'SNXUSDT',
  'CRVUSDT',
  'RUNEUSDT',
  'KAVAUSDT',
  'ZECUSDT',
  'DASHUSDT',
  'CHZUSDT',
  'GALAUSDT',
  'APEUSDT',
  'GMTUSDT',
  '1INCHUSDT',
  'COMPUSDT',
  'CAKEUSDT',
  'XTZUSDT',
  'DYDXUSDT',
  'PENDLEUSDT',
  'JUPUSDT',
  'WIFUSDT',
  'ONDOUSDT',
  'ENSUSDT',
  'TIAUSDT',
  'ORDIUSDT',
  'CFXUSDT',
  'MINAUSDT',
  'ZRXUSDT',
  'LRCUSDT',
  'MASKUSDT',
  'API3USDT',
  'SSVUSDT',
  'MAGICUSDT',
  'ARUSDT',
  'JTOUSDT',
  'STRKUSDT',
  'ENAUSDT',
  'WUSDT',
  'TAOUSDT',
  'NOTUSDT',
  'ZKUSDT',
  'BBUSDT',
  'NEOUSDT',
  'KSMUSDT',
  'IOTAUSDT',
  'FLOWUSDT',
  'QNTUSDT',
  'ROSEUSDT',
  'ANKRUSDT',
  'STORJUSDT',
  'SUSHIUSDT',
  'THETAUSDT',
  'ENJUSDT',
  'BATUSDT',
  'HOTUSDT',
  'KNCUSDT',
  'CELOUSDT',
  'ONEUSDT',
  'ICXUSDT',
  'ONTUSDT',
  'QTUMUSDT',
  'ZENUSDT',
  'SFPUSDT',
  'BELUSDT',
  'COTIUSDT',
  'CHRUSDT',
  'SKLUSDT',
  'PEOPLEUSDT',
  'AUDIOUSDT',
  'ACHUSDT',
  'FXSUSDT',
  'RPLUSDT',
  'CYBERUSDT',
  'MANTAUSDT',
  'PIXELUSDT',
  'PORTALUSDT',
  'AXLUSDT',
  'TURBOUSDT',
  'FLOKIUSDT',
  'BONKUSDT',
  'ARKMUSDT',
  'BLURUSDT',
  'JASMYUSDT',
  'RSRUSDT',
  'WOOUSDT',
  'YGGUSDT'
];

const TARGET = 120;

async function main() {
  const res = await fetch('https://api.binance.com/api/v3/ticker/24hr');
  const data = await res.json();
  const byVol = data.filter((x) => ok(x.symbol)).sort((a, b) => Number(b.quoteVolume) - Number(a.quoteVolume));
  const volRank = new Map(byVol.map((x, i) => [x.symbol, i]));

  const out = [];
  const seen = new Set();
  for (const s of MUST) {
    if (seen.has(s) || out.length >= TARGET) continue;
    seen.add(s);
    out.push(s);
  }
  for (const x of byVol) {
    if (out.length >= TARGET) break;
    if (seen.has(x.symbol)) continue;
    seen.add(x.symbol);
    out.push(x.symbol);
  }
  if (out.length > TARGET) out.length = TARGET;

  const mustIndex = new Map(MUST.map((s, i) => [s, i]));
  out.sort((a, b) => {
    const ma = mustIndex.has(a) ? mustIndex.get(a) : 10000;
    const mb = mustIndex.has(b) ? mustIndex.get(b) : 10000;
    if (ma !== mb) return ma - mb;
    return (volRank.get(a) ?? 99999) - (volRank.get(b) ?? 99999);
  });

  const lines = out.map((s) => `  '${s}'`).join(',\n');
  const body = `/**
 * Curated Binance USDT pairs — Markets, Trade quick-picks, and realtime ticks.
 * Generated from 24h quote volume (excludes stablecoins / leveraged tokens).
 * Regenerate: node scripts/write-trading-pairs.cjs
 */
export const TRADING_PAIRS_USDT = [
${lines}
];

export const TRADING_PAIRS_SET = new Set(TRADING_PAIRS_USDT);

/** Hidden from Markets list and search */
export const MARKETS_EXCLUDED_PAIRS = new Set(['NEARUSDT', 'MORPHOUSDT']);

/** Default when no symbol in URL */
export const DEFAULT_TRADE_SYMBOL = 'BTCUSDT';

export const MARKETS_DEFAULT_LIMIT = 120;
export const MARKETS_SEARCH_LIMIT = 200;
`;

  const serverBody = `/** Keep in sync with src/config/tradingPairs.js — run: node scripts/write-trading-pairs.cjs */
const TRADING_PAIRS_USDT = [
${lines}
];

module.exports = {
  TRADING_PAIRS_USDT,
  DEFAULT_TRADE_SYMBOL: 'BTCUSDT',
  MARKETS_DEFAULT_LIMIT: 120,
  MARKETS_SEARCH_LIMIT: 200
};
`;

  const root = path.join(__dirname, '..');
  fs.writeFileSync(path.join(root, 'src/config/tradingPairs.js'), body);
  fs.writeFileSync(path.join(root, 'server/src/config/tradingPairs.js'), serverBody);
  console.log('Wrote', out.length, 'pairs');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
