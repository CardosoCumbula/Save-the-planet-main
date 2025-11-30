
import { GoogleGenAI, Type, Schema, LiveServerMessage, Modality } from "@google/genai";
import { Lesson, ExerciseType, GroundingSource } from "../types";

// Safety check for process.env to prevent "ReferenceError: process is not defined" crashes in browser
// Fallback to the provided key if process.env.API_KEY is not set
const apiKey = (typeof process !== 'undefined' && process.env && process.env.API_KEY) || 'REMOVED_KEY';
const ai = new GoogleGenAI({ apiKey });

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

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: topicsSchema,
            }
        });

        const data = JSON.parse(response.text || "{}");
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

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: lessonSchema,
        systemInstruction: `You are Eco, a playful dog teaching sustainability. Be creative with your feedback explanations! Output strictly valid JSON in ${langName}.`
      }
    });

    // Clean response text
    const rawText = response.text || "{}";
    const cleanText = rawText.replace(/```json\n?|\n?```/g, "").trim();
    
    let data;
    try {
        data = JSON.parse(cleanText);
    } catch (parseError) {
        console.error("JSON Parse Error:", parseError, "Raw Text:", rawText);
        throw new Error("Failed to parse AI response");
    }
    
    if (!data.exercises || data.exercises.length === 0) {
        throw new Error("No exercises generated by AI");
    }

    // --- AGGRESSIVE DATA SANITIZATION ---
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
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: query,
      config: {
        tools: [{ googleSearch: {} }],
        systemInstruction: "You are Eco, a friendly dog mascot who loves the planet. Keep answers short (under 3 sentences), fun, and motivating. Use emojis."
      }
    });

    const text = response.text || "Woof! I couldn't fetch that right now.";
    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

    return { text, sources };
  } catch (error) {
    console.error("Chat failed:", error);
    return { text: "Ruh-roh! Something went wrong with my eco-sensors.", sources: [] };
  }
};

// --- Live API Integration (Voice) ---

export class LiveClient {
  private sessionPromise: Promise<any> | null = null;
  private audioContext: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private inputProcessor: ScriptProcessorNode | null = null;
  private nextStartTime = 0;
  
  constructor(
    private onAudioData: (isPlaying: boolean) => void,
    private onError: (err: any) => void
  ) {}

  async connect() {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      this.sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
          systemInstruction: "You are Eco, a smart and playful dog teaching humans about nature. You bark happily occasionally. You are concise and interactive.",
        },
        callbacks: {
          onopen: () => {
            console.log("Live API Connected");
            if (this.sessionPromise) {
               this.startAudioInput(this.sessionPromise);
            }
          },
          onmessage: async (msg: LiveServerMessage) => {
             const base64Audio = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
             if (base64Audio) {
               this.onAudioData(true);
               await this.playAudio(base64Audio, outputAudioContext);
               setTimeout(() => this.onAudioData(false), 500);
             }
          },
          onclose: () => console.log("Live API Closed"),
          onerror: (err) => this.onError(err)
        }
      });
      
      await this.sessionPromise;

    } catch (err) {
      this.onError(err);
    }
  }

  private startAudioInput(sessionPromise: Promise<any>) {
    if (!this.audioContext || !this.stream) return;

    const source = this.audioContext.createMediaStreamSource(this.stream);
    this.inputProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);
    
    this.inputProcessor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      const pcmBlob = this.createBlob(inputData);
      
      sessionPromise.then(session => {
        session.sendRealtimeInput({ media: pcmBlob });
      });
    };

    source.connect(this.inputProcessor);
    this.inputProcessor.connect(this.audioContext.destination);
  }

  private createBlob(data: Float32Array) {
     const l = data.length;
     const int16 = new Int16Array(l);
     for (let i = 0; i < l; i++) {
       int16[i] = data[i] * 32768;
     }
     
     let binary = '';
     const bytes = new Uint8Array(int16.buffer);
     const len = bytes.byteLength;
     for (let i = 0; i < len; i++) {
       binary += String.fromCharCode(bytes[i]);
     }
     
     return {
       data: btoa(binary),
       mimeType: 'audio/pcm;rate=16000'
     };
  }

  private async playAudio(base64: string, ctx: AudioContext) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const dataInt16 = new Int16Array(bytes.buffer);
    const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < dataInt16.length; i++) {
      channelData[i] = dataInt16[i] / 32768.0;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    
    const now = ctx.currentTime;
    this.nextStartTime = Math.max(now, this.nextStartTime);
    
    source.start(this.nextStartTime);
    this.nextStartTime += buffer.duration;
  }

  disconnect() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }
    if (this.inputProcessor) {
      this.inputProcessor.disconnect();
    }
    if (this.audioContext) {
      this.audioContext.close();
    }
    this.sessionPromise = null;
  }
}
