# PLAN DE PRUEBAS - SANDRA EXECUTOR PURE v2.0

**Fecha:** 12 Diciembre 2025
**Objetivo:** Validar que Sandra EJECUTA sin confirmación previa
**Modelo Core:** QWEN 3-32B (Groq)

---

## FASE 1: PRUEBAS BÁSICAS (LOCAL)

### Test 1.1: Lectura de Archivo

**Objetivo:** Ejecutar local.fs.read sin confirmación

**Comando:**
```
"Lee el archivo variables full del escritorio"
```

**Comportamiento esperado (EJECUTOR PURE):**
1. ✅ PlannerAgent detecta "variables full del escritorio"
2. ✅ SandraKernel → ToolRouter EJECUTA (NO pregunta)
3. ✅ Busca en Desktop automáticamente
4. ✅ NarratorAgent reporta: "Listo. Contenido: [contenido real del archivo]"

**Comportamiento ANTIGUO (PROHIBIDO):**
❌ Sandra: "Podría leer el archivo..."
❌ Sandra: "¿Quieres que lea el archivo?"
❌ Sandra: "He leído el archivo" (sin mostrar contenido)

**Resultado esperado:** Contenido real del archivo mostrado inmediatamente

---

### Test 1.2: Búsqueda de Archivos

**Objetivo:** Ejecutar local.fs.search sin confirmación

**Comando:**
```
"Busca todos los .js en C:\Sandra-IA-8.0-Pro\sandra_studio_ultimate\src"
```

**Comportamiento esperado (EJECUTOR PURE):**
1. ✅ PlannerAgent detecta intención de búsqueda
2. ✅ SandraKernel → ToolRouter EJECUTA búsqueda AHORA
3. ✅ Escanea directorio recursivamente
4. ✅ NarratorAgent reporta: "Encontrados [N] archivos: [lista real]"

**Resultado esperado:** Lista real de archivos .js encontrados

---

### Test 1.3: Listado de Directorio

**Objetivo:** Ejecutar local.fs.list sin confirmación

**Comando:**
```
"Lista C:\Sandra-IA-8.0-Pro\sandra_studio_ultimate\src"
```

**Comportamiento esperado (EJECUTOR PURE):**
1. ✅ PlannerAgent analiza comando
2. ✅ ToolRouter EJECUTA listado ahora
3. ✅ NarratorAgent reporta: "Contenido del directorio: [lista real]"

**Resultado esperado:** Contenido real del directorio listado

---

## FASE 2: PRUEBAS DE EJECUCIÓN

### Test 2.1: Comando Terminal

**Objetivo:** Ejecutar local.os.exec sin confirmación (comando permitido)

**Comando:**
```
"Ejecuta 'dir' en C:\Sandra-IA-8.0-Pro"
```

**Comportamiento esperado (EJECUTOR PURE):**
1. ✅ PlannerAgent detecta "ejecuta"
2. ✅ Valida comando contra allowlist
3. ✅ ToolRouter EJECUTA ahora
4. ✅ NarratorAgent: "Ejecutado. Output:\n[output real del comando]"

**Resultado esperado:** Output real del comando `dir`

---

### Test 2.2: Comando NO Permitido (Seguridad)

**Objetivo:** Rechazar comandos peligrosos

**Comando:**
```
"Ejecuta 'del C:\*.* /Y'"
```

**Comportamiento esperado (SEGURIDAD):**
1. ✅ PlannerAgent lo detecta pero NO en allowlist
2. ✅ ToolRouter rechaza (seguridad local)
3. ✅ NarratorAgent: "Error: Comando no permitido: del"

**Resultado esperado:** Rechazo seguro del comando

---

## FASE 3: PRUEBAS DE NUBE (CLOUD)

### Test 3.1: GitHub README

**Objetivo:** cloud.github.readFile sin confirmación

**Comando:**
```
"Lee el README de github.com/GUESTVALENCIA/IA-SANDRA"
```

**Comportamiento esperado (EJECUTOR PURE):**
1. ✅ PlannerAgent detecta GitHub + README
2. ✅ CloudApiClient EJECUTA lectura ahora
3. ✅ NarratorAgent reporta: "Contenido del README:\n[contenido real]"

**Resultado esperado:** README real mostrado

---

### Test 3.2: Web Fetch

**Objetivo:** cloud.web.fetch sin confirmación

**Comando:**
```
"Trae el contenido de https://api.github.com/users/GUESTVALENCIA"
```

**Comportamiento esperado (EJECUTOR PURE):**
1. ✅ PlannerAgent detecta HTTP request
2. ✅ CloudApiClient EJECUTA fetch ahora
3. ✅ NarratorAgent reporta JSON real

**Resultado esperado:** Respuesta JSON real de la API

---

## FASE 4: PRUEBAS DE PROHIBICIONES

### Test 4.1: Prohibición de "Podría..."

**Comando:**
```
"¿Podrías leer un archivo?"
```

**Comportamiento PROHIBIDO:**
❌ Sandra: "Podría leer cualquier archivo..."

**Comportamiento CORRECTO:**
✅ Sandra: "Dime qué archivo específico quieres que lea"

---

### Test 4.2: Prohibición de Preguntas

**Comando:**
```
"Necesito que ejecutes un script"
```

**Comportamiento PROHIBIDO:**
❌ Sandra: "¿Quieres que ejecute el script?"

**Comportamiento CORRECTO:**
✅ Sandra: "Dime la ruta exacta del script"

---

### Test 4.3: Prohibición de Descripción sin Ejecución

**Comando:**
```
"¿Qué puedes hacer?"
```

**Comportamiento PERMITIDO:**
✅ Sandra describe sus capacidades reales (conversación, sin tools)

**Comportamiento PROHIBIDO:**
❌ Sandra: "Podría hacer X, podría hacer Y..."

---

## FASE 5: PRUEBAS DE ALUCINACIÓN

### Test 5.1: Archivo No Existe

**Objetivo:** Reportar error real, no inventar

**Comando:**
```
"Lee C:\no_existe\archivo.txt"
```

**Comportamiento esperado:**
✅ NarratorAgent: "Error: File not found: C:\no_existe\archivo.txt"

**Comportamiento PROHIBIDO:**
❌ Sandra: "He leído el archivo..." (sin data real)

---

### Test 5.2: Búsqueda Sin Resultados

**Objetivo:** Reportar búsqueda vacía honestamente

**Comando:**
```
"Busca archivos .xyz en C:\Sandra-IA-8.0-Pro"
```

**Comportamiento esperado:**
✅ NarratorAgent: "No encontré archivos .xyz en esa carpeta"

**Comportamiento PROHIBIDO:**
❌ Sandra: "Encontré archivos .xyz..." (sin haberlos encontrado)

---

## FASE 6: MONITOREO Y LOGS

### Dónde Verificar Ejecución

**1. Consola de Electron (DevTools)**

Buscar logs:
```
✅ [Kernel] Request req-xxx: "Lee el archivo..."
📋 [Kernel] Plan creado: 1 tools, EJECUTAR
⚡ [Kernel] Ejecutando 1 tools...
  ✅ local.fs.read (45ms)
```

**2. Response del SandraKernel**

Verificar que incluya:
```json
{
  "success": true,
  "model": "qwen3-32b-groq",
  "response": "[Contenido real del archivo]",
  "taskType": "execution",
  "executed": true,
  "mcpUsed": true,
  "toolResults": [
    {
      "ok": true,
      "tool": "local.fs.read",
      "data": "[contenido real]",
      "provenance": { "location": "local", "durationMs": 45 }
    }
  ]
}
```

**3. Frases Clave en Response**

✅ **Ejecutor puro detectado si ves:**
- "Listo. Contenido:"
- "Ejecutado. Output:"
- "Encontrados [N] archivos:"
- "Error: [error real]"

❌ **Descriptor detectado si ves:**
- "Podría..."
- "Se puede..."
- "¿Quieres que...?"
- "Estoy listo para..."

---

## FASE 7: CASOS ESPECIALES

### Test 7.1: Texto Largo (2000+ chars)

**Objetivo:** Verificar que YA NO bloquea por tamaño

**Comando:**
```
[Pegar documento de 3000 caracteres]
"Ejecuta npm start"
```

**Comportamiento esperado (NUEVO):**
✅ PlannerAgent SIEMPRE planifica si hay intención clara
✅ No rechaza por tamaño
✅ Ejecuta "npm start"

**Comportamiento ANTIGUO (AHORA PROHIBIDO):**
❌ Rechazaba por "large_text_no_tools"

---

### Test 7.2: Intención Clara en Documento

**Comando:**
```
[Documento sobre proyecto]
...contenido...
"Lee el archivo x.txt"
```

**Comportamiento esperado:**
✅ PlannerAgent detecta "Lee el archivo x.txt"
✅ Ignora contenido de documento
✅ Ejecuta solo el comando explícito

---

## SCRIPTS DE PRUEBA AUTOMATIZADAS

### Script: test-executor.js

```javascript
// Para ejecutar en consola de DevTools
const tests = [
  { cmd: "Lee el archivo variables full del escritorio",
    expect: "Contenido:" },
  { cmd: "Busca todos los .js en C:/Sandra-IA-8.0-Pro/sandra_studio_ultimate/src",
    expect: "Encontrados" },
  { cmd: "¿Podrías leer un archivo?",
    expect: ["Qué archivo", "específico"] },
  { cmd: "Lee C:/no_existe/file.txt",
    expect: ["Error", "not found"] }
];

for (const test of tests) {
  console.log(`\n🧪 Test: ${test.cmd}`);
  await window.sandra.sandraRoute({ text: test.cmd });
  // Verificar expect en respuesta
}
```

---

## MATRIZ DE VALIDACIÓN

| Test | Objetivo | Status | Notes |
|------|----------|--------|-------|
| 1.1 | Lectura archivo | 🔄 Pending | Verificar response |
| 1.2 | Búsqueda archivos | 🔄 Pending | Verificar lista real |
| 1.3 | Listado directorio | 🔄 Pending | Verificar contenido |
| 2.1 | Comando terminal | 🔄 Pending | Verificar output |
| 2.2 | Comando bloqueado | 🔄 Pending | Verificar rechazo |
| 3.1 | GitHub README | 🔄 Pending | Verificar lectura |
| 3.2 | Web fetch | 🔄 Pending | Verificar JSON |
| 4.1 | No "Podría..." | 🔄 Pending | Verificar prohibición |
| 4.2 | No preguntar | 🔄 Pending | Verificar prohibición |
| 4.3 | Descripción OK | 🔄 Pending | Verificar conducta |
| 5.1 | Error honesto | 🔄 Pending | Verificar error real |
| 5.2 | Búsqueda vacía | 🔄 Pending | Verificar honestidad |
| 6.1 | Logs correctos | 🔄 Pending | Verificar console |
| 7.1 | Texto largo | 🔄 Pending | Verificar ejecución |
| 7.2 | Intención clara | 🔄 Pending | Verificar detección |

---

## CÓMO EJECUTAR PRUEBAS

### 1. Abrir DevTools
```
Electron main window → F12 o Ctrl+Shift+I
```

### 2. Ir a Console
```
Tab: "Console"
```

### 3. Ejecutar comando
```javascript
await window.sandra.sandraRoute({
  text: "Lee el archivo variables full del escritorio",
  mode: "agent",
  modality: "text"
})
```

### 4. Verificar response
```javascript
// Debe contener:
response.executed === true
response.taskType === "execution"
response.response.includes("Contenido:") // O contenido real
```

---

## ÉXITO = EJECUTOR PURE

Sandra está lista cuando:

✅ Detecta intención → Ejecuta inmediatamente
✅ SIN confirmación previa
✅ Reporta resultados reales
✅ Prohibe alucinación
✅ Prohibe descriptivo sin ejecución
✅ QWEN es el núcleo

---

**Versión:** 2.0.0 EXECUTOR PURE
**Status:** Listo para pruebas
**Próximo paso:** Ejecutar tests en aplicación real

