@echo off
echo 🔧 Creating .env file for GPT Cells App
echo =====================================
echo.

REM Check if .env already exists
if exist ".env" (
    echo ⚠️  .env file already exists!
    set /p overwrite="Do you want to overwrite it? (y/N): "
    if /i not "%overwrite%"=="y" (
        echo ❌ Cancelled. .env file not modified.
        pause
        exit /b
    )
)

echo 🔑 OpenRouter API Key Setup
echo Get your API key from: https://openrouter.ai/keys
echo.

set /p apiKey="Enter your OpenRouter API key (starts with sk-or-): "

if "%apiKey%"=="" (
    echo ❌ No API key provided. Cancelled.
    pause
    exit /b
)

echo %apiKey% | findstr /b "sk-or-" >nul
if errorlevel 1 (
    echo ⚠️  Warning: API key doesn't start with 'sk-or-'. Are you sure this is correct?
    set /p continue="Continue anyway? (y/N): "
    if /i not "%continue%"=="y" (
        echo ❌ Cancelled.
        pause
        exit /b
    )
)

REM Create .env file
echo # Environment Variables for GPT Cells App > .env
echo # Generated on %date% %time% >> .env
echo. >> .env
echo # OpenRouter API Key (required for AI model calls) >> .env
echo OPENROUTER_API_KEY=%apiKey% >> .env
echo. >> .env
echo # Server Configuration >> .env
echo PORT=3000 >> .env
echo. >> .env
echo # Firebase Configuration (for cloud deployment) >> .env
echo # Uncomment and fill these when deploying to cloud >> .env
echo # FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"your-project-id",...} >> .env
echo # GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account-key.json >> .env
echo # FIREBASE_PROJECT_ID=your-project-id >> .env
echo. >> .env
echo # Other API Keys (optional) >> .env
echo # OPENAI_API_KEY=sk-your-openai-key-here >> .env
echo # FAL_AI_API_KEY=your-fal-ai-key-here >> .env

echo ✅ .env file created successfully!
echo 🔑 API Key (first 10 chars): %apiKey:~0,10%...
echo.
echo 🚀 Next steps:
echo 1. Restart the server: node server.js
echo 2. Test the API: node test-api.js
echo 3. Open the app: http://localhost:3000/app.html
echo.
pause

