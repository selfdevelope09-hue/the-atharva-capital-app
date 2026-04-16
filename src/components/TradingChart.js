import React from 'react';
import { WebView } from 'react-native-webview'; // install: npm install react-native-webview

export default function TradingChart({ symbol = "BTCUSDT" }) {
  // TradingView ka official widget load kar rahe hain
  const html = `
    <html>
      <body style="margin:0; background-color:#0b0e11;">
        <div id="tradingview_chart"></div>
        <script type="text/javascript" src="https://s3.tradingview.com/tv.js"></script>
        <script>
          new TradingView.widget({
            "autosize": true,
            "symbol": "BINANCE:${symbol}",
            "interval": "1",
            "timezone": "Etc/UTC",
            "theme": "dark",
            "style": "1",
            "locale": "en",
            "toolbar_bg": "#f1f3f6",
            "enable_publishing": false,
            "hide_side_toolbar": false,
            "allow_symbol_change": true,
            "container_id": "tradingview_chart"
          });
        </script>
      </body>
    </html>
  `;

  return <WebView source={{ html }} style={{ height: 400, backgroundColor: '#0b0e11' }} />;
}
