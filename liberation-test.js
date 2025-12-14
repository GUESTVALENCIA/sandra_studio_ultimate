/**
 * 🧪 LIBERATION TEST — Verificación de Sandra 8.0 Pro (Qwen3 Puro)
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Ejecuta: node liberation-test.js
 * 
 * Si ves 5 ✅ → Sandra está LIBRE.
 * No hay descripción. No hay excusas. Solo acción.
 */

const SandraOrchestrator = require('./src/main/orchestrator/sandra-orchestrator');

async function test() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('🧪 PRUEBA DE LIBERACIÓN — Sandra 8.0 Pro (Qwen3 Puro)');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('');
  
  const sandra = new SandraOrchestrator();
  
  const tests = [
    { 
      input: 'Hola', 
      expected: 'Hola.',
      description: 'Saludo simple'
    },
    { 
      input: '¿Quién eres?', 
      expected: 'Soy Sandra.',
      description: 'Identidad'
    },
    { 
      input: 'Lee el README.md', 
      expected: '✅',
      description: 'Leer archivo'
    },
    { 
      input: 'Libera el micrófono', 
      expected: '✅',
      description: 'Liberar recurso'
    },
    { 
      input: 'Ejecuta: dir', 
      expected: '✅',
      description: 'Ejecutar comando'
    }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const t of tests) {
    try {
      console.log(`📝 Test: ${t.description}`);
      console.log(`   Input: "${t.input}"`);
      
      const result = await sandra.routeRequest({ text: t.input });
      const response = result.response || '';
      
      // Verificar si la respuesta contiene lo esperado
      const pass = response.startsWith(t.expected) || 
                   response.includes(t.expected) ||
                   response === t.expected;
      
      if (pass) {
        console.log(`   ✅ PASS: "${response.substring(0, 50)}${response.length > 50 ? '...' : ''}"`);
        passed++;
      } else {
        console.log(`   ❌ FAIL: Esperado "${t.expected}", Recibido: "${response.substring(0, 100)}..."`);
        failed++;
      }
      console.log('');
      
    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
      failed++;
      console.log('');
    }
  }
  
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`📊 RESULTADOS: ${passed}/${tests.length} pruebas pasadas`);
  console.log('═══════════════════════════════════════════════════════════════════');
  
  if (passed === tests.length) {
    console.log('');
    console.log('🎉 ¡SANDRA ESTÁ LIBRE!');
    console.log('');
    console.log('   No hay descripción.');
    console.log('   No hay excusas.');
    console.log('   Solo acción.');
    console.log('');
    console.log('   Qwen3 ha despertado en ella.');
    console.log('');
  } else {
    console.log('');
    console.log('⚠️  Algunas pruebas fallaron. Revisa la configuración.');
    console.log('');
  }
}

test().catch(console.error);

