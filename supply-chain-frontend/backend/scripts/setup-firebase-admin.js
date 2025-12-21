const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const ENV_PATH = path.join(__dirname, '..', '.env');

console.log('\n🔥 Firebase Admin SDK Setup 🔥');
console.log('==============================');
console.log('This script will help you configure the Firebase Admin SDK to fix PERMISSION_DENIED errors.');
console.log('You need a Service Account Key (JSON file) from the Firebase Console.\n');
console.log('⚠️  If you see "This project does not exist" error:');
console.log('   1. Make sure you\'re logged into the correct Firebase account');
console.log('   2. Create a new project if needed: https://console.firebase.google.com/\n');
console.log('Steps to get the Service Account Key:');
console.log('1. Go to Firebase Console: https://console.firebase.google.com/');
console.log('2. Select your project (or create a new one)');
console.log('3. Click ⚙️ (gear icon) > Project settings');
console.log('4. Go to "Service accounts" tab');
console.log('5. Click "Generate new private key"');
console.log('6. Save the JSON file to your computer\n');
console.log('💡 Note: The backend works WITHOUT Firebase writes too!');
console.log('   Firebase is optional - blockchain is the source of truth.\n');

rl.question('Path to your downloaded JSON key file (e.g., C:\\Downloads\\service-account.json): ', (jsonPath) => {
  try {
    // Remove quotes if user pasted path with quotes
    jsonPath = jsonPath.replace(/^"|"$/g, '').trim();

    if (!fs.existsSync(jsonPath)) {
      console.error(`\n❌ File not found at: ${jsonPath}`);
      console.log('Please check the path and try again.');
      rl.close();
      return;
    }

    const keyContent = fs.readFileSync(jsonPath, 'utf8');
    const keyJson = JSON.parse(keyContent);

    // Verify it looks like a service account key
    if (!keyJson.project_id || !keyJson.private_key || !keyJson.client_email) {
      console.error('\n❌ Invalid Service Account Key file.');
      console.log('The file does not look like a valid Firebase service account key.');
      rl.close();
      return;
    }

    // Save it to backend directory
    const destPath = path.join(__dirname, '..', 'serviceAccountKey.json');
    fs.writeFileSync(destPath, keyContent);
    console.log(`\n✅ Saved key to: ${destPath}`);

    // Update .env
    let envContent = '';
    if (fs.existsSync(ENV_PATH)) {
      envContent = fs.readFileSync(ENV_PATH, 'utf8');
    }

    // Check if GOOGLE_APPLICATION_CREDENTIALS exists
    if (envContent.includes('GOOGLE_APPLICATION_CREDENTIALS=')) {
      envContent = envContent.replace(
        /GOOGLE_APPLICATION_CREDENTIALS=.*/g,
        `GOOGLE_APPLICATION_CREDENTIALS=${destPath.replace(/\\/g, '/')}`
      );
    } else {
      envContent += `\nGOOGLE_APPLICATION_CREDENTIALS=${destPath.replace(/\\/g, '/')}\n`;
    }

    fs.writeFileSync(ENV_PATH, envContent);
    console.log('✅ Updated .env file with GOOGLE_APPLICATION_CREDENTIALS');
    
    console.log('\n🎉 Setup Complete!');
    console.log('Please RESTART your backend server for changes to take effect:');
    console.log('  npm start');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    rl.close();
  }
});
