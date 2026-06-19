/** Curated NSE symbols for offline / rate-limit fallback search */
export const NSE_SYMBOLS = [
  { symbol: 'RELIANCE', name: 'Reliance Industries Ltd' },
  { symbol: 'TCS', name: 'Tata Consultancy Services' },
  { symbol: 'HDFCBANK', name: 'HDFC Bank Ltd' },
  { symbol: 'INFY', name: 'Infosys Ltd' },
  { symbol: 'ICICIBANK', name: 'ICICI Bank Ltd' },
  { symbol: 'HINDUNILVR', name: 'Hindustan Unilever Ltd' },
  { symbol: 'SBIN', name: 'State Bank of India' },
  { symbol: 'BHARTIARTL', name: 'Bharti Airtel Ltd' },
  { symbol: 'ITC', name: 'ITC Ltd' },
  { symbol: 'KOTAKBANK', name: 'Kotak Mahindra Bank' },
  { symbol: 'LT', name: 'Larsen & Toubro Ltd' },
  { symbol: 'AXISBANK', name: 'Axis Bank Ltd' },
  { symbol: 'ASIANPAINT', name: 'Asian Paints Ltd' },
  { symbol: 'MARUTI', name: 'Maruti Suzuki India' },
  { symbol: 'TITAN', name: 'Titan Company Ltd' },
  { symbol: 'SUNPHARMA', name: 'Sun Pharmaceutical' },
  { symbol: 'ULTRACEMCO', name: 'UltraTech Cement' },
  { symbol: 'NESTLEIND', name: 'Nestle India Ltd' },
  { symbol: 'WIPRO', name: 'Wipro Ltd' },
  { symbol: 'ONGC', name: 'Oil & Natural Gas Corp' },
  { symbol: 'NTPC', name: 'NTPC Ltd' },
  { symbol: 'POWERGRID', name: 'Power Grid Corp' },
  { symbol: 'M&M', name: 'Mahindra & Mahindra' },
  { symbol: 'TATAMOTORS', name: 'Tata Motors Ltd' },
  { symbol: 'TATASTEEL', name: 'Tata Steel Ltd' },
  { symbol: 'JSWSTEEL', name: 'JSW Steel Ltd' },
  { symbol: 'HCLTECH', name: 'HCL Technologies' },
  { symbol: 'TECHM', name: 'Tech Mahindra Ltd' },
  { symbol: 'BAJFINANCE', name: 'Bajaj Finance Ltd' },
  { symbol: 'BAJAJFINSV', name: 'Bajaj Finserv Ltd' },
  { symbol: 'ADANIENT', name: 'Adani Enterprises' },
  { symbol: 'ADANIPORTS', name: 'Adani Ports' },
  { symbol: 'COALINDIA', name: 'Coal India Ltd' },
  { symbol: 'INDUSINDBK', name: 'IndusInd Bank' },
  { symbol: 'DIVISLAB', name: "Dr. Reddy's / Divi's Lab" },
  { symbol: 'DRREDDY', name: "Dr. Reddy's Laboratories" },
  { symbol: 'CIPLA', name: 'Cipla Ltd' },
  { symbol: 'EICHERMOT', name: 'Eicher Motors Ltd' },
  { symbol: 'HEROMOTOCO', name: 'Hero MotoCorp' },
  { symbol: 'BPCL', name: 'Bharat Petroleum' },
  { symbol: 'GRASIM', name: 'Grasim Industries' },
  { symbol: 'HINDALCO', name: 'Hindalco Industries' },
  { symbol: 'TATACONSUM', name: 'Tata Consumer Products' },
  { symbol: 'APOLLOHOSP', name: 'Apollo Hospitals' },
  { symbol: 'BRITANNIA', name: 'Britannia Industries' },
  { symbol: 'VEDL', name: 'Vedanta Ltd' },
  { symbol: 'ZOMATO', name: 'Zomato Ltd' },
  { symbol: 'PAYTM', name: 'One 97 Communications (Paytm)' },
  { symbol: 'IRCTC', name: 'IRCTC' },
  { symbol: 'DMART', name: 'Avenue Supermarts (DMart)' }
];

export function searchNseLocal(q) {
  const s = (q || '').trim().toUpperCase();
  if (!s) return [];
  return NSE_SYMBOLS.filter(
    (r) => r.symbol.includes(s) || r.name.toUpperCase().includes(s) || r.symbol.startsWith(s)
  ).slice(0, 24);
}
