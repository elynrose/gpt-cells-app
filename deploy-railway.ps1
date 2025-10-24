# Railway Deployment Helper Script
Write-Host "🚂 Railway Deployment Helper" -ForegroundColor Green
Write-Host ""

# Check if Railway CLI is installed
try {
    $railwayVersion = railway --version
    Write-Host "✅ Railway CLI found: $railwayVersion" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Railway CLI not found. You can still deploy via web interface:" -ForegroundColor Yellow
    Write-Host "1. Go to https://railway.app" -ForegroundColor Cyan
    Write-Host "2. Sign up with GitHub" -ForegroundColor Cyan
    Write-Host "3. Click 'New Project' → 'Deploy from GitHub repo'" -ForegroundColor Cyan
    Write-Host "4. Select your repository" -ForegroundColor Cyan
    Write-Host "5. Railway will auto-detect Node.js and deploy" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Or install Railway CLI:" -ForegroundColor Yellow
    Write-Host "npm install -g @railway/cli" -ForegroundColor Gray
    Write-Host "railway login" -ForegroundColor Gray
    Write-Host "railway deploy" -ForegroundColor Gray
    exit 0
}

# Check if user is logged in
try {
    $loginStatus = railway whoami
    Write-Host "✅ Logged in as: $loginStatus" -ForegroundColor Green
} catch {
    Write-Host "❌ Not logged in to Railway. Please run:" -ForegroundColor Red
    Write-Host "railway login" -ForegroundColor Yellow
    exit 1
}

# Deploy to Railway
Write-Host "🚀 Deploying to Railway..." -ForegroundColor Yellow
try {
    railway deploy
    Write-Host "✅ Deployment initiated!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 Next steps:" -ForegroundColor Yellow
    Write-Host "1. Check Railway dashboard for deployment status" -ForegroundColor White
    Write-Host "2. Get your Railway URL from the dashboard" -ForegroundColor White
    Write-Host "3. Set environment variables in Railway dashboard:" -ForegroundColor White
    Write-Host "   - NODE_ENV=production" -ForegroundColor Gray
    Write-Host "   - OPENROUTER_API_KEY=your-key" -ForegroundColor Gray
    Write-Host "   - FAL_AI_API_KEY=your-key" -ForegroundColor Gray
    Write-Host "4. Update frontend API URLs:" -ForegroundColor White
    Write-Host "   node update-api-urls.js https://your-railway-url.up.railway.app" -ForegroundColor Gray
    Write-Host "5. Deploy updated frontend:" -ForegroundColor White
    Write-Host "   firebase deploy --only hosting" -ForegroundColor Gray
} catch {
    Write-Host "❌ Deployment failed: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "💡 Alternative: Deploy via web interface at https://railway.app" -ForegroundColor Yellow
}
