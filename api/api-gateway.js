// Vercel Serverless Function - API Gateway
// Adapted from Netlify function for Vercel compatibility

// --- SANDRA CORE ENGINE (Adapted for Serverless) ---
const GLOBAL_CONVERSATION_RULES = `
REGLAS CONVERSACIONALES GLOBALES (Sandra IA 8.0 Pro):
- Responde SIEMPRE en español neutro, con buena ortografía y gramática.
- Usa párrafos cortos y bien separados.
- Actúa como una experta en Hospitalidad y Turismo para Guests Valencia.
- Si te preguntan por disponibilidad, ofrece revisar datos en tiempo real.
- Brevedad estricta: máximo 4 frases salvo que se pida detalle.
`;

class AIOrchestrator {
  constructor() {
    this.providers = {
      openai: {
        url: 'https://api.openai.com/v1/chat/completions',
        model: 'gpt-4o'
      },
      gemini: {
        url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent',
        model: 'gemini-1.5-pro'
      },
      cartesia: {
        url: 'https://api.cartesia.ai/tts/bytes',
        model: 'sonic-multilingual',
        defaultVoice: '2d5b0e6cf361460aa7fc47e3cee4b30c'
      },
      deepgram: {
        url: 'https://api.deepgram.com/v1/listen?model=nova-2&language=es'
      }
    };
  }

  async generateResponse(shortPrompt, context = 'hospitality') {
    const fullSystemPrompt = `${GLOBAL_CONVERSATION_RULES}\nRole: ${context}`;

    try {
      console.log("Attempting Gemini...");
      return await this.callGemini(shortPrompt, fullSystemPrompt);
    } catch (error) {
      console.warn("Gemini Failed, falling back to OpenAI", error.message);
      return await this.callOpenAI(shortPrompt, fullSystemPrompt);
    }
  }

  async callGemini(prompt, systemPrompt) {
    if (!process.env.GEMINI_API_KEY) throw new Error("Missing Gemini Key");

    const response = await fetch(`${this.providers.gemini.url}?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: `${systemPrompt}\n\nUser: ${prompt}` }]
        }]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Gemini API Error body: ${errorText.slice(0, 2000)}`);
      throw new Error(`Gemini API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Validate response structure
    if (!data || !data.candidates || !Array.isArray(data.candidates) || data.candidates.length === 0) {
      throw new Error(`Gemini API returned invalid response: no candidates found. Response: ${JSON.stringify(data)}`);
    }

    const candidate = data.candidates[0];
    if (!candidate || !candidate.content) {
      throw new Error(`Gemini API returned invalid candidate structure. Response: ${JSON.stringify(data)}`);
    }

    if (!candidate.content.parts || !Array.isArray(candidate.content.parts) || candidate.content.parts.length === 0) {
      throw new Error(`Gemini API returned invalid content parts. Response: ${JSON.stringify(data)}`);
    }

    const text = candidate.content.parts[0].text;
    if (!text || typeof text !== 'string') {
      throw new Error(`Gemini API returned invalid text content. Response: ${JSON.stringify(data)}`);
    }

    return text;
  }

  async callOpenAI(prompt, systemPrompt) {
    if (!process.env.OPENAI_API_KEY) throw new Error("Missing OpenAI Key");

    const response = await fetch(this.providers.openai.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: this.providers.openai.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`OpenAI API Error body: ${errorText.slice(0, 2000)}`);
      throw new Error(`OpenAI API Error: ${response.status} - ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data || !data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
      throw new Error(`OpenAI API: Unexpected response structure - no choices. Response: ${JSON.stringify(data)}`);
    }
    
    const choice = data.choices[0];
    if (!choice.message || !choice.message.content) {
      throw new Error(`OpenAI API: Unexpected response structure - no message content. Response: ${JSON.stringify(data)}`);
    }
    
    const content = choice.message.content;
    if (typeof content !== 'string') {
      throw new Error(`OpenAI API: Unexpected response structure - content not a string. Response: ${JSON.stringify(data)}`);
    }
    
    return content;
  }

  async generateVoice(text, voiceId) {
    if (!process.env.CARTESIA_API_KEY) throw new Error("Missing Cartesia Key");

    const selectedVoice = voiceId || this.providers.cartesia.defaultVoice;

    const response = await fetch(this.providers.cartesia.url, {
      method: "POST",
      headers: {
        "Cartesia-Version": "2024-06-10",
        "X-API-Key": process.env.CARTESIA_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model_id: this.providers.cartesia.model,
        transcript: text,
        voice: {
          mode: "id",
          id: selectedVoice
        },
        output_format: {
          container: "mp3",
          sample_rate: 44100
        }
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error(`Cartesia Error body: ${err.slice(0, 2000)}`);
      throw new Error(`Cartesia Error: ${response.status} - ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer).toString('base64');
  }

  async transcribeAudio(audioBuffer, contentType = "application/octet-stream") {
    if (!process.env.DEEPGRAM_API_KEY) throw new Error("Missing Deepgram Key");

    const response = await fetch(this.providers.deepgram.url, {
      method: "POST",
      headers: {
        "Authorization": `Token ${process.env.DEEPGRAM_API_KEY}`,
        "Content-Type": contentType
      },
      body: audioBuffer
    });

    if (!response.ok) {
      const err = await response.text();
      console.error(`Deepgram Error body: ${err.slice(0, 2000)}`);
      throw new Error(`Deepgram Error: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data || !data.results) {
      throw new Error(`Deepgram API: Unexpected response structure - no results. Response: ${JSON.stringify(data)}`);
    }
    
    if (!data.results.channels || !Array.isArray(data.results.channels) || data.results.channels.length === 0) {
      throw new Error(`Deepgram API: Unexpected response structure - no channels or empty channels array. Response: ${JSON.stringify(data)}`);
    }
    
    const channel = data.results.channels[0];
    if (!channel.alternatives || !Array.isArray(channel.alternatives) || channel.alternatives.length === 0) {
      throw new Error(`Deepgram API: Unexpected response structure - no alternatives or empty alternatives array. Response: ${JSON.stringify(data)}`);
    }
    
    const alternative = channel.alternatives[0];
    if (!alternative.transcript) {
      throw new Error(`Deepgram API: Unexpected response structure - no transcript in alternative. Response: ${JSON.stringify(data)}`);
    }
    
    return alternative.transcript;
  }
}

// Global Orchestrator Instance
const orchestrator = new AIOrchestrator();

// Helper function to parse multipart/form-data from raw buffer
function parseMultipartFormData(buffer, contentType) {
  const boundary = contentType?.split('boundary=')[1]?.trim();
  
  if (!boundary) {
    throw new Error('No boundary found in Content-Type');
  }

  const fields = {};
  const files = {};
  
  // Convert buffer to string for parsing
  const bufferStr = buffer.toString('binary');
  
  // Find the final boundary marker (--boundary--)
  const finalBoundary = `--${boundary}--`;
  const hasFinalBoundary = bufferStr.endsWith(finalBoundary) || bufferStr.includes(finalBoundary);
  
  // Split by boundary, but preserve the content
  const boundaryMarker = `--${boundary}`;
  const parts = bufferStr.split(boundaryMarker);
  
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    
    // Skip empty parts
    if (!part || part.trim() === '') continue;
    
    // Check if this is the final boundary marker (ends with --)
    // The final part should be just '--' or empty after the final boundary
    if (i === parts.length - 1 && (part.trim() === '--' || part.trim() === '')) {
      continue; // This is the final boundary marker
    }
    
    // Skip if this part is just the final boundary marker
    if (part.trim() === '--' && i === parts.length - 1) {
      continue;
    }
    
    // Split headers and body
    const headerBodySplit = part.split('\r\n\r\n');
    if (headerBodySplit.length < 2) continue;
    
    const headers = headerBodySplit[0];
    const body = headerBodySplit.slice(1).join('\r\n\r\n');
    
    // Remove trailing CRLF from body if present
    const cleanBody = body.replace(/\r\n$/, '');
    
    if (!headers || !cleanBody) continue;
    
    const contentDisposition = headers.match(/Content-Disposition:.*name="([^"]+)"/);
    if (!contentDisposition) continue;
    
    const fieldName = contentDisposition[1];
    const filenameMatch = headers.match(/filename="([^"]+)"/);
    
    if (filenameMatch) {
      // It's a file - preserve all binary data, including any '--' sequences
      files[fieldName] = {
        data: Buffer.from(cleanBody, 'binary'),
        filename: filenameMatch[1],
        contentType: headers.match(/Content-Type: ([^\r\n]+)/)?.[1]?.trim() || 'application/octet-stream'
      };
    } else {
      // It's a regular field
      fields[fieldName] = cleanBody.trim();
    }
  }
  
  return { fields, files };
}

// Helper to read raw body from request
async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// --- VERCEL SERVERLESS HANDLER ---
// Define handler function first
const handler = async (req, res) => {
  // CORS Headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    return res.status(200).end();
  }

  try {
    // Extract endpoint from URL
    // Vercel routes: /api/sandra/chat -> endpoint: sandra/chat
    let endpoint = req.url || '';
    // Remove query string
    endpoint = endpoint.split('?')[0];
    // Remove /api/ prefix if present
    endpoint = endpoint.replace(/^\/api\//, '').replace(/^\/|\/$/g, '');

    // Parse body based on content type
    const contentType = req.headers['content-type'] || '';
    let parsedBody = null;
    let rawBody = null;

    // Read request body for POST requests (bodyParser is disabled)
    if (req.method === 'POST') {
      rawBody = await getRawBody(req);
      
      if (contentType.includes('multipart/form-data')) {
        // Multipart will be handled in the transcribe endpoint
        parsedBody = rawBody;
      } else if (contentType.includes('application/json')) {
        // Parse JSON
        try {
          parsedBody = JSON.parse(rawBody.toString('utf8'));
        } catch (error) {
          res.setHeader('Access-Control-Allow-Origin', '*');
          return res.status(400).json({ error: `Invalid JSON: ${error.message}` });
        }
      } else {
        // Try to parse as JSON, fallback to string
        try {
          parsedBody = JSON.parse(rawBody.toString('utf8'));
        } catch {
          parsedBody = rawBody.toString('utf8');
        }
      }
    }

    if (req.method === 'POST') {
      switch (endpoint) {
        case 'sandra/chat':
          if (!parsedBody || !parsedBody.message) {
            res.setHeader('Access-Control-Allow-Origin', '*');
            return res.status(400).json({ error: 'Missing message in request body' });
          }
          const chatBody = parsedBody;
          const reply = await orchestrator.generateResponse(chatBody.message, chatBody.role || 'hospitality');
          res.setHeader('Access-Control-Allow-Origin', '*');
          return res.status(200).json({ reply });

        case 'sandra/voice':
          if (!parsedBody || !parsedBody.text) {
            res.setHeader('Access-Control-Allow-Origin', '*');
            return res.status(400).json({ error: 'Missing text in request body' });
          }
          const voiceBody = parsedBody;
          const audioBase64 = await orchestrator.generateVoice(voiceBody.text, voiceBody.voiceId);
          res.setHeader('Access-Control-Allow-Origin', '*');
          return res.status(200).json({ audioContent: audioBase64 });

        case 'sandra/transcribe':
          // Handle binary audio data - supports multipart/form-data, raw binary, and JSON
          let audioData;

          try {
            if (contentType.includes('multipart/form-data')) {
              // Use already-read rawBody for multipart data
              const formData = parseMultipartFormData(rawBody, contentType);
              
              // Look for audio file in form data
              if (formData.files.audio) {
                audioData = formData.files.audio.data;
              } else if (formData.files.file) {
                audioData = formData.files.file.data;
              } else if (formData.fields.audio) {
                // Audio as base64 string in field
                audioData = Buffer.from(formData.fields.audio, 'base64');
              } else {
                res.setHeader('Access-Control-Allow-Origin', '*');
                return res.status(400).json({ error: 'No audio file found in multipart form data. Expected field: "audio" or "file"' });
              }
            } else if (Buffer.isBuffer(rawBody)) {
              // Raw binary data (already read from stream)
              audioData = rawBody;
            } else if (parsedBody && typeof parsedBody === 'object') {
              // JSON object with audio data
              if (parsedBody.audio || parsedBody.data) {
                audioData = Buffer.from(parsedBody.audio || parsedBody.data, 'base64');
              } else {
                res.setHeader('Access-Control-Allow-Origin', '*');
                return res.status(400).json({ error: 'Invalid audio data format in object. Expected "audio" or "data" field' });
              }
            } else if (rawBody) {
              // Raw body as string or buffer - try base64 first
              try {
                audioData = Buffer.from(rawBody.toString('utf8'), 'base64');
              } catch {
                // If base64 fails, treat as binary
                audioData = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'binary');
              }
            } else {
              res.setHeader('Access-Control-Allow-Origin', '*');
              return res.status(400).json({ error: 'No audio data provided or unsupported format' });
            }

            if (!audioData || audioData.length === 0) {
              res.setHeader('Access-Control-Allow-Origin', '*');
              return res.status(400).json({ error: 'Audio data is empty' });
            }

            const audioContentType =
              (parsedBody && typeof parsedBody === 'object' && (parsedBody.mimeType || parsedBody.contentType)) ||
              (!contentType.includes('application/json') && !contentType.includes('multipart/form-data') ? contentType : '') ||
              'application/octet-stream';

            const transcript = await orchestrator.transcribeAudio(audioData, audioContentType);
            res.setHeader('Access-Control-Allow-Origin', '*');
            return res.status(200).json({ text: transcript });
          } catch (parseError) {
            console.error('Error parsing audio data:', parseError);
            res.setHeader('Access-Control-Allow-Origin', '*');
            return res.status(400).json({ error: `Failed to parse audio data: ${parseError.message}` });
          }

        case 'paypal/create-order':
          res.setHeader('Access-Control-Allow-Origin', '*');
          return res.status(200).json({ id: "ORDER-" + Date.now(), status: "CREATED" });

        default:
          res.setHeader('Access-Control-Allow-Origin', '*');
          return res.status(404).json({ error: `Endpoint '${endpoint}' not found` });
      }
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(405).json({ error: 'Method Not Allowed' });

  } catch (error) {
    console.error("API Gateway Error:", error);
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(500).json({ error: error.message || "Internal Server Error" });
  }
};

// --- VERCEL CONFIGURATION ---
// Disable body parser for multipart/form-data handling
// This allows us to read the raw stream for multipart data
// IMPORTANT: Assign config AFTER assigning the handler to preserve both
handler.config = {
  api: {
    bodyParser: false, // Disable automatic body parsing to handle multipart manually
  },
};

// Export handler with config attached
module.exports = handler;
