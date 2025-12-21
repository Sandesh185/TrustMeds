# PowerShell script to remove Git "U M" indicators by staging and committing files

Write-Host "`n🔧 Removing Git U M Indicators..." -ForegroundColor Cyan
Write-Host "================================`n" -ForegroundColor Cyan

# Change to project root
Set-Location "C:\Users\ASUS\OneDrive\Documents\OneNote Notebooks\Desktop\TrustMeds"

# Try to use git command directly
try {
    $null = Get-Command git -ErrorAction Stop
    
    Write-Host "📝 Staging files..." -ForegroundColor Yellow
    git add supply-chain-frontend/backend/scripts/check-firebase-config.js 2>&1 | Out-Null
    git add supply-chain-frontend/backend/scripts/setup-firebase-admin.js 2>&1 | Out-Null
    git add supply-chain-frontend/backend/scripts/setup-firebase-quick.js 2>&1 | Out-Null
    git add supply-chain-frontend/backend/FIREBASE_SETUP.md 2>&1 | Out-Null
    git add supply-chain-frontend/backend/services/firebase.js 2>&1 | Out-Null
    git add supply-chain-frontend/backend/services/eventListeners.js 2>&1 | Out-Null
    git add supply-chain-frontend/backend/services/blockchain.js 2>&1 | Out-Null
    git add .gitignore 2>&1 | Out-Null
    git add supply-chain-frontend/.gitignore 2>&1 | Out-Null
    
    Write-Host "✅ Files staged`n" -ForegroundColor Green
    
    Write-Host "💾 Committing changes..." -ForegroundColor Yellow
    git commit -m "Fix Firebase Admin SDK configuration and add setup scripts" 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Success! U M indicators removed." -ForegroundColor Green
    Write-Host "   Files have been committed to Git.`n" -ForegroundColor Green
} else {
    Write-Host "`n⚠️  Commit may have failed or there were no changes to commit." -ForegroundColor Yellow
    Write-Host "   Check Git status: git status`n" -ForegroundColor Yellow
}

