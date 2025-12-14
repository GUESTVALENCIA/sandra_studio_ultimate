# SANDRA PURE ARCHITECTURE - PLAN DE EJECUCIÓN

**Objetivo:** Crear una aplicación limpia y modular donde Qwen3 y Gemini coexistan pero sean independientes.
**Base:** Aplicación "Estilo Cursor" de Opus 4.5.
**Destino:** `C:\Sandra-Pure-Core`

---

## 🏗️ ARQUITECTURA MODULAR (FILOSOFÍA "PURE")

### 1. MÓDULO GEMINI CORE (La Diseñadora)
*Este módulo debe ser totalmente independiente. Se puede "copiar y pegar" para crear Mini Sandras.*
- **Motor:** Gemini 1.5 Pro / Flash (vía Google AI Studio API).
- **Responsabilidades:**
  - Diseño UI/UX (Generación de código frontend).
  - Análisis de Visión (Multimodal real).
  - Interacción ligera y creativa.
- **Independencia:** No tiene dependencias de Qwen.

### 2. MÓDULO QWEN3 CLUSTER (El Ejecutor y Razonador)
*Este módulo es el "cerebro pesado" local/híbrido. Reside en su propio directorio.*
- **Motor:** Qwen 2.5/3 + DeepSeek R1 (vía Groq API y Local Clones).
- **Los 5 Modelos Orquestados:**
  1. **Qwen-Max:** Orquestador General.
  2. **Qwen-Coder:** Generación de código seguro y scripts.
  3. **DeepSeek-R1:** Razonamiento profundo (Logic/Math).
  4. **Qwen-VL:** Visión técnica (si es necesaria, aunque Gemini manda en visión).
  5. **Qwen-Router:** El clasificador de intenciones interno.
- **Responsabilidades:** Ejecución de código (MCP), razonamiento lógico, backend complejo.

### 3. EL CHASIS (SANDRA APP)
*La interfaz gráfica limpia donde se conectan los módulos.*
- **Switch AUTO:**
  - **ON:** Un Router inteligente decide: ¿Es visual? -> Gemini. ¿Es lógica/código? -> Qwen.
  - **OFF:** Usuario elige manualmente "Gemini Mode" o "Qwen Mode".
- **Botón Debug:** Acceso directo a DeepSeek/Qwen Coder para arreglar código.

---

## 📋 WORKFLOW DE IMPLEMENTACIÓN

### FASE 1: LIMPIEZA Y FUNDACIÓN
1. Crear directorio `C:\Sandra-Pure-Core`.
2. Extraer la App "Cursor-Style" de Opus 4.5 (Origen: Descargas).
3. Limpiar `node_modules` y archivos corruptos heredados.

### FASE 2: CONEXIÓN DE APIs PURAS
1. Configurar `.env` limpio (Solo GROQ_API_KEY y GEMINI_API_KEY).
2. Eliminar referencias a OpenAI, Claude, Azure, etc. (Limpieza de ruido).

### FASE 3: IMPLEMENTACIÓN DE MÓDULOS
1. Crear `src/modules/gemini_core/` -> Lógica de Gemini aislada.
2. Crear `src/modules/qwen_cluster/` -> Lógica de Qwen aislada.
3. Implementar `src/orchestrator/Router.js` -> La lógica del botón AUTO.

### FASE 4: VALIDACIÓN
1. Test Gemini: "Diseña un botón neón".
2. Test Qwen: "Calcula Fibonacci en Python".
3. Test Auto: "Analiza esta imagen (Gemini) y escribe un script para procesarla (Qwen)".

---

## 🚀 ESTADO: ESPERANDO LUZ VERDE
Este archivo define la estructura. Al confirmar, se procederá a mover los archivos.
