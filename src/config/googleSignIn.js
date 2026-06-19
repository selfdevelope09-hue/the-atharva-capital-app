/**
 * Web OAuth client ID (Firebase / Google Cloud) — matches Android `google-services.json` oauth_client client_type 3.
 * Override with REACT_APP_GOOGLE_WEB_CLIENT_ID if you rotate keys.
 */
export const GOOGLE_WEB_CLIENT_ID =
  process.env.REACT_APP_GOOGLE_WEB_CLIENT_ID ||
  '644668465681-0qmpgomoe74fg4iq3imll9i8jn2ga7ur.apps.googleusercontent.com';
