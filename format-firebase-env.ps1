# Format Firebase Service Account for Railway Environment Variable
# This script formats the Firebase service account JSON for Railway

Write-Host "🔧 Firebase Service Account Formatter for Railway" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host ""

# Read the Firebase service account file
$firebaseJson = Get-Content "cellulai-firebase-adminsdk-fbsvc-ec0b26e7de.json" -Raw

# Convert to single line and escape quotes
$formattedJson = $firebaseJson -replace "`n", "" -replace "`r", "" -replace '"', '\"'

Write-Host "📋 Copy this EXACT string to Railway FIREBASE_SERVICE_ACCOUNT_KEY:" -ForegroundColor Yellow
Write-Host ""
Write-Host $formattedJson -ForegroundColor White
Write-Host ""
Write-Host "📝 Instructions:" -ForegroundColor Green
Write-Host "1. Go to Railway Dashboard: https://railway.app/dashboard" -ForegroundColor Blue
Write-Host "2. Select your project: gpt-cells-app-production" -ForegroundColor Blue
Write-Host "3. Go to Variables tab" -ForegroundColor Blue
Write-Host "4. Find FIREBASE_SERVICE_ACCOUNT_KEY variable" -ForegroundColor Blue
Write-Host "5. Replace the value with the string above" -ForegroundColor Blue
Write-Host "6. Click Save" -ForegroundColor Blue
Write-Host ""
Write-Host "IMPORTANT: Copy the ENTIRE string above - it is all one line" -ForegroundColor Red
Write-Host "Make sure there are no line breaks in the Railway variable" -ForegroundColor Red
