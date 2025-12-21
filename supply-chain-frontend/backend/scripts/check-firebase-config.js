const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

console.log('\n🔍 Firebase Configuration Check 🔍');
console.log('===================================\n');

// Check environment variables
const requiredVars = {
  'FIREBASE_PROJECT_ID': process.env.FIREBASE_PROJECT_ID,
  'FIREBASE_API_KEY': process.env.FIREBASE_API_KEY,
  'FIREBASE_AUTH_DOMAIN': process.env.FIREBASE_AUTH_DOMAIN,
};

const optionalVars = {
  'GOOGLE_APPLICATION_CREDENTIALS': process.env.GOOGLE_APPLICATION_CREDENTIALS,
  'FIREBASE_SERVICE_ACCOUNT_JSON': process.env.FIREBASE_SERVICE_ACCOUNT_JSON ? 'Set (hidden)' : undefined,
};

console.log('📋 Required Firebase Client SDK Variables:');
let allRequiredPresent = true;
for (const [key, value] of Object.entries(requiredVars)) {
  if (value) {
    console.log(`   ✅ ${key}: ${value.substring(0, 20)}...`);
  } else {
    console.log(`   ❌ ${key}: NOT SET`);
    allRequiredPresent = false;
  }
}

console.log('\n🔐 Firebase Admin SDK Configuration:');
let adminConfigured = false;

if (optionalVars.GOOGLE_APPLICATION_CREDENTIALS) {
  const credsPath = optionalVars.GOOGLE_APPLICATION_CREDENTIALS;
  if (fs.existsSync(credsPath)) {
    try {
      const credsContent = fs.readFileSync(credsPath, 'utf8');
      const credsJson = JSON.parse(credsContent);
      if (credsJson.project_id && credsJson.private_key && credsJson.client_email) {
        console.log(`   ✅ GOOGLE_APPLICATION_CREDENTIALS: ${credsPath}`);
        console.log(`      Project ID: ${credsJson.project_id}`);
        adminConfigured = true;
      } else {
        console.log(`   ⚠️  GOOGLE_APPLICATION_CREDENTIALS: Invalid file format`);
      }
    } catch (error) {
      console.log(`   ❌ GOOGLE_APPLICATION_CREDENTIALS: Error reading file - ${error.message}`);
    }
  } else {
    console.log(`   ⚠️  GOOGLE_APPLICATION_CREDENTIALS: File not found at ${credsPath}`);
  }
} else {
  console.log(`   ⚠️  GOOGLE_APPLICATION_CREDENTIALS: NOT SET`);
}

if (optionalVars.FIREBASE_SERVICE_ACCOUNT_JSON) {
  try {
    const svcJson = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    if (svcJson.project_id && svcJson.private_key && svcJson.client_email) {
      console.log(`   ✅ FIREBASE_SERVICE_ACCOUNT_JSON: Valid JSON`);
      console.log(`      Project ID: ${svcJson.project_id}`);
      adminConfigured = true;
    } else {
      console.log(`   ⚠️  FIREBASE_SERVICE_ACCOUNT_JSON: Invalid format`);
    }
  } catch (error) {
    console.log(`   ❌ FIREBASE_SERVICE_ACCOUNT_JSON: Invalid JSON - ${error.message}`);
  }
} else {
  console.log(`   ⚠️  FIREBASE_SERVICE_ACCOUNT_JSON: NOT SET`);
}

console.log('\n📊 Summary:');
if (allRequiredPresent) {
  console.log('   ✅ Firebase Client SDK: Configured');
} else {
  console.log('   ⚠️  Firebase Client SDK: Missing some variables');
}

if (adminConfigured) {
  console.log('   ✅ Firebase Admin SDK: Configured (writes enabled)');
} else {
  console.log('   ⚠️  Firebase Admin SDK: Not configured (writes will be skipped)');
  console.log('\n💡 To enable Firebase writes:');
  console.log('   1. Run: node scripts/setup-firebase-admin.js');
  console.log('   2. Or see: FIREBASE_SETUP.md');
}

console.log('\n💡 Note: The backend works fine WITHOUT Firebase Admin SDK!');
console.log('   Blockchain events will still be processed.');
console.log('   Firebase is optional for faster queries.\n');

