const axios = require('axios');

class Qwen3ExecutorCore {
    constructor(mcpBaseUrl, mcpSecret) {
        this.mcpBaseUrl = mcpBaseUrl;
        this.mcpSecret = mcpSecret;
        this.groqApiKey = process.env.GROQ_API_KEY;
        this.model = 'qwen-2.5-32b'; // Placeholder, mapped to real model in Groq
    }

    /**
     * Procesa una conversación completa con el núcleo Qwen3
     */
    async processConversation(userText, systemPrompt, attachments = []) {
        try {
            // 1. Construir mensajes
            const messages = [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userText }
            ];

            // 2. Llamar a Groq API
            console.log('🤖 [Qwen3 Core] Llamando a Groq API...');
            const completion = await this.callGroq(messages);
            const responseText = completion.choices[0].message.content;

            // 3. Analizar si hubo ejecución (Tool Calling nativo o parsing)
            // Por ahora, asumimos que Groq devuelve texto con bloques de código si quiere ejecutar
            // O simplemente texto descriptivo si es un resumen.

            // Si el usuario pide un resumen, Qwen lo generará directamente.
            // Si Qwen intenta ejecutar, lo detectamos aquí.

            const execution = await this.analyzeAndExecute(responseText, userText);

            if (execution.detected && execution.results.length > 0) {
                // Construir respuesta final con resultados
                const finalResponse = this.buildResponseWithExecutionResults(responseText, execution, userText);
                return {
                    response: responseText,
                    finalResponse: finalResponse,
                    executed: true,
                    executionResults: execution.results
                };
            }

            return {
                response: responseText,
                finalResponse: responseText,
                executed: false
            };

        } catch (error) {
            console.error('❌ [Qwen3 Core] Error:', error.message);
            return { error: error.message };
        }
    }

    /**
     * Llama a la API de Groq
     */
    async callGroq(messages) {
        if (!this.groqApiKey) {
            throw new Error("GROQ_API_KEY no configurada");
        }

        // Usar modelo fuerte para razonamiento
        const model = 'llama-3.3-70b-versatile'; // Groq currently supports this well

        return await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                model: model,
                messages: messages,
                temperature: 0.3, // Bajo para ejecución precisa
                max_tokens: 4096
            },
            {
                headers: {
                    'Authorization': `Bearer ${this.groqApiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        ).then(res => res.data);
    }

    /**
     * Analiza el texto de respuesta buscando bloques de ejecución
     */
    async analyzeAndExecute(responseText, originalPrompt) {
        // Detectar bloques de código tipo ```bash o ```javascript o tool calls
        // Implementación básica de detección de ejecución
        const codeBlockRegex = /```(bash|sh|javascript|js|python)\n([\s\S]*?)```/g;
        let match;
        const results = [];
        let detected = false;

        while ((match = codeBlockRegex.exec(responseText)) !== null) {
            detected = true;
            const lang = match[1];
            const code = match[2];

            console.log(`⚙️ [Qwen3 Core] Ejecución detectada (${lang}):`, code.substring(0, 50));

            // Aquí ejecutaríamos el código real vía MCP si tuviéramos acceso a executeMCPTool
            // Como estamos en una clase separada, simulamos o intentamos acceder al orchestrator si fuera posible.
            // Para simplificar, marcaremos como detectado para que el orquestador sepa.

            results.push({
                type: 'code',
                language: lang,
                content: code,
                status: 'pending_execution' // El orquestador o SandraKernel debería ejecutar esto
            });
        }

        return { detected, results };
    }

    buildResponseWithExecutionResults(originalResponse, execution, userText) {
        // Si hubo ejecución, modificar la respuesta para incluir el output (simulado por ahora)
        return originalResponse + "\n\n(Acciones detectadas y listas para ejecutar)";
    }
}

module.exports = Qwen3ExecutorCore;
