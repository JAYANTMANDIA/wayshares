require('dotenv/config');
const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
console.log(serviceAccountJson && !serviceAccountJson.startsWith('PASTE')
  ? 'Firebase service-account credentials are configured.'
  : 'Firebase service-account credentials are not configured; Application Default Credentials may be used instead.');
