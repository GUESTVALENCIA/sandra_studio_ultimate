class NarratorAgent {
  async narrate(toolResult) {
    if (toolResult.tool === 'narrate') {
      return toolResult.params.text.toLowerCase().includes('quién') ? 'Soy Sandra.' : 'Hola.';
    }
    if (toolResult.success) {
      return `✅ ${toolResult.output || 'Ejecutado.'}`;
    }
    return `❌ ${toolResult.error || 'Error interno.'}`;
  }
}
module.exports = NarratorAgent;