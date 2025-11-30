
import { User, UserProgress } from "../types";

const USERS_KEY = 'ecoquest_users';
const SESSION_KEY = 'ecoquest_session_user_id';

const DEFAULT_TOPICS = [
  "Recycling 101", "Plastic Problem", "Composting", 
  "Ocean Life", "Boss: Plastic Titan", 
  "Renewable Energy", "Carbon Footprint", "Save Water", 
  "Green Travel", "Boss: Smog Dragon" 
];

const INITIAL_PROGRESS: UserProgress = {
  xp: 0,
  gems: 100,
  streak: 0,
  hearts: 5,
  level: 1,
  completedLessons: [],
  plantedTrees: [],
  generatedTopics: DEFAULT_TOPICS
};

// Polyfill for crypto.randomUUID for iOS < 15.4
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Helper to delay (simulate network)
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export const authService = {
  getUsers: (): User[] => {
    try {
        const usersStr = localStorage.getItem(USERS_KEY);
        return usersStr ? JSON.parse(usersStr) : [];
    } catch (e) {
        console.error("Local storage error", e);
        return [];
    }
  },

  saveUser: (user: User) => {
    try {
        const users = authService.getUsers();
        const index = users.findIndex(u => u.id === user.id);
        if (index >= 0) {
          users[index] = user;
        } else {
          users.push(user);
        }
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
    } catch (e) {
        console.error("Failed to save user", e);
        alert("Warning: Progress might not save in Private/Incognito mode.");
    }
  },

  getCurrentUserId: (): string | null => {
    return localStorage.getItem(SESSION_KEY);
  },

  getCurrentUser: (): User | null => {
    const id = authService.getCurrentUserId();
    if (!id) return null;
    const users = authService.getUsers();
    return users.find(u => u.id === id) || null;
  },

  login: async (username: string, password: string): Promise<User> => {
    await delay(500);
    const users = authService.getUsers();
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
    if (!user) throw new Error("Invalid credentials");
    
    // Legacy support updates
    if (!user.progress.plantedTrees) user.progress.plantedTrees = [];
    if (!user.language) user.language = 'en';
    if (!user.theme) user.theme = 'light';
    if (!user.progress.generatedTopics) user.progress.generatedTopics = DEFAULT_TOPICS;

    localStorage.setItem(SESSION_KEY, user.id);
    return user;
  },

  signup: async (data: Partial<User>): Promise<User> => {
    await delay(800);
    const users = authService.getUsers();
    
    if (users.some(u => u.username.toLowerCase() === data.username?.toLowerCase())) {
        throw new Error("Username already taken");
    }

    const newUser: User = {
      id: generateUUID(),
      username: data.username!,
      password: data.password!,
      displayName: data.displayName || data.username!,
      avatar: data.avatar || 'bear',
      dailyGoal: data.dailyGoal || 20,
      language: data.language || 'en',
      theme: 'light', // Default theme
      joinedDate: new Date().toISOString(),
      progress: INITIAL_PROGRESS
    };

    authService.saveUser(newUser);
    localStorage.setItem(SESSION_KEY, newUser.id);
    return newUser;
  },

  logout: () => {
    localStorage.removeItem(SESSION_KEY);
  }
};
