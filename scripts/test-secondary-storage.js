
const { initializeApp } = require('firebase/app');
const { getStorage, ref, uploadString, getDownloadURL } = require('firebase/storage');
require('dotenv').config({ path: '.env' });

const config = {
  apiKey: process.env.NEXT_PUBLIC_ONEDELIVERY_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_ONEDELIVERY_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_ONEDELIVERY_PROJECT_ID || 'oneplace-b5fc3', // derived from auth domain if missing
  storageBucket: process.env.NEXT_PUBLIC_ONEDELIVERY_STORAGE_BUCKET,
  appId: process.env.NEXT_PUBLIC_ONEDELIVERY_APP_ID,
};

console.log('Config:', { ...config, apiKey: '***' });

const app = initializeApp(config, 'secondary');
const storage = getStorage(app);
const testRef = ref(storage, 'test-upload-' + Date.now() + '.txt');

async function test() {
  try {
    console.log('Attempting upload...');
    const snapshot = await uploadString(testRef, 'test content');
    console.log('Upload success!');
    const url = await getDownloadURL(snapshot.ref);
    console.log('URL:', url);
  } catch (e) {
    console.error('Upload failed:', e.message);
    if (e.customData) console.error(JSON.stringify(e.customData, null, 2));
  }
}

test();
