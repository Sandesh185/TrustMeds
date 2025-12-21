const fs = require('fs');
const path = require('path');
const os = require('os');

const ENV_PATH = path.join(__dirname, '..', '.env');

// Common download locations
const commonLocations = [
  path.join(os.homedir(), 'Downloads'),
  path.join(os.homedir(), 'Desktop'),
  path.join(os.homedir(), 'Documents'),
  path.join(os.homedir(), 'OneDrive', 'Downloads'),
  path.join(os.homedir(), 'OneDrive', 'Desktop'),
  path.join(os.homedir(), 'OneDrive', 'Documents'),
];

function findFile(filename) {
  // Try exact path first
  if (fs.existsSync(filename)) {
    return filename;
  }

  // Try relative to current directory
  const relativePath = path.join(__dirname, '..', filename);
  if (fs.existsSync(relativePath)) {
    return relativePath;
  }

  // Search common download locations
  for (const basePath of commonLocations) {
    if (fs.existsSync(basePath)) {
      const fullPath = path.join(basePath, filename);
      if (fs.existsSync(fullPath)) {
        return fullPath;
      }
    }
  }

  return null;
}

// Get filename from command line argument or use default
const filename = process.argv[2] || 'studio-4527071257-fa8f4-firebase-adminsdk-fbsvc-292169fff2.json';

console.log('\n🔥 Quick Firebase Admin SDK Setup 🔥');
console.log('====================================\n');
console.log(`Looking for: ${filename}\n`);

const foundPath = findFile(filename);

if (!foundPath) {
  console.error(`❌ File not found: ${filename}`);
  console.log('\nSearched in:');
  console.log(`  - Current directory: ${path.join(__dirname, '..')}`);
  commonLocations.forEach(loc => {
    if (fs.existsSync(loc)) {
      console.log(`  - ${loc}`);
    }
  });
  console.log('\n💡 Options:');
  console.log('  1. Run: node scripts/setup-firebase-admin.js');
  console.log('     Then provide the full path when prompted');
  console.log(`  2. Move the file to: ${path.join(__dirname, '..')}`);
  console.log(`  3. Run: node scripts/setup-firebase-quick.js "C:\\Full\\Path\\To\\${filename}"`);
  process.exit(1);
}

console.log(`✅ Found file at: ${foundPath}\n`);

try {
  const keyContent = fs.readFileSync(foundPath, 'utf8');
  const keyJson = JSON.parse(keyContent);

  // Verify it looks like a service account key
  if (!keyJson.project_id || !keyJson.private_key || !keyJson.client_email) {
    console.error('❌ Invalid Service Account Key file.');
    console.log('The file does not look like a valid Firebase service account key.');
    process.exit(1);
  }

  console.log(`📋 Project ID: ${keyJson.project_id}`);
  console.log(`📧 Client Email: ${keyJson.client_email}\n`);

  // Save it to backend directory
  const destPath = path.join(__dirname, '..', 'serviceAccountKey.json');
  fs.writeFileSync(destPath, keyContent);
  console.log(`✅ Saved key to: ${destPath}`);

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

  // Also update FIREBASE_PROJECT_ID if not set
  if (!envContent.includes('FIREBASE_PROJECT_ID=')) {
    envContent += `FIREBASE_PROJECT_ID=${keyJson.project_id}\n`;
    console.log(`✅ Added FIREBASE_PROJECT_ID=${keyJson.project_id} to .env`);
  }

  fs.writeFileSync(ENV_PATH, envContent);
  console.log('✅ Updated .env file with GOOGLE_APPLICATION_CREDENTIALS');
  
  console.log('\n🎉 Setup Complete!');
  console.log('\n📝 Next steps:');
  console.log('  1. RESTART your backend server:');
  console.log('     Press Ctrl+C to stop, then run: npm start');
  console.log('  2. You should see: "✅ Firebase Admin initialized"');
  console.log('  3. Firebase writes will now work!\n');
  
} catch (error) {
  console.error('\n❌ Error:', error.message);
  if (error.code === 'ENOENT') {
    console.error('   File not found. Check the path.');
  } else if (error instanceof SyntaxError) {
    console.error('   Invalid JSON file.');
  }
  process.exit(1);
}

