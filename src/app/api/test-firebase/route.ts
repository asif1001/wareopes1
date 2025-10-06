import { NextResponse } from 'next/server';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

export async function GET() {
  try {
    console.log('🔧 Firebase Configuration Check:');
    console.log('API Key:', firebaseConfig.apiKey ? `${firebaseConfig.apiKey.substring(0, 20)}...` : '❌ MISSING');
    console.log('Auth Domain:', firebaseConfig.authDomain || '❌ MISSING');
    console.log('Project ID:', firebaseConfig.projectId || '❌ MISSING');
    console.log('Storage Bucket:', firebaseConfig.storageBucket || '❌ MISSING');
    console.log('Messaging Sender ID:', firebaseConfig.messagingSenderId || '❌ MISSING');
    console.log('App ID:', firebaseConfig.appId ? `${firebaseConfig.appId.substring(0, 20)}...` : '❌ MISSING');

    // Check if all required config values are present
    const requiredFields = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
    const missingFields = requiredFields.filter(field => !firebaseConfig[field as keyof typeof firebaseConfig]);
    
    if (missingFields.length > 0) {
      console.error('❌ Missing required Firebase configuration fields:', missingFields);
      return NextResponse.json({
        success: false,
        error: 'Missing Firebase configuration',
        missingFields,
        message: 'Environment variables are not being loaded properly'
      });
    }
    
    console.log('✅ All Firebase configuration fields are present');
    
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    
    console.log('✅ Firebase app initialized successfully');
    
    // Test Firestore connection
    const usersRef = collection(db, 'Users');
    const snapshot = await getDocs(usersRef);
    
    console.log('✅ Successfully connected to Firestore');
    console.log(`📊 Found ${snapshot.size} users in the Users collection`);
    
    const users: any[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      users.push({
        id: doc.id,
        employeeNo: data.employeeNo,
        fullName: data.fullName,
        role: data.role,
        hasPassword: !!data.password
      });
    });
    
    return NextResponse.json({
      success: true,
      firebaseConfig: {
        apiKey: firebaseConfig.apiKey ? `${firebaseConfig.apiKey.substring(0, 20)}...` : 'MISSING',
        authDomain: firebaseConfig.authDomain || 'MISSING',
        projectId: firebaseConfig.projectId || 'MISSING',
        storageBucket: firebaseConfig.storageBucket || 'MISSING',
        messagingSenderId: firebaseConfig.messagingSenderId || 'MISSING',
        appId: firebaseConfig.appId ? `${firebaseConfig.appId.substring(0, 20)}...` : 'MISSING'
      },
      userCount: snapshot.size,
      users: users,
      message: snapshot.size === 0 
        ? 'No users found - this is why login is failing' 
        : 'Users found - login should work with correct credentials'
    });
    
  } catch (error: any) {
    console.error('❌ Firebase connection failed:', error.message);
    return NextResponse.json({
      success: false,
      error: error.message,
      code: error.code || 'unknown'
    });
  }
}