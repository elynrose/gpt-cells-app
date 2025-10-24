# Simple PowerShell script to set up environment variables
Write-Host "GPT Cells App Environment Setup" -ForegroundColor Green
Write-Host ""

# Check if .env file already exists
if (Test-Path ".env") {
    Write-Host ".env file already exists!" -ForegroundColor Yellow
    $overwrite = Read-Host "Do you want to overwrite it? (y/N)"
    if ($overwrite -ne "y" -and $overwrite -ne "Y") {
        Write-Host "Setup cancelled." -ForegroundColor Red
        exit 0
    }
}

Write-Host "Creating .env file from template..." -ForegroundColor Cyan

# Create .env file content
$envContent = @"
# GPT Cells App Environment Variables
# This file contains sensitive configuration data
# DO NOT commit this file to version control

# Node Environment
NODE_ENV=development

# API Keys - Get these from your service providers
FAL_AI_API_KEY=your-fal-ai-api-key-here
OPENROUTER_API_KEY=your-openrouter-api-key-here

# Firebase Configuration
FIREBASE_PROJECT_ID=cellulai
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"cellulai","private_key_id":"","private_key":"","client_email":"","client_id":"","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":""}

# Server Configuration
PORT=3000

# Database Configuration
DATABASE_URL=./spreadsheet.db

# Rate Limiting
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX_REQUESTS=100

# Cache Configuration
CACHE_DURATION=300000
"@

# Write to .env file
$envContent | Out-File -FilePath ".env" -Encoding UTF8

Write-Host ".env file created successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Edit the .env file and add your actual API keys" -ForegroundColor White
Write-Host "2. Get Fal.ai API key from: https://fal.ai" -ForegroundColor White
Write-Host "3. Get OpenRouter API key from: https://openrouter.ai" -ForegroundColor White
Write-Host "4. Add Firebase service account key (optional for development)" -ForegroundColor White
Write-Host ""
Write-Host "Important: Never commit the .env file to version control!" -ForegroundColor Red
