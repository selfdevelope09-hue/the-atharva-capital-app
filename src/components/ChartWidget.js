import React from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';

const { width } = Dimensions.get('window');

export default function ChartWidget({ symbol = "BTCUSDT" }) {
  const chartHtml = `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <style>
          body { margin: 0; padding: 0; background-color: #0b0e11; overflow: hidden; }
          #tradingview_widget { height: 100vh; width: 100vw; }
        </style>
      </head>
      <body>
        <div id="tradingview_widget"></div>
        <script type="text/javascript" src="https://s3.tradingview.com/tv.js"></script>
        <script type="text/javascript">
          new TradingView.widget({
            "autosize": true,
            "symbol": "BINANCE:${symbol}",
            "interval": "15",
            "timezone": "Etc/UTC",
            "theme": "dark",
            "style": "1",
            "locale": "en",
            "toolbar_bg": "#1e2329",
            "enable_publishing": false,
            "withdateranges": true,
            "hide_side_toolbar": false, // ISSE SAARE TOOLS (Trendline, Brush, etc.) AA JAYENGE
            "allow_symbol_change": true,
            "details": false,
            "hotlist": false,
            "calendar": false,
            "show_popup_button": true,
            "popup_width": "1000",
            "popup_height": "650",
            "container_id": "tradingview_widget",
            "studies": [
              "RSI@tv-basicstudies",      // Default Indicators
              "MACD@tv-basicstudies",
              "MASimple@tv-basicstudies"
            ]
          });
        </script>
      </body>
    </html>
  `;

  return (
    <View style={styles.chartContainer}>
      <WebView 
        originWhitelist={['*']} 
        source={{ html: chartHtml }} 
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  chartContainer: { 
    height: 450, // Chart ki height thodi badha di hai tools ke liye
    width: width,
    backgroundColor: '#0b0e11' 
  },
  webview: {
    backgroundColor: '#0b0e11',
  }
});
