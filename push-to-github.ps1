# GitHub Push Helper Script
Write-Host "🐙 GitHub Repository Setup Helper" -ForegroundColor Green
Write-Host ""

# Check if we're in a git repository
if (-not (Test-Path ".git")) {
    Write-Host "❌ Not in a git repository. Please run 'git init' first." -ForegroundColor Red
    exit 1
}

# Check if we have commits
$commitCount = (git rev-list --count HEAD 2>$null)
if ($commitCount -eq 0) {
    Write-Host "❌ No commits found. Please make an initial commit first." -ForegroundColor Red
    exit 1
}

Write-Host "✅ Git repository initialized with $commitCount commit(s)" -ForegroundColor Green
Write-Host ""

# Check if remote origin exists
$remoteUrl = git remote get-url origin 2>$null
if ($remoteUrl) {
    Write-Host "✅ Remote origin already set: $remoteUrl" -ForegroundColor Green
} else {
    Write-Host "⚠️ No remote origin set. You need to:" -ForegroundColor Yellow
    Write-Host "1. Create a repository on GitHub" -ForegroundColor Cyan
    Write-Host "2. Add remote origin:" -ForegroundColor Cyan
    Write-Host "   git remote add origin https://github.com/YOUR_USERNAME/gpt-cells-app.git" -ForegroundColor Gray
    Write-Host ""
    Write-Host "📋 Follow the steps in GITHUB_SETUP.md" -ForegroundColor Yellow
    exit 0
}

# Check current branch
$currentBranch = git branch --show-current
Write-Host "📋 Current branch: $currentBranch" -ForegroundColor Cyan

# Push to GitHub
Write-Host "🚀 Pushing to GitHub..." -ForegroundColor Yellow
try {
    git push -u origin $currentBranch
    Write-Host "✅ Successfully pushed to GitHub!" -ForegroundColor Green
    Write-Host ""
    Write-Host "🎉 Next steps:" -ForegroundColor Yellow
    Write-Host "1. Go to Railway: https://railway.app" -ForegroundColor White
    Write-Host "2. Sign up with GitHub" -ForegroundColor White
    Write-Host "3. Deploy from GitHub repository" -ForegroundColor White
    Write-Host "4. Set environment variables in Railway" -ForegroundColor White
    Write-Host "5. Update frontend API URLs" -ForegroundColor White
    Write-Host "6. Deploy frontend to Firebase" -ForegroundColor White
} catch {
    Write-Host "❌ Push failed: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "💡 Common solutions:" -ForegroundColor Yellow
    Write-Host "- Check your GitHub credentials" -ForegroundColor White
    Write-Host "- Verify repository URL is correct" -ForegroundColor White
    Write-Host "- Make sure repository exists on GitHub" -ForegroundColor White
}
