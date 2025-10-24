# Setup Firebase Environment Variable for Railway
# This script helps you set the FIREBASE_API_KEY environment variable in Railway

Write-Host "🔧 Firebase Environment Variable Setup" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "To set the Firebase API key in Railway:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Go to your Railway dashboard:" -ForegroundColor Green
Write-Host "   https://railway.app/dashboard" -ForegroundColor Blue
Write-Host ""
Write-Host "2. Select your project: gpt-cells-app-production" -ForegroundColor Green
Write-Host ""
Write-Host "3. Go to Variables tab" -ForegroundColor Green
Write-Host ""
Write-Host "4. Add new variable:" -ForegroundColor Green
Write-Host "   Name: FIREBASE_API_KEY" -ForegroundColor White
Write-Host "   Value: AIzaSyA63ET1bNMnxY3ZVmnaa8FCUuvkMOVls5k" -ForegroundColor White
Write-Host ""
Write-Host "5. Click 'Add' to save the variable" -ForegroundColor Green
Write-Host ""
Write-Host "6. Railway will automatically redeploy with the new environment variable" -ForegroundColor Green
Write-Host ""
Write-Host "✅ After setting the variable, the Firebase configuration will be served dynamically" -ForegroundColor Cyan
Write-Host "   from: https://gpt-cells-app-production.up.railway.app/firebase-config.js" -ForegroundColor Blue
Write-Host ""
Write-Host "🧪 Test the configuration:" -ForegroundColor Yellow
Write-Host "   Visit: https://cellulai.web.app/login.html" -ForegroundColor Blue
Write-Host "   Try Google sign-in - it should work now!" -ForegroundColor Green
