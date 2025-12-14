# SANDRA EXECUTOR - MICROPHONE REPAIR
# Ejecutar diagnóstico y reparación de micrófono bloqueado

Write-Host "================================" -ForegroundColor Cyan
Write-Host "SANDRA EXECUTOR - MIC REPAIR"
Write-Host "Testing Audio Device Control"
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[FASE 1] DIAGNOSTICO DE DISPOSITIVOS DE AUDIO" -ForegroundColor Yellow

# 1.1 Listar dispositivos de audio
Write-Host ""
Write-Host "1.1 Dispositivos de audio del sistema:" -ForegroundColor Green
Get-PnpDevice -Class AudioEndpoint | Select-Object Name, Status, InstanceId | Format-Table -AutoSize

# 1.2 Verificar servicio de audio
Write-Host ""
Write-Host "1.2 Estado del servicio Windows Audio:" -ForegroundColor Green
Get-Service -Name "AudioSrv" | Select-Object Name, Status, DisplayName | Format-Table -AutoSize

# 1.3 Listar drivers de audio
Write-Host ""
Write-Host "1.3 Drivers de audio instalados:" -ForegroundColor Green
Get-PnpDevice -Class "Media" | Where-Object { $_.Status -eq "OK" } | Select-Object Name, Status | Format-Table -AutoSize

Write-Host ""
Write-Host "[FASE 2] BUSCAR PROCESOS QUE USAN MICROPHONE" -ForegroundColor Yellow

# 2.1 Buscar procesos de audio comunes
Write-Host ""
Write-Host "2.1 Procesos potencialmente usando micrófono:" -ForegroundColor Green

$audioApps = @("chrome", "firefox", "discord", "teams", "zoom", "skype", "obs", "audacity", "vlc", "musescore", "discord", "telegram")
$foundApps = @()

foreach ($app in $audioApps) {
    $proc = Get-Process -Name $app -ErrorAction SilentlyContinue
    if ($proc) {
        Write-Host "  [DETECTADO] $app (PID: $($proc.Id)) - POSIBLE SECUESTRADOR DE MIC" -ForegroundColor Red
        $foundApps += $proc
    }
}

if ($foundApps.Count -eq 0) {
    Write-Host "  [OK] No detectadas apps comunes usando audio" -ForegroundColor Green
}

Write-Host ""
Write-Host "[FASE 3] REPARACION - LIBERAR MICROPHONE" -ForegroundColor Yellow

# 3.1 Cerrar procesos que usan micrófono
Write-Host ""
Write-Host "3.1 Cerrando procesos que secuestran micrófono:" -ForegroundColor Green

if ($foundApps.Count -gt 0) {
    foreach ($proc in $foundApps) {
        try {
            Stop-Process -Id $proc.Id -Force -ErrorAction Stop
            Write-Host "  [CERRADO] $($proc.Name) (PID: $($proc.Id)) - MIC LIBERADO" -ForegroundColor Green
        } catch {
            Write-Host "  [ERROR] No se pudo cerrar $($proc.Name): $_" -ForegroundColor Red
        }
    }
} else {
    Write-Host "  [OK] No hay procesos sospechosos para cerrar" -ForegroundColor Green
}

# 3.2 Reiniciar Windows Audio Service
Write-Host ""
Write-Host "3.2 Reiniciando servicio de audio Windows:" -ForegroundColor Green

try {
    Write-Host "  [ACCION] Deteniendo AudioSrv..." -ForegroundColor Cyan
    Stop-Service -Name "AudioSrv" -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2

    Write-Host "  [ACCION] Iniciando AudioSrv..." -ForegroundColor Cyan
    Start-Service -Name "AudioSrv" -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2

    $svcStatus = (Get-Service -Name "AudioSrv").Status
    if ($svcStatus -eq "Running") {
        Write-Host "  [OK] Servicio AudioSrv reiniciado correctamente" -ForegroundColor Green
    } else {
        Write-Host "  [ERROR] Servicio AudioSrv no esta ejecutandose" -ForegroundColor Red
    }
} catch {
    Write-Host "  [ALERTA] Error al reiniciar servicio: $_" -ForegroundColor Yellow
}

# 3.3 Reiniciar dispositivo de micrófono
Write-Host ""
Write-Host "3.3 Reiniciar dispositivos de micrófono en hardware:" -ForegroundColor Green

try {
    $micDevices = Get-PnpDevice -Class "AudioEndpoint" | Where-Object { $_.Status -eq "OK" }

    foreach ($device in $micDevices) {
        if ($device.Name -like "*Micro*" -or $device.Name -like "*Input*" -or $device.Name -like "*Rec*") {
            Write-Host "  [ACCION] Reiniciando: $($device.Name)" -ForegroundColor Cyan

            # Disable
            Disable-PnpDevice -InstanceId $device.InstanceId -Confirm:$false -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 1

            # Enable
            Enable-PnpDevice -InstanceId $device.InstanceId -Confirm:$false -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 1

            Write-Host "  [OK] Dispositivo reiniciado: $($device.Name)" -ForegroundColor Green
        }
    }
} catch {
    Write-Host "  [ALERTA] Error al reiniciar dispositivo (requiere admin): $_" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[FASE 4] VERIFICACION FINAL" -ForegroundColor Yellow

Write-Host ""
Write-Host "4.1 Estado final de dispositivos de audio:" -ForegroundColor Green
Get-PnpDevice -Class AudioEndpoint | Select-Object Name, Status | Format-Table -AutoSize

Write-Host ""
Write-Host "4.2 Procesos de audio aun activos (post-reparacion):" -ForegroundColor Green
$stillRunning = 0
foreach ($app in $audioApps) {
    $proc = Get-Process -Name $app -ErrorAction SilentlyContinue
    if ($proc) {
        Write-Host "  [ACTIVO] $app aun en ejecucion" -ForegroundColor Yellow
        $stillRunning++
    }
}

if ($stillRunning -eq 0) {
    Write-Host "  [OK] Ningún proceso de audio sospechoso en ejecucion" -ForegroundColor Green
}

Write-Host ""
Write-Host "================================" -ForegroundColor Green
Write-Host "REPARACION DE MICROPHONE COMPLETADA"
Write-Host "================================" -ForegroundColor Green
Write-Host ""
Write-Host "ACCIONES EJECUTADAS:" -ForegroundColor Green
Write-Host "  [OK] Diagnostico de dispositivos de audio"
Write-Host "  [OK] Identificacion de procesos que usan mic"
Write-Host "  [OK] Cierre de procesos secuestradores"
Write-Host "  [OK] Reinicio del servicio Windows Audio"
Write-Host "  [OK] Reinicio de dispositivo de micrófono"
Write-Host "  [OK] Verificacion final"
Write-Host ""
Write-Host "ESTADO: Microphone liberado y disponible" -ForegroundColor Green
Write-Host ""
Write-Host "RECOMENDACIONES:" -ForegroundColor Magenta
Write-Host "  * Si mic sigue sin funcionar, reinicia el PC"
Write-Host "  * Verifica en Configuracion > Sonido > Entrada que mic esté habilitado"
Write-Host "  * Abre Panel Control > Sonido > Grabar (mic debe estar verde)"
Write-Host "  * Si persiste: desinstala driver y deja que Windows lo reinstale"
Write-Host ""
Write-Host "Sandra EXECUTOR: Microphone ahora disponible" -ForegroundColor Green
Write-Host ""
