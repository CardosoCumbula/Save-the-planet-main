
import { GoogleGenAI, Type, Schema, Modality } from "@google/genai";
import { Lesson, ExerciseType, GroundingSource } from "../types";

// Google Gemma 4 is accessed through the official Google GenAI SDK (@google/genai)
// and the Gemini API, which hosts it (see ai.google.dev/gemma/docs/core/gemma_on_gemini_api).
// The API key is read ONLY from the VITE_GEMINI_API_KEY environment variable (Vite
// exposes VITE_-prefixed vars via import.meta.env). It is never hardcoded in source.
// The model ID can be overridden with VITE_GEMMA_MODEL if your provider exposes a
// different handle; the default matches Google's Gemini API (gemma-4-31b-it).
const GEMMA_MODEL = import.meta.env.VITE_GEMMA_MODEL || 'gemini-3.5-flash-lite';

const GEMMA_MODEL_FALLBACKS: string[] = [
  GEMMA_MODEL,
  'gemini-3.1-flash-lite',
];

/** Read the API key from the environment, throwing a clear error if it is missing. */
function getApiKey(): string {
  const key = import.meta.env.VITE_GEMINI_API_KEY;
  if (!key || key.trim() === '' || key.includes('your_')) {
    throw new Error(
      'Gemma API key is missing or not set. Create a local .env.local in the project ' +
      'root with:  VITE_GEMINI_API_KEY=<your key>  then restart the dev server.'
    );
  }
  return key as string;
}

// The GoogleGenAI client is created lazily inside the calls that need it, so a
// missing or invalid key produces a catchable error instead of crashing the app
// at module load (which caused a blank page).
function getClient(): GoogleGenAI {
  return new GoogleGenAI({ apiKey: getApiKey() });
}

// Polyfill for crypto.randomUUID for iOS < 15.4 and insecure contexts
function generateUUID(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
  } catch (e) {
    // Fallback if randomUUID fails
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
function extractJson(text: string): any {
  if (!text) throw new Error("Empty response");
  try { return JSON.parse(text); } catch {}
  const noFences = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  try { return JSON.parse(noFences); } catch {}
  const start = noFences.indexOf("{");
  const end = noFences.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try { return JSON.parse(noFences.slice(start, end + 1)); } catch {}
  }
  throw new Error("No valid JSON found in AI response");
}

/**
 * Retry a function on transient API errors (503/502/429/UNAVAILABLE).
 * Waits 1s -> 2s -> 4s between attempts. Non-transient errors throw immediately.
 */
async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e: any) {
      lastErr = e;
      const msg = String(e?.message ?? e);
      const status = e?.status ?? e?.error?.code;
      const isTransient =
        status === 503 || status === 502 || status === 429 ||
        /503|502|429|UNAVAILABLE|overloaded|high demand|RESOURCE_EXHAUSTED/i.test(msg);
      if (!isTransient) throw e;
      if (i < attempts - 1) {
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
      }
    }
  }
  throw lastErr;
}

/**
 * Call generateContent with retry, then fall back to the next model in the
 * chain if the current model keeps failing. Returns the first successful
 * response. Throws the last error if all models fail.
 */
async function generateWithFallback(params: {
  contents: any;
  config?: any;
}) {
  let lastErr: any;
  for (const model of GEMMA_MODEL_FALLBACKS) {
    try {
      return await withRetry(() =>
        getClient().models.generateContent({
          model,
          contents: params.contents,
          config: params.config,
        })
      );
    } catch (e) {
      lastErr = e;
      console.warn(`[gemmaService] model ${model} failed, trying next`, e);
    }
  }
  throw lastErr;
}

const EXPLANATION_VARIATIONS = [
    "That's spot on!", 
    "You nailed it!", 
    "Pawsome job!", 
    "Exactly right!", 
    "You're a natural!",
    "Bark-tastic!",
    "Great green thinking!",
    "High five, human!"
];

// --- Topic Generation (Infinite Map) ---

const topicsSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    topics: { type: Type.ARRAY, items: { type: Type.STRING } }
  },
  required: ["topics"]
};

export const generateTopicBatch = async (lastTopic: string, language: string = 'en', startIndex: number): Promise<string[]> => {
    try {
        const langName = { 'en': 'English', 'pt': 'Portuguese', 'es': 'Spanish', 'fr': 'French' }[language] || 'English';
        
        const prompt = `
            Generate 5 new, short, fun, and educational topics for an Ecology game level map.
            The previous topic was: "${lastTopic}".
            The new topics should logically follow or explore new environmental areas.
            
            IMPORTANT: The map index starts at ${startIndex}. 
            Every 5th level (indices ending in 4 or 9, e.g., 14, 19, 24) MUST be a "Boss" level.
            If a generated topic lands on a Boss index, title it "Boss: [Cool Monster Name]" (e.g. "Boss: Trash Golem").
            
            Output Language: ${langName}.
            Return JSON only.
        `;

        const response = await generateWithFallback({
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: topicsSchema,
            },
        });

        const data = extractJson(response.text);
        return data.topics || ["Nature Walk", "Clean Air", "Recycling 2", "Save Energy", "Boss: Pollution Blob"];
    } catch (e) {
        console.error("Topic generation failed", e);
        // Fallback topics if AI fails
        return ["Wilderness", "Forest Fire Prevention", "Solar Power", "Wind Energy", "Boss: Carbon Cloud"];
    }
};

// --- Lesson Generation ---

const exerciseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    type: { type: Type.STRING, enum: [
      ExerciseType.MULTIPLE_CHOICE, 
      ExerciseType.TRUE_FALSE, 
      ExerciseType.FILL_BLANK,
      ExerciseType.SPEAKING,
      ExerciseType.SCENARIO,
      ExerciseType.SORTING
    ]},
    question: { type: Type.STRING },
    options: { type: Type.ARRAY, items: { type: Type.STRING } },
    correctAnswer: { type: Type.STRING },
    explanation: { type: Type.STRING },
    speakingTarget: { type: Type.STRING },
    sortingCategories: { type: Type.ARRAY, items: { type: Type.STRING } }
  },
  required: ["type", "question", "correctAnswer", "explanation"]
};

const lessonSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    topic: { type: Type.STRING },
    context: { type: Type.STRING, description: "A one-sentence narrative setup for the lesson." },
    exercises: { type: Type.ARRAY, items: exerciseSchema }
  },
  required: ["topic", "context", "exercises"]
};

export const generateProceduralLesson = async (topic: string, difficulty: string, language: string = 'en', isBoss: boolean = false): Promise<Lesson> => {
  try {
    const langName = {
        'en': 'English',
        'pt': 'Portuguese',
        'es': 'Spanish',
        'fr': 'French'
    }[language] || 'English';

    const prompt = `
      You are a level designer for a high-quality educational game like Duolingo, but for Ecology.
      Topic: "${topic}"
      Student Level: "${difficulty}"
      Language: "${langName}" (ALL content must be in this language)
      Is Boss Level: ${isBoss}

      GOAL: Create a "Micro-Adventure" Lesson. 
      
      ${isBoss ? `
      **BOSS BATTLE MODE ACTIVATED**
      - Context: The player is facing a giant Trash Monster (e.g., Plastic Golem, Smog Cloud). The tone must be intense and epic.
      - Exercises must be challenging actions to defeat the monster.
      ` : `
      - Standard Mode: Educational and fun narrative.
      `}
      
      STRUCTURE:
      1. Define a specific 'context' (e.g., "You are organizing a beach cleanup").
      2. Generate 5 exercises that strictly follow this narrative arc:
         - Ex 1 (MULTIPLE_CHOICE or SCENARIO): Identify a problem in this context.
         - Ex 2 (TRUE_FALSE or MULTIPLE_CHOICE): Learn a concept related to the problem.
         - Ex 3 (SORTING): Perform a practical action (e.g., sort the specific waste found in the context).
         - Ex 4 (FILL_BLANK): Complete a sentence summarizing the lesson learned.
         - Ex 5 (SPEAKING): Commit to a positive action related to the story.

      IMPORTANT:
      - Vary the 'explanation' field! Do NOT just say "Correct". Give a short fun fact or specific reason why it's right. Use the mascot's voice (Eco).
      - Ensure 'explanation' is in ${langName}.

      SPECIFIC FORMATTING RULES:
      - TRUE_FALSE: 'options' MUST be translated versions of ["True", "False"].
      - MULTIPLE_CHOICE: Must have at least 2 options.
      - SORTING: 'correctAnswer' MUST be "Item:Category|Item:Category" (use PIPE separator).
      - FILL_BLANK: 'question' MUST contain "___" (three underscores).
    `;

    const response = await generateWithFallback({
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: lessonSchema,
        systemInstruction: `You are Eco, a playful dog teaching sustainability. Be creative with your feedback explanations! Output strictly valid JSON in ${langName}.`
      },
    });

    const rawText = response.text || "{}";
    let data: any;
    try {
        data = extractJson(rawText);
    } catch (parseError) {
        console.error("JSON Parse Error:", parseError, "Raw Text:", rawText);
        throw new Error("Failed to parse AI response");
    }
    
    if (!data.exercises || data.exercises.length === 0) {
        throw new Error("No exercises generated by AI");
    }

    const exercises = data.exercises.map((ex: any) => {
        const type = ex.type as ExerciseType;

        // 1. Ensure Options exist
        if ([ExerciseType.MULTIPLE_CHOICE, ExerciseType.SCENARIO, ExerciseType.TRUE_FALSE].includes(type)) {
            if (!ex.options || ex.options.length < 2) {
                if (type === ExerciseType.TRUE_FALSE) {
                    ex.options = language === 'pt' ? ["Verdadeiro", "Falso"] : ["True", "False"];
                } else {
                    ex.options = language === 'pt' ? ["Sim", "Não"] : ["Yes", "No"];
                }
            }
        }

        // 2. Fix Fill-in-the-Blank
        if (type === ExerciseType.FILL_BLANK) {
            if (!ex.question || !ex.question.includes("___")) {
                ex.question = (ex.question || "Complete") + " ___";
            }
            if (!ex.options || ex.options.length === 0) {
                 ex.options = [ex.correctAnswer || "answer", "wrong", "incorrect"];
            }
        }

        // 3. Fix Sorting format
        if (type === ExerciseType.SORTING) {
             if (!ex.sortingCategories || ex.sortingCategories.length === 0) {
                 ex.sortingCategories = ["Good", "Bad"];
             }
             if (ex.correctAnswer && ex.correctAnswer.includes(',') && !ex.correctAnswer.includes('|')) {
                 ex.correctAnswer = ex.correctAnswer.replace(/,/g, '|');
             }
             if (!ex.options || ex.options.length === 0) {
                 ex.options = ex.correctAnswer.split('|').map((pair: string) => pair.split(':')[0].trim());
             }
        }

        // 4. Randomize generic explanations
        if (!ex.explanation || ex.explanation.length < 5 || ex.explanation.toLowerCase().includes("correct")) {
            const randomExpl = EXPLANATION_VARIATIONS[Math.floor(Math.random() * EXPLANATION_VARIATIONS.length)];
            ex.explanation = randomExpl;
        }

        return { ...ex, id: generateUUID() };
    });

    return {
      id: generateUUID(),
      difficulty: difficulty as any,
      topic: data.topic || topic,
      context: data.context || `Let's learn about ${topic}!`,
      exercises: exercises,
      isBoss: isBoss
    };
  } catch (error) {
    console.error("Lesson generation failed:", error);
    throw error;
  }
};

// --- Chat Assistant with Grounding ---

export const askEcoAssistant = async (query: string): Promise<{text: string, sources: GroundingSource[]}> => {
  try {
    const response = await generateWithFallback({
      contents: query,
      config: {
        // Google Search grounding is supported for Gemma 4 on the Gemini API,
        // which lets the assistant cite real web sources.
        tools: [{ googleSearch: {} }],
        systemInstruction: "You are Eco, a friendly dog mascot who loves the planet. Keep answers short (under 3 sentences), fun, and motivating. Use emojis."
      },
    });

    const text = response.text || "Woof! I couldn't fetch that right now.";
    const rawChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources: GroundingSource[] = rawChunks
      .filter((chunk) => chunk?.web?.uri && chunk?.web?.title)
      .map((chunk) => ({ web: { uri: chunk.web!.uri!, title: chunk.web!.title! } }));

    return { text, sources };
  } catch (error) {
    console.error("Chat failed:", error);
    return { text: "Ruh-roh! Something went wrong with my eco-sensors.", sources: [] };
  }
};

// --- Live API Integration (Voice) ---

const LIVE_MODEL = 'gemini-3.8-live';

// --- Voice session memory ---
const MEMORY_KEY = 'eco_voice_memory_v1';
const MEMORY_MAX_SESSIONS = 5;
const STOPWORDS = new Set(['the','and','a','an','is','are','to','of','for','on','in','you','i','we','it','that','this','my','your','with','about','what','how','why','can','really','like']);

export interface VoiceMemoryEntry {
  timestamp: number;
  topics: string[];
  struggles: string[];
  highlights: string[];
}

export function loadVoiceMemory(): VoiceMemoryEntry[] {
  try {
    const raw = localStorage.getItem(MEMORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

export function saveVoiceMemory(entry: VoiceMemoryEntry): void {
  try {
    const existing = loadVoiceMemory();
    const next = [...existing, entry].slice(-MEMORY_MAX_SESSIONS);
    localStorage.setItem(MEMORY_KEY, JSON.stringify(next));
  } catch {}
}

export function clearVoiceMemory(): void {
  try { localStorage.removeItem(MEMORY_KEY); } catch {}
}

export function buildMemorySummary(): string {
  const entries = loadVoiceMemory();
  if (entries.length === 0) return '';
  const recent = entries.slice(-3);
  const topics = recent.flatMap(e => e.topics).slice(0, 8);
  const struggles = recent.flatMap(e => e.struggles).slice(0, 5);
  const lines: string[] = [];
  if (topics.length) lines.push(`Previously discussed: ${[...new Set(topics)].join(', ')}.`);
  if (struggles.length) lines.push(`Topics they struggled with: ${[...new Set(struggles)].join(', ')}.`);
  return lines.join(' ');
}

export class LiveClient {
  private session: any = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private playbackQueue: AudioBufferSourceNode[] = [];
  private transcriptParts: string[] = [];

  constructor(
    private onAudioData: (isPlaying: boolean) => void,
    private onError: (err: any) => void
  ) {}

  async connect() {
    try {
      const apiKey = getApiKey();
      const ai = new GoogleGenAI({ apiKey });
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const memory = buildMemorySummary();
      const systemInstruction =
        "You are Eco, a friendly dog mascot who loves the planet. Keep answers short (under 3 sentences), fun, and motivating. Use emojis." +
        (memory ? ` Context from previous sessions: ${memory} Reference it naturally if relevant.` : '');

      this.session = await ai.live.connect({
        model: LIVE_MODEL,
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction,
          outputAudioTranscription: {},
          inputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => this.startMicStreaming(),
          onmessage: (message: any) => {
            const parts = message?.serverContent?.modelTurn?.parts;
            if (Array.isArray(parts)) {
              for (const part of parts) {
                if (part?.inlineData?.data) this.playAudioChunk(part.inlineData.data);
                const inputText = message?.serverContent?.inputAudioTranscription?.text;
                if (typeof inputText === 'string' && inputText.length > 0) {
                  this.transcriptParts.push(inputText);
                }
                if (typeof part?.text === 'string' && part.text.length > 0) {
                  this.transcriptParts.push(part.text);
                }
              }
            }
          },
          onerror: (e: any) => {
            this.onError(e instanceof Error ? e : new Error(String(e)));
          },
          onclose: () => this.onAudioData(false),
        },
      });
    } catch (err) {
      this.onError(err);
    }
  }

  private startMicStreaming() {
    if (!this.mediaStream || !this.session) return;
    this.audioContext = new AudioContext({ sampleRate: 16000 });
    const source = this.audioContext.createMediaStreamSource(this.mediaStream);
    const processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    processor.onaudioprocess = (e) => {
      const input = e.inputBuffer.getChannelData(0);
      const pcm = new Int16Array(input.length);
      for (let i = 0; i < input.length; i++) {
        const s = Math.max(-1, Math.min(1, input[i]));
        pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      const base64 = btoa(String.fromCharCode(...new Uint8Array(pcm.buffer)));
      this.session.sendRealtimeInput({
        audio: { data: base64, mimeType: 'audio/pcm;rate=16000' },
      });
    };
    source.connect(processor);
    processor.connect(this.audioContext.destination);
  }

  private playAudioChunk(base64: string) {
    try {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const pcm16 = new Int16Array(bytes.buffer);
      const ctx = this.audioContext ?? new AudioContext({ sampleRate: 24000 });
      this.audioContext = ctx;
      const buffer = ctx.createBuffer(1, pcm16.length, 24000);
      const channel = buffer.getChannelData(0);
      for (let i = 0; i < pcm16.length; i++) channel[i] = pcm16[i] / 0x8000;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(ctx.destination);
      src.start();
      this.onAudioData(true);
      src.onended = () => this.onAudioData(false);
      this.playbackQueue.push(src);
    } catch (e) {
      console.warn('[LiveClient] audio playback failed', e);
    }
  }

  disconnect() {
    if (this.transcriptParts.length > 0) {
      const words = this.transcriptParts.join(' ').toLowerCase().split(/\s+/);
      const stop = new Set(['the','and','you','for','that','with','this','have','are','was','but','not','can','what','about','from','they','will','your','how','why','when']);
      const topics = [...new Set(words.filter(w => w.length > 3 && !stop.has(w)))].slice(0, 5);
      saveVoiceMemory({ timestamp: Date.now(), topics, struggles: [], highlights: [] });
    }
    try { this.session?.close?.(); } catch {}
    this.session = null;
    this.playbackQueue.forEach((s) => { try { s.stop(); } catch {} });
    this.playbackQueue = [];
    this.mediaStream?.getTracks().forEach((t) => t.stop());
    this.mediaStream = null;
    this.audioContext?.close().catch(() => {});
    this.audioContext = null;
    this.onAudioData(false);
  }
}
