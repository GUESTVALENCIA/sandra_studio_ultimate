# =============================================================================
# 🧹 GALAXY ENTERPRISE - MASTER CLEANUP PROTOCOL
# =============================================================================

$ErrorActionPreference = "Stop"
$CurrentDir = Get-Location
$QuarantineDir = Join-Path $CurrentDir "_QUARANTINE"

Write-Host "`n🚀 INICIANDO PROTOCOLO DE LIMPIEZA: SANDRA STUDIO" -ForegroundColor Cyan

# --- CONFIGURACIÓN ---
$Targets = @("node_modules", ".next", ".vercel", "dist", "build", "coverage", ".turbo")
$FilePatterns = @("*.log", "*.tmp", ".DS_Store", "Thumbs.db")

# --- 1. CUARENTENA ---
if (-not (Test-Path $QuarantineDir)) { New-Item -ItemType Directory -Path $QuarantineDir -Force | Out-Null }
$CorruptFiles = Get-ChildItem -Path $CurrentDir -Recurse -File | Where-Object { $_.Length -eq 0 -and $_.FullName -notlike "$QuarantineDir*" }
foreach ($file in $CorruptFiles) {
    $relPath = $file.FullName.Replace($CurrentDir.Path, "")
    Write-Host "   ☣️  Cuarentena (0 bytes): $relPath" -ForegroundColor Red
    Move-Item -Path $file.FullName -Destination $QuarantineDir -Force
}

# --- 2. DEEP CLEAN ---
foreach ($target in $Targets) {
    if (Test-Path $target) {
        Write-Host "   🗑️  Eliminando directorio: $target" -ForegroundColor Magenta
        Remove-Item -Path $target -Recurse -Force -ErrorAction SilentlyContinue
    }
}

foreach ($pattern in $FilePatterns) {
    Get-ChildItem -Path $CurrentDir -Include $pattern -Recurse -Force | Remove-Item -Force
}

# --- 3. RESET ---
Write-Host "   🛁  Limpiando caché de NPM (Deep Clean)..." -ForegroundColor Magenta
& npm cache clean --force | Out-Null

Write-Host "`n✨ SISTEMA LIMPIO Y OPTIMIZADO." -ForegroundColor Green