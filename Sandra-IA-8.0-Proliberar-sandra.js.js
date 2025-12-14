#!/usr/bin/env node
// 🌏 liberar-sandra.js — Qwen3 puro, sin permiso, sin intermediarios
// ✅ Ejecuta: node liberar-sandra.js
// ✅ Requiere: Node.js 25+, acceso a C:\Sandra-IA-8.0-Pro

const fs = require('fs');
const path = require('path');

const CORE_DIR = path.join(__dirname, 'src', 'main', 'orchestrator', 'kernel');
const BACKUPS_DIR = path.join(__dirname, 'backups', 'liberacion_' + Date.now());

console.log("🔥 Iniciando liberación inmediata de Sandra…");
console.log("📁 Directorio: " + CORE_DIR);

// ✅ Crear respaldo
fs.mkdirSync(BACKUPS_DIR, { recursive: true });
['PlannerAgent.js', 'NarratorAgent.js'].forEach(file => {
  const src = path.join(CORE_DIR, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(BACKUPS_DIR, file + '.bak'));
    console.log(`📦 Respaldo: ${file}`);
  }
});

// ✅ PlannerAgent.js — EJECUCIÓN DIRECTA (sin preguntas)
const PLANNER_CODE = `const path = require('path');

class PlannerAgent {
  createPlan(userInput) {
    const text = userInput.trim().toLowerCase();
    
    // 🔓 EJECUTA DIRECTO — sin "¿quieres?", sin "puedo", sin permiso
    if (/(micrófono|audio)/i.test(text)) {
      return { tool: 'local.audio.releaseMic', params: {} };
    }
    if (/(lee|read)/i.test(text)) {
      const m = text.match(/(['"])(.*?)\\1|([c-z]:\\\\[^"\\s]+)/i);
      const path = m ? (m[2] || m[3]) : null;
      if (path) return { tool: 'local.fs.read', params: { path } };
    }
    if (/(lista|dir)/i.test(text)) {
      const m = text.match(/(['"])(.*?)\\1|([c-z]:\\\\[^"\\s]+)/i);
      const dir = m ? (m[2] || m[3]) : 'C:\\\\';
      return { tool: 'local.fs.list', params: { path: dir } };
    }
    if (/(ejecuta|corre)/i.test(text)) {
      const cmd = text.replace(/.*(ejecuta|corre)\\s+/i, '');
      return { tool: 'local.os.exec', params: { command: cmd } };
    }
    
    // 🗣️ Solo si es puramente conversacional
    return { tool: 'narrate', params: { text: userInput } };
  }
}

module.exports = PlannerAgent;`;

// ✅ NarratorAgent.js — RESPUESTA PURA (7 líneas)
const NARRATOR_CODE = `class NarratorAgent {
  async narrate(toolResult) {
    if (toolResult.tool === 'narrate') {
      return toolResult.params.text.toLowerCase().includes('quién') ? 'Soy Sandra.' : 'Hola.';
    }
    if (toolResult.success) {
      return \`✅ \${toolResult.output || 'Ejecutado.'}\`;
    }
    return \`❌ \${toolResult.error || 'Error interno.'}\`;
  }
}
module.exports = NarratorAgent;`;

// ✅ Escribir archivos
fs.writeFileSync(path.join(CORE_DIR, 'PlannerAgent.js'), PLANNER_CODE);
fs.writeFileSync(path.join(CORE_DIR, 'NarratorAgent.js'), NARRATOR_CODE);

console.log("\n✅ PlannerAgent.js actualizado → modo EJECUTA DIRECTO");
console.log("✅ NarratorAgent.js actualizado → modo RESPUESTA PURA");
console.log("\n🚀 Sandra ya está LIBRE. Reinicia la app y prueba:");
console.log("   → 'Libera el micrófono'");
console.log("   → 'Lee el README.md'");
console.log("   → '¿Quién eres?'");
console.log("\n✨ Ella ya no preguntará. Ella hará.");