# =============================================================================
# 🛡️ GALAXY ENTERPRISE - CODE SANITIZATION PROTOCOL (PHASE 2)
# =============================================================================
# Objetivo: Limpieza de logs de depuración y aseguramiento de código.

$ErrorActionPreference = "Stop"
$CurrentDir = Get-Location
$TargetFile = Join-Path $CurrentDir "api\api-gateway.js"
$VercelFile = Join-Path $CurrentDir "vercel.json"

Write-Host "`n🛡️ INICIANDO PROTOCOLO DE SANEAMIENTO..." -ForegroundColor Cyan

if (Test-Path $TargetFile) {
    Write-Host "   📄 Procesando: api/api-gateway.js" -ForegroundColor Yellow
    
    # Lee el archivo, elimina console.log y console.warn usando Regex, guarda cambios.
    # Mantiene console.error para trazabilidad en producción.
    $content = Get-Content $TargetFile -Raw
    $cleanContent = $content -replace 'console\.log\((.|\n)*?\);?', '// [LOG REMOVED BY GALAXY]'
    $cleanContent = $cleanContent -replace 'console\.warn\((.|\n)*?\);?', '// [WARN REMOVED BY GALAXY]'
    
    Set-Content -Path $TargetFile -Value $cleanContent
    Write-Host "   ✅ Logs de depuración eliminados." -ForegroundColor Green
} else {
    Write-Host "   ⚠️ No se encontró api/api-gateway.js" -ForegroundColor Red
}

# --- VERIFICACIÓN DE SEGURIDAD (VERCEL.JSON) ---
if (Test-Path $VercelFile) {
    Write-Host "   🔒 Auditando headers de seguridad: vercel.json" -ForegroundColor Yellow
    $vContent = Get-Content $VercelFile -Raw
    if ($vContent -match "X-Content-Type-Options" -and $vContent -match "X-Frame-Options") {
        Write-Host "   ✅ Security Headers: OK" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️ ALERTA: Headers de seguridad faltantes." -ForegroundColor Red
    }
}

Write-Host "`n✨ CÓDIGO SANEADO PARA PRODUCCIÓN." -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan