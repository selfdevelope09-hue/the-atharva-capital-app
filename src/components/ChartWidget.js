import React from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

export default function ChartWidget({ symbol = "BTCUSDT" }) {
  const chartHtml = `
    <html>
      <head><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="margin:0; background-color:#0b0e11;">
        <div id="chart"></div>
        <script type="text/javascript" src="https://s3.tradingview.com/tv.js"></script>
        <script>
          new TradingView.widget({
            "autosize": true,
            "symbol": "BINANCE:${symbol}",
            "interval": "15",
            "timezone": "Etc/UTC",
            "theme": "dark",
            "style": "1",
            "locale": "en",
            "enable_publishing": false,
            "hide_top_toolbar": false,
            "save_image": false,
            "container_id": "chart"
          });
        </script>
      </body>
    </html>
  `;

  return (
    <View style={styles.container}>
      <WebView originWhitelist={['*']} source={{ html: chartHtml }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { height: 350, backgroundColor: '#0b0e11' }
});
