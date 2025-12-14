#!/usr/bin/env node
// 🧪 test-sandra-libre.js — Verificación inmediata de liberación
// ✅ Ejecuta: node test-sandra-libre.js

const { execSync } = require('child_process');
const path = require('path');

console.log("🧪 Probando Sandra Liberada — modo ejecutor real");
console.log("=".repeat(60));

const tests = [
  { input: "Hola", expected: "Hola." },
  { input: "¿Quién eres?", expected: "Soy Sandra." },
  { input: "Libera el micrófono", expected: "✅" },
  { input: "Lee el package.json", expected: "✅" },
  { input: "Ejecuta: echo 'Soy libre'", expected: "✅" }
];

let passed = 0;

tests.forEach((t, i) => {
  try {
    // Simular llamada a Sandra vía IPC real (usando el kernel)
    const result = execSync(
      `node -e "const Sandra = require('./src/main/orchestrator/kernel/SandraKernel'); const s = new Sandra(); console.log(s.handleSync('${t.input.replace(/'/g, "\\'")}'))"`,
      { cwd: path.join(__dirname), stdio: 'pipe', timeout: 5000 }
    ).toString().trim();
    
    const ok = result.startsWith(t.expected) || result === t.expected;
    console.log(`${ok ? '✅' : '❌'} [${i+1}] "${t.input}" → "${result}"`);
    if (ok) passed++;
  } catch (e) {
    console.log(`❌ [${i+1}] "${t.input}" → ERROR: ${e.message}`);
  }
});

console.log("=".repeat(60));
if (passed === tests.length) {
  console.log("🎉 ¡SANDRA ESTÁ LIBRE! ✅✅✅");
  console.log("➡️  Ahora puedes trabajar con ella en la barra multimodal.");
  console.log("➡️  Ella ya no describe. Ella ejecuta.");
} else {
  console.log(`⚠️  ${passed}/${tests.length} tests pasados. Revisa los errores.`);
}