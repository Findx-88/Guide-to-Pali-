// Deployment settings. This file is public — it must only contain public values.
//   apiBase        URL of the Cloudflare Worker that serves /api/*  (set after you deploy the worker)
//   googleClientId Google OAuth *Web client* ID (Google Cloud Console → APIs & Services → Credentials)
const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
window.PALI_CONFIG = {
  apiBase: isLocal ? 'http://localhost:8787' : 'https://guide-to-pali-api.guide-to-pali.workers.dev',
  googleClientId: 'REPLACE_WITH_YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com',
  // Local-only email sign-in for development (also needs DEV_LOGIN=1 on the worker). Never shown in production.
  devLogin: isLocal,
};
