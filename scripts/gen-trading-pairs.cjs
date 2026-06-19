/** One-off: top liquid Binance USDT spot pairs (excludes stables / leveraged). */
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
  return (
    sym.endsWith('USDT') &&
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

async function main() {
  const res = await fetch('https://api.binance.com/api/v3/ticker/24hr');
  const data = await res.json();
  const byVol = data
    .filter((x) => ok(x.symbol))
    .sort((a, b) => Number(b.quoteVolume) - Number(a.quoteVolume))
    .map((x) => x.symbol);

  const volSet = new Set(byVol);
  const out = [];
  const seen = new Set();
  for (const s of MUST) {
    if (!volSet.has(s) && s !== 'MKRUSDT') continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  for (const s of byVol) {
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
    if (out.length >= 120) break;
  }
  console.log(JSON.stringify(out, null, 2));
  console.error('count', out.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
