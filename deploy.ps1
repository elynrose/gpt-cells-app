# Firebase Deployment Script
Write-Host "🚀 Deploying GPT Cells App to Firebase Hosting..." -ForegroundColor Green

# Check if Firebase CLI is installed
try {
    $firebaseVersion = firebase --version
    Write-Host "✅ Firebase CLI version: $firebaseVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Firebase CLI not found. Please install it first:" -ForegroundColor Red
    Write-Host "npm install -g firebase-tools" -ForegroundColor Yellow
    exit 1
}

# Check if user is logged in
Write-Host "🔐 Checking Firebase authentication..." -ForegroundColor Yellow
try {
    firebase projects:list | Out-Null
    Write-Host "✅ Firebase authentication successful" -ForegroundColor Green
} catch {
    Write-Host "❌ Not authenticated. Please run: firebase login" -ForegroundColor Red
    Write-Host "Then run this script again." -ForegroundColor Yellow
    exit 1
}

# Deploy to Firebase Hosting
Write-Host "📦 Deploying to Firebase Hosting..." -ForegroundColor Yellow
try {
    firebase deploy --only hosting
    Write-Host "✅ Deployment successful!" -ForegroundColor Green
    Write-Host "🌐 Your app should be available at: https://cellulai.firebaseapp.com" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Deployment failed. Check the error messages above." -ForegroundColor Red
    exit 1
}

Write-Host "🎉 Deployment complete!" -ForegroundColor Green
