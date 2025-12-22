# =============================================================================
# 🤝 GALAXY ENTERPRISE - GIT HANDOFF
# =============================================================================

Write-Host "`n📦 PREPARANDO ENTREGA A REPOSITORIO..." -ForegroundColor Cyan

git status
git add .

$commitMsg = "feat(galaxy): enterprise upgrade & security hardening"
git commit -m $commitMsg

Write-Host "`n✅ COMMIT REALIZADO: $commitMsg" -ForegroundColor Green
Write-Host "👉 Listo para 'git push' (Jules)." -ForegroundColor Yellow