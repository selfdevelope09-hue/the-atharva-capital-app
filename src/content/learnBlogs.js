/** Built-in Learn blogs (shown on /learn). */
export const LEARN_BLOGS = [
  {
    id: 'crypto-beginners',
    slug: 'crypto-beginners',
    title: 'Crypto Trading for Beginners: What is Cryptocurrency and How Does it Work?',
    category: 'basics',
    level: 'Beginner',
    duration_minutes: 8,
    summary:
      'Understand digital currency, blockchain, why people trade crypto, and essential terms before your first virtual trade on AuronX.',
    sections: [
      {
        type: 'p',
        text:
          'If you have ever scrolled through financial news or social media, you have definitely heard the words "Bitcoin," "Crypto," or "Web3." Cryptocurrency has become one of the fastest-growing asset classes in the world. But for a complete beginner, it can feel overwhelming. In this guide, we break down the absolute basics in simple terms.'
      },
      { type: 'h2', text: 'What is Cryptocurrency?' },
      {
        type: 'p',
        text:
          'At its core, a cryptocurrency is a digital or virtual currency secured by cryptography. Unlike traditional currencies like the US Dollar (USD) or Indian Rupee (INR), cryptocurrencies are decentralized.'
      },
      {
        type: 'ul',
        items: [
          'Traditional money (fiat): controlled by central banks and governments. They print money and track transactions.',
          'Cryptocurrency: controlled by a network of computers worldwide. No single government, bank, or company owns it.'
        ]
      },
      {
        type: 'p',
        text:
          'The prefix "crypto" comes from cryptography — complex mathematical codes that make counterfeiting and double-spending virtually impossible.'
      },
      { type: 'h2', text: 'What is Blockchain Technology?' },
      {
        type: 'p',
        text:
          'Imagine a shared digital notebook everyone can see, but no one can edit or delete. Every send or receive is recorded there.'
      },
      {
        type: 'ul',
        items: [
          'Blocks: transactions grouped into blocks.',
          'Chain: each full block links to the previous one, forming a chronological chain.',
          'Security: thousands of computers (nodes) hold copies — altering one copy is rejected by the network.'
        ]
      },
      { type: 'h2', text: 'Why Do People Trade Cryptocurrency?' },
      {
        type: 'ul',
        items: [
          '24/7 market — trade any day, any time.',
          'High volatility — large daily moves create opportunities (and risk).',
          'Low barriers — you can start with small amounts (e.g. fractions of Bitcoin).'
        ]
      },
      { type: 'h2', text: 'Common Terms You Must Know' },
      {
        type: 'table',
        headers: ['Term', 'Definition'],
        rows: [
          ['Bitcoin (BTC)', 'The first cryptocurrency (2009). Often called "Digital Gold."'],
          ['Altcoins', 'Any crypto that is not Bitcoin — e.g. Ethereum (ETH), Solana (SOL).'],
          ['Wallet', 'Software or hardware that stores your keys and crypto securely.'],
          ['Market cap', 'Price × total coins in circulation — total value of a coin.']
        ]
      },
      { type: 'h2', text: 'Conclusion' },
      {
        type: 'p',
        text:
          'Cryptocurrency is changing how we think about value and finance. Because markets move fast, jumping into live trading without practice can lead to heavy losses. Learn the basics first, then practice on a virtual simulator before risking real money.'
      }
    ]
  },
  {
    id: 'crypto-vs-stocks',
    slug: 'crypto-vs-stocks',
    title: 'Crypto Trading vs. Stock Trading: Which One is Right for You?',
    category: 'trading',
    level: 'Beginner',
    duration_minutes: 10,
    summary:
      'Compare market hours, volatility, regulation, and returns — and decide which market fits your style and risk tolerance.',
    sections: [
      {
        type: 'p',
        text:
          'Should you trade cryptocurrencies or traditional stocks? Both offer opportunities, but they run on different rules, systems, and risk profiles. Here is a side-by-side view to help you choose.'
      },
      { type: 'h2', text: '1. Market Hours' },
      {
        type: 'ul',
        items: [
          'Crypto: 24/7/365 — prices move even while you sleep.',
          'Stocks: fixed weekday sessions; closed weekends and holidays (NYSE, NASDAQ, NSE, etc.).'
        ]
      },
      {
        type: 'p',
        text: 'Crypto offers flexibility but needs discipline — big moves can happen overnight.'
      },
      { type: 'h2', text: '2. Volatility and Risk' },
      {
        type: 'ul',
        items: [
          'Crypto: extreme volatility — 20% up or 30% down in a day is possible.',
          'Stocks: generally steadier; blue-chip stocks rarely move 5–10% daily. Backed by company assets and regulation.'
        ]
      },
      { type: 'h2', text: '3. Ownership and Regulation' },
      {
        type: 'ul',
        items: [
          'Stocks: you own a piece of the company; markets regulated by SEC, SEBI, etc.',
          'Crypto: you hold a digital asset; you bet on technology adoption and demand. Regulation is still evolving.'
        ]
      },
      { type: 'h2', text: 'Crypto vs. Stocks at a Glance' },
      {
        type: 'table',
        headers: ['Feature', 'Crypto', 'Stocks'],
        rows: [
          ['Market hours', '24/7/365', 'Mon–Fri (fixed)'],
          ['Asset type', 'Digital token / network', 'Company equity'],
          ['Volatility', 'Very high', 'Low to moderate'],
          ['Regulation', 'Evolving', 'Strong government oversight'],
          ['Liquidation risk', 'High (with leverage)', 'Lower']
        ]
      },
      { type: 'h2', text: 'Conclusion' },
      {
        type: 'p',
        text:
          'Choose crypto if you want speed, volatility, and round-the-clock trading. Choose stocks for steadier growth and corporate fundamentals. Beginners should practice on a virtual simulator before trading with real capital.'
      }
    ]
  },
  {
    id: 'spot-vs-futures',
    slug: 'spot-vs-futures',
    title: 'Spot Trading vs. Futures Trading: What is the Difference?',
    category: 'trading',
    level: 'Intermediate',
    duration_minutes: 12,
    summary:
      'Spot means you own the coin; futures are contracts for price — with long, short, and leverage. Know both before advanced strategies.',
    sections: [
      {
        type: 'p',
        text:
          'On most crypto platforms you will see Spot and Futures. Both let you profit from price moves, but the mechanics differ. Understanding both is essential before advanced trading.'
      },
      { type: 'h2', text: 'What is Spot Trading?' },
      {
        type: 'p',
        text:
          'Spot is buying or selling crypto for immediate delivery. When you buy Bitcoin on spot, you own the asset — you can hold it, transfer it, or sell later. There is no expiration.'
      },
      {
        type: 'p',
        text:
          'Example: buy 1 BTC at $60,000. If price rises to $65,000 and you sell, you profit $5,000. If it drops to $50,000, you still own 1 BTC until you choose to sell.'
      },
      { type: 'h2', text: 'What is Futures Trading?' },
      {
        type: 'p',
        text:
          'Futures are contracts on the price of an asset — you do not own the underlying coin. You can go long (profit if price rises) or short (profit if price falls), often with leverage.'
      },
      {
        type: 'ul',
        items: [
          'Long: profit when price goes up.',
          'Short: profit when price goes down.',
          'Leverage: trade larger size than your balance (borrowed from the exchange).'
        ]
      },
      { type: 'h2', text: 'Spot vs. Futures' },
      {
        type: 'table',
        headers: ['Feature', 'Spot', 'Futures'],
        rows: [
          ['Own the asset?', 'Yes', 'No — price contract only'],
          ['Profit when price falls?', 'No (unless you already hold)', 'Yes — short positions'],
          ['Leverage', 'Usually none', 'Yes — up to high multiples'],
          ['Risk', 'Moderate', 'High — liquidation possible'],
          ['Holding period', 'Unlimited', 'Funding fees / expiry possible']
        ]
      },
      { type: 'h2', text: 'Conclusion' },
      {
        type: 'p',
        text:
          'Use spot for long-term holding and lower complexity. Use futures for short-term trading, leverage, or profiting in bear markets. Practice futures in a virtual environment first — liquidation is real on live accounts.'
      }
    ]
  },
  {
    id: 'leverage-margin',
    slug: 'leverage-margin',
    title: "What is Leverage and Margin in Crypto Trading? A Beginner's Guide",
    category: 'risk',
    level: 'Intermediate',
    duration_minutes: 11,
    summary:
      'Margin is your collateral; leverage multiplies position size — and losses. Learn liquidation before using high leverage.',
    sections: [
      {
        type: 'p',
        text:
          'In crypto futures you will constantly see leverage and margin. They power high-reward trading — and high risk if mismanaged.'
      },
      { type: 'h2', text: 'What is Margin?' },
      {
        type: 'p',
        text:
          'Margin is collateral you put up to open a leveraged position — your initial deposit from your wallet.'
      },
      {
        type: 'ul',
        items: [
          'Isolated margin: risk limited to that trade only.',
          'Cross margin: losses can use your full wallet to keep the position open.'
        ]
      },
      { type: 'h2', text: 'What is Leverage?' },
      {
        type: 'p',
        text:
          'Leverage multiplies buying or selling power. Expressed as 5x, 10x, 50x, or higher — your margin × leverage = position size.'
      },
      { type: 'h2', text: 'How They Work Together' },
      {
        type: 'p',
        text: 'Formula: Position size = Margin × Leverage'
      },
      {
        type: 'p',
        text:
          'Example with $100 margin: at 5x leverage your position is $500 — a 10% favorable move on the position ≈ $50 profit (50% on your $100). At 100x, position is $10,000 — same 10% move ≈ $1,000 profit — but a small adverse move can wipe you out.'
      },
      { type: 'h2', text: 'Liquidation' },
      {
        type: 'p',
        text:
          'If losses eat your margin below the maintenance level, the exchange closes your position (liquidation). You lose the margin you posted. Higher leverage = liquidation price closer to your entry — at 100x, roughly a 1% move against you can end the trade.'
      },
      { type: 'h2', text: 'Conclusion' },
      {
        type: 'p',
        text:
          'Leverage is a double-edged sword. Master margin, leverage, and liquidation in AuronX virtual trading before using real money — practice builds discipline without financial risk.'
      }
    ]
  },
  {
    id: 'liquidation-prevent',
    slug: 'liquidation-prevent',
    title: 'What is Liquidation in Crypto Trading and How to Prevent It?',
    category: 'risk',
    level: 'Intermediate',
    duration_minutes: 10,
    summary:
      'Why exchanges force-close leveraged positions, how liquidation price works, and four habits to protect your margin.',
    sections: [
      {
        type: 'p',
        text:
          'If you talk to any crypto futures trader, they will likely tell you a story about getting liquidated. In derivatives trading, liquidation strikes fear into beginners — but once you understand it, you can protect your capital.'
      },
      { type: 'h2', text: 'What is Liquidation?' },
      {
        type: 'p',
        text:
          'Liquidation occurs when a platform automatically closes your leveraged position because your account no longer has enough margin to cover ongoing losses.'
      },
      {
        type: 'p',
        text:
          'With leverage you borrow from the exchange. If price moves against you, losses eat your deposit. The platform cannot let you lose borrowed funds — so it force-closes the position when losses equal your initial margin. You lose that collateral entirely.'
      },
      { type: 'h2', text: 'The Concept of Liquidation Price' },
      {
        type: 'p',
        text:
          'Every leveraged futures position (long or short) has a calculated liquidation price.'
      },
      {
        type: 'ul',
        items: [
          'Long: liquidation price sits below entry — a crash to that level liquidates you.',
          'Short: liquidation price sits above entry — a pump to that level liquidates you.'
        ]
      },
      { type: 'h2', text: 'The Impact of Leverage on Liquidation' },
      {
        type: 'ul',
        items: [
          '2x leverage: market must move ~50% against you to liquidate.',
          '10x leverage: only ~10% against you can trigger liquidation.',
          '100x leverage: roughly a 1% move against you can wipe the position.'
        ]
      },
      { type: 'h2', text: 'Pro Tips: How to Prevent Liquidation' },
      {
        type: 'h3',
        text: '1. Always use a stop-loss'
      },
      {
        type: 'p',
        text:
          'A stop-loss closes your position before liquidation. If liquidation is at a 1% drop, a stop at 0.5% gives a small controlled loss instead of losing all margin.'
      },
      {
        type: 'h3',
        text: '2. Lower your leverage'
      },
      {
        type: 'p',
        text:
          '125x leaves zero room for error. Beginners and volatile markets often do better at 5x–10x for breathing room.'
      },
      {
        type: 'h3',
        text: '3. Use isolated margin'
      },
      {
        type: 'p',
        text:
          'In isolated mode, only the margin for that trade is at risk — the rest of your wallet stays safe if one position is liquidated.'
      },
      {
        type: 'h3',
        text: '4. Monitor maintenance margin'
      },
      {
        type: 'p',
        text:
          'Watch your margin ratio. You can add margin to push liquidation further away — but do this carefully, not as a habit to avoid cutting losses.'
      },
      { type: 'h2', text: 'Conclusion' },
      {
        type: 'p',
        text:
          'Liquidation is how the market manages risk. Practice high-leverage scenarios on AuronX virtual trading — learn thresholds and stop-loss discipline without risking real savings.'
      }
    ]
  },
  {
    id: 'stop-loss-take-profit',
    slug: 'stop-loss-take-profit',
    title: 'Master Risk Management: What Are Stop-Loss and Take-Profit Orders?',
    category: 'risk',
    level: 'Beginner',
    duration_minutes: 11,
    summary:
      'Automate exits with SL and TP, understand risk-to-reward ratios, and set levels using structure — not guesswork.',
    sections: [
      {
        type: 'p',
        text:
          'Crypto moves fast — 5% up or 10% down in minutes. Pros rarely enter without two boundaries: stop-loss (SL) and take-profit (TP).'
      },
      { type: 'h2', text: 'What is a Stop-Loss (SL)?' },
      {
        type: 'p',
        text:
          'A stop-loss automatically closes your position at a set price if the market moves against you. Purpose: limit losses before liquidation or a full drain of margin.'
      },
      {
        type: 'p',
        text:
          'Example: long Bitcoin at $65,000 with 10x leverage; liquidation near $59,000. Set SL at $64,000 — a crash triggers a small loss, not full liquidation.'
      },
      { type: 'h2', text: 'What is a Take-Profit (TP)?' },
      {
        type: 'p',
        text:
          'Take-profit closes the trade when price hits your profit target — removing greed and locking gains while you are away from the screen.'
      },
      {
        type: 'p',
        text:
          'Example: entry at $65,000, TP at $68,000. Price hits $68,100 then crashes to $63,000 — your TP already filled at the target.'
      },
      { type: 'h2', text: 'Risk-to-Reward Ratio (R:R)' },
      {
        type: 'p',
        text:
          'Combining SL and TP defines your R:R. A common setup is 1:2 — risk $10 to make $20. Win only half your trades and you can still be net profitable if winners pay twice what losers cost.'
      },
      { type: 'h2', text: 'How to Set SL and TP Correctly' },
      {
        type: 'ul',
        items: [
          'Use technical levels — SL below support (longs) or above resistance (shorts).',
          'Do not set stops too tight — normal volatility can stop you out before the move.',
          'Set SL/TP when opening the trade — do not leave fields empty.'
        ]
      },
      { type: 'h2', text: 'Conclusion' },
      {
        type: 'p',
        text:
          'Trading without SL and TP is like driving without brakes. Practice on AuronX with volatile pairs and leverage — master locking profits and accepting small losses risk-free.'
      }
    ]
  },
  {
    id: 'technical-analysis-candlesticks',
    slug: 'technical-analysis-candlesticks',
    title: 'Introduction to Technical Analysis: How to Read Crypto Charts and Candlesticks',
    category: 'technical',
    level: 'Beginner',
    duration_minutes: 12,
    summary:
      'Technical analysis basics: candlesticks, trends, support and resistance — a framework instead of guessing.',
    sections: [
      {
        type: 'p',
        text:
          'Charts look chaotic to beginners — red and green bars, lines, numbers. To a trained trader they tell a story of psychology, supply, and demand. That study is technical analysis (TA).'
      },
      { type: 'h2', text: 'What is Technical Analysis?' },
      {
        type: 'p',
        text:
          'TA studies historical price and volume to estimate future direction. Unlike fundamental analysis (team, tech, news), TA assumes available information is reflected in price. Past patterns help judge up, down, or sideways bias — as probabilities, not certainties.'
      },
      { type: 'h2', text: 'Japanese Candlestick Charts' },
      {
        type: 'p',
        text:
          'Each candle shows one time frame (1m, 1h, 1d). The body = open and close; wicks = high and low for that period.'
      },
      {
        type: 'ul',
        items: [
          'Green (bullish): price closed higher — bottom of body = open, top = close.',
          'Red (bearish): price closed lower — top of body = open, bottom = close.'
        ]
      },
      { type: 'h2', text: 'Market Trends' },
      {
        type: 'ul',
        items: [
          'Uptrend: higher highs and higher lows — buyers in control.',
          'Downtrend: lower highs and lower lows — sellers dominate.',
          'Sideways: price ranges between a ceiling and floor.'
        ]
      },
      { type: 'h2', text: 'Support and Resistance' },
      {
        type: 'p',
        text:
          'Support is a zone where buying often overwhelms selling — price may bounce. Resistance is where selling pressure caps rallies. A strong break above resistance often turns that level into new support.'
      },
      { type: 'h2', text: 'Conclusion' },
      {
        type: 'p',
        text:
          'TA is a game of probabilities. Practice drawing trends and levels on AuronX live charts — see how your analysis behaves at real market speed, risk-free.'
      }
    ]
  },
  {
    id: 'order-book-market-depth',
    slug: 'order-book-market-depth',
    title: 'Understanding the Order Book and Market Depth in Crypto Trading',
    category: 'technical',
    level: 'Intermediate',
    duration_minutes: 10,
    summary:
      'Bids, asks, spread, depth chart, and how limit vs market orders interact with the book.',
    sections: [
      {
        type: 'p',
        text:
          'Beside the chart you see red and green columns updating fast — the order book, plus a depth graph. To understand second-by-second price moves, learn how the book works.'
      },
      { type: 'h2', text: 'What is an Order Book?' },
      {
        type: 'p',
        text:
          'A live list of buy and sell orders for an asset — volume at each price. Two sides:'
      },
      {
        type: 'ul',
        items: [
          'Ask side (sellers, red): sell orders from lowest to highest price.',
          'Bid side (buyers, green): buy orders from highest to lowest price.'
        ]
      },
      { type: 'h2', text: 'Core Components' },
      {
        type: 'table',
        headers: ['Metric', 'Meaning'],
        rows: [
          ['Price', 'Level where a trader wants to trade'],
          ['Amount / size', 'Quantity at that price'],
          ['Total', 'Cumulative size at and above/below that level'],
          ['Spread', 'Gap between best bid and best ask']
        ]
      },
      { type: 'h2', text: 'What is Market Depth?' },
      {
        type: 'p',
        text:
          'Depth charts the book visually — green wall (bid depth) vs red wall (ask depth). A large bid wall suggests buying support; a large ask wall can cap upside until absorbed.'
      },
      { type: 'h2', text: 'Market vs Limit Orders' },
      {
        type: 'ul',
        items: [
          'Limit order: you set a price — order waits in the book (you add liquidity / act as maker).',
          'Market order: execute now at best available price — matches the opposite side instantly (you remove liquidity / act as taker).'
        ]
      },
      { type: 'h2', text: 'Conclusion' },
      {
        type: 'p',
        text:
          'The order book is where supply and demand meet. Practice on AuronX — watch live depth, place limits and markets, and see how spread affects fills, risk-free.'
      }
    ]
  },
  {
    id: 'market-makers-takers',
    slug: 'market-makers-takers',
    title: 'Market Makers vs. Market Takers: Understanding Crypto Trading Fees',
    category: 'trading',
    level: 'Intermediate',
    duration_minutes: 9,
    summary:
      'Maker vs taker fees, liquidity, and when to use limit vs market orders to save on costs.',
    sections: [
      {
        type: 'p',
        text:
          'Every trade pays a fee. Exchanges often charge less for makers and more for takers. Who are they, and how do you pay less?'
      },
      { type: 'h2', text: 'What is Liquidity?' },
      {
        type: 'p',
        text:
          'Liquidity is how easily you can buy or sell at a stable price without moving the market. High liquidity = deep book and tight spread. Low liquidity = big orders can slip price. Exchanges reward users who add liquidity.'
      },
      { type: 'h2', text: 'Who is a Market Maker?' },
      {
        type: 'p',
        text:
          'A maker adds liquidity — orders that do not fill immediately sit in the book. Use limit orders below/above the current price. Example: BTC at $65,000, limit buy at $64,500 — you wait in the bid column. Reward: lower maker fees (sometimes rebates).'
      },
      { type: 'h2', text: 'Who is a Market Taker?' },
      {
        type: 'p',
        text:
          'A taker removes liquidity — instant execution at the best available price. Market buy at $65,000 matches the lowest ask immediately. Cost: higher taker fee for speed.'
      },
      { type: 'h2', text: 'Maker vs Taker at a Glance' },
      {
        type: 'table',
        headers: ['', 'Market maker', 'Market taker'],
        rows: [
          ['Action', 'Adds liquidity', 'Removes liquidity'],
          ['Order type', 'Limit', 'Market'],
          ['Speed', 'Waits for price', 'Instant'],
          ['Fees', 'Lower', 'Higher']
        ]
      },
      { type: 'h2', text: 'Optimize Your Strategy' },
      {
        type: 'ul',
        items: [
          'Prefer limit orders when a few minutes do not matter — fees add up over hundreds of trades.',
          'Reserve market orders for emergencies, breakouts, or when speed beats fee savings.'
        ]
      },
      { type: 'h2', text: 'Conclusion' },
      {
        type: 'p',
        text:
          'Balance cost vs speed. On AuronX, test both order types on real feeds and see how maker/taker behavior affects your virtual PnL — without real money.'
      }
    ]
  },
  {
    id: 'beginner-trading-checklist',
    slug: 'beginner-trading-checklist',
    title: 'The Ultimate Crypto Trading Checklist for Beginners: 5 Steps Before Your First Trade',
    category: 'basics',
    level: 'Beginner',
    duration_minutes: 8,
    summary:
      'A printable pre-trade checklist: trend, R:R, leverage, order type, and emotions — before you click buy or sell.',
    sections: [
      {
        type: 'p',
        text:
          'You have learned crypto basics, spot vs futures, leverage, order books, and stop-losses. Before your first trade, run through this checklist — trading without a plan is gambling.'
      },
      {
        type: 'h2',
        text: '1. Have you identified the trend?'
      },
      {
        type: 'p',
        text:
          'Zoom out to 4h or 1d charts. Is the asset uptrending, downtrending, or sideways? Avoid fighting the macro trend with high-leverage longs in a crash unless you are experienced.'
      },
      {
        type: 'h2',
        text: '2. Is your risk-to-reward calculated?'
      },
      {
        type: 'p',
        text:
          'Define stop-loss and take-profit before entry. Aim for at least 1:2 R:R — risking $10 to target $20. Never enter hoping price “just goes up.”'
      },
      {
        type: 'h2',
        text: '3. Right margin mode and leverage?'
      },
      {
        type: 'p',
        text:
          'Beginners: 2x–10x leverage and isolated margin so one bad trade cannot touch your full wallet.'
      },
      {
        type: 'h2',
        text: '4. Order type and fees factored in?'
      },
      {
        type: 'p',
        text:
          'Use limit orders when speed is not critical (maker fees). Save market orders for breakouts or urgent exits.'
      },
      {
        type: 'h2',
        text: '5. Are your emotions in check?'
      },
      {
        type: 'p',
        text:
          'Avoid FOMO pumps and revenge trading after a loss. Trade your rules and charts, not social media hype.'
      },
      { type: 'h2', text: 'Pre-trade checklist' },
      {
        type: 'table',
        headers: ['Item', 'Goal', 'Done?'],
        rows: [
          ['Trend', 'Aligned with macro direction', '☐'],
          ['SL & TP', 'Set on the platform', '☐'],
          ['Leverage & margin', 'Low leverage, isolated mode', '☐'],
          ['Execution', 'Limit where possible', '☐'],
          ['Mindset', 'Calm and rule-based', '☐']
        ]
      },
      { type: 'h2', text: 'Conclusion' },
      {
        type: 'p',
        text:
          'Master this list in AuronX virtual trading — simulate leverage, stops, order books, and run the checklist again and again. Build strategy and psychology before risking real capital.'
      }
    ]
  }
];

export function getLearnBlogBySlug(slug) {
  const s = String(slug || '').trim().toLowerCase();
  return LEARN_BLOGS.find((b) => b.slug === s || b.id === s) || null;
}
