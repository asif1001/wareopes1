# Firebase Storage Setup Guide

## Issue
You're getting a "Firebase Storage: User does not have permission to access" error because Firebase Storage hasn't been set up in your project yet.

## Solution Steps

### Step 1: Enable Firebase Storage
1. Go to [Firebase Console Storage](https://console.firebase.google.com/project/studio-4931427805-f05d2/storage)
2. Click **"Get Started"** 
3. Choose **"Start in production mode"** (we have custom security rules)
4. Select your preferred storage location (e.g., us-central1)
5. Click **"Done"**

### Step 2: Deploy Security Rules
After enabling Firebase Storage, run this command in your terminal:

```bash
firebase deploy --only storage
```

This will deploy the security rules from `storage.rules` that allow authenticated users to upload profile images.

### Step 3: Test Profile Image Upload
1. Go to your My Account page: http://localhost:3000/my-account
2. Try uploading a profile image
3. The upload should now work without permission errors

## Files Created
- `firebase.json` - Firebase project configuration
- `storage.rules` - Security rules for Firebase Storage
- `firestore.rules` - Security rules for Firestore database
- `firestore.indexes.json` - Firestore indexes configuration

## Security Rules Summary
The storage rules allow:
- ✅ Authenticated users to upload profile images
- ✅ 5MB file size limit
- ✅ Image files only (image/*)
- ✅ Read access for all authenticated users
- ❌ Deny all other access

## Troubleshooting
If you still get permission errors after setup:
1. Make sure you're logged in to the app
2. Check that Firebase Storage is properly enabled
3. Verify the security rules were deployed successfully
4. Clear browser cache and try again