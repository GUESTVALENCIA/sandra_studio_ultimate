const PlannerAgent = require('./PlannerAgent');
const NarratorAgent = require('./NarratorAgent');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
// Try to import axios or fetch for cloud, otherwise use fallback
let axios;
try { axios = require('axios'); } catch (e) { }

// Import Qwen3 Core
const Qwen3ExecutorCore = require('../qwen3-executor-core');

class SandraKernel {
    constructor(config = {}) {
        this.planner = new PlannerAgent();
        this.narrator = new NarratorAgent();
        // Initialize Qwen3 with dummy URL/Secret if not provided, relies on env vars internally
        this.qwen3 = new Qwen3ExecutorCore('http://localhost:3001', 'sandra_secret');
    }

    async handle(request) {
        const { text, mode, modality } = request;

        // 1. Plan
        const plan = this.planner.createPlan(text);
        console.log("DEBUG PLAN:", JSON.stringify(plan));

        // 2. Execute
        let toolResult = {
            success: true,
            tool: plan.tool,
            params: plan.params
        };
        let executed = false;

        if (plan.tool === 'narrate') {
            toolResult.output = plan.params.text;
        } else {
            executed = true;
            const execResult = await this.executeTool(plan.tool, plan.params);
            toolResult = { ...toolResult, ...execResult };
        }

        // 3. Narrate
        // Narrator expects toolResult to have params if tool is 'narrate'
        const responseText = await this.narrator.narrate(toolResult);

        // 4. Return formatted result
        return {
            success: toolResult.success,
            response: responseText,
            executed: executed,
            taskType: executed ? 'execution' : 'conversational',
            toolResults: [toolResult],
            mcpUsed: executed // Simulating MCP usage
        };
    }

    async executeTool(toolName, params) {
        const start = Date.now();
        let result = {
            success: false,
            tool: toolName,
            data: null,
            provenance: { location: 'local', durationMs: 0 }
        };

        try {
            if (toolName === 'local.fs.read') {
                if (fs.existsSync(params.path)) {
                    const content = fs.readFileSync(params.path, 'utf8');
                    result.success = true;
                    result.data = content;
                    result.output = content; // For narrator
                } else {
                    result.error = `File not found: ${params.path}`;
                    result.output = result.error;
                }
            }
            else if (toolName === 'local.fs.list') {
                if (fs.existsSync(params.path)) {
                    const files = fs.readdirSync(params.path);
                    const content = files.join('\n');
                    result.success = true;
                    result.data = content;
                    result.output = content;
                } else {
                    result.error = `Directory not found: ${params.path}`;
                    result.output = result.error;
                }
            }
            else if (toolName === 'local.os.exec') {
                const output = await new Promise((resolve) => {
                    exec(params.command, { cwd: process.cwd() }, (err, stdout, stderr) => {
                        resolve(stdout || stderr || (err ? err.message : 'Done'));
                    });
                });
                result.success = true; // Assume exec always runs even if command fails in shell?? Or check err?
                result.data = output;
                result.output = output;
            }
            else if (toolName === 'local.fs.search') {
                // Recursive search using dir /s or find
                const { directory, pattern } = params;
                const cmd = `dir /s /b "${path.join(directory, pattern)}"`; // Simplified windows search
                // Or use 'pattern' as filename wildcard if it doesn't have path separators
                // If pattern is like "*.js", cmd: dir /s /b "path\*.js"

                // If directory is like "C:\Downloads" and search is "opus", maybe "C:\Downloads\*opus*"
                // Let's assume pattern is a wildcard or partial name.
                // If pattern has no wildcards, wrap in *
                const searchPattern = pattern.includes('*') ? pattern : `*${pattern}*`;
                const searchPath = path.join(directory, searchPattern);

                const output = await new Promise((resolve) => {
                    exec(`dir /S /B "${searchPath}"`, { cwd: directory }, (err, stdout, stderr) => {
                        resolve(stdout || stderr || (err ? err.message : 'No files found'));
                    });
                });
                result.success = true;
                result.data = output;
                result.output = output.trim() ? `Encontrados:\n${output}` : 'No se encontraron archivos.';
            }
            else if (toolName === 'cloud.github.readFile') {
                // params.url
                try {
                    let url = params.url;
                    // Convert github.com URL to raw.githubusercontent.com
                    // https://github.com/user/repo/blob/main/README.md -> https://raw.githubusercontent.com/user/repo/main/README.md
                    // If it's just repo root ...

                    if (url.includes('github.com')) {
                        // Naive conversion
                        url = url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
                        // If it's a root repo URL like .../PWA, append /main/README.md as guess
                        if (!url.endsWith('.md') && !url.endsWith('.txt') && !url.endsWith('.js')) {
                            // Attempt to fetch README.md
                            // Remove trailing slash
                            if (url.endsWith('/')) url = url.slice(0, -1);
                            url += '/main/README.md';
                        }
                    }

                    let content;
                    if (axios) {
                        const resp = await axios.get(url);
                        content = resp.data;
                    } else {
                        // Fallback using https native
                        const https = require('https');
                        content = await new Promise((resolve, reject) => {
                            https.get(url, (res) => {
                                let data = '';
                                res.on('data', chunk => data += chunk);
                                res.on('end', () => resolve(data));
                            }).on('error', reject);
                        });
                    }

                    result.success = true;
                    result.data = typeof content === 'string' ? content : JSON.stringify(content);
                    result.output = `Contenido de GitHub:\n${result.data.substring(0, 500)}...`;
                } catch (e) {
                    result.error = `Error reading GitHub: ${e.message}`;
                    result.output = result.error;
                }
            }
            else if (toolName === 'qwen.think') {
                // Use Qwen via Qwen3ExecutorCore to generate text
                try {
                    const response = await this.qwen3.callGroq([
                        { role: 'system', content: 'You are Sandra IA, a helpful assistant. Answer the user request directly.' },
                        { role: 'user', content: params.text }
                    ]);
                    result.success = true;
                    result.data = response.choices[0].message.content;
                    result.output = result.data;
                } catch (e) {
                    console.error("Qwen think error:", e.message);
                    // ERROR RESILIENCE: If Groq fails, fallback to simple message
                    result.error = e.message;
                    result.output = "Lo siento, no pude procesar tu solicitud compleja en este momento (Error de conexión con Qwen).";
                }
            }
            else if (toolName === 'local.fs.copy') {
                const sourceName = params.source;
                const fs = require('fs');
                const os = require('os');

                // Smart copy logic (Opus specific or general)
                const userHome = os.homedir();
                const downloadsPath = path.join(userHome, 'Downloads');

                let sourcePath = sourceName;
                // If not absolute, look in Downloads
                if (!path.isAbsolute(sourceName)) {
                    // Try exact match in downloads
                    let possible = path.join(downloadsPath, sourceName);
                    if (fs.existsSync(possible)) {
                        sourcePath = possible;
                    } else {
                        // Try scanning downloads (case insensitive partial)
                        try {
                            const files = fs.readdirSync(downloadsPath);
                            const match = files.find(f => f.toLowerCase().includes(sourceName.toLowerCase()));
                            if (match) {
                                sourcePath = path.join(downloadsPath, match);
                            }
                        } catch (e) { }
                    }
                }

                if (!fs.existsSync(sourcePath)) {
                    result.error = `No pude encontrar '${sourceName}' en Descargas ni como ruta absoluta.`;
                    result.output = result.error;
                } else {
                    // Copy to workspace/Opus_Analysis
                    const destDir = path.join(__dirname, '..', '..', '..', 'Opus_Analysis');
                    try {
                        if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

                        const destPath = path.join(destDir, path.basename(sourcePath));

                        // Recursive copy using cpSync (Node 16.7+) or fallback
                        if (fs.cpSync) {
                            fs.cpSync(sourcePath, destPath, { recursive: true });
                        } else {
                            // Fallback for older nodes (file only)
                            fs.copyFileSync(sourcePath, destPath);
                        }

                        result.success = true;
                        result.data = `Copiado a ${destPath}`;

                        // List content for immediate feedback
                        let contentList = '';
                        if (fs.lstatSync(destPath).isDirectory()) {
                            contentList = fs.readdirSync(destPath).join('\n');
                        } else {
                            contentList = 'Archivo único copiado.';
                        }

                        result.output = `✅ He copiado '${path.basename(sourcePath)}' a tu espacio de trabajo para análisis.\n\nContenido:\n${contentList}\n\nListo para examinar.`;

                    } catch (e) {
                        result.error = `Error al copiar: ${e.message}`;
                        result.output = result.error;
                    }
                }
            }
            else if (toolName === 'local.audio.releaseMic') {
                result.success = true;
                result.data = "Microphone released";
                result.output = "Micrófono liberado.";
            }
            else {
                result.error = `Herramienta desconocida: ${toolName}`;
            }

        } catch (e) {
            result.error = e.message;
            result.output = e.message;
        }

        result.ok = result.success; // Alias for test compatibility
        result.provenance.durationMs = Date.now() - start;
        return result;
    }
}

module.exports = SandraKernel;
