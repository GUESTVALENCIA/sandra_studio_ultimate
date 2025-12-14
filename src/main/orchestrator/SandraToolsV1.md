# Sandra Tools v1 - Contrato de Herramientas

**Versión:** 1.0.0  
**Fecha:** 11 Diciembre 2025  
**Objetivo:** Contrato único para herramientas locales y cloud

---

## Principios de Diseño

1. **Normalización:** Todas las tools retornan el mismo formato
2. **Provenance:** Cada resultado indica dónde se ejecutó (local|render)
3. **Seguridad:** Allowlists y validación de argumentos
4. **Observabilidad:** RequestId end-to-end y logging estructurado

---

## Formato de Respuesta Normalizado

```typescript
interface ToolResult {
  ok: boolean;                    // Éxito o fallo
  tool: string;                   // Nombre de la tool ejecutada
  data: object | string;          // Datos del resultado
  stdout?: string;                // Salida estándar (si aplica)
  stderr?: string;                // Salida de error (si aplica)
  error?: string;                 // Mensaje de error (si ok=false)
  provenance: {                   // Metadatos de ejecución
    location: 'local' | 'render';
    timestamp: string;             // ISO 8601
    durationMs: number;
    requestId?: string;            // ID de request end-to-end
  };
}
```

---

## Tools Locales (Desktop Electron)

### `local.fs.list`
Lista archivos y directorios en el sistema local.

**Args:**
```json
{
  "dir": "string"  // Ruta del directorio (default: ".")
}
```

**Ejemplo:**
```json
{
  "ok": true,
  "tool": "local.fs.list",
  "data": {
    "files": [
      { "name": "app.js", "type": "file", "size": 1234 },
      { "name": "src", "type": "directory" }
    ],
    "count": 2,
    "directory": "C:\\Users\\clayt\\Downloads"
  },
  "provenance": {
    "location": "local",
    "timestamp": "2025-12-11T20:00:00Z",
    "durationMs": 45
  }
}
```

### `local.fs.read`
Lee el contenido de un archivo local.

**Args:**
```json
{
  "path": "string"  // Ruta absoluta o relativa al workspace
}
```

**Ejemplo:**
```json
{
  "ok": true,
  "tool": "local.fs.read",
  "data": "# README\n\nContenido del archivo...",
  "provenance": {
    "location": "local",
    "timestamp": "2025-12-11T20:00:00Z",
    "durationMs": 12
  }
}
```

### `local.fs.search`
Busca archivos por nombre o patrón.

**Args:**
```json
{
  "dir": "string",      // Directorio base de búsqueda
  "pattern": "string"   // Patrón de búsqueda (glob o regex)
}
```

### `local.os.exec`
Ejecuta un comando del sistema operativo.

**Args:**
```json
{
  "command": "string",     // Comando a ejecutar
  "cwd": "string?",        // Directorio de trabajo (opcional)
  "timeoutMs": "number?"   // Timeout en ms (default: 10000)
}
```

**Seguridad:**
- Allowlist de comandos permitidos
- Confirmación para comandos destructivos
- Sanitización de argumentos

**Ejemplo:**
```json
{
  "ok": true,
  "tool": "local.os.exec",
  "data": "Archivo encontrado: opus.exe",
  "stdout": "Archivo encontrado: opus.exe\n",
  "stderr": "",
  "provenance": {
    "location": "local",
    "timestamp": "2025-12-11T20:00:00Z",
    "durationMs": 234
  }
}
```

### `local.audio.releaseMic`
Libera el micrófono del sistema.

**Args:**
```json
{}
```

**Implementación segura:**
- No usar `taskkill` a ciegas
- Identificar procesos que bloquean el micrófono
- Liberar recursos de forma controlada

### `local.apps.find`
Busca aplicaciones instaladas.

**Args:**
```json
{
  "name": "string"  // Nombre de la aplicación
}
```

### `local.apps.launch`
Lanza una aplicación.

**Args:**
```json
{
  "path": "string"  // Ruta al ejecutable
}
```

---

## Tools Cloud (Render)

### `cloud.github.readFile`
Lee un archivo de un repositorio de GitHub.

**Args:**
```json
{
  "owner": "string",   // Usuario/organización
  "repo": "string",    // Nombre del repo
  "ref": "string?",    // Branch/tag/commit (default: "main")
  "path": "string"     // Ruta del archivo en el repo
}
```

**Ejemplo:**
```json
{
  "ok": true,
  "tool": "cloud.github.readFile",
  "data": "# README\n\nContenido del README...",
  "provenance": {
    "location": "render",
    "timestamp": "2025-12-11T20:00:00Z",
    "durationMs": 567
  }
}
```

### `cloud.web.fetch`
Hace una petición HTTP a una URL.

**Args:**
```json
{
  "url": "string",           // URL a obtener
  "method": "string?",        // Método HTTP (default: "GET")
  "headers": "object?",       // Headers HTTP
  "body": "object|string?"    // Cuerpo de la petición
}
```

### `cloud.render.logs`
Obtiene logs de un servicio en Render.

**Args:**
```json
{
  "serviceId": "string",
  "level": "string?",        // "info" | "error" | "debug"
  "limit": "number?",        // Número de líneas
  "startTime": "string?"     // ISO 8601
}
```

### `cloud.pwa.query`
Consulta un endpoint del PWA en Render.

**Args:**
```json
{
  "endpoint": "string",       // Ruta del endpoint
  "body": "object?"           // Cuerpo de la petición
}
```

---

## Política Local vs Cloud

### Se ejecuta LOCAL si:
- Acceso a archivos del sistema (Descargas, Escritorio, etc.)
- Ejecución de comandos del sistema operativo
- Control de hardware (micrófono, apps)
- Operaciones que requieren permisos del sistema

### Se ejecuta CLOUD si:
- Acceso a APIs externas (GitHub, web scraping)
- Operaciones que requieren infraestructura cloud
- Consultas a servicios remotos (Render, APIs públicas)
- Operaciones que no requieren acceso local

### Decisión automática:
El `ToolRouter` decide basándose en el prefijo de la tool:
- `local.*` → Ejecuta en Desktop (IPC handlers)
- `cloud.*` → Ejecuta en Render (HTTP API)

---

## Manejo de Errores

**Formato de error:**
```json
{
  "ok": false,
  "tool": "local.fs.read",
  "error": "File not found: C:\\Users\\clayt\\Downloads\\file.txt",
  "provenance": {
    "location": "local",
    "timestamp": "2025-12-11T20:00:00Z",
    "durationMs": 5
  }
}
```

**Reglas:**
- Nunca inventar datos si hay error
- Mensajes de error descriptivos y útiles
- Logging estructurado para debugging

---

## Observabilidad

**RequestId end-to-end:**
- Generado en el renderer
- Propagado a través de IPC → Kernel → Router → Tools
- Incluido en todos los logs y respuestas

**Logging estructurado:**
```json
{
  "requestId": "req-1234567890",
  "intent": "read_file",
  "chosenTools": ["local.fs.read"],
  "localVsCloud": "local",
  "toolResults": [
    {
      "tool": "local.fs.read",
      "ok": true,
      "durationMs": 12
    }
  ]
}
```

