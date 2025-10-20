import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Validate required environment variables
const requiredEnvVars = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0 && process.env.NODE_ENV !== 'development') {
  console.error('Missing required Firebase environment variables:', missingVars);
  // In production, we should fail gracefully rather than crash
}

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || '',
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore with connection settings for better reliability
const db = initializeFirestore(app, {
  experimentalForceLongPolling: false, // Use WebChannel transport by default
  // Increase cache size and ignore undefineds for stability
  cacheSizeBytes: 40000000, // 40MB cache
  ignoreUndefinedProperties: true,
});

// Initialize Storage
const storage = getStorage(app);

// Add connection state monitoring and retry logic
if (typeof window !== 'undefined') {
  // Client-side only: Add connection monitoring
  let connectionRetryCount = 0;
  const MAX_CONNECTION_RETRIES = 3;
  const RETRY_DELAY = 2000; // 2 seconds

  // Monitor Firestore connection state
  const monitorConnection = () => {
    // Listen for online/offline events
    window.addEventListener('online', () => {
      console.log('Network connection restored');
      connectionRetryCount = 0; // Reset retry count when back online
    });

    window.addEventListener('offline', () => {
      console.log('Network connection lost - Firestore will operate in offline mode');
    });

    // Add custom error handling for Firestore operations
    const originalConsoleError = console.error;
    console.error = function(...args) {
      const errorMessage = args.join(' ');
      
      // Check for Firestore connection errors
      if (errorMessage.includes('Could not reach Cloud Firestore backend') || 
          errorMessage.includes('FirebaseError: [code=unavailable]') ||
          errorMessage.includes('Name resolution failed')) {
        
        connectionRetryCount++;
        
        if (connectionRetryCount <= MAX_CONNECTION_RETRIES) {
          console.warn(`Firestore connection issue detected (attempt ${connectionRetryCount}/${MAX_CONNECTION_RETRIES}). Retrying in ${RETRY_DELAY}ms...`);
          
          // Attempt to reconnect after delay
          setTimeout(() => {
            // Force a simple Firestore operation to test connectivity
            import('./firestore').then(({ testConnection }) => {
              if (testConnection) {
                testConnection().catch(() => {
                  // Connection test failed, but don't log additional errors
                });
              }
            });
          }, RETRY_DELAY * connectionRetryCount); // Exponential backoff
        } else {
          console.warn('Max Firestore connection retries reached. Operating in offline mode.');
        }
      }
      
      // Call original console.error
      originalConsoleError.apply(console, args);
    };
  };

  // Initialize connection monitoring
  monitorConnection();
}

export { app, db, storage };
