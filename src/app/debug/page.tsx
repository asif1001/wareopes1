"use client";

export default function DebugPage() {
  const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Firebase Environment Variables Debug</h1>
      <div className="space-y-2">
        <div><strong>API Key:</strong> {firebaseConfig.apiKey ? '✅ Set' : '❌ Missing'}</div>
        <div><strong>Auth Domain:</strong> {firebaseConfig.authDomain ? '✅ Set' : '❌ Missing'}</div>
        <div><strong>Database URL:</strong> {firebaseConfig.databaseURL ? '✅ Set' : '❌ Missing'}</div>
        <div><strong>Project ID:</strong> {firebaseConfig.projectId ? `✅ ${firebaseConfig.projectId}` : '❌ Missing'}</div>
        <div><strong>Storage Bucket:</strong> {firebaseConfig.storageBucket ? '✅ Set' : '❌ Missing'}</div>
        <div><strong>Messaging Sender ID:</strong> {firebaseConfig.messagingSenderId ? '✅ Set' : '❌ Missing'}</div>
        <div><strong>App ID:</strong> {firebaseConfig.appId ? '✅ Set' : '❌ Missing'}</div>
        <div><strong>Measurement ID:</strong> {firebaseConfig.measurementId ? '✅ Set' : '❌ Missing'}</div>
      </div>
      
      <h2 className="text-xl font-bold mt-8 mb-4">Raw Values (for debugging)</h2>
      <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
        {JSON.stringify(firebaseConfig, null, 2)}
      </pre>
    </div>
  );
}