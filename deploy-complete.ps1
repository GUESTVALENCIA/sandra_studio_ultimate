# =============================================================================
# 🚀 GALAXY ENTERPRISE - FULL DEPLOYMENT PIPELINE
# =============================================================================
# Ejecuta el ciclo completo: Limpieza -> Saneamiento -> Handoff

$ErrorActionPreference = "Stop"

Write-Host "`n🤖 INICIANDO SECUENCIA DE DESPLIEGUE AUTOMATIZADO" -ForegroundColor Magenta
Write-Host "============================================================" -ForegroundColor Magenta

# 1. Fase de Limpieza
.\master-cleanup-workflow.ps1

# 2. Fase de Saneamiento
.\sanitize-code.ps1

# 3. Fase de Entrega (Git)
.\git-handoff.ps1

Write-Host "`n✅ CICLO COMPLETO FINALIZADO CON ÉXITO." -ForegroundColor Green
Write-Host "👉 El proyecto está limpio, optimizado y commiteado." -ForegroundColor Cyan
Write-Host "🚀 Esperando push remoto..." -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Magenta