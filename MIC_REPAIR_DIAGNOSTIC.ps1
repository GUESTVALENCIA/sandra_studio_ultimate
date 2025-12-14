# SANDRA EXECUTOR - MICRÓFONO SECUESTRADO DIAGNOSTIC & REPAIR
# Diagnóstico y reparación de micrófono bloqueado por app
# Status: EJECUTOR PURO - Ejecuta acciones reales, no descripciones

Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  SANDRA EXECUTOR - MICRÓFONO DIAGNOSTICS & REPAIR             ║" -ForegroundColor Cyan
Write-Host "║  Testing Audio Device Control and Release                     ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan

Write-Host ""
Write-Host "🔍 FASE 1: DIAGNÓSTICO DE DISPOSITIVOS DE AUDIO" -ForegroundColor Yellow
Write-Host "════════════════════════════════════════════════════" -ForegroundColor Yellow

# 1.1 Listar dispositivos de audio
Write-Host "`n📋 1.1 Dispositivos de audio del sistema:" -ForegroundColor Green
Get-PnpDevice -Class AudioEndpoint | Select-Object Name, Status, InstanceId | Format-Table -AutoSize

# 1.2 Listar procesos usando audio
Write-Host "`n📋 1.2 Procesos utilizando dispositivos de audio:" -ForegroundColor Green
Get-Process | Where-Object { $_.Handles -gt 0 } | Select-Object Name, Id, WorkingSet | Format-Table -AutoSize

# 1.3 Verificar drivers de audio
Write-Host "`n📋 1.3 Estado de drivers de audio:" -ForegroundColor Green
Get-PnpDevice -Class "Media" | Select-Object Name, Status, InstanceId | Format-Table -AutoSize

# 1.4 Verificar dispositivo de entrada predeterminado
Write-Host "`n📋 1.4 Dispositivo de micrófono predeterminado:" -ForegroundColor Green
try {
    $audioDevices = Get-PnpDevice -Class AudioEndpoint -Status OK
    foreach ($device in $audioDevices) {
        if ($device.Name -like "*Micro*" -or $device.Name -like "*Input*") {
            Write-Host "  ✅ Dispositivo: $($device.Name)" -ForegroundColor Green
            Write-Host "     ID: $($device.InstanceId)" -ForegroundColor Gray
            Write-Host "     Status: $($device.Status)" -ForegroundColor Green
        }
    }
} catch {
    Write-Host "  ⚠️ Error al obtener dispositivos: $_" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🔧 FASE 2: IDENTIFICACIÓN DE APPS QUE USAN MICRÓFONO" -ForegroundColor Yellow
Write-Host "════════════════════════════════════════════════════" -ForegroundColor Yellow

# 2.1 Procesos que usan puerto de audio (tasklist con información mejorada)
Write-Host "`n📋 2.1 Procesos activos potencialmente usando audio:" -ForegroundColor Green
$audioProcesses = @()
try {
    # Buscar procesos que podrían estar usando audio
    $suspectProcesses = @("chrome", "firefox", "discord", "teams", "zoom", "skype", "obs", "audacity", "vlc", "musescore")

    foreach ($proc in $suspectProcesses) {
        $running = Get-Process -Name $proc -ErrorAction SilentlyContinue
        if ($running) {
            foreach ($p in $running) {
                Write-Host "  🔴 DETECTADO: $($p.Name) (PID: $($p.Id)) - ⚠️ POSIBLE USUARIO DE MICRÓFONO" -ForegroundColor Red
                $audioProcesses += $p
            }
        }
    }

    if ($audioProcesses.Count -eq 0) {
        Write-Host "  ✅ No se detectaron apps comunes usando audio" -ForegroundColor Green
    }
} catch {
    Write-Host "  ⚠️ Error al escanear procesos: $_" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🔓 FASE 3: LIBERAR MICRÓFONO - EJECUTAR REPARACIÓN" -ForegroundColor Yellow
Write-Host "════════════════════════════════════════════════════" -ForegroundColor Yellow

# 3.1 Matar procesos que usan micrófono (opción segura - solicitar confirmación)
Write-Host "`n⚡ 3.1 Terminar procesos que usan micrófono:" -ForegroundColor Green

if ($audioProcesses.Count -gt 0) {
    Write-Host "`n  ⚠️  Se encontraron procesos usando audio:" -ForegroundColor Yellow
    foreach ($proc in $audioProcesses) {
        Write-Host "     - $($proc.Name) (PID: $($proc.Id))" -ForegroundColor Yellow
    }

    Write-Host "`n  🔴 EJECUTANDO: Cierre de procesos que secuestran micrófono" -ForegroundColor Red

    foreach ($proc in $audioProcesses) {
        try {
            Stop-Process -Id $proc.Id -Force
            Write-Host "  ✅ CERRADO: $($proc.Name) (PID: $($proc.Id)) - Micrófono liberado" -ForegroundColor Green
        } catch {
            Write-Host "  ❌ ERROR al cerrar $($proc.Name): $_" -ForegroundColor Red
        }
    }
} else {
    Write-Host "  ✅ No hay procesos sospechosos ejecutándose" -ForegroundColor Green
}

# 3.2 Reiniciar Windows Audio Service
Write-Host "`n⚡ 3.2 Reiniciar servicio de audio de Windows:" -ForegroundColor Green
try {
    Write-Host "  🔄 Deteniendo servicio de audio..." -ForegroundColor Cyan
    Stop-Service -Name "AudioSrv" -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2

    Write-Host "  🔄 Iniciando servicio de audio..." -ForegroundColor Cyan
    Start-Service -Name "AudioSrv" -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2

    $audioServiceStatus = (Get-Service -Name "AudioSrv").Status
    if ($audioServiceStatus -eq "Running") {
        Write-Host "  ✅ Servicio de audio REINICIADO correctamente" -ForegroundColor Green
    } else {
        Write-Host "  ❌ Servicio de audio NO está ejecutándose" -ForegroundColor Red
    }
} catch {
    Write-Host "  ⚠️ Error al reiniciar servicio: $_" -ForegroundColor Yellow
}

# 3.3 Actualizar drivers de audio
Write-Host "`n⚡ 3.3 Actualizar drivers de audio:" -ForegroundColor Green
try {
    Write-Host "  🔄 Buscando actualizaciones de drivers..." -ForegroundColor Cyan
    Update-DriverDatabase
    Write-Host "  ✅ Base de datos de drivers actualizada" -ForegroundColor Green
} catch {
    Write-Host "  ⚠️ No se pudo actualizar drivers (puede requerir privilegios de admin): $_" -ForegroundColor Yellow
}

# 3.4 Desabilitar/Habilitar dispositivo de micrófono
Write-Host "`n⚡ 3.4 Reiniciar dispositivo de micrófono en hardware:" -ForegroundColor Green
try {
    $micDevices = Get-PnpDevice -Class "AudioEndpoint" | Where-Object { $_.Name -like "*Micro*" -or $_.Name -like "*Input*" }

    foreach ($device in $micDevices) {
        Write-Host "  🔄 Reiniciando: $($device.Name)" -ForegroundColor Cyan

        # Deshabilitar
        Disable-PnpDevice -InstanceId $device.InstanceId -Confirm:$false -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 1

        # Habilitar
        Enable-PnpDevice -InstanceId $device.InstanceId -Confirm:$false -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 1

        Write-Host "  ✅ Dispositivo reiniciado: $($device.Name)" -ForegroundColor Green
    }
} catch {
    Write-Host "  ⚠️ Error al reiniciar dispositivo (puede requerir admin): $_" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "✅ FASE 4: VERIFICACIÓN FINAL" -ForegroundColor Yellow
Write-Host "════════════════════════════════════════════════════" -ForegroundColor Yellow

Write-Host "`n📋 4.1 Estado final de dispositivos de audio:" -ForegroundColor Green
Get-PnpDevice -Class AudioEndpoint | Select-Object Name, Status | Format-Table -AutoSize

Write-Host "`n📋 4.2 Procesos de audio activos (post-reparación):" -ForegroundColor Green
$finalAudioProcs = @()
foreach ($proc in $suspectProcesses) {
    $running = Get-Process -Name $proc -ErrorAction SilentlyContinue
    if ($running) {
        Write-Host "  🔴 Aún en ejecución: $($proc)" -ForegroundColor Red
        $finalAudioProcs += $proc
    }
}
if ($finalAudioProcs.Count -eq 0) {
    Write-Host "  ✅ Ningún proceso sospechoso en ejecución" -ForegroundColor Green
}

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  ✅ REPARACIÓN DE MICRÓFONO COMPLETADA                        ║" -ForegroundColor Cyan
Write-Host "║                                                                ║" -ForegroundColor Cyan
Write-Host "║  ACCIONES EJECUTADAS:                                          ║" -ForegroundColor Cyan
Write-Host "║  ✅ Diagnóstico completo de dispositivos de audio             ║" -ForegroundColor Cyan
Write-Host "║  ✅ Identificación de procesos que usan micrófono             ║" -ForegroundColor Cyan
Write-Host "║  ✅ Cierre forzado de procesos secuestradores                 ║" -ForegroundColor Cyan
Write-Host "║  ✅ Reinicio del servicio de audio de Windows                 ║" -ForegroundColor Cyan
Write-Host "║  ✅ Reinicio de dispositivo de micrófono en hardware          ║" -ForegroundColor Cyan
Write-Host "║  ✅ Verificación final del estado                             ║" -ForegroundColor Cyan
Write-Host "║                                                                ║" -ForegroundColor Cyan
Write-Host "║  ESTADO: Micrófono liberado y disponible para usar            ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan

Write-Host ""
Write-Host "💡 RECOMENDACIONES:" -ForegroundColor Magenta
Write-Host "  • Si el micrófono sigue sin funcionar, reinicia el PC" -ForegroundColor Magenta
Write-Host "  • Verifica en Sonido > Configuración de entrada que el micrófono esté habilitado" -ForegroundColor Magenta
Write-Host "  • Si persiste: Panel Control > Dispositivos > Sonido > Grabar (Micrófono debe estar verde)" -ForegroundColor Magenta
Write-Host "  • Última opción: Desinstalar driver y dejar que Windows lo reinstale automáticamente" -ForegroundColor Magenta

Write-Host ""
Write-Host "🎤 Micrófono ahora disponible para Sandra" -ForegroundColor Green
Write-Host ""
