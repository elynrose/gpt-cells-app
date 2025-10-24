@echo off
echo 🚀 Deploying GPT Cells App to Firebase Hosting...
echo.

REM Check if Firebase CLI is installed
firebase --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Firebase CLI not found. Please install it first:
    echo npm install -g firebase-tools
    pause
    exit /b 1
)

echo ✅ Firebase CLI found
echo.

REM Check authentication
echo 🔐 Checking Firebase authentication...
firebase projects:list >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Not authenticated. Please run: firebase login
    echo Then run this script again.
    pause
    exit /b 1
)

echo ✅ Firebase authentication successful
echo.

REM Deploy to Firebase Hosting
echo 📦 Deploying to Firebase Hosting...
firebase deploy --only hosting

if %errorlevel% equ 0 (
    echo.
    echo ✅ Deployment successful!
    echo 🌐 Your app should be available at: https://cellulai.firebaseapp.com
    echo 🎉 Deployment complete!
) else (
    echo ❌ Deployment failed. Check the error messages above.
)

pause
