# ✅ ACTUALIZACIÓN COMPLETA - Conexión con Render MCP Server

## 📋 Cambios Realizados

Se han actualizado todos los archivos de la aplicación de escritorio para conectarse al servidor MCP en Render en lugar de localhost.

---

## 🔧 Archivos Modificados

### 1. `src/main/orchestrator/sandra-orchestrator.js`
- ✅ **Línea 26-27**: Configuración para usar Render por defecto
- ✅ **Línea 809**: Actualizado prompt para mencionar Render
- ✅ **Línea 1027**: Mensaje de error actualizado

### 2. `src/main/main.js`
- ✅ **Línea 200**: Puerto cambiado de `3001` a `4042`
- ✅ **Línea 1093**: Puerto en spawn cambiado a `4042`
- ✅ **Línea 1138-1142**: Configuración MCP para Render
- ✅ **Línea 1160-1164**: `mcp-call-master` usa Render
- ✅ **Línea 1307**: WebSocket URL dinámica para Render

### 3. `src/main/mcp-universal-prompt.js`
- ✅ **Línea 37**: Prompt actualizado para mencionar Render

### 4. `src/renderer/components/app.js`
- ✅ **Línea 3303**: WebSocket URL dinámica que usa configuración MCP

---

## 📝 Configuración de Variables de Entorno

### Crear archivo `.env.pro` en la raíz del proyecto:

```bash
# Copiar el ejemplo
cp .env.pro.example .env.pro

# Editar con tus valores reales
```

### Variables Requeridas:

```bash
# MCP Server (Render)
MCP_SERVER_URL=https://pwa-imbf.onrender.com
MCP_PORT=4042
MCP_SECRET_KEY=sandra_mcp_ultra_secure_2025

# LLM APIs
OPENAI_API_KEY=sk-proj-...
GROQ_API_KEY=gsk_...
GEMINI_API_KEY=AIzaSy...

# Voice APIs
CARTESIA_API_KEY=...
CARTESIA_VOICE_ID=2d5b0e6cf361460aa7fc47e3cee4b30c
DEEPGRAM_API_KEY=...
```

---

## ✅ Verificación

### 1. Verificar que Render está activo:
```bash
curl https://pwa-imbf.onrender.com/health
```

### 2. Iniciar la aplicación:
```bash
npm start
# o
./INICIAR_SANDRA_ULTIMATE.bat
```

### 3. Verificar en los logs:
Buscar en la consola:
```
✅ Sandra Orchestrator inicializado
🔗 MCP Universal: https://pwa-imbf.onrender.com:4042
```

### 4. Probar conexión:
- Abrir la aplicación
- Ir a Configuración (⚙️)
- Verificar que "MCP Master (Render)" está habilitado
- Desactivar "Modo Offline"
- Probar un mensaje en el chat

---

## 🔍 Troubleshooting

### Problema: "No se puede conectar al MCP"
**Solución:**
1. Verificar que `.env.pro` existe y tiene `MCP_SERVER_URL`
2. Verificar que Render está activo: `curl https://pwa-imbf.onrender.com/health`
3. Verificar que no hay firewall bloqueando la conexión

### Problema: "Modo Offline activo"
**Solución:**
1. Verificar que todas las API keys están en `.env.pro`
2. Ir a Configuración → Proveedores y verificar que están configuradas
3. Desactivar toggle "Modo Offline"
4. Reiniciar aplicación

### Problema: "Error en WebSocket"
**Solución:**
1. Verificar que Render soporta WebSockets (debería funcionar automáticamente)
2. Verificar que la URL es `wss://` (no `ws://`) para Render
3. Verificar logs en Render dashboard

---

## 📚 Referencias

- Repositorio GitHub: https://github.com/GUESTVALENCIA/IA-SANDRA/tree/main/app-desktop-opus
- Servidor MCP Render: https://pwa-imbf.onrender.com
- Documentación completa: `CONFIGURACION_COMPLETA_SANDRA_MCP.md`

---

**Fecha de actualización:** $(date)
**Estado:** ✅ Completado

