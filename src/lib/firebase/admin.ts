import { getApps, getApp, initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

/**
 * Firebase Admin initialization
 *
 * Credentials
 * - Reads FIREBASE_ADMIN_CREDENTIALS (JSON string) from environment.
 * - Falls back to Application Default Credentials (GOOGLE_APPLICATION_CREDENTIALS) when not provided.
 *
 * Use Admin for server-only code paths (API routes, server components) to bypass Firestore rules
 * and keep sensitive operations off the client.
 */
export async function getAdminDb() {
  // First, if an app already exists, return its Firestore instance.
  try {
    getApp();
    return getFirestore();
  } catch (_) {
    // No existing app. Use a global promise to ensure concurrent callers
    // don't race to call initializeApp with different credential objects.
    const g = globalThis as any;
    if (!g.__FIREBASE_ADMIN_INIT_PROMISE) {
      g.__FIREBASE_ADMIN_INIT_PROMISE = (async () => {
        const credsJson = process.env.FIREBASE_ADMIN_CREDENTIALS;
        if (credsJson) {
          const serviceAccount = JSON.parse(credsJson);
          initializeApp({ credential: cert(serviceAccount) });
        } else {
          initializeApp({ credential: applicationDefault() });
        }
      })();
    }

    try {
      // Wait for the initialization promise to settle. If initializeApp
      // threw because an app was concurrently created, getting the app
      // here will succeed and we can return its Firestore instance.
  await g.__FIREBASE_ADMIN_INIT_PROMISE;
  return getFirestore();
    } catch (initErr: any) {
      try {
        getApp();
        return getFirestore();
      } catch (_) {
        throw initErr;
      }
    }
  }
}
