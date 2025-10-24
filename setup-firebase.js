/**
 * Firebase Setup Helper Script
 * This script helps you set up Firebase credentials for the GPT Cells app
 */

const fs = require('fs');
const path = require('path');

console.log('🔥 Firebase Setup Helper for GPT Cells App');
console.log('==========================================\n');

console.log('📋 To get your Firebase service account key:');
console.log('1. Go to: https://console.firebase.google.com/');
console.log('2. Select your "cellulai" project');
console.log('3. Click the gear icon → Project Settings');
console.log('4. Go to "Service accounts" tab');
console.log('5. Click "Generate new private key"');
console.log('6. Download the JSON file\n');

console.log('📁 Once you have the JSON file:');
console.log('1. Rename it to: firebase-service-account.json');
console.log('2. Place it in this directory (same as server-firebase.js)');
console.log('3. Run: npm run start:firebase\n');

console.log('🔧 Alternative: Use environment variables');
console.log('Set these environment variables:');
console.log('- FIREBASE_PRIVATE_KEY_ID');
console.log('- FIREBASE_PRIVATE_KEY');
console.log('- FIREBASE_CLIENT_EMAIL');
console.log('- FIREBASE_CLIENT_ID\n');

// Check if service account file exists
const serviceAccountPath = path.join(__dirname, 'firebase-service-account.json');
if (fs.existsSync(serviceAccountPath)) {
  console.log('✅ Found firebase-service-account.json');
  try {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    console.log('✅ Service account file is valid JSON');
    console.log(`📧 Client email: ${serviceAccount.client_email}`);
    console.log(`🆔 Project ID: ${serviceAccount.project_id}`);
    console.log('\n🚀 You can now run: npm run start:firebase');
  } catch (error) {
    console.log('❌ Service account file is not valid JSON');
    console.log('Please check the file and try again.');
  }
} else {
  console.log('❌ firebase-service-account.json not found');
  console.log('Please follow the steps above to get your Firebase credentials.');
}

console.log('\n📚 For more help, see: FIREBASE_SETUP.md');



