import { getApps, getApp, initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

/**
 * Firebase Admin initialization
 *
 * Credentials
 * - Reads FIREBASE_ADMIN_CREDENTIALS (JSON string) from environment.
 * - Reads FIREBASE_ADMIN_CREDENTIALS_BASE64 (base64 JSON) when provided.
 * - Falls back to Application Default Credentials (GOOGLE_APPLICATION_CREDENTIALS) when not provided.
 *
 * Use Admin for server-only code paths (API routes, server components) to bypass Firestore rules
 * and keep sensitive operations off the client.
 */

// Retry configuration for connection issues
const MAX_RETRIES = 3;
const INITIAL_DELAY = 1000; // 1 second
const MAX_DELAY = 5000; // 5 seconds

// Exponential backoff with jitter
function getRetryDelay(attempt: number): number {
  const baseDelay = Math.min(INITIAL_DELAY * Math.pow(2, attempt), MAX_DELAY);
  const jitter = Math.random() * 0.1 * baseDelay; // 10% jitter
  return baseDelay + jitter;
}

// Sleep utility
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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
        const credsB64 = process.env.FIREBASE_ADMIN_CREDENTIALS_BASE64;
        
        let lastError: any;
        
        // Retry initialization with exponential backoff
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
          try {
            const resolveStorageBucket = () => {
              const envBucket = process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
              const pid = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
              const normalized = envBucket ? envBucket.replace(/\.firebasestorage\.app$/i, '.appspot.com') : undefined;
              return normalized || (pid ? `${pid}.appspot.com` : undefined);
            }
            const storageBucket = resolveStorageBucket();
            // First, try base64-encoded credentials if present
            if (credsB64) {
              try {
                const decoded = Buffer.from(credsB64, 'base64').toString('utf-8');
                const serviceAccount = JSON.parse(decoded);
                initializeApp({
                  credential: cert(serviceAccount),
                  projectId: (serviceAccount.project_id as string) || envProjectId,
                  storageBucket,
                });
                return;
              } catch (e) {
                console.warn('FIREBASE_ADMIN_CREDENTIALS_BASE64 decode/parse failed, attempting JSON env credentials.');
              }
            }

            // Next, try plain JSON from env
            if (credsJson) {
              try {
                const serviceAccount = JSON.parse(credsJson);
                initializeApp({
                  credential: cert(serviceAccount),
                  projectId: (serviceAccount.project_id as string) || envProjectId,
                  storageBucket,
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
                    storageBucket,
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
              storageBucket,
            });
            return; // Success, exit retry loop
            
          } catch (error: any) {
            lastError = error;
            
            // Check if it's a connection/DNS error that might benefit from retry
            const isRetryableError = error.message?.includes('UNAVAILABLE') || 
                                   error.message?.includes('Name resolution failed') ||
                                   error.message?.includes('ENOTFOUND') ||
                                   error.message?.includes('ECONNREFUSED') ||
                                   error.code === 14; // gRPC UNAVAILABLE
            
            if (!isRetryableError || attempt === MAX_RETRIES - 1) {
              throw error; // Don't retry non-connection errors or if max retries reached
            }
            
            const delay = getRetryDelay(attempt);
            console.warn(`Firebase Admin initialization failed (attempt ${attempt + 1}/${MAX_RETRIES}), retrying in ${Math.round(delay)}ms:`, error.message);
            await sleep(delay);
          }
        }
        
        // If we get here, all retries failed
        throw lastError;
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

// Expose the admin namespace for callers that need FieldValue, etc.
export async function getAdmin() {
  try {
    // Ensure app is initialized; reuse getAdminDb for robust init logic
    await getAdminDb();
  } catch (_) {
    // Swallow; getApp below will throw if still not initialized
  }
  // If an app exists, return the admin namespace
  try {
    getApp();
    return admin;
  } catch (err) {
    // Propagate initialization error to caller
    throw err;
  }
}
