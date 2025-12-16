import { GoogleGenerativeAI } from "@google/generative-ai";

// --- CONFIGURATION ---
const API_KEY = localStorage.getItem('GEMINI_API_KEY') || 'INSERT_YOUR_API_KEY_HERE';

let genAI = null;
let model = null;
let chatSession = null;

// --- STATE ---
let isListening = false;
let isSpeaking = false;
let recognition = null;
let synthesis = window.speechSynthesis;
let isCallMode = false; // "Llamar" loop mode

// --- INITIALIZATION ---
function initGemini() {
    if (API_KEY !== 'INSERT_YOUR_API_KEY_HERE') {
        genAI = new GoogleGenerativeAI(API_KEY);
        model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        startChatSession();
    } else {
        console.warn("Gemini API Key missing.");
    }
}

function startChatSession() {
    if (!model) return;
    chatSession = model.startChat({
        history: [
            {
                role: "user",
                parts: [{ text: "Hola. Eres Sandrita, una asistente de IA divertida y cariñosa para una niña de 7 años llamada Sandra. Tu tono es infantil, alegre y educativo. Hablas español. Respuestas cortas." }],
            },
            {
                role: "model",
                parts: [{ text: "¡Hola Sandra! 🌈 Soy Sandrita, tu amiga mágica. ¡Qué emoción estar contigo! ¿A qué quieres jugar hoy? 🦄" }],
            },
        ],
    });
}

// --- VOICE (WEB SPEECH API) ---
function initVoice() {
    if ('webkitSpeechRecognition' in window) {
        recognition = new webkitSpeechRecognition();
        recognition.continuous = false; // We handle loop manually to avoid echo
        recognition.lang = 'es-ES';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
            isListening = true;
            updateStatus("Escuchando...");
        };

        recognition.onend = () => {
            isListening = false;
            if (isCallMode && !isSpeaking) {
                // Restart listening if call mode is active and not speaking
                setTimeout(() => {
                    try { recognition.start(); } catch(e){}
                }, 100);
            }
        };

        recognition.onresult = async (event) => {
            const transcript = event.results[0][0].transcript;
            console.log("Heard:", transcript);
            updateStatus("Pensando... ✨");
            await processInput(transcript);
        };

        recognition.onerror = (event) => {
            console.error("Speech error", event.error);
            updateStatus("Error: " + event.error);
            if (isCallMode) stopInteraction();
        };
    } else {
        alert("Tu navegador no soporta voz. Usa Chrome.");
    }
}

// --- LOGIC ---
async function processInput(text) {
    if (!chatSession) {
        speak("No estoy conectada a mi cerebro mágico todavía.");
        return;
    }

    try {
        const result = await chatSession.sendMessage(text);
        const response = result.response.text();
        console.log("Gemini:", response);
        speak(response);
    } catch (error) {
        console.error("Gemini Error:", error);
        speak("Ups, me he mareado un poquito. ¿Me lo repites?");
    }
}

function speak(text) {
    if (synthesis.speaking) synthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-ES';
    utterance.pitch = 1.2; // Child-like
    utterance.rate = 1.0;

    // Echo Cancellation Trick: Don't listen while speaking
    isSpeaking = true;
    if (isListening) recognition.stop();

    utterance.onend = () => {
        isSpeaking = false;
        if (isCallMode) {
            // Resume listening in call mode
            setTimeout(() => {
                try { recognition.start(); } catch(e){}
            }, 500); // 500ms buffer to avoid hearing itself
        } else {
            document.getElementById('voice-visualizer').classList.remove('active');
        }
    };

    synthesis.speak(utterance);
}

// --- UI ACTIONS ---
window.startOneShotVoice = () => {
    isCallMode = false;
    document.getElementById('voice-visualizer').classList.add('active');
    try { recognition.start(); } catch(e) { console.log(e); }
};

window.startCallLoop = () => {
    isCallMode = true;
    document.getElementById('voice-visualizer').classList.add('active');
    speak("¡Hola Sandra! Estoy lista para hablar. ¿Qué me cuentas?");
};

window.stopInteraction = () => {
    isCallMode = false;
    isListening = false;
    synthesis.cancel();
    recognition.stop();
    document.getElementById('voice-visualizer').classList.remove('active');
};

window.triggerPreset = (type) => {
    const prompts = {
        'unicorn': "Cuéntame un cuento corto sobre un unicornio volador que busca un arcoíris.",
        'candy': "Describe un castillo hecho de chuches y chocolate.",
        'mermaid': "Cuéntame qué hacen las sirenas en el fondo del mar."
    };
    processInput(prompts[type]);
};

window.handleAction = (action) => {
    if (action === 'video') speak("¡Vamos a crear un video mágico! (Esta función estará lista pronto)");
    if (action === 'imagine') speak("Cierra los ojos... ¿Qué quieres imaginar? (Generación de imagen pronto)");
    if (action === 'nano') speak("Nano dice: ¡Hola! Cómete una banana.");
};

window.openYouTube = () => {
    window.open('https://www.youtube.com/kids/', '_blank');
};

window.openCamera = () => {
    // Basic camera implementation
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.click();
};

window.updateStatus = (text) => {
    document.getElementById('status-text').innerText = text;
};

// --- BOOTSTRAP ---
window.addEventListener('DOMContentLoaded', () => {
    initVoice();
    initGemini();

    // Prompt for key if missing (Simulated for this demo)
    if (API_KEY === 'INSERT_YOUR_API_KEY_HERE') {
        const key = prompt("Por favor, introduce tu Gemini API Key para Sandrita:");
        if (key) {
            localStorage.setItem('GEMINI_API_KEY', key);
            location.reload();
        }
    }
});
