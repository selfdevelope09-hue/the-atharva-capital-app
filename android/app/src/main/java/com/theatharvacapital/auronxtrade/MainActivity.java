package com.theatharvacapital.auronxtrade;

import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.core.view.WindowCompat;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;

/**
 * Play Store WebViews often advertise {@code ; wv} in the UA. Older app bundles used that substring
 * to show an "Open in browser" gate — strip it here so even old JS does not classify the Shell as blocked.
 */
public class MainActivity extends BridgeActivity {

  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    // Layout below status bar (edge-to-edge) so nav is not clipped under the notch/camera hole
    WindowCompat.setDecorFitsSystemWindows(getWindow(), true);
  }

  @Override
  public void onResume() {
    super.onResume();
    Bridge bridge = this.getBridge();
    if (bridge == null) {
      return;
    }
    WebView wv = bridge.getWebView();
    if (wv == null) {
      return;
    }
    wv.post(() -> {
      WebSettings s = wv.getSettings();
      String ua = s.getUserAgentString();
      if (ua != null && ua.contains("; wv")) {
        s.setUserAgentString(ua.replace("; wv", ""));
      }
    });
  }
}
