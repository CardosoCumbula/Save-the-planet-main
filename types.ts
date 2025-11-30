
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
