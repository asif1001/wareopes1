// Simple script to verify Firebase Storage bucket existence using Admin SDK
// Usage: node check-storage-bucket.js
require('dotenv').config();

const { initializeApp, cert, applicationDefault } = require('firebase-admin/app');
const { getStorage } = require('firebase-admin/storage');

function initAdmin() {
  const credsJson = process.env.FIREBASE_ADMIN_CREDENTIALS;
  if (credsJson) {
    try {
      const serviceAccount = JSON.parse(credsJson);
      initializeApp({ credential: cert(serviceAccount) });
      return serviceAccount.project_id;
    } catch (e) {
      console.warn('Failed to parse FIREBASE_ADMIN_CREDENTIALS, falling back to ADC or serviceAccount.json');
    }
  }
  initializeApp({ credential: applicationDefault() });
  return process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '(unknown)';
}

function resolveBucketCandidates() {
  const envBucket = (process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '').replace(/^gs:\/\//, '');
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '';
  const candidates = [];

  if (envBucket) {
    const parts = envBucket.split('.');
    const proj = parts[0];
    if (envBucket.endsWith('.appspot.com')) {
      candidates.push(envBucket);
      if (proj) candidates.push(`${proj}.firebasestorage.app`);
    } else if (envBucket.endsWith('.firebasestorage.app')) {
      candidates.push(envBucket);
      if (proj) candidates.push(`${proj}.appspot.com`);
    } else {
      // treat as project id
      candidates.push(`${envBucket}.appspot.com`, `${envBucket}.firebasestorage.app`);
    }
  } else if (projectId) {
    candidates.push(`${projectId}.appspot.com`, `${projectId}.firebasestorage.app`);
  }

  return candidates;
}

async function main() {
  console.log('🔎 Checking Firebase Storage bucket existence with Admin SDK...');
  const projectId = initAdmin();
  console.log('Project ID (admin):', projectId);

  const storage = getStorage();
  const candidates = resolveBucketCandidates();
  if (!candidates.length) {
    console.error('No bucket candidates derived from env. Set FIREBASE_PROJECT_ID or FIREBASE_STORAGE_BUCKET.');
    process.exit(1);
  }

  for (const cand of candidates) {
    try {
      const bucket = storage.bucket(cand);
      const [exists] = await bucket.exists();
      console.log(`- Bucket ${cand}:`, exists ? '✅ exists' : '❌ not found');
    } catch (e) {
      console.log(`- Bucket ${cand}: error ->`, e.message || String(e));
    }
  }
}

main().catch((e) => {
  console.error('Unexpected error:', e?.message || e);
  process.exit(1);
});