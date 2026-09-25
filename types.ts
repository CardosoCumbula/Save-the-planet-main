
export enum ExerciseType {
  MULTIPLE_CHOICE = 'MULTIPLE_CHOICE',
  TRUE_FALSE = 'TRUE_FALSE',
  FILL_BLANK = 'FILL_BLANK',
  SPEAKING = 'SPEAKING',
  SCENARIO = 'SCENARIO',
  SORTING = 'SORTING'
}

export interface Exercise {
  id: string;
  type: ExerciseType;
  question: string;
  options?: string[]; // For MC, or Items for Sorting
  correctAnswer: string; // For Sorting: "Item1:Cat1|Item2:Cat2"
  explanation: string;
  speakingTarget?: string; 
  sortingCategories?: string[]; // For Sorting: ["Recycle", "Compost"]
}

export interface Lesson {
  id: string;
  topic: string;
  context: string; // The narrative scenario (e.g. "You are cleaning the park...")
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  exercises: Exercise[];
  isBoss?: boolean;
}

export interface PlantedTree {
  topic: string;
  treeType: string;
  datePlanted: string;
}

export interface UserProgress {
  xp: number;
  gems: number;
  streak: number;
  hearts: number;
  level: number;
  completedLessons: string[];
  plantedTrees: PlantedTree[];
  generatedTopics: string[]; // Stores the infinite path of topics
}

export interface User {
  id: string;
  username: string; // unique
  password: string; // simulated hash (simple string for local demo)
  displayName: string;
  avatar: string; // Avatar ID
  dailyGoal: number; // XP per day
  progress: UserProgress;
  joinedDate: string;
  language?: string;
  theme?: 'light' | 'dark';
}

export interface GroundingSource {
  web?: {
    uri: string;
    title: string;
  };
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  sources?: GroundingSource[];
  isError?: boolean;
}

export enum MascotMood {
  HAPPY = 'HAPPY',
  SAD = 'SAD',
  EXCITED = 'EXCITED',
  IDLE = 'IDLE',
  THINKING = 'THINKING',
  TALKING = 'TALKING',
  BATTLE = 'BATTLE'
}

// Lesson feedback can now be IDLE, CORRECT, ALMOST (partial credit) or WRONG.
export type LessonStatus = 'IDLE' | 'CORRECT' | 'ALMOST' | 'WRONG';

// ---------------------------------------------------------------------------
// Python AI engine API response shapes (services/aiEngineService.ts)
// ---------------------------------------------------------------------------

export interface DifficultyPrediction {
  probability_correct: number;
  recommended_difficulty: string;
  reason: string;
  model_used: string;
}

export type GradeVerdict = 'CORRECT' | 'ALMOST' | 'WRONG';

export interface GradeResult {
  similarity: number;
  verdict: GradeVerdict;
  partial_credit_xp: number;
  hint: string;
  reason: string;
}

export interface TopicRecommendation {
  topic: string;
  score: number;
  reason: string;
}

export interface AiInsights {
  user_id: string;
  per_topic_mastery: Record<string, number>;
  weak_topics: string[];
  predicted_next_difficulty: string;
  reason: string;
  recommended_topics: TopicRecommendation[];
  model_information: Record<string, string>;
}

// One logged learner interaction, matching the Python service schema.
export interface AiInteractionLog {
  user_id: string;
  timestamp: string;
  topic: string;
  exercise_id: string;
  exercise_type: string;
  difficulty: string;
  user_answer: string;
  correct_answer: string;
  is_correct: number;
  time_spent_ms?: number | null;
  hearts_before?: number;
  session_index?: number;
}
