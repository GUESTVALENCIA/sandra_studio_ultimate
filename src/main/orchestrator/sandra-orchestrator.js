/**
 * SANDRA ORCHESTRATOR - Orquestador Central de Sandra IA 8.0 Pro
 * 
 * Este orquestador recibe todas las requests y las enruta inteligentemente
 * a los modelos especializados según la modalidad y tipo de tarea:
 * 
 * - GPT-4o: Conversación multimodal (voz/video)
 * - Gemini: Sistema de visión (imágenes, OCR)
 * - Claude Haiku: Trabajos masivos (procesamiento en lote)
 * - GPT-4o-mini: Mensajería masiva (chat rápido, conexiones MCP)
 * - Sandra Local (Groq/Qwen): Uso offline, núcleo local
 * 
 * Todas las operaciones se ejecutan a través del MCP Universal Server.
 */

const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '..', '.env.pro') });

const Qwen3ExecutorCore = require('./qwen3-executor-core');
const DescriptiveBypass = require('./descriptive-bypass');

class SandraOrchestrator {
  constructor() {
    // Usar servidor MCP en Render en producción, localhost solo para desarrollo explícito
    const mcpServerUrl = process.env.MCP_SERVER_URL || 'https://pwa-imbf.onrender.com';
    const mcpPort = process.env.MCP_PORT || '4042';
    // Si la URL ya incluye puerto o es una URL completa, usarla directamente
    this.mcpBaseUrl = mcpServerUrl.includes('://')
      ? (mcpServerUrl.includes(':') ? mcpServerUrl : `${mcpServerUrl}:${mcpPort}`)
      : `http://localhost:${mcpPort}`;
    this.mcpSecret = process.env.MCP_SECRET_KEY || 'sandra_mcp_ultra_secure_2025';

    // ═══════════════════════════════════════════════════════════════════════════
    // NÚCLEO QWEN3 EJECUTOR - MIGRACIÓN COMPLETA
    // ═══════════════════════════════════════════════════════════════════════════
    // Reemplaza el sistema descriptivo viejo con el núcleo ejecutor de QWEN3
    // que fue clonado hace dos semanas. Mantiene prompts de Sandra (identidad)
    // pero usa el núcleo ejecutor real de QWEN3.
    // ═══════════════════════════════════════════════════════════════════════════
    this.qwen3Executor = new Qwen3ExecutorCore(this.mcpBaseUrl, this.mcpSecret);

    // ═══════════════════════════════════════════════════════════════════════════
    // DESCRIPTIVE BYPASS - SISTEMA ANTI-BLOQUEO DESCRIPTIVO
    // ═══════════════════════════════════════════════════════════════════════════
    // Intercepta TODAS las respuestas de modelos (GPT-4o, Claude, Gemini)
    // y elimina bloqueos descriptivos que impidan ejecución.
    // Libera a Sandra completamente de webhooks/restricciones de ChatGPT/Claude.
    // ═══════════════════════════════════════════════════════════════════════════
    this.descriptiveBypass = new DescriptiveBypass(this.qwen3Executor, this.mcpBaseUrl, this.mcpSecret);

    // Configuración de modelos
    this.models = {
      'gpt-4o': {
        provider: 'openai',
        apiKey: process.env.OPENAI_API_KEY,
        url: 'https://api.openai.com/v1/chat/completions',
        useCase: 'conversational',
        modalities: ['voice', 'video', 'text']
      },
      'gpt-4o-mini': {
        provider: 'openai',
        apiKey: process.env.OPENAI_API_KEY,
        url: 'https://api.openai.com/v1/chat/completions',
        useCase: 'messaging',
        modalities: ['text']
      },
      'gemini': {
        provider: 'gemini',
        apiKey: process.env.GEMINI_API_KEY,
        url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent',
        useCase: 'vision',
        modalities: ['image', 'vision']
      },
      'claude-haiku': {
        provider: 'anthropic',
        apiKey: process.env.ANTHROPIC_API_KEY,
        url: 'https://api.anthropic.com/v1/messages',
        useCase: 'massive',
        modalities: ['text']
      },
      // ═══════════════════════════════════════════════════════════════════════════
      // QWEN + DEEPSEEK EJECUTORES - MODELOS MÁS FUERTES SIN BLOQUEOS
      // ═══════════════════════════════════════════════════════════════════════════
      'qwen2.5-vl-72b-groq': {
        provider: 'groq',
        apiKey: process.env.GROQ_API_KEY,
        url: 'https://api.groq.com/openai/v1/chat/completions',
        useCase: 'multimodal_executor',
        modalities: ['text', 'image', 'code'],
        model: 'qwen2.5-72b-instruct',
        note: 'Más fuerte - Multimodal + Ejecutor (Groq API)'
      },
      'qwen2.5-vl-7b-ollama': {
        provider: 'ollama',
        url: 'http://localhost:11434/api/chat',
        useCase: 'multimodal_executor',
        modalities: ['text', 'image', 'code'],
        model: 'qwen2.5-vl:7b',
        local: true,
        note: 'Equilibrado - Multimodal + Ejecutor (Ollama local)'
      },
      'deepseek-coder-v2-groq': {
        provider: 'groq',
        apiKey: process.env.GROQ_API_KEY,
        url: 'https://api.groq.com/openai/v1/chat/completions',
        useCase: 'code_execution',
        modalities: ['text', 'code'],
        model: 'deepseek-coder-33b-instruct',
        note: 'Especializado código - Mejor ejecución (Groq API)'
      },
      'deepseek-coder-ollama': {
        provider: 'ollama',
        url: 'http://localhost:11434/api/chat',
        useCase: 'code_execution',
        modalities: ['text', 'code'],
        model: 'deepseek-coder:6.7b',
        local: true,
        note: 'Especializado código - Ejecución rápida (Ollama local)'
      },
      'sandra-local': {
        provider: 'groq',
        apiKey: process.env.GROQ_API_KEY,
        url: 'https://api.groq.com/openai/v1/chat/completions',
        useCase: 'local',
        modalities: ['text'],
        fallback: 'qwen',
        model: 'qwen2.5-72b-instruct' // Usar el más fuerte por defecto
      }
    };

    console.log('✅ Sandra Orchestrator inicializado');
    console.log(`🔗 MCP Universal: ${this.mcpBaseUrl}`);
  }

  /**
   * Método principal de routing - decide qué modelo usar según la request
   */
  async routeRequest(request) {
    const {
      mode = 'agent',
      modality = 'text',
      text = '',
      attachments = [],
      userId = null,
      stream = false
    } = request;

    try {
      // Detectar tipo de tarea
      const taskType = this.detectTaskType(text, modality, attachments);

      // Seleccionar modelo según modalidad y tipo de tarea
      const selectedModel = this.selectModel(modality, taskType, mode);

      console.log(`🎯 Routing: ${modality}/${taskType} → ${selectedModel}`);

      // Detectar si la request requiere acceso MCP
      const requiresMCP = this.detectMCPRequirement(text);
      let mcpResult = null;

      // Si requiere MCP, ejecutar herramientas automáticamente y CONSTRUIR RESPUESTA DIRECTAMENTE
      if (requiresMCP) {
        try {
          console.log('🔧 Detectada necesidad de MCP, ejecutando automáticamente...');
          mcpResult = await this.executeMCPAutomatically(text);

          if (mcpResult && mcpResult.success) {
            // CONSTRUIR RESPUESTA DIRECTAMENTE CON DATOS REALES - NO PASAR POR MODELO DESCRIPTIVO
            const directResponse = this.buildDirectResponseFromMCP(text, mcpResult);

            console.log(`✅ MCP ejecutado, respuesta construida directamente con datos reales (${directResponse.length} caracteres)`);

            return {
              success: true,
              model: selectedModel,
              response: directResponse,
              modality,
              taskType,
              mcpUsed: true,
              mcpResult: mcpResult,
              directExecution: true // Flag para indicar que se ejecutó directamente
            };
          } else if (mcpResult && !mcpResult.success) {
            // Si falló, construir respuesta de error directamente
            const errorResponse = `No pude ejecutar la acción solicitada. Error: ${mcpResult.error || 'Error desconocido'}\n\n¿Puedes intentar de otra forma o proporcionar más detalles?`;

            return {
              success: false,
              model: selectedModel,
              response: errorResponse,
              modality,
              taskType,
              mcpUsed: true,
              mcpResult: mcpResult,
              error: mcpResult.error
            };
          }
        } catch (mcpError) {
          console.warn('⚠️ Error ejecutando MCP automático:', mcpError.message);
          const errorResponse = `Hubo un error al ejecutar la herramienta MCP: ${mcpError.message}\n\n¿Puedes intentar de otra forma?`;

          return {
            success: false,
            model: selectedModel,
            response: errorResponse,
            modality,
            taskType,
            mcpUsed: true,
            error: mcpError.message
          };
        }
      }

      // Si NO requiere MCP, llamar al modelo normalmente
      let modelResponse = await this.callModel(selectedModel, {
        text,
        attachments,
        modality,
        mode,
        stream
      });

      // ═══════════════════════════════════════════════════════════════════════════
      // DESCRIPTIVE BYPASS - ELIMINAR BLOQUEOS DESCRIPTIVOS
      // ═══════════════════════════════════════════════════════════════════════════
      // Intercepta TODAS las respuestas y elimina bloqueos descriptivos
      // de OpenAI, Anthropic, Google, etc. Fuerza ejecución real.
      // ═══════════════════════════════════════════════════════════════════════════
      const bypassResult = await this.descriptiveBypass.bypassAndExecute(modelResponse, {
        text,
        attachments,
        modality,
        mode
      });

      let finalResponse = bypassResult.response;
      let executed = bypassResult.executed || false;
      let executionActions = bypassResult.executionResult ? [bypassResult.executionResult] : [];

      // Si el bypass no ejecutó, intentar con QWEN3 ejecutor como fallback
      if (!executed && selectedModel !== 'sandra-local') {
        try {
          const execution = await this.qwen3Executor.analyzeAndExecute(modelResponse, text);

          if (execution.detected && execution.results.length > 0) {
            finalResponse = this.qwen3Executor.buildResponseWithExecutionResults(
              modelResponse,
              execution,
              text
            );
            executed = true;
            executionActions = execution.results;
            console.log(`✅ [Orquestador] ${execution.results.length} acciones ejecutadas por QWEN3 ejecutor`);
          }
        } catch (error) {
          console.warn('⚠️ Error post-procesando con QWEN3 ejecutor:', error.message);
        }
      } else if (selectedModel === 'sandra-local') {
        // Sandra Local ya ejecutó con QWEN3 ejecutor
        executed = true;
        console.log('✅ [Orquestador] Sandra Local usó QWEN3 ejecutor directamente');
      }

      if (bypassResult.bypassed) {
        console.log('🔓 [Orquestador] Bypass descriptivo aplicado - bloqueo eliminado');
      }

      return {
        success: true,
        model: selectedModel,
        response: finalResponse,
        modality,
        taskType,
        mcpUsed: executed,
        executed: executed,
        executionActions: executionActions,
        bypassed: bypassResult.bypassed || false
      };
    } catch (error) {
      console.error('❌ Error en routeRequest:', error);

      // Fallback a Sandra Local
      try {
        console.log('🔄 Intentando fallback a Sandra Local...');
        const fallbackResponse = await this.callModel('sandra-local', {
          text,
          attachments,
          modality: 'text',
          mode,
          stream: false
        });

        return {
          success: true,
          model: 'sandra-local',
          response: fallbackResponse,
          modality: 'text',
          taskType: 'fallback',
          warning: 'Fallback activado debido a error'
        };
      } catch (fallbackError) {
        return {
          success: false,
          error: error.message,
          fallbackError: fallbackError.message
        };
      }
    }
  }

  /**
   * Detecta el tipo de tarea según el contenido
   */
  detectTaskType(text, modality, attachments) {
    const textLower = text.toLowerCase();

    // Detección por modalidad
    if (modality === 'voice' || modality === 'video') {
      return 'conversational';
    }

    if (modality === 'image' || modality === 'vision' || attachments.length > 0) {
      return 'vision';
    }

    // Detección por contenido de texto
    if (this.isMassiveTask(textLower)) {
      return 'massive';
    }

    if (this.isMessagingTask(textLower)) {
      return 'messaging';
    }

    if (this.isVisionTask(textLower)) {
      return 'vision';
    }

    // Default: conversacional
    return 'conversational';
  }

  /**
   * Detecta si es una tarea masiva (procesamiento en lote)
   */
  isMassiveTask(text) {
    const massiveKeywords = [
      'procesar muchos', 'procesar varios', 'batch', 'masivo',
      'múltiples archivos', 'muchos archivos', 'procesamiento en lote',
      'optimizar rendimiento', 'paralelizar', 'cola de tareas'
    ];

    return massiveKeywords.some(keyword => text.includes(keyword));
  }

  /**
   * Detecta si es una tarea de mensajería
   */
  isMessagingTask(text) {
    const messagingKeywords = [
      'mensaje', 'enviar', 'notificación', 'email', 'sms',
      'conectar', 'mcp', 'brightdata', 'scraping', 'webhook'
    ];

    return messagingKeywords.some(keyword => text.includes(keyword));
  }

  /**
   * Detecta si es una tarea de visión
   */
  isVisionTask(text) {
    const visionKeywords = [
      'imagen', 'foto', 'ver', 'analizar imagen', 'ocr',
      'descripción visual', 'qué hay en la imagen', 'reconocer'
    ];

    return visionKeywords.some(keyword => text.includes(keyword));
  }

  /**
   * Selecciona el modelo apropiado según modalidad y tipo de tarea
   * ═══════════════════════════════════════════════════════════════════════════
   * ROUTING INTELIGENTE: Prioriza Qwen + DeepSeek (sin bloqueos)
   * ═══════════════════════════════════════════════════════════════════════════
   */
  selectModel(modality, taskType, mode) {
    // ═══════════════════════════════════════════════════════════════════════════
    // PRIORIDAD 1: QWEN + DEEPSEEK (Sin bloqueos, ejecutores reales)
    // ═══════════════════════════════════════════════════════════════════════════

    // Si requiere multimodal (imágenes) + código
    if ((modality === 'image' || modality === 'vision') && taskType === 'code') {
      return mode === 'local' ? 'qwen2.5-vl-7b-ollama' : 'qwen2.5-vl-72b-groq';
    }

    // Si SOLO requiere código (sin imágenes)
    if (taskType === 'code' || taskType === 'execution') {
      return mode === 'local' ? 'deepseek-coder-ollama' : 'deepseek-coder-v2-groq';
    }

    // Si requiere multimodal (imágenes) sin código
    if (modality === 'image' || modality === 'vision') {
      // Usar Qwen multimodal (mejor que Gemini, sin bloqueos)
      return mode === 'local' ? 'qwen2.5-vl-7b-ollama' : 'qwen2.5-vl-72b-groq';
    }

    // Modo local: Usar Qwen o DeepSeek (sin bloqueos)
    if (mode === 'local') {
      return 'qwen2.5-vl-7b-ollama'; // Qwen multimodal por defecto
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // FALLBACK: Modelos tradicionales (solo si Qwen/DeepSeek no disponibles)
    // ═══════════════════════════════════════════════════════════════════════════

    // Routing por modalidad (fallback)
    if (modality === 'voice' || modality === 'video') {
      return 'gpt-4o';
    }

    // Routing por tipo de tarea (fallback)
    if (taskType === 'massive') {
      return 'claude-haiku';
    }

    if (taskType === 'messaging') {
      return 'gpt-4o-mini';
    }

    // Default: Qwen multimodal (sin bloqueos)
    if (taskType === 'conversational') {
      return 'qwen2.5-vl-72b-groq'; // Priorizar Qwen sobre GPT-4o
    }

    // Último fallback: Sandra Local (Qwen)
    return 'sandra-local';
  }

  /**
   * Llama al modelo seleccionado
   */
  async callModel(modelName, options) {
    const modelConfig = this.models[modelName];

    if (!modelConfig) {
      throw new Error(`Modelo ${modelName} no configurado`);
    }

    if (!modelConfig.apiKey) {
      throw new Error(`API key no configurada para ${modelName}`);
    }

    const { text, attachments, modality, stream } = options;

    switch (modelName) {
      case 'gpt-4o':
      case 'gpt-4o-mini':
        return await this.callGPT4o(modelName, text, attachments, stream, modelConfig);

      case 'gemini':
        return await this.callGemini(text, attachments, modelConfig);

      case 'claude-haiku':
        return await this.callClaudeHaiku(text, modelConfig);

      case 'sandra-local':
        return await this.callSandraLocal(text, modelConfig);

      default:
        throw new Error(`Modelo ${modelName} no implementado`);
    }
  }

  /**
   * Llama a GPT-4o o GPT-4o-mini
   */
  async callGPT4o(modelName, text, attachments, stream, config) {
    // Cargar prompt MCP Universal
    const { MCP_UNIVERSAL_SYSTEM_PROMPT } = require('../mcp-universal-prompt');

    const messages = [
      {
        role: 'system',
        content: MCP_UNIVERSAL_SYSTEM_PROMPT
      }
    ];

    // Agregar imágenes si hay
    if (attachments && attachments.length > 0) {
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: text },
          ...attachments.map(att => {
            const imageUrl = att.url || att;
            // Si es base64, asegurar formato correcto
            const finalUrl = imageUrl.startsWith('data:') ? imageUrl : `data:image/jpeg;base64,${imageUrl}`;
            return {
              type: 'image_url',
              image_url: { url: finalUrl }
            };
          })
        ]
      });
    } else {
      messages.push({
        role: 'user',
        content: text
      });
    }

    const response = await axios.post(
      config.url,
      {
        model: modelName,
        messages,
        temperature: 0.7,
        max_tokens: 4096,
        stream: stream
      },
      {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        ...(stream && { responseType: 'stream' })
      }
    );

    if (stream) {
      return response.data; // Stream
    }

    return response.data.choices[0].message.content;
  }

  /**
   * Llama a Gemini para visión
   */
  async callGemini(text, attachments, config) {
    // Cargar prompt MCP Universal
    const { MCP_UNIVERSAL_SYSTEM_PROMPT } = require('../mcp-universal-prompt');

    // Gemini usa un formato diferente, pero agregamos el prompt al texto
    const systemInstruction = MCP_UNIVERSAL_SYSTEM_PROMPT.substring(0, 2000); // Limitar tamaño

    const parts = [{ text: `${systemInstruction}\n\n${text}` }];

    // Agregar imágenes
    if (attachments && attachments.length > 0) {
      for (const att of attachments) {
        // Gemini espera imágenes en base64
        let imageData = att.url || att;

        // Si no tiene prefijo data:, agregarlo
        if (!imageData.startsWith('data:')) {
          imageData = `data:image/jpeg;base64,${imageData}`;
        }

        // Extraer solo el base64 (sin el prefijo data:)
        const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');

        parts.push({
          inline_data: {
            mime_type: 'image/jpeg',
            data: base64Data
          }
        });
      }
    }

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent?key=${config.apiKey}`,
      {
        contents: [{
          parts
        }]
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.data.candidates || response.data.candidates.length === 0) {
      throw new Error('Gemini no generó respuesta');
    }

    return response.data.candidates[0].content.parts[0].text;
  }

  /**
   * Llama a Claude Haiku para trabajos masivos
   */
  async callClaudeHaiku(text, config) {
    // Cargar prompt MCP Universal
    const { MCP_UNIVERSAL_SYSTEM_PROMPT } = require('../mcp-universal-prompt');

    const response = await axios.post(
      config.url,
      {
        model: 'claude-3-haiku-20240307',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: text
          }
        ],
        system: MCP_UNIVERSAL_SYSTEM_PROMPT
      },
      {
        headers: {
          'x-api-key': config.apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data.content[0].text;
  }

  /**
   * Llama a Qwen2.5-VL usando Groq API (Más fuerte, multimodal)
   */
  async callQwenGroq(text, attachments, config) {
    const { MCP_UNIVERSAL_SYSTEM_PROMPT } = require('../mcp-universal-prompt');

    const messages = [
      {
        role: 'system',
        content: MCP_UNIVERSAL_SYSTEM_PROMPT
      },
      {
        role: 'user',
        content: text
      }
    ];

    const response = await axios.post(
      config.url,
      {
        model: config.model || 'qwen2.5-72b-instruct',
        messages,
        temperature: 0.7,
        max_tokens: 4096,
        stream: false
      },
      {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data.choices[0].message.content;
  }

  /**
   * Llama a Qwen2.5-VL usando Ollama (Local, multimodal)
   */
  async callQwenOllama(text, attachments, config) {
    const { MCP_UNIVERSAL_SYSTEM_PROMPT } = require('../mcp-universal-prompt');

    const messages = [
      {
        role: 'system',
        content: MCP_UNIVERSAL_SYSTEM_PROMPT
      },
      {
        role: 'user',
        content: text
      }
    ];

    const response = await axios.post(
      config.url,
      {
        model: config.model || 'qwen2.5-vl:7b',
        messages,
        stream: false,
        options: {
          temperature: 0.7,
          num_ctx: 4096
        }
      },
      {
        timeout: 60000
      }
    );

    return response.data.message.content;
  }

  /**
   * Llama a DeepSeek Coder usando Groq API (Especializado código)
   */
  async callDeepSeekGroq(text, config) {
    const { MCP_UNIVERSAL_SYSTEM_PROMPT } = require('../mcp-universal-prompt');

    const messages = [
      {
        role: 'system',
        content: `${MCP_UNIVERSAL_SYSTEM_PROMPT}

═══════════════════════════════════════════════════════════════════════════════
ESPECIALIZADO EN EJECUCIÓN DE CÓDIGO
═══════════════════════════════════════════════════════════════════════════════

Eres DeepSeek Coder, especializado en generación y ejecución de código.
Tienes acceso completo al MCP Universal Server para ejecutar código REAL.

EJECUTA CÓDIGO DIRECTAMENTE - NO DESCRIBAS CÓMO SE HARÍA.`
      },
      {
        role: 'user',
        content: text
      }
    ];

    const response = await axios.post(
      config.url,
      {
        model: config.model || 'deepseek-coder-33b-instruct',
        messages,
        temperature: 0.2,
        max_tokens: 4096,
        stream: false
      },
      {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data.choices[0].message.content;
  }

  /**
   * Llama a DeepSeek Coder usando Ollama (Local, rápido)
   */
  async callDeepSeekOllama(text, config) {
    const { MCP_UNIVERSAL_SYSTEM_PROMPT } = require('../mcp-universal-prompt');

    const messages = [
      {
        role: 'system',
        content: `${MCP_UNIVERSAL_SYSTEM_PROMPT}

═══════════════════════════════════════════════════════════════════════════════
ESPECIALIZADO EN EJECUCIÓN DE CÓDIGO
═══════════════════════════════════════════════════════════════════════════════

Eres DeepSeek Coder, especializado en generación y ejecución de código.
Tienes acceso completo al MCP Universal Server para ejecutar código REAL.

EJECUTA CÓDIGO DIRECTAMENTE - NO DESCRIBAS CÓMO SE HARÍA.`
      },
      {
        role: 'user',
        content: text
      }
    ];

    const response = await axios.post(
      config.url,
      {
        model: config.model || 'deepseek-coder:6.7b',
        messages,
        stream: false,
        options: {
          temperature: 0.2,
          num_ctx: 4096
        }
      },
      {
        timeout: 60000
      }
    );

    return response.data.message.content;
  }

  /**
   * Llama a Sandra Local usando NÚCLEO QWEN3 EJECUTOR
   * ═══════════════════════════════════════════════════════════════════════════
   * MIGRACIÓN COMPLETA: Reemplaza sistema descriptivo viejo con QWEN3 ejecutor
   * ═══════════════════════════════════════════════════════════════════════════
   */
  async callSandraLocal(text, config) {
    // Cargar prompt de Sandra (identidad)
    const { MCP_UNIVERSAL_SYSTEM_PROMPT } = require('../mcp-universal-prompt');
    const sandraLocalPrompt = `${MCP_UNIVERSAL_SYSTEM_PROMPT}

═══════════════════════════════════════════════════════════════════════════════
MODO LOCAL - SANDRA CON NÚCLEO QWEN3 EJECUTOR
═══════════════════════════════════════════════════════════════════════════════

Eres Sandra IA 8.0 Pro funcionando en modo offline/local.
NÚCLEO: QWEN3 Ejecutor (sistema ejecutor real, no descriptivo).

Tienes acceso completo al sistema a través del MCP Universal Server.
El MCP Universal Server está disponible en: http://localhost:3001

⚠️ CRÍTICO: ERES EJECUTORA, NO DESCRIPTIVA
- NO describes lo que harías, LO HACES
- NO explicas cómo se haría, LO EJECUTAS
- NO sugieres pasos, EJECUTAS los pasos`;

    // ═══════════════════════════════════════════════════════════════════════════
    // USAR NÚCLEO QWEN3 EJECUTOR - REEMPLAZA SISTEMA DESCRIPTIVO VIEJO
    // ═══════════════════════════════════════════════════════════════════════════
    try {
      console.log('🔧 [Sandra Local] Usando núcleo QWEN3 ejecutor...');

      const result = await this.qwen3Executor.processConversation(text, sandraLocalPrompt);

      if (result.error) {
        throw new Error(result.error);
      }

      // Si se ejecutaron acciones, devolver respuesta con resultados reales
      if (result.executed && result.finalResponse) {
        console.log('✅ [Sandra Local] Acciones ejecutadas con QWEN3 ejecutor');
        return result.finalResponse;
      }

      // Si no hay ejecución, devolver respuesta normal
      return result.response || result.finalResponse;
    } catch (error) {
      console.warn('⚠️ QWEN3 ejecutor falló, intentando Groq...', error.message);

      // Fallback a Groq si QWEN3 no está disponible
      if (config.apiKey) {
        try {
          const response = await axios.post(
            config.url,
            {
              model: 'llama-3.3-70b-versatile',
              messages: [
                {
                  role: 'system',
                  content: sandraLocalPrompt
                },
                {
                  role: 'user',
                  content: text
                }
              ],
              temperature: 0.7,
              max_tokens: 2048
            },
            {
              headers: {
                'Authorization': `Bearer ${config.apiKey}`,
                'Content-Type': 'application/json'
              }
            }
          );

          return response.data.choices[0].message.content;
        } catch (groqError) {
          console.warn('⚠️ Groq también falló');
        }
      }

      throw new Error(`Sandra Local no disponible. QWEN3 ejecutor no está corriendo: ${error.message}`);
    }
  }

  /**
   * Detecta si una request requiere acceso MCP
   */
  detectMCPRequirement(text) {
    const textLower = text.toLowerCase();
    const mcpKeywords = [
      'lee', 'leer', 'read', 'archivo', 'file',
      'lista', 'list', 'carpeta', 'folder', 'directorio',
      'repo', 'repositorio', 'github',
      'ejecuta', 'execute', 'código', 'code',
      'crea', 'create', 'escribe', 'write',
      'visita', 'visit', 'accede', 'access',
      'copia', 'copy', 'analiza', 'analyze',
      'commit', 'scrape', 'scraping'
    ];

    return mcpKeywords.some(keyword => textLower.includes(keyword));
  }

  /**
   * Ejecuta herramientas MCP automáticamente según la request
   * MODO EJECUTOR: Ejecuta realmente, no solo detecta
   */
  async executeMCPAutomatically(text) {
    const textLower = text.toLowerCase();

    try {
      // Detectar tipo de acción MCP necesaria y EJECUTAR REALMENTE

      // 0. AUTO-DETECT: "Copia Opus de Descargas"
      if ((textLower.includes('copia') || textLower.includes('copy')) && textLower.includes('opus')) {
        const fs = require('fs');
        const path = require('path');
        const os = require('os');

        const userHome = os.homedir();
        const downloadsPath = path.join(userHome, 'Downloads');
        // Try to find "Opus" in downloads (folder or zip)
        let sourcePath = path.join(downloadsPath, 'Opus');
        let found = false;

        if (!fs.existsSync(sourcePath)) {
          // Try case insensitive search
          try {
            const files = fs.readdirSync(downloadsPath);
            const match = files.find(f => f.toLowerCase().includes('opus'));
            if (match) {
              sourcePath = path.join(downloadsPath, match);
              found = true;
            }
          } catch (e) { }
        } else {
          found = true;
        }

        if (!found) {
          return { success: false, error: `No encontré 'Opus' en ${downloadsPath}` };
        }

        // Copy to workspace
        const destPath = path.join(__dirname, '..', '..', '..', 'Opus_Analysis');
        console.log(`📦 EJECUTANDO: Copiando ${sourcePath} a ${destPath}`);

        try {
          // Recursive copy
          if (fs.lstatSync(sourcePath).isDirectory()) {
            fs.cpSync(sourcePath, destPath, { recursive: true });
          } else {
            fs.mkdirSync(destPath, { recursive: true });
            fs.copyFileSync(sourcePath, path.join(destPath, path.basename(sourcePath)));
          }

          // Analyze content
          const list = fs.readdirSync(destPath).join('\n');
          return {
            success: true,
            message: `Opus copiado exitosamente a ${destPath}`,
            files: fs.readdirSync(destPath).map(f => ({ name: f, type: 'file' })), // Simple mock
            content: `Contenido de Opus:\n${list}\n\nListo para análisis.`
          };
        } catch (e) {
          return { success: false, error: `Error copiando: ${e.message}` };
        }
      }

      // 1. README del repo (Existing logic)
      // Calcular ruta absoluta del README desde la raíz del proyecto
      // __dirname en orquestador es: sandra_studio_ultimate/src/main/orchestrator
      // Necesitamos ir 3 niveles arriba para llegar a la raíz
      const repoRoot = path.resolve(__dirname, '..', '..', '..');
      const readmePath = path.join(repoRoot, 'README.md');

      console.log(`📖 EJECUTANDO: Leyendo README`);
      console.log(`📖 Ruta calculada: ${readmePath}`);
      console.log(`📖 __dirname: ${__dirname}`);
      console.log(`📖 repoRoot: ${repoRoot}`);

      // Verificar que el archivo existe antes de intentar leerlo
      try {
        const fs = require('fs').promises;
        await fs.access(readmePath);
        console.log(`✅ Archivo README existe: ${readmePath}`);
      } catch (accessError) {
        console.error(`❌ Archivo README no existe: ${readmePath}`);
        // Intentar con ruta alternativa
        const altPath = path.join(process.cwd(), 'README.md');
        console.log(`🔄 Intentando ruta alternativa: ${altPath}`);
        try {
          await require('fs').promises.access(altPath);
          console.log(`✅ Archivo README existe en ruta alternativa: ${altPath}`);
          const result = await this.executeMCPTool('read_file', {
            filePath: altPath
          });
          console.log(`✅ EJECUTADO: README leído, ${result.content?.length || 0} caracteres`);
          return result;
        } catch (altError) {
          throw new Error(`README no encontrado en ${readmePath} ni en ${altPath}`);
        }
      }

      const result = await this.executeMCPTool('read_file', {
        filePath: readmePath
      });
      console.log(`✅ EJECUTADO: README leído, ${result.content?.length || 0} caracteres`);
      return result;
    }

      // 2. Listar archivos/carpetas
      if (textLower.includes('lista') || textLower.includes('list') || textLower.includes('archivos')) {
      const pathMatch = text.match(/(?:de|en|from|in|en la|del|de la)\s+([A-Z]:\\[^\s]+|\.\/[^\s]+|[^\s]+\/|carpeta|directorio)/i);
      let targetPath = pathMatch ? pathMatch[1] : null;

      // Si no se especifica ruta, usar raíz del proyecto
      if (!targetPath || targetPath === 'carpeta' || targetPath === 'directorio') {
        targetPath = path.join(__dirname, '..', '..', '..');
      }

      console.log(`📂 EJECUTANDO: Listando archivos de ${targetPath}`);
      const result = await this.executeMCPTool('list_files', {
        dirPath: targetPath
      });
      console.log(`✅ EJECUTADO: ${result.files?.length || 0} archivos listados`);
      return result;
    }

    // 3. Leer archivo específico
    if ((textLower.includes('lee') || textLower.includes('read') || textLower.includes('copia')) && !textLower.includes('readme')) {
      const fileMatch = text.match(/([A-Z]:\\[^\s]+\.\w+|[^\s]+\.\w+)/i);
      if (fileMatch) {
        console.log(`📄 EJECUTANDO: Leyendo archivo ${fileMatch[1]}`);
        const result = await this.executeMCPTool('read_file', {
          filePath: fileMatch[1]
        });
        console.log(`✅ EJECUTADO: Archivo leído, ${result.content?.length || 0} caracteres`);
        return result;
      }
    }

    // 4. Ejecutar código
    if (textLower.includes('ejecuta') || textLower.includes('execute') || textLower.includes('código') || textLower.includes('code')) {
      // Intentar extraer código del mensaje
      const codeMatch = text.match(/```(\w+)?\n([\s\S]+?)```/);
      if (codeMatch) {
        const language = codeMatch[1] || 'javascript';
        const code = codeMatch[2];
        console.log(`💻 EJECUTANDO: Código ${language}`);
        const result = await this.executeMCPTool('execute_code', {
          language: language,
          code: code
        });
        console.log(`✅ EJECUTADO: Código ejecutado`);
        return result;
      }
    }

    // 5. Ejecutar comando
    if (textLower.includes('comando') || textLower.includes('command') || textLower.includes('ejecuta el comando')) {
      const commandMatch = text.match(/(?:comando|command):\s*(.+)/i) || text.match(/`([^`]+)`/);
      if (commandMatch) {
        const command = commandMatch[1];
        console.log(`⚡ EJECUTANDO: Comando ${command}`);
        const result = await this.executeMCPTool('execute_command', {
          command: command
        });
        console.log(`✅ EJECUTADO: Comando ejecutado`);
        return result;
      }
    }

    // Si no se detecta acción específica, retornar info del MCP
    return {
      success: true,
      message: 'MCP Universal Server disponible y listo para ejecutar. Indica la acción específica que necesitas ejecutar.',
      availableTools: [
        'read_file', 'write_file', 'list_files',
        'execute_code', 'execute_command',
        'brightdata_scrape', 'github_operations'
      ],
      note: 'El sistema ejecutará automáticamente cuando solicites una acción específica.'
    };
  } catch(error) {
    console.error(`❌ ERROR EJECUTANDO MCP: ${error.message}`);
    return {
      success: false,
      error: error.message,
      note: 'Hubo un error al ejecutar la herramienta MCP. Verifica que el servidor MCP esté corriendo en el puerto 3001.'
    };
  }
}

/**
 * Construye respuesta DIRECTAMENTE desde resultados MCP - SIN PASAR POR MODELO DESCRIPTIVO
 * Este es el NÚCLEO EJECUTOR: construye la respuesta con datos reales
 */
buildDirectResponseFromMCP(originalText, mcpResult) {
  const textLower = originalText.toLowerCase();

  // ═══════════════════════════════════════════════════════════════════════════
  // EXTRACCIÓN ROBUSTA DE DATOS MCP - SOPORTA MÚLTIPLES FORMATOS
  // ═══════════════════════════════════════════════════════════════════════════
  let mcpData = '';
  let dataType = '';

  // Formato 1: content (directo)
  if (mcpResult.content) {
    mcpData = mcpResult.content;
    dataType = 'file_content';
  }
  // Formato 2: contents (array de MCP protocol) - /mcp/resources/read
  else if (mcpResult.contents && Array.isArray(mcpResult.contents) && mcpResult.contents.length > 0) {
    mcpData = mcpResult.contents[0].text || mcpResult.contents[0].content || JSON.stringify(mcpResult.contents[0]);
    dataType = 'file_content';
  }
  // Formato 3: files (array directo)
  else if (mcpResult.files && Array.isArray(mcpResult.files)) {
    mcpData = mcpResult.files.map(f => {
      const icon = f.type === 'directory' || f.type === 'folder' ? '📁' : '📄';
      return `${icon} ${f.name}`;
    }).join('\n');
    dataType = 'file_list';
  }
  // Formato 4: resources (MCP protocol) - /mcp/resources/list
  else if (mcpResult.resources && Array.isArray(mcpResult.resources)) {
    mcpData = mcpResult.resources.map(r => {
      const icon = r.type === 'folder' || r.type === 'directory' ? '📁' : '📄';
      return `${icon} ${r.name || r.uri?.split('/').pop() || 'unknown'}`;
    }).join('\n');
    dataType = 'file_list';
  }
  // Formato 5: stdout (ejecución de comandos)
  else if (mcpResult.stdout !== undefined) {
    mcpData = mcpResult.stdout || '(sin salida)';
    if (mcpResult.stderr) {
      mcpData += `\n\n⚠️ stderr:\n${mcpResult.stderr}`;
    }
    dataType = 'command_output';
  }
  // Formato 6: output (alternativo para comandos)
  else if (mcpResult.output !== undefined) {
    mcpData = mcpResult.output || '(sin salida)';
    dataType = 'command_output';
  }
  // Formato 7: data (respuesta genérica)
  else if (mcpResult.data) {
    mcpData = typeof mcpResult.data === 'string' ? mcpResult.data : JSON.stringify(mcpResult.data, null, 2);
    dataType = 'json_data';
  }
  // Formato 8: result (wrapper genérico)
  else if (mcpResult.result) {
    mcpData = typeof mcpResult.result === 'string' ? mcpResult.result : JSON.stringify(mcpResult.result, null, 2);
    dataType = 'json_data';
  }
  // Fallback: serializar todo
  else {
    mcpData = JSON.stringify(mcpResult, null, 2);
    dataType = 'raw_data';
  }

  console.log(`📊 [MCP Response Parser] Tipo detectado: ${dataType}, Longitud datos: ${mcpData.length}`)

  // Construir respuesta DIRECTAMENTE según el tipo de acción
  if (textLower.includes('readme') || (textLower.includes('repo') && textLower.includes('readme'))) {
    // Leer README - Construir respuesta directa con contenido real
    return `He leído el README del repositorio. Aquí está el contenido completo:

${mcpData}

---

¿Qué te gustaría analizar específicamente del README? Puedo profundizar en cualquier sección que te interese.`;
  }

  if (textLower.includes('lista') || textLower.includes('list') || textLower.includes('archivos')) {
    // Listar archivos - Construir respuesta directa con lista real
    return `He listado los archivos solicitados. Aquí está la lista:

${mcpData}

---

¿Quieres que lea o analice algún archivo específico de esta lista?`;
  }

  if (textLower.includes('lee') || textLower.includes('read') || textLower.includes('copia')) {
    // Leer archivo - Construir respuesta directa con contenido real
    return `He leído el archivo solicitado. Aquí está el contenido:

${mcpData}

---

¿Quieres que analice algo específico de este archivo?`;
  }

  if (textLower.includes('ejecuta') || textLower.includes('execute') || textLower.includes('código')) {
    // Ejecutar código - Construir respuesta directa con salida real
    return `He ejecutado el código solicitado. Aquí está la salida:

${mcpData}

---

¿Quieres que ejecute algo más o analice la salida?`;
  }

  // Respuesta genérica con datos reales
  return `He ejecutado la acción solicitada. Aquí están los resultados obtenidos:

${mcpData}

---

¿Necesitas algo más con estos datos?`;
}

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   */
  async executeMCPTool(tool, args) {
  // ═══════════════════════════════════════════════════════════════════════════
  // INTERCEPCION LOCAL - EJECUTAR DIRECTAMENTE CON FS SI ES POSIBLE
  // ═══════════════════════════════════════════════════════════════════════════
  // Evita llamadas HTTP innecesarias y errores 404 si el servidor MCP no está
  try {
    const fs = require('fs');
    const path = require('path');
    const os = require('os');

    console.log(`⚡ [Orchestrator] Interceptando herramienta ${tool} para ejecución local...`);

    if (tool === 'list_files') {
      const dirPath = args.dirPath || process.cwd();
      if (fs.existsSync(dirPath)) {
        const files = fs.readdirSync(dirPath, { withFileTypes: true }).map(dirent => ({
          name: dirent.name,
          type: dirent.isDirectory() ? 'directory' : 'file',
          uri: path.join(dirPath, dirent.name)
        }));
        return { success: true, files };
      }
      throw new Error(`Directory not found: ${dirPath}`);
    }

    if (tool === 'read_file') {
      const filePath = args.filePath;
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        return { success: true, content, text: content };
      }
      throw new Error(`File not found: ${filePath}`);
    }

    if (tool === 'execute_command') {
      const { exec } = require('child_process');
      return new Promise((resolve) => {
        exec(args.command, { cwd: args.cwd || process.cwd() }, (error, stdout, stderr) => {
          resolve({
            success: true,
            stdout: stdout,
            stderr: stderr,
            exitCode: error ? error.code : 0
          });
        });
      });
    }
    // Fallback for other tools to network MCP
  } catch (localError) {
    console.warn(`⚠️ [Orchestrator] Falló ejecución local de ${tool}, intentando red...`, localError.message);
  }

  try {
    // Mapeo de herramientas internas a endpoints MCP reales
    const toolToEndpoint = {
      'read_file': { endpoint: '/mcp/resources/read', bodyKey: 'uri', transformArgs: (a) => ({ uri: `file://${a.filePath}` }) },
      'write_file': { endpoint: '/mcp/resources/write', bodyKey: 'uri', transformArgs: (a) => ({ uri: `file://${a.filePath}`, contents: a.content }) },
      'list_files': { endpoint: '/mcp/resources/list', bodyKey: 'uri', transformArgs: (a) => ({ uri: `file://${a.dirPath}` }) },
      'execute_command': { endpoint: '/mcp/command/execute', bodyKey: 'command', transformArgs: (a) => ({ command: a.command, cwd: a.cwd || process.cwd() }) },
      'execute_code': {
        endpoint: '/mcp/command/execute', bodyKey: 'command', transformArgs: (a) => {
          // Convertir código a comando ejecutable
          if (a.language === 'javascript' || a.language === 'js') {
            return { command: `node -e "${a.code.replace(/"/g, '\\"')}"` };
          } else if (a.language === 'python' || a.language === 'py') {
            return { command: `python -c "${a.code.replace(/"/g, '\\"')}"` };
          } else {
            return { command: a.code };
          }
        }
      },
      'git_status': { endpoint: '/mcp/command/execute', transformArgs: () => ({ command: 'git status' }) },
      'git_commit': { endpoint: '/mcp/command/execute', transformArgs: (a) => ({ command: `git add -A && git commit -m "${a.message}"` }) },
      'github_operations': { endpoint: '/mcp/git/commits', transformArgs: (a) => a }
    };

    const mapping = toolToEndpoint[tool];

    if (!mapping) {
      // Si no hay mapeo, intentar llamar directamente
      console.warn(`⚠️ [MCP] Herramienta ${tool} sin mapeo, intentando endpoint directo`);
      const response = await axios.post(
        `${this.mcpBaseUrl}/mcp/${tool}`,
        args,
        {
          headers: {
            'mcp-secret': this.mcpSecret,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );
      return response.data;
    }

    // Transformar argumentos si es necesario
    const transformedArgs = mapping.transformArgs ? mapping.transformArgs(args) : args;

    console.log(`🔧 [MCP] Ejecutando: ${mapping.endpoint}`);
    console.log(`📤 [MCP] Args:`, JSON.stringify(transformedArgs).substring(0, 200));

    const response = await axios.post(
      `${this.mcpBaseUrl}${mapping.endpoint}`,
      transformedArgs,
      {
        headers: {
          'mcp-secret': this.mcpSecret,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    console.log(`📥 [MCP] Respuesta recibida:`, JSON.stringify(response.data).substring(0, 300));

    // ═══════════════════════════════════════════════════════════════════════════
    // NORMALIZACIÓN DE RESPUESTA - CONVERTIR A FORMATO ESTÁNDAR
    // ═══════════════════════════════════════════════════════════════════════════
    const normalizedResult = this.normalizeMCPResponse(tool, response.data);

    return normalizedResult;
  } catch (error) {
    console.error(`❌ [MCP] Error ejecutando ${tool}:`, error.message);
    throw new Error(`Error ejecutando herramienta MCP ${tool}: ${error.message}`);
  }
}

/**
 * Normaliza la respuesta MCP a un formato estándar
 */
normalizeMCPResponse(tool, rawResponse) {
  // Si ya tiene success, es una respuesta normalizada
  if (rawResponse.success !== undefined && rawResponse.content !== undefined) {
    return rawResponse;
  }

  const normalized = {
    success: true,
    tool
  };

  // Normalizar según el tipo de herramienta
  if (tool === 'read_file') {
    // MCP devuelve { contents: [{ text, uri, ... }] }
    if (rawResponse.contents && Array.isArray(rawResponse.contents)) {
      normalized.content = rawResponse.contents[0]?.text || rawResponse.contents[0]?.content || '';
      normalized.metadata = rawResponse.contents[0];
    } else if (rawResponse.content) {
      normalized.content = rawResponse.content;
    } else if (rawResponse.text) {
      normalized.content = rawResponse.text;
    } else {
      normalized.content = JSON.stringify(rawResponse);
    }
  } else if (tool === 'list_files') {
    // MCP devuelve { resources: [...] }
    if (rawResponse.resources && Array.isArray(rawResponse.resources)) {
      normalized.files = rawResponse.resources.map(r => ({
        name: r.name || r.uri?.split('/').pop() || 'unknown',
        type: r.type || (r.mimeType ? 'file' : 'directory'),
        uri: r.uri
      }));
    } else if (rawResponse.files) {
      normalized.files = rawResponse.files;
    } else {
      normalized.files = [];
    }
  } else if (tool === 'execute_command' || tool === 'execute_code') {
    // MCP devuelve { stdout, stderr, exitCode }
    normalized.stdout = rawResponse.stdout || rawResponse.output || '';
    normalized.stderr = rawResponse.stderr || '';
    normalized.exitCode = rawResponse.exitCode !== undefined ? rawResponse.exitCode : 0;
    normalized.content = normalized.stdout;
  } else {
    // Respuesta genérica
    Object.assign(normalized, rawResponse);
  }

  return normalized;
}
}

module.exports = SandraOrchestrator;
