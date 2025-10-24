# Simple PowerShell script to create .env file
Write-Host "🔧 Creating .env file for GPT Cells App" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green
Write-Host ""

# Get OpenRouter API key from user
Write-Host "🔑 OpenRouter API Key Setup" -ForegroundColor Cyan
Write-Host "Get your API key from: https://openrouter.ai/keys" -ForegroundColor Gray
Write-Host ""

$apiKey = Read-Host "Enter your OpenRouter API key (starts with sk-or-)"

if (-not $apiKey) {
    Write-Host "❌ No API key provided. Cancelled." -ForegroundColor Red
    exit
}

if (-not $apiKey.StartsWith("sk-or-")) {
    Write-Host "⚠️  Warning: API key doesn't start with 'sk-or-'. Are you sure this is correct?" -ForegroundColor Yellow
    $continue = Read-Host "Continue anyway? (y/N)"
    if ($continue -ne "y" -and $continue -ne "Y") {
        Write-Host "❌ Cancelled." -ForegroundColor Red
        exit
    }
}

# Create .env file content
$envContent = "# Environment Variables for GPT Cells App`n"
$envContent += "# Generated on $(Get-Date)`n`n"
$envContent += "# OpenRouter API Key (required for AI model calls)`n"
$envContent += "OPENROUTER_API_KEY=$apiKey`n`n"
$envContent += "# Server Configuration`n"
$envContent += "PORT=3000`n`n"
$envContent += "# Firebase Configuration (for cloud deployment)`n"
$envContent += "# Uncomment and fill these when deploying to cloud`n"
$envContent += "# FIREBASE_SERVICE_ACCOUNT_KEY={\"type\":\"service_account\",\"project_id\":\"your-project-id\",...}`n"
$envContent += "# GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account-key.json`n"
$envContent += "# FIREBASE_PROJECT_ID=your-project-id`n`n"
$envContent += "# Other API Keys (optional)`n"
$envContent += "# OPENAI_API_KEY=sk-your-openai-key-here`n"
$envContent += "# FAL_AI_API_KEY=your-fal-ai-key-here`n"

# Write .env file
try {
    $envContent | Out-File -FilePath ".env" -Encoding UTF8
    Write-Host "✅ .env file created successfully!" -ForegroundColor Green
    Write-Host "🔑 API Key (first 10 chars): $($apiKey.Substring(0, 10))..." -ForegroundColor Cyan
    Write-Host ""
    Write-Host "🚀 Next steps:" -ForegroundColor Yellow
    Write-Host "1. Restart the server: node server.js" -ForegroundColor White
    Write-Host "2. Test the API: node test-api.js" -ForegroundColor White
    Write-Host "3. Open the app: http://localhost:3000/app.html" -ForegroundColor White
} catch {
    Write-Host "❌ Error creating .env file: $($_.Exception.Message)" -ForegroundColor Red
}

