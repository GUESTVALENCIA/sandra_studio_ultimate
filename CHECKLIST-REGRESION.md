# Checklist de Regresión - Sandra Kernel

**Fecha:** 11 Diciembre 2025  
**Objetivo:** Verificar que el nuevo Kernel no rompe funcionalidades existentes

---

## Funcionalidades Core

### Desktop App

- [ ] La app inicia correctamente
- [ ] El selector de modelos funciona
- [ ] El chat básico funciona (sin tools)
- [ ] Sandra responde cuando se selecciona como provider
- [ ] El streaming funciona (si está habilitado)
- [ ] Los mensajes se guardan en historial

### IPC Handlers

- [ ] `sandra-route` IPC handler responde
- [ ] Formato de request/response es compatible
- [ ] Fallback a Groq funciona si Kernel falla
- [ ] Handlers `mcp-local-*` siguen funcionando (para compatibilidad)

### Tools Locales

- [ ] `local.fs.list` funciona
- [ ] `local.fs.read` funciona
- [ ] `local.fs.search` funciona
- [ ] `local.os.exec` funciona (con allowlist)
- [ ] `local.audio.releaseMic` funciona
- [ ] `local.apps.find` funciona
- [ ] `local.apps.launch` funciona

### Tools Cloud

- [ ] `cloud.github.readFile` funciona
- [ ] `cloud.web.fetch` funciona
- [ ] `cloud.pwa.query` funciona
- [ ] Manejo de errores (404, timeouts) funciona

### Casos de Uso Reales

- [ ] "Lee el README del repo" → Ejecuta y muestra contenido real
- [ ] "Busca Opus en Descargas" → Ejecuta y muestra resultados reales
- [ ] "Libera el micrófono" → Ejecuta y confirma
- [ ] "Hola, ¿cómo estás?" → Conversación normal sin tools
- [ ] "Lee variables full del escritorio" → Busca y lee archivo real

---

## Regresión de Bugs Conocidos

### Bug Principal (RESUELTO)

- [x] **Sandra describe en vez de ejecutar** → RESUELTO con Kernel
- [x] **No extrae datos de MCP** → RESUELTO con normalización
- [x] **Respuestas genéricas** → RESUELTO con NarratorAgent

### Verificación

- [ ] Sandra NO dice "he leído X" sin mostrar contenido real
- [ ] Sandra NO inventa datos cuando tools fallan
- [ ] Sandra muestra outputs reales de tools ejecutadas

---

## Performance

- [ ] Latencia de tools locales < 1 segundo
- [ ] Latencia de tools cloud < 3 segundos
- [ ] Latencia de conversación < 2 segundos
- [ ] No hay memory leaks en ejecuciones múltiples

---

## Seguridad

- [ ] Allowlist de comandos funciona
- [ ] Rutas de archivos se normalizan correctamente
- [ ] No se ejecutan comandos peligrosos
- [ ] MCP Secret se valida en cloud endpoints

---

## Compatibilidad

- [ ] Render server sigue funcionando
- [ ] Health check responde
- [ ] MCP endpoints responden
- [ ] Web/widget puede usar cloud tools

---

## Logging y Debugging

- [ ] RequestId se propaga correctamente
- [ ] Logs muestran decisiones del Kernel
- [ ] Logs muestran tool results
- [ ] Errores se loguean correctamente

---

## Próximos Pasos

1. Ejecutar `node test-kernel-e2e.js`
2. Probar manualmente en la app
3. Verificar logs en consola
4. Probar casos edge (archivos no existen, comandos no permitidos, etc.)

---

**Estado:** ⏳ En progreso  
**Última actualización:** 11 Diciembre 2025

