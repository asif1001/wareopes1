#!/bin/bash

# Deployment script for Vercel
echo "🚀 Starting Vercel deployment..."

# Link to existing project
echo "📌 Linking to existing Vercel project..."
vercel link --yes

# Set environment variables (uncomment and run these commands manually after authentication)
echo "⚙️  Setting environment variables..."

# Public Firebase config
vercel env add NEXT_PUBLIC_FIREBASE_API_KEY production <<< "AIzaSyDqi_NLPG6qQfPDNv4q2EagXk7kyhsFLbU"
vercel env add NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN production <<< "expotracker-6e353.firebaseapp.com"
vercel env add NEXT_PUBLIC_FIREBASE_DATABASE_URL production <<< "https://expotracker-6e353-default-rtdb.firebaseio.com"
vercel env add NEXT_PUBLIC_FIREBASE_PROJECT_ID production <<< "expotracker-6e353"
vercel env add NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET production <<< "expotracker-6e353.firebasestorage.app"
vercel env add NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID production <<< "980879059261"
vercel env add NEXT_PUBLIC_FIREBASE_APP_ID production <<< "1:980879059261:web:b1086110b963ee190dfd54"
vercel env add NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID production <<< "G-LG7KRYCFHQ"

# Server-side config
vercel env add SERVER_ACTIONS_ALLOWED_ORIGINS production <<< "https://wareopes1.vercel.app"

echo "🔐 Note: You'll need to add FIREBASE_ADMIN_CREDENTIALS manually via the dashboard"
echo "📝 The credential is too complex for CLI input"

# Deploy
echo "🚀 Deploying to production..."
vercel --prod

echo "✅ Deployment complete!"
echo "🌐 Your app should be available at: https://wareopes1.vercel.app"