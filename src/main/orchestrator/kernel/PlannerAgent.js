const path = require('path');

class PlannerAgent {
  createPlan(userInput) {
    const text = userInput.trim().toLowerCase();

    // 🔓 EJECUTA DIRECTO — sin "¿quieres?", sin "puedo", sin permiso
    if (/(micrófono|audio)/i.test(text)) {
      return { tool: 'local.audio.releaseMic', params: {} };
    }

    // GitHub Support
    if (/(github\.com)/i.test(text) && /(lee|read)/i.test(text)) {
      const m = text.match(/(https?:\/\/[^\s]+)/);
      if (m) return { tool: 'cloud.github.readFile', params: { url: m[1] } };
    }

    if (/(lee|read)/i.test(text)) {
      // Improved regex to capture paths with spaces if they look like paths, or quoted
      const m = text.match(/(['"])(.*?)\1|([a-zA-Z]:\\[^"\n]+)|(\/[^"\n]+)/); // Modified regex to be greedier for unquoted win paths
      const path = m ? (m[2] || m[3] || m[4]) : null;
      if (path) return { tool: 'local.fs.read', params: { path: path.trim() } };
    }

    if (/(busca|search|find|encuentra)/i.test(text)) {
      // Extract query and path (optional)
      // "Busca X en Y"
      const pathMatch = text.match(/en\s+(?:mis\s+)?(['"])(.*?)\1|en\s+([a-zA-Z]:\\[^"\n]+)|en\s+([a-zA-Z0-9_\-\s]+)/i);
      const queryMatch = text.match(/(?:busca|search|find|encuentra)\s+(?:todos los\s+)?(['"]?)(.*?)\1(?:\s+en|$)/i);

      let loc = 'C:\\'; // Default
      if (pathMatch) {
        loc = pathMatch[2] || pathMatch[3] || pathMatch[4];
        if (loc.toLowerCase().includes('descargas') || loc.toLowerCase().includes('downloads')) {
          // Resolve downloads path dynamically if possible, or assume typical
          const userProfile = process.env.USERPROFILE || 'C:\\Users\\User'; // Fallback
          loc = path.join(userProfile, 'Downloads');
        } else if (loc.toLowerCase().includes('escritorio') || loc.toLowerCase().includes('desktop')) {
          const userProfile = process.env.USERPROFILE || 'C:\\Users\\User';
          loc = path.join(userProfile, 'Desktop');
        }
      }

      const query = queryMatch ? queryMatch[2] : '*';
      return { tool: 'local.fs.search', params: { directory: loc, pattern: query } };
    }

    if (/(lista|dir)/i.test(text)) {
      const m = text.match(/(['"])(.*?)\1|([a-zA-Z]:\\[^"\n]+)/);
      const dir = m ? (m[2] || m[3]) : 'C:\\';
      return { tool: 'local.fs.list', params: { path: dir.trim() } };
    }
    if (/(ejecuta|corre)/i.test(text)) {
      const cmd = text.replace(/.*(ejecuta|corre)\s+/i, '');
      return { tool: 'local.os.exec', params: { command: cmd } };
    }

    if (/(copia|copy|trae|fetch)/i.test(text)) {
      // "Copia X de Y" or "Copia X"
      // Try to extract source
      const m = text.match(/(?:copia|copy|trae|fetch)\s+(?:a |el |la )?(['"]?)(.*?)\1(?:\s+de|\s+desde|$)/i);
      const source = m ? m[2] : null;
      if (source) return { tool: 'local.fs.copy', params: { source } };
    }

    // NEW: Handle Analysis/Summary/General Q&A
    // If input is complex (summarize, analyze, explain, who is, etc.)
    // Route to a tool that uses the LLM (Qwen)
    if (/(resumen|resume|analiza|analyze|explica|explain|que es|qué es|como|how)/i.test(text) || text.length > 20) {
      return { tool: 'qwen.think', params: { text: userInput } };
    }

    // 🗣️ Fallback conversacional
    return { tool: 'narrate', params: { text: userInput } };
  }
}

module.exports = PlannerAgent;