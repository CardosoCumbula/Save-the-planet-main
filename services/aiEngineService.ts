import {
  AiInsights,
  AiInteractionLog,
  DifficultyPrediction,
  GradeResult,
  Lesson,
  TopicRecommendation,
} from '../types';

// The Python backend URL. Override with VITE_AI_ENGINE_URL if needed.
const AI_ENGINE_URL =
  import.meta.env.VITE_AI_ENGINE_URL || 'http://localhost:8000';

const REQUEST_TIMEOUT_MS = 2500;

// Module-level availability state. We ping /health once on startup; every
// request uses this cached flag instead of hammering the server repeatedly.
let checkedAvailability = false;
let available = false;

export const isAiEngineAvailable = (): boolean => available;

/** Ping the backend once and cache the result. Safe to call any number of times. */
export const checkAiEngineAvailability = async (): Promise<boolean> => {
  if (checkedAvailability) return available;
  checkedAvailability = true;
  try {
    const res = await timedFetch(`${AI_ENGINE_URL}/health`, { method: 'GET' });
    available = res?.status === 'ok';
  } catch {
    available = false;
  }
  return available;
};

/** fetch wrapper with AbortController timeout, try/catch and a safe fallback. */
async function timedFetch(url: string, options: RequestInit): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function jsonBody(body: unknown): RequestInit {
  return { method: 'POST', body: JSON.stringify(body) };
}

// ---------------------------------------------------------------------------
// Difficulty prediction (Model 1 - adaptive difficulty)
// ---------------------------------------------------------------------------

export async function predictDifficultyForUser(
  history: AiInteractionLog[],
  currentTopic: string,
  currentDifficulty: string
): Promise<DifficultyPrediction | null> {
  const payload = jsonBody({ history, current_topic: currentTopic, current_difficulty: currentDifficulty });
  return (await timedFetch(`${AI_ENGINE_URL}/predict/difficulty-for-user`, payload)) as DifficultyPrediction | null;
}

// ---------------------------------------------------------------------------
// Answer grading (Model 2 - smart free-text feedback)
// ---------------------------------------------------------------------------

export async function gradeAnswer(
  userAnswer: string,
  expectedAnswer: string
): Promise<GradeResult | null> {
  const payload = jsonBody({ user_answer: userAnswer, expected_answer: expectedAnswer });
  return (await timedFetch(`${AI_ENGINE_URL}/grade/answer`, payload)) as GradeResult | null;
}

// ---------------------------------------------------------------------------
// Topic recommendation (Model 3 - learning path)
// ---------------------------------------------------------------------------

export async function recommendTopics(
  learnerProfile: Record<string, number>,
  candidateTopics: string[],
  k = 5
): Promise<{ recommendations: TopicRecommendation[]; model_used: string } | null> {
  const payload = jsonBody({ learner_profile: learnerProfile, candidate_topics: candidateTopics, k });
  return (await timedFetch(`${AI_ENGINE_URL}/recommend/topics`, payload)) as
    | { recommendations: TopicRecommendation[]; model_used: string }
    | null;
}

// ---------------------------------------------------------------------------
// Insights (shown in the Profile view)
// ---------------------------------------------------------------------------

export async function getInsights(userId: string): Promise<AiInsights | null> {
  return (await timedFetch(`${AI_ENGINE_URL}/insights/${encodeURIComponent(userId)}`, { method: 'GET' })) as AiInsights | null;
}

// ---------------------------------------------------------------------------
// Interaction logging (fire-and-forget; never blocks the UI)
// ---------------------------------------------------------------------------

const sessionHistory: AiInteractionLog[] = [];

export const getSessionHistory = (): AiInteractionLog[] => sessionHistory;

export function logInteraction(interaction: AiInteractionLog): void {
  sessionHistory.push(interaction);
  // Never await; logging must not slow down the game.
  if (available) {
    timedFetch(`${AI_ENGINE_URL}/log/interaction`, jsonBody(interaction)).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Lesson validation (Integration 2) - optional, never fatal
// ---------------------------------------------------------------------------

export function validateLesson(lesson: Lesson | null): string[] {
  const problems: string[] = [];
  if (!lesson) return ['Generated lesson is empty'];
  if (!lesson.topic) problems.push('Lesson has no topic');
  if (!lesson.exercises || lesson.exercises.length === 0) problems.push('Lesson has no exercises');
  else {
    lesson.exercises.forEach((ex, i) => {
      if (!ex.question) problems.push(`Exercise ${i + 1} has no question`);
    });
  }
  return problems;
}