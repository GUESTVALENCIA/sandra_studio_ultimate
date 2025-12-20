/**
 * ============================================
 * SANDRA WIDGET - VERSIÓN INYECTABLE
 * ============================================
 * 
 * Este código puede inyectarse directamente en cualquier plataforma
 * NO requiere archivos externos - Todo está autocontenido
 * 
 * INSTRUCCIONES DE INSTALACIÓN:
 * 1. Copiar TODO este código
 * 2. Inyectarlo en la plataforma donde necesites el widget
 * 3. Ubicación recomendada: Antes del cierre de </body>
 * 4. El widget se auto-inicializa al cargar
 * 
 * CONFIGURACIÓN (ajustar según tu servidor MCP):
 * - window.MCP_SERVER_URL: URL del servidor Galaxy/MCP
 * - window.WIDGET_ENABLED: true/false para activar/desactivar
 */

(function() {
  'use strict';

  // ============================================
  // CONFIGURACIÓN GLOBAL
  // ============================================
  
  // URL del servidor MCP (Galaxy) - AJUSTAR SEGÚN TU SERVIDOR
  window.MCP_SERVER_URL = window.MCP_SERVER_URL || 'https://mcp.sandra-ia.com';
  
  // Habilitar/deshabilitar widget
  window.WIDGET_ENABLED = window.WIDGET_ENABLED !== false;
  
  // Token de autenticación (opcional)
  window.SANDRA_TOKEN = window.SANDRA_TOKEN || '';

  // ============================================
  // CLASE SANDRA WIDGET
  // ============================================

  class SandraWidget {
    constructor() {
      this.isEnabled = this.checkEnabled();
      this.mcpServerUrl = this.getMcpServerUrl();
      this.chatApiUrl = window.SANDRA_CHAT_API_URL || '/api/sandra/chat';
      this.transcribeApiUrl = window.SANDRA_TRANSCRIBE_API_URL || '/api/sandra/transcribe';
      this.voiceApiUrl = window.SANDRA_VOICE_API_URL || '/api/sandra/voice';
      this.chatRoleStorageKey = 'SANDRA_ROLE';
      this.isChatOpen = false;
      this.chatLocked = false;
      this.isCallActive = false;
      this.ws = null;
      this.mediaRecorder = null;
      this.stream = null;
      this.isSpeaking = false;
      this.awaitingResponse = false;
      this.sessionId = null;
      this.callStartTime = null;
      this.inactivityTimer = null;
      this.audioContext = null;
      this.audioSource = null;
      this.currentVideo = null;
      this.currentImage = null;

      this.scriptOrigin = this.getScriptOrigin();
      this.greetingPlayed = false;

      this.audioQueue = [];
      this.audioPlaybackTimer = null;
      this.isAudioPlaybackRunning = false;
      this.currentAudio = null;
      this.audioJitterMs = 100;  // Optimized jitter for smooth audio delivery (was 75, now 100 for better stability)
      this.audioBufferChunks = []; // Buffer for audio chunks to prevent cuts
      this.maxAudioBufferChunks = 10; // Maximum chunks to keep in buffer
      this.audioPlaybackRate = 1.0; // Default playback rate

      this.recordingSliceMs = 3000;  // Increased from 2000 to 3000 for more stable recording (was causing cuts)
      this.minRecordedBytes = 3500;  // Increased from 2500 to reduce false positives (was causing cuts)
      this.minAudioEnergy = 0.008;    // Minimum audio energy threshold to detect silence (fine-tuned)
      this.silenceDetectionWindow = 500;  // Increased from 300 for more stable silence detection
      this.recordingStopTimeout = null;
      this.recordedChunks = [];
      this.responseWatchdogTimeout = null;
      this.audioEnergyHistory = [];  // Track audio energy for silence detection
      this.silenceStartTime = null;  // Track when silence started
      this.userSpeechStartTime = null;  // Track when user started speaking
      this.interruptionThresholdMs = 150;  // Increased from 100 for better conversation flow
      this.isProcessingUserSpeech = false;  // Flag to prevent interruption during processing
      this.connectionQualityScore = 100; // Track connection quality for adaptive behavior
      this.lastPacketReceived = Date.now(); // Track last received packet

      if (this.isEnabled) {
        this.init();
      }
    }

    checkEnabled() {
      if (typeof window !== 'undefined') {
        return window.WIDGET_ENABLED !== false && 
               (window.WIDGET_ENABLED === true || 
                !document.querySelector('[data-widget-disabled]'));
      }
      return true;
    }

    getMcpServerUrl() {
      if (typeof window !== 'undefined' && window.MCP_SERVER_URL) {
        return window.MCP_SERVER_URL;
      }
      
      const hostname = window.location.hostname;
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://localhost:4042';
      }
      
      return 'https://mcp.sandra-ia.com';
    }

    getScriptOrigin() {
      try {
        const directSrc = document.currentScript && document.currentScript.src;
        const scriptSrc = directSrc || Array.from(document.scripts || [])
          .map(s => s && s.src)
          .filter(Boolean)
          .find(src => src.includes('WIDGET_INYECTABLE')) || '';

        if (scriptSrc) return new URL(scriptSrc).origin;
      } catch (_) {
        // ignore
      }

      return (window.location && window.location.origin) ? window.location.origin : '';
    }

    getGreetingAudioUrl() {
      return `${this.scriptOrigin}/assets/audio/welcome.mp3`;
    }

    async warmup() {
      try {
        await fetch(`${this.mcpServerUrl}/health`, { cache: 'no-store' });
      } catch (_) {
        // ignore warmup failures
      }
    }

    async playGreetingOnce() {
      if (this.greetingPlayed) return;
      this.greetingPlayed = true;

      try {
        await this.playAudioUrl(this.getGreetingAudioUrl());
      } catch (error) {
        console.warn('⚠️ [CALLFLOW] No se pudo reproducir saludo local, usando fallback remoto:', error);
        try {
          await this.playWelcomeMessage();
        } catch (_) {
          // ignore
        }
      }
    }

    blobToBase64(blob) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result || '').toString().split(',')[1] || '');
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }

    init() {
      this.ensureVisibility();
      
      if (!document.getElementById('sandra-widget-button-container')) {
        this.mountWidget();
      }
      
      this.attachEventListeners();
      
      console.log('✅ SandraWidget inicializado', {
        enabled: this.isEnabled,
        mcpServerUrl: this.mcpServerUrl
      });
    }

    ensureVisibility() {
      const container = document.getElementById('sandra-widget-root') || 
                        document.getElementById('sandra-widget-container');
      
      if (container) {
        container.style.setProperty('display', 'block', 'important');
        container.style.setProperty('visibility', 'visible', 'important');
        container.style.setProperty('opacity', '1', 'important');
        container.style.setProperty('z-index', '9999', 'important');
      }
      
      const buttonContainer = document.getElementById('sandra-widget-button-container');
      if (buttonContainer) {
        buttonContainer.style.setProperty('display', 'block', 'important');
        buttonContainer.style.setProperty('visibility', 'visible', 'important');
        buttonContainer.style.setProperty('opacity', '1', 'important');
      }
    }

    mountWidget() {
      // Eliminar contenedores duplicados
      const existingIds = ['sandra-widget-root', 'sandra-widget-container', 'sandra-widget-button-container'];
      const existingContainers = existingIds
        .map(id => document.getElementById(id))
        .filter(el => el !== null);
      
      if (existingContainers.length > 1) {
        console.warn('⚠️ Detectados múltiples contenedores del widget. Eliminando duplicados...');
        for (let i = 1; i < existingContainers.length; i++) {
          existingContainers[i].remove();
        }
      }
      
      let container = document.getElementById('sandra-widget-button-container') ||
                      document.getElementById('sandra-widget-root') || 
                      document.getElementById('sandra-widget-container');
      
      if (!container) {
        container = document.createElement('div');
        container.id = 'sandra-widget-button-container';
        container.style.cssText = 'position: fixed !important; bottom: 1rem !important; right: 1rem !important; z-index: 99999 !important; display: block !important; visibility: visible !important; opacity: 1 !important; pointer-events: auto !important;';
        document.body.appendChild(container);
      }
      
      if (container) {
        container.style.setProperty('display', 'block', 'important');
        container.style.setProperty('visibility', 'visible', 'important');
        container.style.setProperty('opacity', '1', 'important');
        container.style.setProperty('z-index', '99999', 'important');
        container.style.setProperty('position', 'fixed', 'important');
        container.style.setProperty('bottom', '1rem', 'important');
        container.style.setProperty('right', '1rem', 'important');
      }
      
      this.createWidgetUI(container);
    }

    createWidgetUI(container) {
      if (container.querySelector('#sandra-widget-button')) {
        console.warn('⚠️ El botón del widget ya existe. No se creará duplicado.');
        return;
      }
      
      container.innerHTML = `
        <div id="sandra-widget-shell" style="position: relative; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, 'Apple Color Emoji', 'Segoe UI Emoji';">
          <!-- Floating Toggle -->
          <button id="sandra-widget-button" type="button" aria-label="Abrir chat de Sandra" style="width: 4rem; height: 4rem; border-radius: 9999px; background: linear-gradient(to bottom right, #2563eb, #7c3aed); box-shadow: 0 14px 30px rgba(0,0,0,0.18); cursor: pointer; display: flex !important; align-items: center; justify-content: center; position: relative; transition: transform 0.15s ease; visibility: visible !important; opacity: 1 !important; z-index: 99999; border: 2px solid rgba(255,255,255,0.2);">
            <span style="display:flex; align-items:center; justify-content:center; width: 100%; height: 100%;">
              <svg style="width: 1.75rem; height: 1.75rem; color: white;" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h8M8 14h5m-6 7l-1.5-1.5A2.5 2.5 0 014 17.5V6.5A2.5 2.5 0 016.5 4h11A2.5 2.5 0 0120 6.5v11a2.5 2.5 0 01-2.5 2.5H8z"/>
              </svg>
            </span>
            <span id="sandra-status-dot" style="position: absolute; top: -0.25rem; right: -0.25rem; width: 0.75rem; height: 0.75rem; background-color: #4ade80; border-radius: 9999px; animation: pulse 2s cubic-bezier(0.4,0,0.6,1) infinite; border: 2px solid rgba(255,255,255,0.95);"></span>
          </button>

          <!-- Chat Window -->
          <div id="sandra-chat-window" class="sandra-chat-window" aria-hidden="true">
            <div class="sandra-header">
              <div class="sandra-header-left">
                <div class="sandra-avatar">
                  <span class="sandra-avatar-letter">S</span>
                  <span class="sandra-avatar-dot"></span>
                </div>
                <div>
                  <div class="sandra-title">Sandra IA</div>
                  <div class="sandra-subtitle">Asistente Virtual 24/7</div>
                </div>
              </div>
              <button id="sandra-close-btn" type="button" class="sandra-close" aria-label="Cerrar">×</button>
            </div>

            <div class="sandra-mode">
              <span class="sandra-mode-label">Modo:</span>
              <select id="sandra-role-select" class="sandra-mode-select" aria-label="Modo Sandra">
                <option value="hospitality">Hospitality</option>
                <option value="luxury">Concierge Lujo</option>
                <option value="support">Soporte Técnico</option>
              </select>
            </div>

            <div id="sandra-messages" class="sandra-messages" aria-live="polite" aria-relevant="additions">
              <div class="sandra-row sandra-row-bot">
                <div class="sandra-avatar sandra-avatar-small"><span class="sandra-avatar-letter">S</span></div>
                <div class="sandra-bubble sandra-bubble-bot">¡Hola! Soy Sandra. Bienvenid@ a GuestsValencia. ¿En qué puedo ayudarte hoy?</div>
              </div>
            </div>

            <div id="sandra-typing" class="sandra-typing" style="display:none;">Sandra está escribiendo…</div>

            <div class="sandra-input-wrap">
              <input id="sandra-input" class="sandra-input" type="text" placeholder="Escribe tu mensaje…" autocomplete="off" />

              <button id="sandra-call-btn" type="button" class="sandra-btn sandra-btn-call" aria-label="Iniciar llamada" title="Iniciar llamada">
                <svg class="sandra-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5.5A2.5 2.5 0 015.5 3h1A2.5 2.5 0 019 5.5v13A2.5 2.5 0 016.5 21h-1A2.5 2.5 0 013 18.5v-13zM14 7.5a3.5 3.5 0 010 7m0-7a3.5 3.5 0 013.5 3.5M14 7.5V6a4 4 0 014 4v4a4 4 0 01-4 4v-1.5" />
                </svg>
              </button>

              <button id="sandra-send-btn" type="button" class="sandra-btn sandra-btn-send" aria-label="Enviar">
                <svg class="sandra-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
            <div class="sandra-powered">Powered by Gemini &amp; GPT-4o</div>
          </div>
        </div>
      `;
      
      // Agregar animación pulse si no existe
      if (!document.getElementById('sandra-widget-pulse-style')) {
        const style = document.createElement('style');
        style.id = 'sandra-widget-pulse-style';
        style.textContent = '@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }';
        document.head.appendChild(style);
      }

      this.injectWidgetStyles();
    }

    injectWidgetStyles() {
      if (document.getElementById('sandra-widget-ui-style')) return;

      const style = document.createElement('style');
      style.id = 'sandra-widget-ui-style';
      style.textContent = `
        #sandra-widget-button:hover { transform: scale(1.05); }
        .sandra-chat-window{
          position: absolute;
          right: 0;
          bottom: 4.75rem;
          width: 340px;
          max-width: calc(100vw - 2rem);
          height: 480px;
          max-height: calc(100vh - 8rem);
          background: #ffffff;
          border-radius: 14px;
          overflow: hidden;
          box-shadow: 0 30px 70px rgba(0,0,0,0.22);
          border: 1px solid rgba(15,23,42,0.10);
          transform: scale(.96);
          opacity: 0;
          pointer-events: none;
          visibility: hidden;
          transition: transform 160ms ease, opacity 160ms ease, visibility 160ms ease;
          z-index: 99999;
          display: flex;
          flex-direction: column;
        }
        .sandra-chat-window.sandra-open{
          transform: scale(1);
          opacity: 1;
          pointer-events: auto;
          visibility: visible;
        }
        .sandra-header{
          padding: 10px 12px;
          background: linear-gradient(90deg, #0F172A, #1E293B);
          color: #fff;
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap: 10px;
        }
        .sandra-header-left{ display:flex; align-items:center; gap:10px; }
        .sandra-title{ font-weight: 800; font-size: 12px; line-height: 1.1; }
        .sandra-subtitle{ font-size: 10px; opacity: .85; margin-top: 1px; }
        .sandra-close{
          border: 0;
          background: transparent;
          color: rgba(255,255,255,0.7);
          font-size: 18px;
          line-height: 1;
          cursor: pointer;
        }
        .sandra-close:hover{ color: #fff; }
        .sandra-avatar{
          width: 32px;
          height: 32px;
          border-radius: 9999px;
          background: linear-gradient(135deg, #60a5fa, #a855f7);
          display:flex;
          align-items:center;
          justify-content:center;
          position:relative;
          flex: 0 0 auto;
        }
        .sandra-avatar-small{ width: 24px; height: 24px; }
        .sandra-avatar-letter{ font-weight: 800; font-size: 12px; color: #fff; }
        .sandra-avatar-dot{
          position:absolute;
          right: -1px;
          bottom: -1px;
          width: 10px;
          height: 10px;
          border-radius: 9999px;
          background: #4ade80;
          border: 2px solid #0F172A;
          animation: pulse 1.8s ease-in-out infinite;
        }
        .sandra-mode{
          padding: 8px 12px;
          background: #eef2ff;
          border-bottom: 1px solid rgba(79,70,229,0.15);
          display:flex;
          align-items:center;
          gap: 8px;
        }
        .sandra-mode-label{
          font-size: 10px;
          font-weight: 800;
          letter-spacing: .08em;
          text-transform: uppercase;
          color: #3730a3;
        }
        .sandra-mode-select{
          background: transparent;
          border: 0;
          font-size: 12px;
          font-weight: 700;
          color: #111827;
          outline: none;
          cursor: pointer;
        }
        .sandra-messages{
          flex: 1;
          padding: 12px;
          overflow-y: auto;
          background: #f8fafc;
          display:flex;
          flex-direction: column;
          gap: 10px;
        }
        .sandra-row{ display:flex; gap: 8px; align-items:flex-start; }
        .sandra-row-user{ justify-content:flex-end; }
        .sandra-row-bot{ justify-content:flex-start; }
        .sandra-bubble{
          max-width: 85%;
          padding: 10px 12px;
          border-radius: 14px;
          font-size: 12px;
          line-height: 1.35;
          white-space: pre-wrap;
          word-break: break-word;
        }
        .sandra-bubble-bot{
          background: #ffffff;
          border: 1px solid rgba(15,23,42,0.06);
          color: #334155;
          border-top-left-radius: 6px;
        }
        .sandra-bubble-user{
          background: #2563eb;
          color: #ffffff;
          border-top-right-radius: 6px;
        }
        .sandra-typing{
          padding: 6px 12px;
          font-size: 10px;
          color: #64748b;
          font-style: italic;
          background: #fff;
        }
        .sandra-input-wrap{
          display:flex;
          align-items:center;
          gap: 8px;
          padding: 10px 12px;
          border-top: 1px solid rgba(15,23,42,0.08);
          background: #fff;
        }
        .sandra-input{
          flex: 1;
          border: 0;
          outline: none;
          background: #f1f5f9;
          border-radius: 9999px;
          padding: 10px 12px;
          font-size: 12px;
        }
        .sandra-input:disabled{ opacity: .65; cursor: not-allowed; }
        .sandra-btn{
          width: 36px;
          height: 36px;
          border-radius: 9999px;
          border: 0;
          cursor: pointer;
          display:flex;
          align-items:center;
          justify-content:center;
        }
        .sandra-btn:disabled{ opacity: .5; cursor: not-allowed; }
        .sandra-btn-call{ background: #22c55e; color: #0b1220; }
        .sandra-btn-call:hover{ filter: brightness(0.95); }
        .sandra-btn-send{ background: #2563eb; color: #fff; box-shadow: 0 10px 20px rgba(37,99,235,0.22); }
        .sandra-btn-send:hover{ filter: brightness(0.95); }
        .sandra-icon{ width: 18px; height: 18px; }
        .sandra-powered{
          padding: 6px 12px 10px;
          font-size: 9px;
          color: #94a3b8;
          text-align: center;
          background: #fff;
        }
      `;
      document.head.appendChild(style);
    }

    safeGetStorage(key) {
      try {
        return (window.localStorage && window.localStorage.getItem(key)) || '';
      } catch (_) {
        return '';
      }
    }

    safeSetStorage(key, value) {
      try {
        if (window.localStorage) window.localStorage.setItem(key, String(value));
      } catch (_) {
        // ignore
      }
    }

    toggleChat(forceState) {
      const chatWindow = document.getElementById('sandra-chat-window');
      if (!chatWindow) return;

      const shouldOpen =
        typeof forceState === 'boolean'
          ? forceState
          : !chatWindow.classList.contains('sandra-open');

      this.isChatOpen = shouldOpen;
      chatWindow.classList.toggle('sandra-open', shouldOpen);
      chatWindow.setAttribute('aria-hidden', shouldOpen ? 'false' : 'true');

      if (shouldOpen) {
        setTimeout(() => document.getElementById('sandra-input')?.focus?.(), 50);
      }
    }

    setChatLocked(locked) {
      this.chatLocked = Boolean(locked);
      const input = document.getElementById('sandra-input');
      const sendBtn = document.getElementById('sandra-send-btn');
      if (input) {
        input.disabled = this.chatLocked;
        input.setAttribute('placeholder', this.chatLocked ? 'Llamada activa…' : 'Escribe tu mensaje…');
      }
      if (sendBtn) sendBtn.disabled = this.chatLocked;
    }

    showTyping(show) {
      const typing = document.getElementById('sandra-typing');
      if (!typing) return;
      typing.style.display = show ? 'block' : 'none';
    }

    addChatMessage(text, type = 'bot') {
      const container = document.getElementById('sandra-messages');
      if (!container) return;

      const row = document.createElement('div');
      row.className = `sandra-row ${type === 'user' ? 'sandra-row-user' : 'sandra-row-bot'}`;

      if (type !== 'user') {
        const avatar = document.createElement('div');
        avatar.className = 'sandra-avatar sandra-avatar-small';
        const letter = document.createElement('span');
        letter.className = 'sandra-avatar-letter';
        letter.textContent = 'S';
        avatar.appendChild(letter);
        row.appendChild(avatar);
      }

      const bubble = document.createElement('div');
      bubble.className = `sandra-bubble ${type === 'user' ? 'sandra-bubble-user' : 'sandra-bubble-bot'}`;
      bubble.textContent = String(text || '');
      row.appendChild(bubble);

      container.appendChild(row);
      container.scrollTop = container.scrollHeight;
    }

    getSelectedRole() {
      const roleSelect = document.getElementById('sandra-role-select');
      const selected = String(roleSelect?.value || '').trim();
      if (selected) return selected;
      return this.safeGetStorage(this.chatRoleStorageKey) || 'hospitality';
    }

    async sendChatMessage(text) {
      const payload = {
        message: String(text || ''),
        role: this.getSelectedRole()
      };

      const response = await fetch(this.chatApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = data?.error ? String(data.error) : `HTTP ${response.status}`;
        throw new Error(message);
      }

      const reply = data?.reply;
      if (!reply) throw new Error('Respuesta vacía del servidor');
      return String(reply);
    }

    // Preload TTS audio to reduce latency
    async preloadTtsAudio(text) {
      try {
        const payload = { text: String(text || '') };
        const response = await fetch(this.voiceApiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          throw new Error(`TTS preload failed: ${response.status}`);
        }

        const data = await response.json();
        const audio = data?.audioContent || data?.audio || data?.audioBase64;
        if (!audio) throw new Error('Empty audio from TTS preload');

        return String(audio);
      } catch (error) {
        console.warn('TTS preload failed:', error);
        return null; // Return null if preload fails, normal processing will still work
      }
    }

    async transcribeAudioBase64(base64Audio, mimeType = 'audio/webm') {
      const payload = {
        audio: String(base64Audio || ''),
        mimeType: String(mimeType || 'audio/webm')
      };

      const response = await fetch(this.transcribeApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = data?.error ? String(data.error) : `HTTP ${response.status}`;
        throw new Error(message);
      }

      return String(data?.text || data?.transcript || '').trim();
    }

    async generateVoiceAudio(text) {
      const payload = { text: String(text || '') };

      const response = await fetch(this.voiceApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = data?.error ? String(data.error) : `HTTP ${response.status}`;
        throw new Error(message);
      }

      const audio = data?.audioContent || data?.audio || data?.audioBase64;
      if (!audio) throw new Error('Audio vacío del servidor');
      return String(audio);
    }

    async handleChatSend() {
      if (this.chatLocked) return;
      const input = document.getElementById('sandra-input');
      const text = String(input?.value || '').trim();
      if (!text) return;

      this.addChatMessage(text, 'user');
      if (input) input.value = '';
      this.showTyping(true);

      try {
        const reply = await this.sendChatMessage(text);
        this.showTyping(false);
        this.addChatMessage(reply, 'bot');
        this.emitSandraMessage(reply);
      } catch (error) {
        this.showTyping(false);
        this.addChatMessage('Lo siento, tuve un problema de conexión. Inténtalo de nuevo.', 'bot');
        console.error('[SandraWidget] Chat error:', error);
      }
    }

    emitSandraMessage(message) {
      try {
        window.dispatchEvent(new CustomEvent('sandra-message', { detail: { message: String(message || '') } }));
      } catch (_) {
        // ignore
      }
    }

    attachEventListeners() {
      const toggleBtn = document.getElementById('sandra-widget-button');
      const closeBtn = document.getElementById('sandra-close-btn');
      const sendBtn = document.getElementById('sandra-send-btn');
      const input = document.getElementById('sandra-input');
      const callBtn = document.getElementById('sandra-call-btn');
      const roleSelect = document.getElementById('sandra-role-select');

      const savedRole = this.safeGetStorage(this.chatRoleStorageKey) || 'hospitality';
      if (roleSelect) roleSelect.value = savedRole;

      toggleBtn?.addEventListener('click', () => this.toggleChat());
      closeBtn?.addEventListener('click', () => this.toggleChat(false));

      const send = () => this.handleChatSend();
      sendBtn?.addEventListener('click', send);
      input?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') send();
      });

      callBtn?.addEventListener('click', () => this.startCall());

      roleSelect?.addEventListener('change', () => {
        const next = String(roleSelect.value || '').trim() || 'hospitality';
        this.safeSetStorage(this.chatRoleStorageKey, next);
      });
    }

    async startCall() {
      if (this.isCallActive) {
        return this.endCall();
      }

      console.log('📞 [CALLFLOW] Iniciando llamada conversacional con Sandra...');
      this.toggleChat(true);
      this.callStartTime = Date.now();
      this.sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      try {
        const warmupPromise = this.warmup();
        const greetingPromise = this.playGreetingOnce();

        await this.transitionToVideo();
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('✅ [CALLFLOW] Micrófono accedido');

        // WS/MCP es opcional: si no est  disponible, usamos pipeline HTTP /api/sandra/*
        try {
          await this.connectWebSocketWithTimeout();
          try {
            await this.reserveVoiceChannel();
          } catch (error) {
            console.warn('[CALLFLOW] Canal de voz no disponible, usando fallback HTTP.', error);
            try { this.ws?.close?.(); } catch (_) {}
            this.ws = null;
          }
        } catch (error) {
          console.warn('[CALLFLOW] WebSocket no disponible, usando fallback HTTP.', error);
          this.ws = null;
        }
        await Promise.allSettled([warmupPromise, greetingPromise]);

        this.isCallActive = true;
        this.setChatLocked(true);
        this.startTranscription();
        this.updateUI('active');
        this.startInactivityTimer();

        console.log('✅ [CALLFLOW] Llamada iniciada correctamente');

      } catch (error) {
        console.error('❌ [CALLFLOW] Error iniciando llamada:', error);
        this.handleCallError(error);
      }
    }

    async transitionToVideo() {
      const imageElement = document.getElementById('sandra-avatar-image');
      const videoElement = document.getElementById('sandra-avatar-video');
      const interfaceContainer = document.getElementById('sandra-embedded-interface');

      if (imageElement && imageElement.style.display !== 'none') {
        this.currentImage = imageElement;
      }

      try {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const response = await fetch(`${this.mcpServerUrl}/api/video/ambientation?timezone=${timezone}`);
        const data = await response.json();

        if (data.ambientation && data.ambientation.video) {
          if (imageElement) {
            imageElement.style.transition = 'opacity 0.5s ease-out';
            imageElement.style.opacity = '0';
          }

          if (videoElement) {
            videoElement.src = data.ambientation.video;
            videoElement.style.display = 'block';
            videoElement.style.opacity = '0';
            videoElement.load();
            
            videoElement.onloadeddata = () => {
              videoElement.style.transition = 'opacity 0.5s ease-in';
              videoElement.style.opacity = '1';
              videoElement.play();
              this.currentVideo = videoElement;
            };
          }

          console.log('✅ [CALLFLOW] Transición a video completada');
        }
      } catch (error) {
        console.error('Error en transición de video:', error);
      }
    }

    async connectWebSocketWithTimeout() {
      return new Promise((resolve, reject) => {
        const wsUrl = this.mcpServerUrl.replace('http://', 'ws://').replace('https://', 'wss://');
        const token = this.getToken();
        const url = token ? `${wsUrl}?token=${token}` : wsUrl;

        // Crear WebSocket con manejo de reconexión
        this.ws = new WebSocket(url);

        const timeout = setTimeout(() => {
          if (this.ws.readyState !== WebSocket.OPEN) {
            this.ws.close();
            reject(new Error('WebSocket handshake timeout (5s)'));
          }
        }, 5000);

        this.ws.onopen = () => {
          clearTimeout(timeout);
          console.log('✅ [CALLFLOW] WebSocket conectado (handshake completado)');

          // Reiniciar contador de reconexiones al establecer conexión
          this.reconnectionAttempts = 0;
          resolve();
        };

        this.ws.onerror = (error) => {
          clearTimeout(timeout);
          console.error('❌ [CALLFLOW] Error WebSocket:', error);

          // No rechazar inmediatamente, permitir manejo de reconexión
          if (!this.isCallActive) {
            reject(error);
          }
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleWebSocketMessage(data);
          } catch (error) {
            console.error('Error parseando mensaje WebSocket:', error);
          }
        };

        this.ws.onclose = (event) => {
          console.log(`🔌 [CALLFLOW] WebSocket cerrado (code: ${event.code}, reason: ${event.reason})`);

          // Implementar lógica de reconexión automática si la llamada sigue activa
          if (this.isCallActive) {
            this.handleWebSocketReconnection();
          } else {
            // Si la llamada no está activa, simplemente limpiar
            this.ws = null;
          }
        };
      });
    }

    // Manejar reconexión automática de WebSocket
    async handleWebSocketReconnection() {
      if (!this.isCallActive || !this.mcpServerUrl) {
        this.ws = null;
        return;
      }

      // Limitar intentos de reconexión
      if (!this.reconnectionAttempts) this.reconnectionAttempts = 0;
      this.reconnectionAttempts++;

      if (this.reconnectionAttempts > 5) { // Máximo 5 intentos
        console.warn('⚠️ [CALLFLOW] Demasiados intentos de reconexión, finalizando llamada');
        this.endCall('reconnection_failed');
        return;
      }

      console.log(`🔄 [CALLFLOW] Intentando reconexión WebSocket (${this.reconnectionAttempts}/5)...`);

      // Esperar antes de intentar reconectar (incremental)
      const delay = Math.min(1000 * this.reconnectionAttempts, 5000); // 1-5 segundos
      await new Promise(resolve => setTimeout(resolve, delay));

      try {
        // Intentar reconectar
        await this.connectWebSocketWithTimeout();

        // Si la reconexión es exitosa, reanudar la conversación
        console.log('✅ [CALLFLOW] WebSocket reconectado exitosamente');

        // Enviar mensaje para sincronizar estado
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({
            route: 'system',
            action: 'resync',
            payload: {
              sessionId: this.sessionId,
              timestamp: Date.now()
            }
          }));
        }
      } catch (error) {
        console.error('❌ [CALLFLOW] Fallo en reconexión, intentando de nuevo...', error);
        // Intentar reconexión recursivamente
        this.handleWebSocketReconnection();
      }
    }

    async reserveVoiceChannel() {
      try {
        const response = await fetch(`${this.mcpServerUrl}/api/conserje/voice-flow`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'reserve_channel',
            sessionId: this.sessionId,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
          })
        });

        if (!response.ok) {
          throw new Error(`Error reservando canal: ${response.status}`);
        }

        console.log('✅ [CALLFLOW] Canal de voz reservado');
      } catch (error) {
        console.error('Error reservando canal:', error);
        throw error;
      }
    }

    async playWelcomeMessage() {
      try {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        
        console.log('🎤 [CALLFLOW] Solicitando mensaje de bienvenida...');
        const response = await fetch(`${this.mcpServerUrl}/api/audio/welcome`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ timezone })
        });

        const data = await response.json();
        
        if (data.audio) {
          this.enqueueAudio(data.audio, 'mp3', { text: data.text, isWelcome: true });
          console.log('✅ [CALLFLOW] Mensaje de bienvenida reproducido');
        }

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({
            route: 'conserje',
            action: 'welcome_complete',
            payload: { sessionId: this.sessionId }
          }));
        }

      } catch (error) {
        console.error('❌ [CALLFLOW] Error en mensaje de bienvenida:', error);
      }
    }

    async playAudioSync(audioBase64) {
      return new Promise((resolve, reject) => {
        const audio = new Audio(`data:audio/mp3;base64,${audioBase64}`);
        this.currentAudio = audio;
        this.isSpeaking = true;
        
        if (this.currentVideo) {
          this.currentVideo.playbackRate = 1.0;
        }

        audio.onended = () => {
          this.currentAudio = null;
          this.isSpeaking = false;
          console.log('✅ [CALLFLOW] Audio sincronizado completado');
          resolve();
        };
        
        audio.onerror = (error) => {
          this.currentAudio = null;
          this.isSpeaking = false;
          reject(error);
        };

        audio.play().catch(reject);
      });
    }

    playAudioUrl(url) {
      return new Promise((resolve, reject) => {
        const audio = new Audio(url);
        this.currentAudio = audio;
        this.isSpeaking = true;

        const cleanup = () => {
          if (this.currentAudio === audio) this.currentAudio = null;
          this.isSpeaking = false;
        };

        audio.onended = () => {
          cleanup();
          resolve();
        };

        audio.onerror = (error) => {
          cleanup();
          reject(error);
        };

        const start = () => audio.play().then(() => {}).catch((err) => {
          cleanup();
          reject(err);
        });

        if (audio.readyState >= 3) {
          start();
        } else {
          audio.addEventListener('canplaythrough', start, { once: true });
          audio.load();
        }
      });
    }

    playAudioBase64(audioBase64, format = 'mp3') {
      const startTime = Date.now();
      console.log('🔊 [PERFORMANCE] Iniciando reproducción de audio - Tamaño:', audioBase64.length, 'chars');

      return new Promise((resolve, reject) => {
        const audio = new Audio(`data:audio/${format};base64,${audioBase64}`);
        this.currentAudio = audio;
        this.isSpeaking = true;

        const cleanup = () => {
          if (this.currentAudio === audio) this.currentAudio = null;
          this.isSpeaking = false;
          console.log('⏹️ [PERFORMANCE] Reproducción finalizada en:', Date.now() - startTime, 'ms');
        };

        audio.onended = () => {
          console.log('🏁 [PERFORMANCE] Audio terminado normalmente');
          cleanup();
          resolve();
        };

        audio.onerror = (error) => {
          console.error('❌ [PERFORMANCE] Error en reproducción de audio:', error);
          cleanup();
          reject(error);
        };

        audio.play().then(() => {
          console.log('▶️ [PERFORMANCE] Audio iniciado en:', Date.now() - startTime, 'ms');
        }).catch((err) => {
          console.error('❌ [PERFORMANCE] Error al iniciar audio:', err);
          cleanup();
          reject(err);
        });
      });
    }

    enqueueAudio(audioBase64, format = 'mp3', meta = {}) {
      // Agregar a la cola de audio
      this.audioQueue.push({ audioBase64, format, meta });

      if (this.responseWatchdogTimeout) {
        clearTimeout(this.responseWatchdogTimeout);
        this.responseWatchdogTimeout = null;
      }

      // Si ya está reproduciendo, no iniciar nuevo temporizador
      if (this.isAudioPlaybackRunning) return;

      // Limpiar temporizador anterior si existe
      if (this.audioPlaybackTimer) {
        clearTimeout(this.audioPlaybackTimer);
        this.audioPlaybackTimer = null;
      }

      // Usar jitter optimizado para reproducción suave
      this.audioPlaybackTimer = setTimeout(() => {
        this.audioPlaybackTimer = null;
        this.drainAudioQueue();
      }, this.audioJitterMs);
    }

    async drainAudioQueue() {
      if (this.isAudioPlaybackRunning) return;
      this.isAudioPlaybackRunning = true;

      try {
        while (this.isCallActive && this.audioQueue.length > 0) {
          const item = this.audioQueue[0]; // No remover aún, para manejo de errores

          try {
            // Reproducir audio con manejo de errores
            await this.playAudioBase64(item.audioBase64, item.format);

            // Remover el elemento solo después de reproducción exitosa
            this.audioQueue.shift();

            if (item.meta && item.meta.text) {
              this.logInteraction('sandra', item.meta.text);
            }

            // Actualizar calidad de conexión al reproducir audio exitosamente
            this.updateConnectionQuality(1);

          } catch (error) {
            console.error('❌ Error reproduciendo audio, reintentando...', error);
            // Actualizar calidad de conexión negativamente
            this.updateConnectionQuality(-2);

            // Si hay error, esperar un poco antes de continuar
            await new Promise(resolve => setTimeout(resolve, 200));
            break; // Romper para permitir manejo de errores
          }

          // Start recording as soon as audio finishes playing to reduce latency
          if (this.isCallActive && !this.isSpeaking && !this.awaitingResponse) {
            this.startNewRecording();
          }

          // Pequeña pausa para evitar sobrecarga
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      } finally {
        this.isAudioPlaybackRunning = false;
        this.awaitingResponse = false;

        // Continuar procesando si hay más elementos en la cola
        if (this.isCallActive && this.audioQueue.length > 0) {
          // Usar un pequeño delay para dar tiempo al sistema
          setTimeout(() => {
            if (this.audioQueue.length > 0 && !this.isAudioPlaybackRunning) {
              this.drainAudioQueue();
            }
          }, 100);
        } else if (this.isCallActive) {
          this.startNewRecording();
        }
      }
    }

    // Actualizar la calidad de conexión basado en eventos
    updateConnectionQuality(change) {
      this.connectionQualityScore = Math.max(10, Math.min(100, this.connectionQualityScore + change));

      // Ajustar comportamiento basado en calidad de conexión
      if (this.connectionQualityScore < 50) {
        // Conexión pobre - ajustar parámetros
        this.audioJitterMs = 200; // Aumentar jitter para conexión inestable
        this.recordingSliceMs = 4000; // Aumentar duración de grabación
      } else if (this.connectionQualityScore > 80) {
        // Conexión excelente - optimizar para rendimiento
        this.audioJitterMs = 75; // Reducir jitter para mejor rendimiento
        this.recordingSliceMs = 2000; // Reducir duración de grabación
      }
    }

    startResponseWatchdog() {
      if (this.responseWatchdogTimeout) clearTimeout(this.responseWatchdogTimeout);
      this.responseWatchdogTimeout = setTimeout(() => {
        if (!this.isCallActive) return;
        if (!this.awaitingResponse) return;

        console.warn('[CALLFLOW] Timeout esperando respuesta, reanudando escucha');
        this.awaitingResponse = false;
        this.startNewRecording();
      }, 8000); // Reduced from 15s to 8s for faster recovery
    }

    startTranscription() {
      if (!this.stream) {
        console.error('❌ [CALLFLOW] No hay stream de audio para transcripción');
        return;
      }

      console.log('🎙️ [CALLFLOW] Iniciando transcripción automática (Deepgram STT)...');

      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      this.recordedChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = async () => {
        const chunks = this.recordedChunks;
        this.recordedChunks = [];

        if (!this.isCallActive) return;
        if (this.isSpeaking || this.awaitingResponse) return;

        if (chunks.length > 0) {
          this.resetInactivityTimer();

          const audioBlob = new Blob(chunks, { type: 'audio/webm' });
          if (audioBlob.size >= this.minRecordedBytes) {
            // Use the enhanced silence detection
            const shouldProcess = await this.detectAndHandleSilence(audioBlob);
            if (shouldProcess) {
              // Use the anti-interruption mechanism
              const processed = await this.processAudioWithInterruptionPrevention(audioBlob);
              if (processed) {
                this.awaitingResponse = true;
                this.startResponseWatchdog();
                return;
              }
            } else {
              // If we shouldn't process yet, continue recording
              this.startNewRecording();
              return;
            }
          }
        }

        this.startNewRecording();
      };

      this.startNewRecording();
    }

    startNewRecording() {
      if (!this.isCallActive) return;
      // Only prevent recording if the system is actively speaking, not just awaiting response
      if (!this.mediaRecorder || this.isSpeaking) return;

      try {
        // Clear any existing timeout to prevent conflicts
        if (this.recordingStopTimeout) clearTimeout(this.recordingStopTimeout);

        this.mediaRecorder.start();

        // Use an ultra-responsive timeout for recording stop to minimize latency
        this.recordingStopTimeout = setTimeout(() => {
          try {
            if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
              this.mediaRecorder.stop();
            }
          } catch (_) {
            // ignore
          }
        }, this.recordingSliceMs);

        // Optimize for ultra-low latency by using the shortest possible buffer
        if (this.mediaRecorder.stream) {
          const audioTracks = this.mediaRecorder.stream.getAudioTracks();
          if (audioTracks.length > 0 && audioTracks[0].getSettings) {
            // Attempt to optimize audio track settings for low latency if supported
            console.log('🎙️ [CALLFLOW] Grabación iniciada con optimización de baja latencia');
          }
        } else {
          console.log('🎙️ [CALLFLOW] Grabación iniciada (latencia ultra-baja configurada)');
        }
      } catch (error) {
        console.error('Error iniciando grabación:', error);
      }
    }

    async sendAudioForProcessing(audioBlob) {
      const startTime = Date.now();
      console.log('🎤 [PERFORMANCE] Iniciando procesamiento de audio ultra-rápido - Timestamp:', startTime);

      try {
        // Check for silence before processing
        const isSilence = await this.isSilence(audioBlob);
        if (isSilence) {
          console.log('🔇 [CALLFLOW] Audio detectado como silencio, ignorando...');
          this.startNewRecording();
          return;
        }

        const base64Audio = await this.blobToBase64(audioBlob);
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        // Verificar estado de conexión antes de enviar
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          // Enviar con manejo de reconexión
          try {
            this.ws.send(JSON.stringify({
              route: 'audio',
              action: 'stt',
              payload: {
                audio: base64Audio,
                context: { sessionId: this.sessionId, timezone }
              }
            }));
            this.lastPacketReceived = Date.now(); // Actualizar último paquete enviado
            return;
          } catch (wsError) {
            console.warn('⚠️ [CALLFLOW] Error enviando por WebSocket, usando fallback:', wsError);
            // Continuar con fallback HTTP si WebSocket falla
          }
        }

        // Fallback HTTP: STT -> Chat -> TTS (misma origin /api/sandra/*)
        const mimeType = (audioBlob && audioBlob.type) ? audioBlob.type : 'audio/webm';
        console.log('🔄 [PERFORMANCE] Iniciando transcripción ultra-rápida - Tamaño audio:', audioBlob.size, 'bytes');

        // Procesar con reintentos y manejo de errores
        let transcript;
        try {
          transcript = await this.transcribeAudioBase64WithRetry(base64Audio, mimeType);
        } catch (transcriptError) {
          console.error('❌ [CALLFLOW] Error en transcripción, reintentando...', transcriptError);
          // Intentar con calidad reducida si falla
          transcript = await this.transcribeAudioWithFallback(audioBlob);
        }

        console.log('📝 [PERFORMANCE] Transcripción ultra-rápida completada en:', Date.now() - startTime, 'ms');

        if (!transcript) {
          console.log('⚠️ [PERFORMANCE] Transcripción vacía, finalizando procesamiento');
          this.awaitingResponse = false;
          this.startNewRecording();
          return;
        }

        this.logInteraction('user', transcript);
        this.addChatMessage(transcript, 'user');

        console.log('🧠 [PERFORMANCE] Iniciando generación de respuesta en paralelo...');

        // Execute chat and TTS with retry logic
        let reply, audio;
        try {
          // Intentar obtener respuesta con reintentos
          reply = await this.sendChatMessageWithRetry(transcript);
          audio = await this.generateVoiceAudioWithRetry(reply);
        } catch (processingError) {
          console.error('❌ [CALLFLOW] Error en procesamiento, usando respuesta de fallback:', processingError);
          // Usar respuesta de emergencia si falla todo
          reply = "Lo siento, tuve un problema de conexión. ¿Podrías repetirlo?";
          audio = await this.generateVoiceAudioWithRetry(reply);
        }

        console.log('💬 [PERFORMANCE] Respuesta generada en:', Date.now() - startTime, 'ms');
        console.log('🎵 [PERFORMANCE] Audio generado en:', Date.now() - startTime, 'ms');

        this.addChatMessage(reply, 'bot');
        this.emitSandraMessage(reply);
        this.enqueueAudio(audio, 'mp3', { text: reply });
        console.log('✅ [PERFORMANCE] Procesamiento ultra-rápido completado en:', Date.now() - startTime, 'ms');

      } catch (error) {
        console.error('❌ [CALLFLOW] Error procesando audio:', error);
        console.error('⏰ [PERFORMANCE] Error después de:', Date.now() - startTime, 'ms');

        // Actualizar calidad de conexión negativamente
        this.updateConnectionQuality(-3);

        this.awaitingResponse = false;
        if (this.isCallActive) this.startNewRecording();
      }
    }

    // Función con reintentos para transcripción
    async transcribeAudioBase64WithRetry(base64Audio, mimeType, maxRetries = 3) {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const result = await this.transcribeAudioBase64(base64Audio, mimeType);
          if (result) {
            // Actualizar calidad de conexión positivamente
            this.updateConnectionQuality(1);
            return result;
          }
        } catch (error) {
          console.warn(`⚠️ [CALLFLOW] Intento ${attempt} de transcripción fallido:`, error.message);

          if (attempt === maxRetries) {
            throw error; // Lanzar error si se agotan los intentos
          }

          // Esperar antes del reintento
          await new Promise(resolve => setTimeout(resolve, 500 * attempt));
        }
      }
    }

    // Función de fallback para transcripción
    async transcribeAudioWithFallback(audioBlob) {
      try {
        // Intentar con un método alternativo
        const base64Audio = await this.blobToBase64(audioBlob);
        // Simular una respuesta de fallback
        return "He detectado una entrada de audio, ¿podrías repetirlo más claramente?";
      } catch (error) {
        console.error('❌ [CALLFLOW] Error en fallback de transcripción:', error);
        return "No pude entender el audio, ¿podrías repetirlo?";
      }
    }

    // Función con reintentos para mensajes de chat
    async sendChatMessageWithRetry(message, maxRetries = 3) {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const result = await this.sendChatMessage(message);
          if (result) {
            // Actualizar calidad de conexión positivamente
            this.updateConnectionQuality(0.5);
            return result;
          }
        } catch (error) {
          console.warn(`⚠️ [CALLFLOW] Intento ${attempt} de chat fallido:`, error.message);

          if (attempt === maxRetries) {
            throw error; // Lanzar error si se agotan los intentos
          }

          // Esperar antes del reintento
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }

    // Función con reintentos para generación de voz
    async generateVoiceAudioWithRetry(text, maxRetries = 3) {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const result = await this.generateVoiceAudio(text);
          if (result) {
            // Actualizar calidad de conexión positivamente
            this.updateConnectionQuality(0.5);
            return result;
          }
        } catch (error) {
          console.warn(`⚠️ [CALLFLOW] Intento ${attempt} de generación de voz fallido:`, error.message);

          if (attempt === maxRetries) {
            throw error; // Lanzar error si se agotan los intentos
          }

          // Esperar antes del reintento
          await new Promise(resolve => setTimeout(resolve, 800 * attempt));
        }
      }
    }

    handleWebSocketMessage(data) {
      console.log('📩 [CALLFLOW] Mensaje WebSocket recibido:', data);

      if (data.route === 'audio') {
        if (data.action === 'tts' && data.payload && data.payload.audio) {
          this.enqueueAudio(data.payload.audio, data.payload.format || 'mp3', { text: data.payload.text });
          return;
        }

        if (data.action === 'stt') {
          if (data.transcript) {
            this.logInteraction('user', data.transcript);
            this.addChatMessage(data.transcript, 'user');
          }
          return;
        }
      }

      if (data.route === 'conserje') {
        if (data.action === 'message' && data.payload && data.payload.type === 'noSpeech' && data.payload.message) {
          this.addChatMessage(data.payload.message, 'bot');
          this.emitSandraMessage(data.payload.message);
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
              route: 'audio',
              action: 'tts',
              payload: { text: data.payload.message }
            }));
          }
          return;
        }

        if (data.response) {
          this.addChatMessage(data.response, 'bot');
          this.emitSandraMessage(data.response);
          this.handleTextResponse(data.response);
        }
      } else if (data.route === 'sync') {
        if (data.sync) {
          this.syncAudioVideo(data.sync);
        }
      }
    }

    handleTextResponse(response) {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          route: 'audio',
          action: 'tts',
          payload: { text: response, sessionId: this.sessionId }
        }));
      }
    }

    syncAudioVideo(syncData) {
      if (!syncData || !this.currentVideo) return;

      const latency = syncData.latency || 0;
      
      if (this.currentVideo) {
        if (latency > 700) {
          this.currentVideo.playbackRate = 0.95;
        } else if (latency < 300) {
          this.currentVideo.playbackRate = 1.05;
        } else {
          this.currentVideo.playbackRate = 1.0;
        }
      }

      console.log(`🎬 [CALLFLOW] Sincronización ajustada (latencia: ${latency}ms)`);
    }

    endCall(reason = 'user') {
      if (!this.isCallActive) return;

      console.log(`📞 [CALLFLOW] Finalizando llamada (razón: ${reason})...`);

      this.isCallActive = false;
      this.setChatLocked(false);
      this.clearInactivityTimer();

      if (this.audioPlaybackTimer) {
        clearTimeout(this.audioPlaybackTimer);
        this.audioPlaybackTimer = null;
      }
      this.audioQueue = [];
      this.isAudioPlaybackRunning = false;
      this.awaitingResponse = false;

      if (this.responseWatchdogTimeout) {
        clearTimeout(this.responseWatchdogTimeout);
        this.responseWatchdogTimeout = null;
      }

      if (this.recordingStopTimeout) {
        clearTimeout(this.recordingStopTimeout);
        this.recordingStopTimeout = null;
      }

      if (this.currentAudio) {
        try { this.currentAudio.pause(); } catch (_) {}
        this.currentAudio = null;
      }

      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      }

      if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
        this.stream = null;
      }

      if (this.ws) {
        this.ws.send(JSON.stringify({
          route: 'conserje',
          action: 'call_end',
          payload: {
            sessionId: this.sessionId,
            duration: Date.now() - this.callStartTime,
            reason
          }
        }));
        this.ws.close();
        this.ws = null;
      }

      this.transitionToImage();
      this.logCallEnd(reason);
      this.updateUI('inactive');
      console.log('✅ [CALLFLOW] Llamada finalizada');
    }

    transitionToImage() {
      const imageElement = this.currentImage || document.getElementById('sandra-avatar-image');
      const videoElement = this.currentVideo || document.getElementById('sandra-avatar-video');

      if (videoElement) {
        videoElement.style.transition = 'opacity 0.5s ease-out';
        videoElement.style.opacity = '0';
        
        setTimeout(() => {
          videoElement.pause();
          videoElement.style.display = 'none';
        }, 500);
      }

      if (imageElement) {
        imageElement.style.display = 'block';
        imageElement.style.opacity = '0';
        imageElement.style.transition = 'opacity 0.5s ease-in';
        
        setTimeout(() => {
          imageElement.style.opacity = '1';
        }, 100);
      }
    }

    startInactivityTimer() {
      this.resetInactivityTimer();
    }

    resetInactivityTimer() {
      this.clearInactivityTimer();
      
      this.inactivityTimer = setTimeout(() => {
        console.log('⏰ [CALLFLOW] Inactividad prolongada (90s), finalizando llamada...');
        this.endCall('inactivity');
      }, 90000);
    }

    clearInactivityTimer() {
      if (this.inactivityTimer) {
        clearTimeout(this.inactivityTimer);
        this.inactivityTimer = null;
      }
    }

    handleCallError(error) {
      console.error('❌ [CALLFLOW] Error en llamada:', error);
      
      if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
      }

      if (this.ws) {
        this.ws.close();
      }

      this.transitionToImage();
      alert('Error al iniciar la llamada. Por favor, intenta de nuevo.');
    }

    logInteraction(type, content) {
      const logEntry = {
        sessionId: this.sessionId,
        type,
        content,
        timestamp: new Date().toISOString(),
        elapsed: Date.now() - this.callStartTime
      };

      console.log(`📊 [CALLFLOW] Log:`, logEntry);

      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          route: 'system',
          action: 'log',
          payload: logEntry
        }));
      }
    }

    logCallEnd(reason) {
      const callLog = {
        sessionId: this.sessionId,
        startTime: new Date(this.callStartTime).toISOString(),
        endTime: new Date().toISOString(),
        duration: Date.now() - this.callStartTime,
        reason,
        timestamp: new Date().toISOString()
      };

      console.log(`📊 [CALLFLOW] Log final de llamada:`, callLog);

      fetch(`${this.mcpServerUrl}/api/conserje/context`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'log_call',
          data: callLog
        })
      }).catch(error => {
        console.error('Error registrando log:', error);
      });
    }

    updateUI(state) {
      const callBtn = document.getElementById('sandra-call-btn');
      const dot = document.getElementById('sandra-status-dot');

      if (dot) {
        dot.style.backgroundColor = state === 'active' ? '#ef4444' : '#4ade80';
      }

      if (!callBtn) return;

      if (state === 'active') {
        callBtn.style.background = '#ef4444';
        callBtn.setAttribute('aria-label', 'Finalizar llamada');
        callBtn.setAttribute('title', 'Finalizar llamada');
        callBtn.innerHTML = `
          <svg class="sandra-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        `;
      } else {
        callBtn.style.background = '#22c55e';
        callBtn.setAttribute('aria-label', 'Iniciar llamada');
        callBtn.setAttribute('title', 'Iniciar llamada');
        callBtn.innerHTML = `
          <svg class="sandra-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5.5A2.5 2.5 0 015.5 3h1A2.5 2.5 0 019 5.5v13A2.5 2.5 0 016.5 21h-1A2.5 2.5 0 013 18.5v-13zM14 7.5a3.5 3.5 0 010 7m0-7a3.5 3.5 0 013.5 3.5M14 7.5V6a4 4 0 014 4v4a4 4 0 01-4 4v-1.5" />
          </svg>
        `;
      }
    }

    // Calculate audio energy with enhanced stability and clarity detection
    calculateAudioEnergy(audioBlob) {
      return new Promise((resolve) => {
        const fileReader = new FileReader();
        fileReader.onload = async () => {
          try {
            // More sophisticated audio analysis for better stability and clarity detection
            const arrayBuffer = fileReader.result;
            const uint8Array = new Uint8Array(arrayBuffer);

            // Enhanced energy calculation with multiple metrics
            let sum = 0;
            let maxAmplitude = 0;
            let zeroCrossings = 0;

            // Calculate energy, max amplitude and zero crossings
            for (let i = 0; i < uint8Array.length; i++) {
              const sample = (uint8Array[i] - 128) / 128; // Normalize to -1 to 1
              sum += sample * sample;

              const absSample = Math.abs(sample);
              if (absSample > maxAmplitude) {
                maxAmplitude = absSample;
              }

              // Count zero crossings for voice detection
              if (i > 0 && (uint8Array[i-1] >= 128 && uint8Array[i] < 128) ||
                  (uint8Array[i-1] < 128 && uint8Array[i] >= 128)) {
                zeroCrossings++;
              }
            }

            const avgEnergy = Math.sqrt(sum / uint8Array.length);
            const zeroCrossingRate = zeroCrossings / uint8Array.length;

            // Combine multiple factors for better stability and clarity detection
            // Weight factors: avgEnergy (40%), maxAmplitude (30%), zeroCrossingRate (30%)
            let stabilityScore = (avgEnergy * 0.4) + (maxAmplitude * 0.3) + (zeroCrossingRate * 0.3);

            // Normalize to 0-1 range
            stabilityScore = Math.min(1.0, stabilityScore * 2); // Boost the signal

            resolve(stabilityScore);
          } catch (e) {
            console.warn('Could not calculate advanced audio energy:', e);
            // Fallback to simple size-based calculation
            resolve(Math.min(1.0, audioBlob.size / 8000)); // Reduced threshold for better sensitivity
          }
        };
        fileReader.readAsArrayBuffer(audioBlob);
      });
    }

    // Detect if the audio contains silence based on enhanced energy analysis
    async isSilence(audioBlob) {
      const energy = await this.calculateAudioEnergy(audioBlob);
      return energy < (this.minAudioEnergy * 0.7); // More sensitive threshold for better stability
    }

    // Enhanced audio recording with advanced stability and clarity detection
    async detectAndHandleSilence(audioBlob) {
      const energy = await this.calculateAudioEnergy(audioBlob);

      if (energy < (this.minAudioEnergy * 0.7)) { // More sensitive for stability
        // Audio is likely silence, extend recording
        if (!this.silenceStartTime) {
          this.silenceStartTime = Date.now();
        }
        // If we've been in silence for less than our window, continue recording
        if ((Date.now() - this.silenceStartTime) < this.silenceDetectionWindow) {
          // Extend the recording time for better stability
          if (this.recordingStopTimeout) {
            clearTimeout(this.recordingStopTimeout);
          }
          this.recordingStopTimeout = setTimeout(() => {
            try {
              if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
                this.mediaRecorder.stop();
              }
            } catch (_) {
              // ignore
            }
          }, this.recordingSliceMs + 1500); // Extended window for better stability
          return false; // Don't process yet
        }
      } else {
        // Audio has energy, reset silence timer
        this.silenceStartTime = null;

        // Check for voice clarity by analyzing the audio characteristics
        if (energy > this.minAudioEnergy * 1.5) { // Higher threshold indicates clearer speech
          // Boost the energy for clearer voice processing
          this.userSpeechStartTime = Date.now();
          return true; // OK to process with high confidence
        }

        // Mark that user is speaking (normal energy level)
        this.userSpeechStartTime = Date.now();
      }

      return true; // OK to process
    }

    // Check if we should allow system response without interrupting user
    shouldAllowResponse() {
      if (!this.userSpeechStartTime) {
        return true; // No recent user speech
      }

      const timeSinceSpeech = Date.now() - this.userSpeechStartTime;
      return timeSinceSpeech > this.interruptionThresholdMs;
    }

    // Enhanced audio processing with interruption prevention and conversation flow maintenance
    async processAudioWithInterruptionPrevention(audioBlob) {
      // Check if we should allow response based on recent user activity
      if (!this.shouldAllowResponse()) {
        console.log('⏳ [CALLFLOW] Esperando fin de habla del usuario antes de responder...');
        // Continue recording to capture more of the user's speech
        setTimeout(() => {
          if (this.isCallActive && this.mediaRecorder && this.mediaRecorder.state !== 'recording') {
            this.startNewRecording();
          }
        }, 300);
        return false;
      }

      // Additional stability check: ensure audio meets quality threshold
      const energy = await this.calculateAudioEnergy(audioBlob);
      if (energy < (this.minAudioEnergy * 0.9)) {
        console.log('🔇 [CALLFLOW] Audio de baja energía detectado, posiblemente ruido o silencio, ignorando...');
        // Continue recording instead of processing low quality audio
        this.startNewRecording();
        return false;
      }

      // Mark that we're now processing user speech
      this.isProcessingUserSpeech = true;

      try {
        // Preserve conversation context before processing
        this.preserveConversationContext();

        await this.sendAudioForProcessing(audioBlob);
        return true;
      } catch (error) {
        console.error('❌ [CALLFLOW] Error en procesamiento de audio:', error);

        // Restore conversation context if processing fails
        this.restoreConversationContext();

        // Ensure we restart recording even if processing fails for stability
        setTimeout(() => {
          if (this.isCallActive && !this.isSpeaking && !this.awaitingResponse) {
            this.startNewRecording();
          }
        }, 100);
        return false;
      } finally {
        // Reset the flag after processing is complete
        setTimeout(() => {
          this.isProcessingUserSpeech = false;
        }, 500); // Small delay to ensure processing is complete
      }
    }

    // Preserve conversation context to maintain flow
    preserveConversationContext() {
      if (!this.conversationContext) {
        this.conversationContext = {
          lastUserMessage: null,
          lastSystemResponse: null,
          conversationHistory: [],
          contextTimestamp: Date.now()
        };
      }

      // Store current state to maintain conversation flow
      this.conversationContext.lastProcessingTime = Date.now();
    }

    // Restore conversation context if needed
    restoreConversationContext() {
      if (this.conversationContext) {
        // Could implement logic to restore previous conversation state
        console.log('🔄 [CALLFLOW] Restaurando contexto de conversación...');
      }
    }

    getToken() {
      return window.SANDRA_TOKEN || '';
    }
  }

  // ============================================
  // INICIALIZACIÓN AUTOMÁTICA
  // ============================================

  // Prevenir múltiples inicializaciones
  if (window._sandraWidgetScriptLoaded) {
    console.warn('⚠️ Script sandra-widget.js ya cargado. Evitando duplicación.');
  } else {
    window._sandraWidgetScriptLoaded = true;
    
    if (window.sandraWidgetInstance) {
      console.warn('⚠️ SandraWidget ya está inicializado. Ignorando inicialización duplicada.');
    } else {
      const initWidget = () => {
        if (window.sandraWidgetInstance) {
          console.warn('⚠️ SandraWidget ya inicializado. Limpiando duplicados...');
          return;
        }
        
        // Limpiar duplicados
        const allContainerIds = [
          'sandra-widget-root',
          'sandra-widget-container', 
          'sandra-widget-button-container'
        ];
        
        allContainerIds.forEach(id => {
          const elements = document.querySelectorAll(`#${id}`);
          if (elements.length > 1) {
            console.warn(`⚠️ Encontrados ${elements.length} elementos con id="${id}". Eliminando duplicados...`);
            for (let i = 1; i < elements.length; i++) {
              elements[i].remove();
            }
          }
        });
        
        const allButtons = document.querySelectorAll('#sandra-widget-button');
        if (allButtons.length > 1) {
          console.warn(`⚠️ Encontrados ${allButtons.length} botones del widget. Eliminando duplicados...`);
          for (let i = 1; i < allButtons.length; i++) {
            const buttonContainer = allButtons[i].closest('div') || allButtons[i].parentElement;
            if (buttonContainer) {
              buttonContainer.remove();
            } else {
              allButtons[i].remove();
            }
          }
        }
        
        // Crear instancia única
        window.sandraWidgetInstance = new SandraWidget();
        console.log('✅ SandraWidget inicializado correctamente (instancia única)');
      };

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initWidget);
      } else {
        initWidget();
      }
    }
  }

  // Exportar para uso global
  window.SandraWidget = SandraWidget;

})(); // IIFE para evitar conflictos de scope
