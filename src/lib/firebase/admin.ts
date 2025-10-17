import { getApps, getApp, initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

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
        // Prefer explicit JSON from env
        const envProjectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
        const credsJson = process.env.FIREBASE_ADMIN_CREDENTIALS;
        if (credsJson) {
          try {
            const serviceAccount = JSON.parse(credsJson);
            initializeApp({
              credential: cert(serviceAccount),
              projectId: (serviceAccount.project_id as string) || envProjectId,
            });
            return;
          } catch (e) {
            // Fall through to file-based credentials
            console.warn('FIREBASE_ADMIN_CREDENTIALS parse failed, attempting file-based credentials.');
          }
        }

        // Next, try GOOGLE_APPLICATION_CREDENTIALS or a local serviceAccount.json file
        const credsPathEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS;
        const candidatePaths = [
          credsPathEnv ? path.resolve(process.cwd(), credsPathEnv) : '',
          path.resolve(process.cwd(), 'serviceAccount.json'),
        ].filter(Boolean);

        for (const p of candidatePaths) {
          try {
            if (p && fs.existsSync(p)) {
              const raw = fs.readFileSync(p, 'utf-8');
              const serviceAccount = JSON.parse(raw);
              initializeApp({
                credential: cert(serviceAccount),
                projectId: (serviceAccount.project_id as string) || envProjectId,
              });
              return;
            }
          } catch (e) {
            // Try next candidate path
          }
        }

        // If file lookups failed, do not attempt static JSON import.
        // Rely on FIREBASE_ADMIN_CREDENTIALS or ADC in production environments.

        // Finally, fall back to ADC if available in environment
        initializeApp({
          credential: applicationDefault(),
          projectId: envProjectId,
        });
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
