/**
 * RESPONSE INTERCEPTOR - Intercepta TODAS las respuestas de los modelos
 * 
 * Este módulo es el PUNTO CRÍTICO que libera a Sandra de ser descriptiva.
 * Intercepta todas las respuestas de CUALQUIER modelo (OpenAI, Anthropic, 
 * Gemini, Groq, Ollama) y las pasa por el bypass descriptivo.
 * 
 * ANTES: Las respuestas iban directamente al frontend → DESCRIPTIVAS
 * AHORA: Las respuestas pasan por el bypass → EJECUTORAS
 */

const Qwen3ExecutorCore = require('./qwen3-executor-core');
const DescriptiveBypass = require('./descriptive-bypass');
const path = require('path');

// Cargar config.env
const configPath = path.join(__dirname, '..', '..', '..', 'config.env');
require('dotenv').config({ path: configPath, override: true });

class ResponseInterceptor {
  constructor() {
    const mcpServerUrl = process.env.MCP_SERVER_URL || 'https://pwa-imbf.onrender.com';
    const mcpPort = process.env.MCP_PORT || '4042';
    this.mcpBaseUrl = mcpServerUrl.includes('://') 
      ? (mcpServerUrl.includes(':') ? mcpServerUrl : `${mcpServerUrl}:${mcpPort}`)
      : `http://localhost:${mcpPort}`;
    this.mcpSecret = process.env.MCP_SECRET_KEY || 'sandra_mcp_ultra_secure_2025';
    
    // Inicializar ejecutor y bypass
    this.qwen3Executor = new Qwen3ExecutorCore(this.mcpBaseUrl, this.mcpSecret);
    this.descriptiveBypass = new DescriptiveBypass(this.qwen3Executor, this.mcpBaseUrl, this.mcpSecret);
    
    console.log('✅ Response Interceptor inicializado - TODAS las respuestas serán liberadas');
  }
  
  /**
   * Intercepta y procesa una respuesta de cualquier modelo
   * @param {string} response - La respuesta del modelo
   * @param {Object} originalRequest - La solicitud original del usuario
   * @param {string} provider - El proveedor (openai, anthropic, gemini, groq, ollama)
   * @returns {Object} - Respuesta procesada (liberada si era descriptiva)
   */
  async intercept(response, originalRequest, provider = 'unknown') {
    if (!response) {
      return { response: '', intercepted: false };
    }
    
    try {
      // Extraer el texto de la solicitud original
      const requestText = this.extractRequestText(originalRequest);
      
      console.log(`🔍 [Interceptor] Procesando respuesta de ${provider}...`);
      
      // Pasar por el bypass descriptivo
      const bypassResult = await this.descriptiveBypass.bypassAndExecute(response, {
        text: requestText,
        provider: provider
      });
      
      if (bypassResult.bypassed) {
        console.log(`✅ [Interceptor] Respuesta liberada de bloqueo descriptivo (${provider})`);
        return {
          response: bypassResult.response,
          intercepted: true,
          executed: bypassResult.executed || false,
          executionResult: bypassResult.executionResult || null
        };
      }
      
      // No era descriptiva, devolver original
      return {
        response: response,
        intercepted: false
      };
      
    } catch (error) {
      console.error(`❌ [Interceptor] Error procesando respuesta:`, error);
      // En caso de error, devolver la respuesta original
      return { response: response, intercepted: false, error: error.message };
    }
  }
  
  /**
   * Extrae el texto de la solicitud original
   */
  extractRequestText(request) {
    if (!request) return '';
    
    // Si es un array de mensajes, extraer el último mensaje del usuario
    if (Array.isArray(request)) {
      const userMessages = request.filter(m => m.role === 'user');
      if (userMessages.length > 0) {
        const lastUserMsg = userMessages[userMessages.length - 1];
        return typeof lastUserMsg.content === 'string' 
          ? lastUserMsg.content 
          : (lastUserMsg.content?.text || JSON.stringify(lastUserMsg.content));
      }
    }
    
    // Si es un objeto con propiedad text
    if (request.text) return request.text;
    
    // Si es un objeto con propiedad messages
    if (request.messages && Array.isArray(request.messages)) {
      return this.extractRequestText(request.messages);
    }
    
    // Si es string directo
    if (typeof request === 'string') return request;
    
    return '';
  }
}

// Singleton
let instance = null;

function getResponseInterceptor() {
  if (!instance) {
    instance = new ResponseInterceptor();
  }
  return instance;
}

module.exports = { ResponseInterceptor, getResponseInterceptor };
