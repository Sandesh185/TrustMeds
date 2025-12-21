# Firebase Setup Guide

## Problem: "This project does not exist, or you do not have permission to view it"

This error means either:
1. The Firebase project doesn't exist
2. You're logged into the wrong Firebase account
3. You don't have permission to access the project

## Solution Options

### Option 1: Create a New Firebase Project (Recommended)

1. **Go to Firebase Console**: https://console.firebase.google.com/
2. **Sign in** with your Google account
3. **Click "Add project"** or "Create a project"
4. **Enter project name**: e.g., "trustmeds" or "drug-supply-chain"
5. **Follow the setup wizard**:
   - Disable Google Analytics (optional)
   - Click "Create project"
6. **Wait for project creation** (takes ~30 seconds)
7. **Click "Continue"** when done

### Option 2: Use Existing Project

1. **Check which account you're logged into** in Firebase Console
2. **Switch accounts** if needed (top right corner)
3. **Select the correct project** from the project dropdown

## Getting Service Account Key

Once you have access to a Firebase project:

1. **Go to Project Settings**:
   - Click the gear icon ⚙️ next to "Project Overview"
   - Select "Project settings"

2. **Go to Service Accounts tab**

3. **Click "Generate new private key"**
   - A JSON file will download
   - **Keep this file secure!** It has admin access to your Firebase project

4. **Run the setup script**:
   ```bash
   cd supply-chain-frontend/backend
   node scripts/setup-firebase-admin.js
   ```

5. **Enter the path to your downloaded JSON file** when prompted

## Alternative: Continue Without Firebase Writes

The backend is configured to work **without Firebase Admin SDK**. It will:
- ✅ Continue running normally
- ✅ Handle blockchain events
- ⚠️ Skip Firebase writes (with warnings)
- ✅ All API endpoints will work

Firebase writes are optional - the blockchain is the source of truth. Firebase is just for faster queries and UI display.

## Environment Variables Needed

If you want to enable Firebase writes, add to `supply-chain-frontend/backend/.env`:

```env
# Firebase Project Configuration (from Firebase Console > Project Settings > General)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_API_KEY=your-api-key
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=123456789
FIREBASE_APP_ID=1:123456789:web:abcdef

# Firebase Admin SDK (choose ONE method)
# Method 1: Path to service account JSON file
GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json

# Method 2: Service account JSON as environment variable (alternative)
# FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'
```

## Troubleshooting

### "Permission denied" errors
- Make sure you've downloaded the **Service Account Key** (not just API keys)
- The JSON file must have `project_id`, `private_key`, and `client_email` fields

### "Project does not exist"
- Check you're logged into the correct Firebase account
- Verify the `FIREBASE_PROJECT_ID` in your `.env` matches the project ID in Firebase Console

### Still having issues?
- The backend will work fine without Firebase writes
- Blockchain events will still be processed
- You can add Firebase later when you have access

