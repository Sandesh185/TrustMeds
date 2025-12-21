const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('\n📝 Git Commit Helper');
console.log('===================\n');

// Check if we're in a git repository
try {
  execSync('git rev-parse --git-dir', { stdio: 'ignore' });
} catch (error) {
  console.log('❌ Not a Git repository. Skipping Git operations.\n');
  process.exit(0);
}

// Files to stage (based on what we see in the IDE)
const filesToStage = [
  'supply-chain-frontend/backend/scripts/check-firebase-config.js',
  'supply-chain-frontend/backend/scripts/setup-firebase-admin.js',
  'supply-chain-frontend/backend/scripts/setup-firebase-quick.js',
  'supply-chain-frontend/backend/FIREBASE_SETUP.md',
  'supply-chain-frontend/backend/services/firebase.js',
  'supply-chain-frontend/backend/services/eventListeners.js',
  'supply-chain-frontend/backend/services/blockchain.js',
  '.gitignore',
  'supply-chain-frontend/.gitignore',
];

console.log('📋 Files to stage:');
filesToStage.forEach(file => {
  const fullPath = path.join(process.cwd(), file);
  if (fs.existsSync(fullPath)) {
    console.log(`   ✅ ${file}`);
  } else {
    console.log(`   ⚠️  ${file} (not found)`);
  }
});

console.log('\n💡 To remove "U M" indicators, run these commands:');
console.log('\n1. Stage all changes:');
console.log('   git add supply-chain-frontend/backend/scripts/');
console.log('   git add supply-chain-frontend/backend/FIREBASE_SETUP.md');
console.log('   git add supply-chain-frontend/backend/services/');
console.log('   git add .gitignore');
console.log('   git add supply-chain-frontend/.gitignore');
console.log('\n2. Commit the changes:');
console.log('   git commit -m "Fix Firebase Admin SDK configuration and add setup scripts"');
console.log('\nOr use your IDE\'s Git interface:');
console.log('   - Right-click files → "Stage Changes"');
console.log('   - Then commit from Source Control panel\n');

