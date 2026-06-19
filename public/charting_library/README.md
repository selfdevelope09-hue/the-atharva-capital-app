# TradingView Charting Library (drawings + database save)

The simple chart (`tv-widget-chart.html`) shows **drawing tools** but cannot save layouts to our Postgres database.

To enable **per-user cloud save** (layouts, drawings, indicators):

1. Get the licensed zip from [TradingView Charting Library](https://www.tradingview.com/charting-library-docs/latest/getting_started/).
2. Copy the full folder to **repo root** as `charting_library/` (must contain `charting_library.js` and `bundles/`).
3. Run `npm run build` — files copy into `public/charting_library/`.
4. Deploy web app (Vercel) and ensure you are **logged in** on Trade.

Verify: open `https://www.theatharvacapital.com/charting_library/charting_library.js` — must download JavaScript, not the app HTML page.

Database tables: `tv_chart_keys`, `tv_charts`, `tv_study_templates` (see `server/sql/media-tv-schema.sql`).
