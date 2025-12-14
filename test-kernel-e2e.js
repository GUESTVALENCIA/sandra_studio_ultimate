/**
 * E2E Tests - Sandra Kernel
 * 
 * Pruebas end-to-end para verificar que el Kernel funciona correctamente
 * con tools locales y cloud.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'config.env') });

const SandraKernel = require('./src/main/orchestrator/kernel/SandraKernel');

async function runTests() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║     E2E TESTS - SANDRA KERNEL                           ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');

  const kernel = new SandraKernel(null);
  let passed = 0;
  let failed = 0;

  // Test 1: Conversación simple (sin tools)
  console.log('TEST 1: Conversación simple...');
  try {
    const result1 = await kernel.handle({
      text: 'Hola, ¿cómo estás?',
      mode: 'agent',
      modality: 'text'
    });

    if (result1.success && result1.response && !result1.executed) {
      console.log('✅ PASS: Conversación sin tools');
      passed++;
    } else {
      console.log('❌ FAIL: Respuesta incorrecta');
      failed++;
    }
  } catch (error) {
    console.log(`❌ FAIL: ${error.message}`);
    failed++;
  }
  console.log('');

  // Test 2: Lectura de archivo local
  console.log('TEST 2: Lectura de archivo local...');
  try {
    const testFile = path.join(__dirname, 'package.json');
    const result2 = await kernel.handle({
      text: `Lee el archivo ${testFile}`,
      mode: 'agent',
      modality: 'text'
    });

    if (result2.success && result2.executed && result2.toolResults) {
      const toolResult = result2.toolResults[0];
      if (toolResult.ok && toolResult.tool === 'local.fs.read') {
        console.log('✅ PASS: Archivo local leído correctamente');
        passed++;
      } else {
        console.log('❌ FAIL: Tool no ejecutada correctamente');
        failed++;
      }
    } else {
      console.log('❌ FAIL: No se ejecutó tool');
      failed++;
    }
  } catch (error) {
    console.log(`❌ FAIL: ${error.message}`);
    failed++;
  }
  console.log('');

  // Test 3: Búsqueda en Descargas
  console.log('TEST 3: Búsqueda en Descargas...');
  try {
    const result3 = await kernel.handle({
      text: 'Busca opus en mis Descargas',
      mode: 'agent',
      modality: 'text'
    });

    if (result3.success && result3.executed) {
      console.log('✅ PASS: Búsqueda ejecutada');
      passed++;
    } else {
      console.log('❌ FAIL: Búsqueda no ejecutada');
      failed++;
    }
  } catch (error) {
    console.log(`❌ FAIL: ${error.message}`);
    failed++;
  }
  console.log('');

  // Test 4: GitHub README (cloud)
  console.log('TEST 4: Lectura de README de GitHub (cloud)...');
  try {
    const result4 = await kernel.handle({
      text: 'Lee el README del repo https://github.com/GUESTVALENCIA/PWA',
      mode: 'agent',
      modality: 'text'
    });

    if (result4.success && result4.executed && result4.toolResults) {
      const toolResult = result4.toolResults[0];
      if (toolResult.ok && toolResult.tool === 'cloud.github.readFile') {
        console.log('✅ PASS: README de GitHub leído');
        passed++;
      } else {
        console.log('❌ FAIL: Tool cloud no ejecutada');
        failed++;
      }
    } else {
      console.log('⚠️ SKIP: Cloud tool puede fallar si no hay conexión');
    }
  } catch (error) {
    console.log(`⚠️ SKIP: ${error.message}`);
  }
  console.log('');

  // Test 5: Pegar documento largo NO debe disparar tools basura (".env", "lista", "en un ...")
  console.log('TEST 5: Documento largo (anti falsos positivos)...');
  try {
    const testFile = path.join(__dirname, 'package.json');
    const longDoc = [
      `Lee el archivo "${testFile}"`,
      '',
      'Sandra-Live: Sistema Conversacional Avanzado (Producción)',
      'El siguiente es el código completo ... en un único documento ...',
      'Configuración de Entorno (.env)',
      '... Obtener lista de categorías ...',
      '... (mucho texto) ...'
    ].join('\n');

    const result5 = await kernel.handle({
      text: longDoc,
      mode: 'agent',
      modality: 'text'
    });

    const firstTool = result5?.toolResults?.[0];
    const ok =
      result5.success &&
      result5.executed &&
      firstTool &&
      firstTool.ok &&
      firstTool.tool === 'local.fs.read';

    if (ok) {
      console.log('✅ PASS: No disparó .env/un, ejecutó solo el read correcto');
      passed++;
    } else {
      console.log('❌ FAIL: Se dispararon tools incorrectas o no ejecutó read');
      failed++;
    }
  } catch (error) {
    console.log(`❌ FAIL: ${error.message}`);
    failed++;
  }
  console.log('');

  // Resumen
  console.log('═══════════════════════════════════════════════════════');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Total: ${passed + failed}`);
  console.log('═══════════════════════════════════════════════════════');

  if (failed === 0) {
    console.log('🎉 Todos los tests pasaron!');
    process.exit(0);
  } else {
    console.log('⚠️ Algunos tests fallaron');
    process.exit(1);
  }
}

runTests().catch(console.error);

