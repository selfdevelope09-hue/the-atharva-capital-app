import React from 'react';
import ReactDOM from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import './index.css'; // optional
import App from './App';
import { attachCapacitorDeepLinks } from './nativeAppLinks';
import { forceFirebaseSession, resetStaleBffSession } from './config/dataBackend';
import { GOOGLE_WEB_CLIENT_ID } from './config/googleSignIn';

resetStaleBffSession();
forceFirebaseSession();
void attachCapacitorDeepLinks();

if (Capacitor.isNativePlatform()) {
  import('@codetrix-studio/capacitor-google-auth')
    .then(({ GoogleAuth }) => {
      const init = {
        scopes: ['profile', 'email'],
        grantOfflineAccess: true,
        serverClientId: GOOGLE_WEB_CLIENT_ID
      };
      if (Capacitor.getPlatform() === 'ios') {
        init.clientId = GOOGLE_WEB_CLIENT_ID;
      }
      return GoogleAuth.initialize(init);
    })
    .catch(() => {});
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
