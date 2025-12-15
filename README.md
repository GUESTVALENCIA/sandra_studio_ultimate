# Guests Valencia PWA (postproducción) + Widget Sandra IA

Postproducción (Vercel): `https://pwa-chi-six.vercel.app/`

## Estructura

- `public/index.html`: página principal.
- `public/assets/js/galaxy/WIDGET_INYECTABLE.js`: widget (chat + botón verde de llamada).
- `api/api-gateway.js`: función serverless (Vercel) para `/api/sandra/*`.
- `vercel.json`: config de Vercel (SPA + `/api/*` -> gateway).

## Backend (Vercel)

- El widget usa:
  - `POST /api/sandra/chat` (Gemini → fallback OpenAI)
  - `POST /api/sandra/transcribe` (Deepgram)
  - `POST /api/sandra/voice` (Cartesia TTS)
- Variables de entorno requeridas en Vercel: `GEMINI_API_KEY`, `OPENAI_API_KEY` (fallback), `DEEPGRAM_API_KEY`, `CARTESIA_API_KEY`.

## Config MCP (opcional)

- Para forzar la URL del servidor MCP desde el navegador: `https://pwa-chi-six.vercel.app/?mcp=https://TU_SERVER` (se guarda en `localStorage` como `MCP_SERVER_URL`).
