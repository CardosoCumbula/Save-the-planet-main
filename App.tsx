
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Heart, Star, Zap, Trophy, MessageCircle, Mic, 
  Map as MapIcon, Volume2, ArrowRight, Check, X as XIcon, 
  Leaf, ExternalLink, Lock, Home, RefreshCw, ShoppingBag, Shield, Gift, SkipForward, Turtle, User as UserIcon, Skull, Swords, AlertTriangle, ChevronLeft, Sun, Moon, Loader
} from 'lucide-react';
import { 
  User, UserProgress, Lesson, Exercise, ExerciseType, MascotMood, ChatMessage, PlantedTree, LessonStatus
} from './types';
import { generateProceduralLesson, askEcoAssistant, generateTopicBatch } from './services/gemmaService';
import {
  checkAiEngineAvailability, isAiEngineAvailable, predictDifficultyForUser,
  gradeAnswer, recommendTopics, logInteraction, validateLesson, getSessionHistory
} from './services/aiEngineService';
import { authService } from './services/authService';
import { Mascot } from './components/Mascot';
import { VoiceChat } from './components/VoiceChat';
import { Auth } from './components/Auth';
import { Profile } from './components/Profile';
import { Avatar } from './components/Avatar';
import { Tree, TREE_TYPES } from './components/Tree';
import { BossMonster, BossState } from './components/BossMonster';

const SOUNDS = {
  correct: 'https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3',
  wrong: 'https://assets.mixkit.co/active_storage/sfx/2003/2003-preview.mp3',
  finish: 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3',
  pop: 'https://assets.mixkit.co/active_storage/sfx/2578/2578-preview.mp3',
  chest: 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3',
  hit: 'https://assets.mixkit.co/active_storage/sfx/214/214-preview.mp3'
};

const POSITIVE_REACTIONS = ["Awesome!", "Correct!", "You got it!", "Pawsome!", "Brilliant!", "Spot on!", "Great job!", "Fantastic!"];
const NEGATIVE_REACTIONS = ["Not quite...", "Ruh-roh!", "Oops!", "Try again!", "Keep going!", "Almost!", "Don't give up!"];

const Confetti = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
        window.addEventListener('resize', resize);
        resize();
        const particles: any[] = [];
        const colors = ['#34D399', '#60A5FA', '#FBBF24', '#F87171', '#A78BFA'];
        for (let i = 0; i < 150; i++) {
            particles.push({
                x: window.innerWidth / 2, y: window.innerHeight / 2,
                w: Math.random() * 10 + 5, h: Math.random() * 10 + 5,
                dx: (Math.random() - 0.5) * 20, dy: (Math.random() - 0.5) * 20,
                color: colors[Math.floor(Math.random() * colors.length)],
                rotation: Math.random() * 360, gravity: 0.5, drag: 0.96
            });
        }
        const animate = () => {
            if (!ctx) return;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particles.forEach((p, i) => {
                p.x += p.dx; p.y += p.dy; p.dy += p.gravity; p.dx *= p.drag; p.dy *= p.drag; p.rotation += 5;
                ctx.save(); ctx.translate(p.x, p.y); ctx.rotate((p.rotation * Math.PI) / 180);
                ctx.fillStyle = p.color; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
                if (p.y > canvas.height) particles.splice(i, 1);
            });
            if (particles.length > 0) requestAnimationFrame(animate);
        };
        animate();
        return () => window.removeEventListener('resize', resize);
    }, []);
    return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-50" />;
};

function App() {
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  useEffect(() => {
    const handleResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [currentView, setCurrentView] = useState<'MAP' | 'LESSON' | 'CHAT' | 'LESSON_COMPLETE'>('MAP');
  const [currentTab, setCurrentTab] = useState<'LEARN' | 'LEADERBOARD' | 'SHOP' | 'PROFILE'>('LEARN');
  
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  
  const [mascotMood, setMascotMood] = useState<MascotMood>(MascotMood.IDLE);
  const [isVoiceChatOpen, setIsVoiceChatOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingMap, setIsGeneratingMap] = useState(false);
  const [loadingTip, setLoadingTip] = useState("");
  const [shakeHeart, setShakeHeart] = useState(false);
  const [showQuitModal, setShowQuitModal] = useState(false);
  const [isBossIntro, setIsBossIntro] = useState(false);
  const [bossState, setBossState] = useState<BossState>('IDLE');
  const [bossHealth, setBossHealth] = useState(100);
  const [isChestOpen, setIsChestOpen] = useState(false);
  const [lastPlantedTree, setLastPlantedTree] = useState<string | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [sortingState, setSortingState] = useState<{ [key: string]: string }>({}); 
  const [activeSortingItem, setActiveSortingItem] = useState<string | null>(null);
  const [lessonStatus, setLessonStatus] = useState<LessonStatus>('IDLE');
  const [aiDifficultyUsed, setAiDifficultyUsed] = useState(false);
  const [aiHint, setAiHint] = useState('');
  const [correctAnswersCount, setCorrectAnswersCount] = useState(0);
  const [reactionText, setReactionText] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [spokenText, setSpokenText] = useState("");
  const [audioLevels, setAudioLevels] = useState<number[]>([10, 10, 10, 10, 10]);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const user = authService.getCurrentUser();
    if (user) setCurrentUser(user);
    setAuthChecked(true);
  }, []);

  // Check once whether the Python AI engine is reachable.
  useEffect(() => {
    checkAiEngineAvailability();
  }, []);

  useEffect(() => {
      if (currentUser?.theme === 'dark') {
          document.documentElement.classList.add('dark');
      } else {
          document.documentElement.classList.remove('dark');
      }
  }, [currentUser?.theme]);

  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [currentExerciseIndex, activeLesson]);

  useEffect(() => {
    if (isBossIntro) {
        const timer = setTimeout(() => { setIsBossIntro(false); }, 3500);
        return () => clearTimeout(timer);
    }
  }, [isBossIntro]);

  const updateUserProgress = (newProgress: Partial<UserProgress>) => {
    if (!currentUser) return;
    const updatedUser = { ...currentUser, progress: { ...currentUser.progress, ...newProgress } };
    setCurrentUser(updatedUser);
    authService.saveUser(updatedUser);
  };

  const playSound = (type: keyof typeof SOUNDS) => {
    const audio = new Audio(SOUNDS[type]);
    audio.volume = 0.5;
    audio.play().catch(() => {});
  };

  const playTTS = (text: string, rate: number = 1.0) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = rate;
    utterance.pitch = 1.1;
    const lang = currentUser?.language || 'en';
    const voice = window.speechSynthesis.getVoices().find(v => v.lang.startsWith(lang));
    if (voice) utterance.voice = voice;
    setMascotMood(MascotMood.TALKING);
    utterance.onend = () => setMascotMood(MascotMood.IDLE);
    window.speechSynthesis.speak(utterance);
  };

  const calculateMatchPercentage = (target: string, spoken: string) => {
      const t = target.toLowerCase().replace(/[.,!?]/g, '').split(' ');
      const s = spoken.toLowerCase().replace(/[.,!?]/g, '').split(' ');
      let matches = 0;
      t.forEach(word => { if (s.includes(word)) matches++; });
      return matches / t.length;
  };

  const getFlag = (lang?: string) => {
      switch(lang) {
          case 'pt': return '🇧🇷';
          case 'es': return '🇪🇸';
          case 'fr': return '🇫🇷';
          default: return '🇺🇸';
      }
  };

  if (!authChecked) return null;
  if (!currentUser) return <Auth onLogin={setCurrentUser} />;

  const mapTopics = currentUser.progress.generatedTopics || [];

  const startLesson = async (topic: string, index: number) => {
    if (currentUser.progress.hearts <= 0) {
        alert("You need hearts!");
        setCurrentTab('SHOP');
        return;
    }
    setIsLoading(true);
    setLoadingTip(topic.includes("Boss") ? "Preparing for Battle..." : "Generating Lesson...");
    setShowQuitModal(false);
    setIsBossIntro(false);
    try {
      const isBoss = (index + 1) % 5 === 0;
      // Default heuristic: keep the original rule as an offline fallback.
      let difficulty = currentUser.progress.level > 5 ? 'Intermediate' : 'Beginner';
      setAiDifficultyUsed(false);

      // Integration 1: let the Python model pick the difficulty when available.
      if (isAiEngineAvailable()) {
        const prediction = await predictDifficultyForUser(
          getSessionHistory(), topic, difficulty
        );
        if (prediction && prediction.model_used.includes('ML') && prediction.recommended_difficulty) {
          difficulty = prediction.recommended_difficulty;
          setAiDifficultyUsed(true);
        }
      }

      let lesson = await generateProceduralLesson(topic, difficulty, currentUser.language, isBoss);
      // Integration 2: validate the generated lesson; retry once, then proceed.
      const problems = validateLesson(lesson);
      if (problems.length > 0) {
        lesson = await generateProceduralLesson(topic, difficulty, currentUser.language, isBoss);
      }
      lesson.isBoss = isBoss || lesson.topic.toLowerCase().includes('boss');
      setActiveLesson(lesson);
      setCurrentExerciseIndex(0);
      setLessonStatus('IDLE');
      setSelectedOption(null);
      setSortingState({});
      setSpokenText("");
      setIsChestOpen(false);
      setLastPlantedTree(null);
      setCorrectAnswersCount(0);
      setBossHealth(100);
      setBossState('IDLE');
      setCurrentView('LESSON');
      if (lesson.isBoss) {
          setIsBossIntro(true);
          playSound('hit');
      } else {
          setMascotMood(MascotMood.EXCITED);
          playSound('pop');
      }
    } catch (e: any) {
      alert(`Could not load lesson. ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSortingClick = (itemOrCategory: string, isCategory: boolean) => {
    if (lessonStatus !== 'IDLE') return;
    if (!isCategory) { setActiveSortingItem(itemOrCategory); playSound('pop'); } 
    else if (activeSortingItem) {
        setSortingState(prev => ({ ...prev, [activeSortingItem]: itemOrCategory }));
        setActiveSortingItem(null); playSound('pop');
    }
  };

  const checkAnswer = async () => {
    if (!activeLesson) return;
    const currentEx = activeLesson.exercises[currentExerciseIndex];
    const userText = currentEx.type === ExerciseType.SPEAKING ? spokenText : (selectedOption || '');
    const expectedText = currentEx.type === ExerciseType.SPEAKING ? (currentEx.speakingTarget || '') : currentEx.correctAnswer;

    let verdict: 'CORRECT' | 'ALMOST' | 'WRONG';
    let gradeHint = '';
    const needsAi = currentEx.type === ExerciseType.FILL_BLANK || currentEx.type === ExerciseType.SPEAKING;

    if (needsAi && isAiEngineAvailable()) {
        // Integration 3: use the Python grader for free-text answers.
        const grade = await gradeAnswer(userText, expectedText);
        if (grade && grade.verdict) {
            verdict = grade.verdict;
            gradeHint = grade.hint || '';
        } else {
            verdict = userText.toLowerCase().trim() === expectedText.toLowerCase().trim() ? 'CORRECT' : 'WRONG';
        }
    } else if (currentEx.type === ExerciseType.SORTING) {
        const correctPairs = currentEx.correctAnswer.split('|').map(p => p.trim().toLowerCase());
        const userPairs = Object.entries(sortingState).map(([item, cat]) => `${item}:${cat}`.toLowerCase());
        const allUserCorrect = userPairs.every(pair => correctPairs.includes(pair));
        verdict = (allUserCorrect && currentEx.options && Object.keys(sortingState).length === currentEx.options.length) ? 'CORRECT' : 'WRONG';
    } else if (currentEx.type === ExerciseType.SPEAKING) {
        const matchPerc = calculateMatchPercentage(expectedText, userText);
        verdict = matchPerc >= 0.7 ? 'CORRECT' : 'WRONG';
    } else {
        verdict = userText.toLowerCase().trim() === expectedText.toLowerCase().trim() ? 'CORRECT' : 'WRONG';
    }

    if (verdict === 'CORRECT') {
      setLessonStatus('CORRECT');
      setReactionText(POSITIVE_REACTIONS[Math.floor(Math.random() * POSITIVE_REACTIONS.length)]);
      setCorrectAnswersCount(prev => prev + 1);
      setMascotMood(activeLesson.isBoss ? MascotMood.BATTLE : MascotMood.HAPPY);
      playSound('correct');
      if (activeLesson.isBoss) {
          setBossState('HIT');
          setBossHealth(prev => Math.max(0, prev - (100 / activeLesson.exercises.length)));
          setTimeout(() => setBossState('IDLE'), 1000);
      }
    } else if (verdict === 'ALMOST') {
      // Partial credit: no heart lost, encouraging hint, some XP at reward time.
      setLessonStatus('ALMOST');
      setReactionText('So close - keep going!');
      setAiHint(gradeHint || 'Almost there. Review the key idea and try again.');
      setMascotMood(MascotMood.THINKING);
      playSound('wrong');
    } else {
      setLessonStatus('WRONG');
      setReactionText(NEGATIVE_REACTIONS[Math.floor(Math.random() * NEGATIVE_REACTIONS.length)]);
      setAiHint(gradeHint);
      setMascotMood(MascotMood.SAD);
      playSound('wrong');
      if (activeLesson.isBoss) {
          setBossState('ATTACK');
          setTimeout(() => setBossState('IDLE'), 1000);
      }
      if (currentUser.progress.hearts > 0) {
        setShakeHeart(true);
        setTimeout(() => setShakeHeart(false), 500);
        updateUserProgress({ hearts: currentUser.progress.hearts - 1 });
      }
    }

    // Integration 5: fire-and-forget interaction logging for future retraining.
    logInteraction({
      user_id: currentUser.id,
      timestamp: new Date().toISOString(),
      topic: activeLesson.topic,
      exercise_id: currentEx.id,
      exercise_type: currentEx.type,
      difficulty: activeLesson.difficulty,
      user_answer: userText,
      correct_answer: expectedText,
      is_correct: verdict === 'WRONG' ? 0 : 1,
      time_spent_ms: null,
      hearts_before: currentUser.progress.hearts,
      session_index: 0,
    });

    if (isRecording) {
        setIsRecording(false);
        if (audioContextRef.current) audioContextRef.current.suspend();
    }
  };

  const handleNext = () => {
    if (!activeLesson) return;
    if (currentExerciseIndex < activeLesson.exercises.length - 1) {
      setCurrentExerciseIndex(prev => prev + 1);
      setLessonStatus('IDLE');
      setSelectedOption(null);
      setSortingState({});
      setActiveSortingItem(null);
      setSpokenText("");
      setAudioLevels([10, 10, 10, 10, 10]);
      if (!activeLesson.isBoss) setMascotMood(MascotMood.IDLE);
    } else {
      if (activeLesson.isBoss) {
          setBossState('DEAD');
          setTimeout(finishLesson, 1500);
      } else {
          finishLesson();
      }
    }
  };

  const finishLesson = () => setCurrentView('LESSON_COMPLETE');

  const applyLessonRewards = async () => {
      const isBoss = activeLesson?.isBoss;
      const xpGain = isBoss ? 50 : 20;
      const gemGain = isBoss ? 25 : 10;
      const topic = activeLesson!.topic;
      const newCompleted = Array.from(new Set([...currentUser.progress.completedLessons, topic]));
      
      let newTrees = [...(currentUser.progress.plantedTrees || [])];
      if (!newTrees.find(t => t.topic === topic) && !isBoss) {
          const randomTree = TREE_TYPES[Math.floor(Math.random() * TREE_TYPES.length)];
          setLastPlantedTree(randomTree);
          newTrees.push({ topic: topic, treeType: randomTree, datePlanted: new Date().toISOString() });
      }

      // Check if we need to generate more topics (Infinite Path)
      let currentTopics = [...currentUser.progress.generatedTopics];
      const currentTopicIndex = currentTopics.indexOf(topic);
      
      // If we are within 2 lessons of the end, generate more!
      if (currentTopicIndex >= currentTopics.length - 3) {
          setIsGeneratingMap(true);
          try {
              const newTopics = await generateTopicBatch(topic, currentUser.language, currentTopics.length);
              // Integration 6: let Python reorder the new topics when available.
              let orderedNew = newTopics;
              if (isAiEngineAvailable() && newTopics.length > 0) {
                  const profile = Object.fromEntries(
                      currentUser.progress.completedLessons.map((t) => [t, 1])
                  );
                  const rec = await recommendTopics(profile, newTopics, newTopics.length);
                  if (rec && rec.recommendations.length > 0) {
                      const recOrder = rec.recommendations.map((r) => r.topic);
                      const tail = newTopics.filter((t) => !recOrder.includes(t));
                      orderedNew = [...recOrder, ...tail];
                  }
              }
              currentTopics = [...currentTopics, ...orderedNew];
          } catch (e) {
              console.error("Failed to extend map", e);
          } finally {
              setIsGeneratingMap(false);
          }
      }

      updateUserProgress({
          xp: currentUser.progress.xp + xpGain,
          gems: currentUser.progress.gems + gemGain,
          completedLessons: newCompleted,
          plantedTrees: newTrees,
          generatedTopics: currentTopics,
          level: Math.floor((currentUser.progress.xp + xpGain) / 100) + 1
      });
  };

  const visualizeAudio = () => {
      if (!analyserRef.current) return;
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);
      const step = Math.floor(dataArray.length / 5);
      const newLevels = [];
      for(let i=0; i<5; i++) newLevels.push(Math.max(10, dataArray[i * step] / 2));
      setAudioLevels(newLevels);
      animationFrameRef.current = requestAnimationFrame(visualizeAudio);
  };

  const toggleRecording = async () => {
    if (!('webkitSpeechRecognition' in window)) { alert("Microphone access not supported."); return; }
    if (isRecording) {
        setIsRecording(false);
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        setAudioLevels([10, 10, 10, 10, 10]);
        return;
    }
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!audioContextRef.current) audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        const ctx = audioContextRef.current;
        if(ctx.state === 'suspended') await ctx.resume();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);
        analyserRef.current = analyser;
        setIsRecording(true);
        visualizeAudio();
        const SpeechRecognition = (window as any).webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.lang = currentUser?.language === 'pt' ? 'pt-BR' : 'en-US';
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.onresult = (event: any) => {
            let final = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) final += event.results[i][0].transcript;
            setSpokenText(final);
        };
        recognition.onerror = () => { setIsRecording(false); setAudioLevels([10,10,10,10,10]); };
        recognition.start();
    } catch (err) { alert("Could not access microphone."); setIsRecording(false); }
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    setChatMessages(prev => [...prev, { role: 'user', text: chatInput }]);
    setChatInput("");
    setMascotMood(MascotMood.THINKING);
    const result = await askEcoAssistant(chatInput);
    setChatMessages(prev => [...prev, { role: 'model', text: result.text, sources: result.sources }]);
    setMascotMood(MascotMood.TALKING);
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const renderBossIntro = () => {
      if (!activeLesson) return null;
      return (
          <div className="fixed inset-0 z-[60] bg-purple-900 animate-flash-red flex flex-col items-center justify-center overflow-hidden p-6">
                <div className="animate-ping absolute inset-0 bg-red-500 opacity-20"></div>
                <div className="relative z-10 text-center">
                    <h1 className="text-5xl md:text-7xl font-black text-white mb-12 animate-bounce drop-shadow-2xl tracking-widest border-4 border-white p-4 rounded-xl bg-purple-800 transform -rotate-2">BOSS BATTLE</h1>
                    <div className="flex items-end justify-center gap-4 md:gap-12">
                        <div className="animate-slide-in-left transform translate-y-8"><Mascot mood={MascotMood.BATTLE} className="w-32 h-32 md:w-48 md:h-48 drop-shadow-2xl filter brightness-110" /></div>
                        <div className="text-6xl font-black text-red-500 animate-pulse italic drop-shadow-md">VS</div>
                        <div className="animate-slide-in-right transform -translate-y-4"><BossMonster type={activeLesson.topic.includes('Smog') ? 'smog' : 'plastic'} state="ATTACK" health={100} maxHealth={100} className="w-48 h-48 md:w-64 md:h-64 animate-slam" /></div>
                    </div>
                    <p className="text-white font-bold text-xl mt-12 animate-pulse">GET READY!</p>
                </div>
          </div>
      );
  };

  const renderTopBar = () => (
      <header className="sticky top-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md z-30 border-b-2 border-slate-200 dark:border-slate-800 px-4 py-2 md:py-3 flex justify-between items-center shadow-sm transition-colors duration-300">
        <button onClick={() => setCurrentTab('PROFILE')} className="w-10 h-9 md:w-12 md:h-10 flex items-center justify-center text-2xl bg-slate-100 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors active:scale-95">{getFlag(currentUser?.language)}</button>
        <div className="flex gap-2 md:gap-4">
            <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-default border-2 border-transparent hover:border-slate-100 dark:hover:border-slate-700">
                <img src="https://d35aaqx5ub95lt.cloudfront.net/images/icons/398e4298a3b39ce566050e5c041949ef.svg" className="w-6 h-6 md:w-7 md:h-7"/>
                <span className="font-bold text-orange-500 text-lg dark:text-orange-400">{currentUser?.progress.streak}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer border-2 border-transparent hover:border-slate-100 dark:hover:border-slate-700" onClick={() => setCurrentTab('SHOP')}>
                 <img src="https://d35aaqx5ub95lt.cloudfront.net/images/gems/45c14e05be9c1af1d7d0b74bdacce178.svg" className="w-6 h-6 md:w-7 md:h-7"/>
                <span className="font-bold text-blue-500 text-lg dark:text-blue-400">{currentUser?.progress.gems}</span>
            </div>
            <div className={`flex items-center gap-2 px-3 py-1 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer border-2 border-transparent hover:border-slate-100 dark:hover:border-slate-700 ${shakeHeart ? 'animate-shake' : ''}`} onClick={() => setCurrentTab('SHOP')}>
                <Heart className={`w-6 h-6 md:w-7 md:h-7 ${currentUser && currentUser.progress.hearts > 0 ? 'fill-red-500 text-red-500' : 'fill-slate-200 text-slate-400'}`} strokeWidth={2.5}/>
                <span className="font-bold text-red-500 text-lg dark:text-red-400">{currentUser?.progress.hearts}</span>
            </div>
        </div>
    </header>
  );

  const renderMap = () => {
    const containerWidth = Math.min(windowSize.width, 448);
    const topics = mapTopics; // use dynamic list
    const pathD = topics.map((_, i) => {
        const x = 50 + Math.sin(i * 1.5) * 30; 
        const y = i * 120 + 60;
        return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
    }).join(' ');

    const pathColor = currentUser?.theme === 'dark' ? '#334155' : '#e2e8f0';

    return (
      <div className="flex-1 overflow-y-auto bg-white dark:bg-slate-950 relative pb-32 no-scrollbar transition-colors duration-300">
        <div className="bg-green-500 dark:bg-green-600 p-6 text-white mb-8 rounded-b-3xl shadow-lg relative overflow-hidden transition-colors duration-300">
            <div className="relative z-10 flex justify-between items-center max-w-md mx-auto">
                <div><h2 className="text-lg md:text-xl font-bold opacity-90 tracking-widest uppercase mb-1">Unit 1</h2><h1 className="text-xl md:text-2xl font-black">Eco Adventure</h1></div>
                <Leaf size={40} className="text-green-300 opacity-50 md:w-12 md:h-12" />
            </div>
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
        </div>

        <div className="max-w-md mx-auto flex flex-col items-center relative min-h-screen w-full">
            <svg className="absolute top-0 left-0 w-full z-0 pointer-events-none" style={{ height: topics.length * 120 + 200 }}>
                <path d={pathD.replace(/M ([0-9.]+) ([0-9.]+)/, `M $1 $2`).replace(/L ([0-9.]+) ([0-9.]+)/g, (match, x, y) => { const pxX = (parseFloat(x) / 100) * containerWidth; return `L ${pxX} ${y}`; }).replace('M', 'M').replace('L', 'L')} stroke={pathColor} strokeWidth="10" fill="none" strokeLinecap="round" />
            </svg>

            {topics.map((topic, index) => {
                const isCompleted = currentUser.progress.completedLessons.includes(topic);
                // Logic: If it's the first level OR previous level is completed
                const isUnlocked = index === 0 || currentUser.progress.completedLessons.includes(topics[index-1]);
                const isLocked = !isUnlocked;
                const xOffset = (Math.sin(index * 1.5) * 30 / 100) * containerWidth;
                const plantedTree = currentUser.progress.plantedTrees?.find(t => t.topic === topic);
                const isRightSide = xOffset > 0;
                const isBossNode = (index + 1) % 5 === 0;

                return (
                    <div key={index} className="relative flex flex-col items-center w-full mb-8 z-10" style={{ transform: `translateX(${xOffset}px)` }}>
                         <button
                            onClick={() => isUnlocked && startLesson(topic, index)}
                            disabled={isLocked || isLoading}
                            className={`rounded-full flex items-center justify-center border-b-[6px] transition-all duration-150 relative group z-20 ${isBossNode ? 'w-24 h-24' : 'w-20 h-20'} ${isCompleted ? 'bg-yellow-400 border-yellow-600 active:border-b-0 active:translate-y-[6px]' : isLocked ? 'bg-slate-200 dark:bg-slate-800 border-slate-300 dark:border-slate-700 cursor-not-allowed' : isBossNode ? 'bg-purple-600 border-purple-800 active:border-b-0 active:translate-y-[6px]' : 'bg-green-500 border-green-700 active:border-b-0 active:translate-y-[6px]'}`}
                        >
                            <div className="absolute top-2 left-2 w-6 h-3 bg-white opacity-20 rounded-full"></div>
                            {isCompleted ? <Star className="text-yellow-700 w-10 h-10 fill-yellow-600 drop-shadow-sm opacity-50" strokeWidth={3} /> : isLocked ? <Lock className="text-slate-400 dark:text-slate-600 w-8 h-8" strokeWidth={3} /> : isBossNode ? <Skull className="text-white w-12 h-12 drop-shadow-sm" strokeWidth={3} /> : <Star className="text-white w-10 h-10 drop-shadow-sm" strokeWidth={3} />}
                            {plantedTree && !isBossNode && (<div className={`absolute bottom-0 ${isRightSide ? '-left-20' : '-right-20'} w-24 h-24 pointer-events-none z-10 animate-pop origin-bottom`}><Tree type={plantedTree.treeType} /></div>)}
                            {isCompleted && (<div className="absolute -top-6 -right-2"><div className="w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center border-2 border-yellow-100 shadow-sm animate-bounce"><Trophy size={16} className="text-yellow-800" fill="currentColor"/></div></div>)}
                            {!isCompleted && isUnlocked && (<div className="absolute -top-10 bg-white dark:bg-slate-800 px-3 py-1 rounded-xl shadow-md border-2 border-slate-100 dark:border-slate-700 font-bold text-green-600 dark:text-green-400 animate-bounce whitespace-nowrap z-30 text-sm md:text-base">{isBossNode ? 'BOSS' : 'START'}<div className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-3 h-3 bg-white dark:bg-slate-800 border-b-2 border-r-2 border-slate-100 dark:border-slate-700 rotate-45"></div></div>)}
                        </button>
                         <div className={`absolute rounded-full top-2 bg-black/10 dark:bg-black/30 z-10 ${isLocked ? 'hidden' : 'block'} ${isBossNode ? 'w-24 h-24' : 'w-20 h-20'}`}></div>
                    </div>
                );
            })}
            
            {isGeneratingMap && (
                <div className="flex flex-col items-center gap-2 mb-12 animate-pulse">
                    <Loader className="animate-spin text-green-500" size={32} />
                    <span className="text-slate-400 font-bold text-sm">Discovering new lands...</span>
                </div>
            )}
        </div>
        {/* Floating Buttons */}
        <div className="fixed bottom-24 right-4 md:right-6 flex flex-col gap-3 md:gap-4 z-40 safe-area-bottom">
            <button onClick={() => setIsVoiceChatOpen(true)} className="bg-white dark:bg-slate-800 p-3 md:p-4 rounded-2xl shadow-xl border-2 border-slate-100 dark:border-slate-700 border-b-4 text-purple-500 dark:text-purple-400 hover:bg-slate-50 dark:hover:bg-slate-700 active:border-b-2 active:translate-y-[2px] transition-all"><Mic size={24} md:size={28} strokeWidth={2.5}/></button>
            <button onClick={() => setCurrentView('CHAT')} className="bg-white dark:bg-slate-800 p-3 md:p-4 rounded-2xl shadow-xl border-2 border-slate-100 dark:border-slate-700 border-b-4 text-blue-500 dark:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-700 active:border-b-2 active:translate-y-[2px] transition-all"><MessageCircle size={24} md:size={28} strokeWidth={2.5}/></button>
        </div>
        <div className="fixed bottom-24 left-4 md:left-6 z-40 safe-area-bottom" onClick={() => playTTS("Let's save the planet!")}>
             <Mascot mood={MascotMood.IDLE} className="w-20 h-20 md:w-24 md:h-24 hover:scale-105 transition-transform cursor-pointer drop-shadow-xl" />
        </div>
      </div>
    );
  };

  const renderLesson = () => {
    if (!activeLesson) return null;
    const exercise = activeLesson.exercises[currentExerciseIndex];
    const progressPerc = ((currentExerciseIndex + 1) / activeLesson.exercises.length) * 100;
    
    const renderSpeakingText = () => {
        if (!exercise.speakingTarget) return null;
        const targetWords = exercise.speakingTarget.split(' ');
        const spokenLower = spokenText.toLowerCase();
        return (
            <div className="flex flex-wrap gap-2 justify-center my-4 md:my-6">
                {targetWords.map((word, i) => {
                    const cleanWord = word.replace(/[.,!?]/g, '').toLowerCase();
                    const isSpoken = spokenLower.includes(cleanWord);
                    return (<span key={i} className={`text-xl md:text-2xl font-bold px-2 py-1 md:px-3 rounded-xl border-b-4 transition-all ${isSpoken ? 'bg-green-100 text-green-600 border-green-200' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-transparent'}`}>{word}</span>);
                })}
            </div>
        );
    };

    return (
      <div className={`flex flex-col h-full relative ${activeLesson.isBoss ? 'bg-purple-900' : 'bg-white dark:bg-slate-950'} transition-colors duration-300`}>
        <div className="flex items-center gap-4 md:gap-6 p-4 md:p-6 max-w-3xl mx-auto w-full z-10">
            <button onClick={() => setShowQuitModal(true)} className="text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-red-500 p-2 rounded-xl transition-colors"><XIcon size={24} md:size={28} strokeWidth={2.5}/></button>
            <div className="flex-1 h-3 md:h-4 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden"><div className={`${activeLesson.isBoss ? 'bg-purple-500' : 'bg-green-500'} h-full transition-all duration-500 ease-out rounded-full`} style={{ width: `${progressPerc}%` }}></div></div>
            {aiDifficultyUsed && (
                <span className="px-2 py-0.5 text-[10px] md:text-xs font-black uppercase rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700">AI-adapted</span>
            )}
            <div className="flex items-center text-red-500 font-bold"><Heart className={`fill-red-500 mr-2 ${shakeHeart ? 'animate-shake' : ''}`} size={24} md:size={28} strokeWidth={2.5}/> <span className="text-lg md:text-xl">{currentUser.progress.hearts}</span></div>
        </div>

        {showQuitModal && (
            <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl border-2 border-slate-100 dark:border-slate-800 transform scale-100">
                    <h3 className="text-2xl font-black text-slate-700 dark:text-slate-100 mb-2">Quit Lesson?</h3>
                    <p className="text-slate-500 dark:text-slate-400 font-bold mb-6">You will lose all progress in this session.</p>
                    <div className="flex flex-col gap-3">
                        <button onClick={() => setShowQuitModal(false)} className="w-full bg-blue-500 text-white font-extrabold text-lg py-3 rounded-xl border-b-4 border-blue-600 active:border-b-0 active:translate-y-[4px] transition-all">KEEP LEARNING</button>
                        <button onClick={() => { setShowQuitModal(false); setCurrentView('MAP'); }} className="w-full text-red-500 font-extrabold text-lg py-3 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-all">END SESSION</button>
                    </div>
                </div>
            </div>
        )}

        {activeLesson.isBoss && !isBossIntro && (
            <div className="flex flex-col items-center justify-center -mt-2 md:-mt-4 mb-2 md:mb-4 z-10">
                <BossMonster type={activeLesson.topic.includes('Smog') ? 'smog' : 'plastic'} state={bossState} health={bossHealth} maxHealth={100} className="w-32 h-32 md:w-48 md:h-48"/>
            </div>
        )}

        {!activeLesson.isBoss && currentExerciseIndex === 0 && activeLesson.context && (
            <div className="px-4 md:px-6 max-w-2xl mx-auto mb-2 md:mb-4 animate-pop">
                <div className="bg-blue-50 dark:bg-slate-800 border-2 border-blue-100 dark:border-slate-700 rounded-2xl p-3 md:p-4 flex items-start gap-3">
                    <Mascot mood={MascotMood.TALKING} className="w-12 h-12 md:w-16 md:h-16 shrink-0"/>
                    <div>
                        <h3 className="font-black text-blue-500 dark:text-blue-400 text-xs md:text-sm uppercase mb-1">Adventure Start!</h3>
                        <p className="text-slate-700 dark:text-slate-200 font-bold leading-tight text-sm md:text-base">{activeLesson.context}</p>
                    </div>
                </div>
            </div>
        )}

        <div ref={contentRef} key={currentExerciseIndex} className={`flex-1 overflow-y-auto pb-40 md:pb-48 max-w-2xl mx-auto w-full px-4 md:px-6 animate-fade-in z-10 ${activeLesson.isBoss ? 'text-white' : ''}`}>
            <h1 className={`text-xl md:text-3xl font-bold mt-2 md:mt-4 mb-6 md:mb-10 leading-tight ${activeLesson.isBoss ? 'text-white' : 'text-slate-700 dark:text-slate-100'}`}>
                {exercise.type === ExerciseType.SORTING ? "Tap the pairs that go together" : exercise.type === ExerciseType.FILL_BLANK ? "Fill in the missing word" : exercise.type === ExerciseType.SPEAKING ? "Speak this sentence" : exercise.question}
            </h1>

            {exercise.type === ExerciseType.MULTIPLE_CHOICE || exercise.type === ExerciseType.TRUE_FALSE || exercise.type === ExerciseType.SCENARIO ? (
                <div className="grid gap-3 md:gap-4">
                    {exercise.options?.map((opt, i) => (
                        <button key={i} disabled={lessonStatus !== 'IDLE'} onClick={() => { setSelectedOption(opt); playSound('pop'); }} className={`p-4 md:p-5 text-left rounded-2xl border-2 border-b-[4px] text-base md:text-lg font-bold transition-all active:scale-[0.98] active:border-b-2 ${selectedOption === opt ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : activeLesson.isBoss ? 'bg-purple-800 border-purple-950 text-white hover:bg-purple-700' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750'} ${lessonStatus === 'CORRECT' && selectedOption === opt ? '!bg-green-100 dark:!bg-green-900/30 !border-green-500 !text-green-700 dark:!text-green-400' : ''} ${lessonStatus === 'WRONG' && selectedOption === opt ? '!bg-red-100 dark:!bg-red-900/30 !border-red-500 !text-red-700 dark:!text-red-400' : ''}`}>
                            <div className="flex items-center justify-between">{opt}{selectedOption === opt && (<div className={`w-5 h-5 md:w-6 md:h-6 rounded border-2 flex items-center justify-center border-current`}><div className="w-2.5 h-2.5 md:w-3 md:h-3 bg-current rounded-full"></div></div>)}</div>
                        </button>
                    ))}
                </div>
            ) : exercise.type === ExerciseType.FILL_BLANK ? (
                <div className="space-y-8 md:space-y-12">
                     <div className={`flex flex-wrap items-center gap-2 md:gap-3 text-lg md:text-2xl font-medium leading-relaxed p-4 md:p-6 border-2 rounded-3xl ${activeLesson.isBoss ? 'text-white bg-purple-800 border-purple-700' : 'text-slate-700 dark:text-slate-200 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900'}`}>
                        {exercise.question.split('___').map((part, i, arr) => (
                            <React.Fragment key={i}><span>{part}</span>{i < arr.length - 1 && (<button onClick={() => setSelectedOption(null)} className={`min-w-[80px] md:min-w-[120px] h-10 md:h-12 px-3 md:px-4 rounded-xl border-b-4 transition-all font-bold text-base md:text-lg flex items-center justify-center ${selectedOption ? 'bg-blue-500 text-white border-blue-600' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-transparent'}`}>{selectedOption || "_"}</button>)}</React.Fragment>
                        ))}
                    </div>
                    <div className="flex flex-wrap gap-2 md:gap-3 justify-center">
                        {exercise.options?.map((opt) => (
                            <button key={opt} disabled={selectedOption === opt || lessonStatus !== 'IDLE'} onClick={() => { setSelectedOption(opt); playSound('pop'); }} className={`px-4 py-3 md:px-6 md:py-4 rounded-2xl border-2 border-b-4 font-bold text-base md:text-lg shadow-sm transition-all ${selectedOption === opt ? 'opacity-0 pointer-events-none scale-0' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750 active:translate-y-[2px] active:border-b-2'}`}>{opt}</button>
                        ))}
                    </div>
                </div>
            ) : exercise.type === ExerciseType.SORTING ? (
                 <div className="flex flex-col gap-4 md:gap-6">
                    <div className="flex gap-3 md:gap-4">
                        {exercise.sortingCategories?.map(cat => (
                            <button key={cat} onClick={() => handleSortingClick(cat, true)} className={`flex-1 rounded-2xl p-3 md:p-4 min-h-[140px] md:min-h-[180px] border-2 border-dashed transition-all flex flex-col gap-2 md:gap-3 items-center ${activeLesson.isBoss ? 'bg-purple-800 border-purple-600 text-white hover:bg-purple-700' : 'bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
                                <span className={`font-bold uppercase tracking-wider text-[10px] md:text-xs ${activeLesson.isBoss ? 'text-purple-200' : 'text-slate-500 dark:text-slate-400'}`}>{cat}</span>
                                <div className="flex flex-col gap-2 w-full">{Object.entries(sortingState).filter(([_, c]) => c === cat).map(([item]) => (<div key={item} className="bg-white dark:bg-slate-800 px-2 py-1 md:px-3 md:py-2 rounded-xl text-xs md:text-sm font-bold shadow-sm border border-slate-200 dark:border-slate-600 border-b-2 animate-pop text-center text-slate-700 dark:text-slate-200">{item}</div>))}</div>
                            </button>
                        ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2 md:gap-3">
                        {exercise.options?.filter(opt => !sortingState[opt]).map(opt => (
                            <button key={opt} onClick={() => handleSortingClick(opt, false)} className={`p-3 md:p-4 rounded-xl border-2 border-b-4 font-bold text-sm md:text-base text-center transition-all active:border-b-2 active:translate-y-[2px] ${activeSortingItem === opt ? 'bg-blue-100 dark:bg-blue-900/50 border-blue-400 text-blue-700 dark:text-blue-300' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750'}`}>{opt}</button>
                        ))}
                    </div>
                 </div>
            ) : exercise.type === ExerciseType.SPEAKING ? (
                 <div className="flex flex-col items-center justify-center space-y-8 md:space-y-12 py-4 md:py-8">
                     <div className="flex items-center gap-4">
                        <button onClick={() => playTTS(exercise.speakingTarget || "")} className="bg-blue-500 text-white p-3 md:p-4 rounded-2xl border-b-4 border-blue-700 hover:bg-blue-400 active:border-b-0 active:translate-y-1 transition-all"><Volume2 size={24} md:size={28} /></button>
                        <button onClick={() => playTTS(exercise.speakingTarget || "", 0.6)} className="bg-white dark:bg-slate-800 text-blue-500 border-2 border-blue-200 dark:border-blue-800 p-2 md:p-3 rounded-2xl hover:bg-blue-50 dark:hover:bg-slate-700 transition-all"><Turtle size={20} md:size={24} /></button>
                     </div>
                     <div className="min-h-[60px] md:min-h-[80px]">{renderSpeakingText()}</div>
                     <div className="relative">
                         <button onClick={toggleRecording} className={`w-24 h-24 md:w-32 md:h-32 rounded-3xl flex items-center justify-center transition-all border-b-8 active:border-b-0 active:translate-y-2 relative overflow-hidden ${isRecording ? 'bg-red-500 border-red-700' : 'bg-blue-500 border-blue-700'}`}>
                             {isRecording ? (<div className="flex gap-1 items-end h-12 md:h-16 pointer-events-none">{audioLevels.map((h, i) => (<div key={i} className="w-2 md:w-3 bg-white rounded-full transition-all duration-75" style={{ height: `${Math.min(100, h * 1.5)}%` }}></div>))}</div>) : ( <Mic className="text-white w-10 h-10 md:w-14 md:h-14" strokeWidth={2.5} /> )}
                         </button>
                     </div>
                     <p className={`font-bold uppercase tracking-widest text-xs md:text-sm ${activeLesson.isBoss ? 'text-purple-300' : 'text-slate-400 dark:text-slate-500'}`}>{isRecording ? "Listening..." : "Tap to Speak"}</p>
                </div>
            ) : null}
        </div>

        <div className={`fixed bottom-0 left-0 w-full z-50 border-t-2 transition-all duration-300 transform ${lessonStatus === 'IDLE' ? (activeLesson.isBoss ? 'bg-purple-950 border-purple-900' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800') : ''} ${lessonStatus === 'CORRECT' ? 'bg-green-100 dark:bg-green-900 border-green-200 dark:border-green-800' : ''} ${lessonStatus === 'ALMOST' ? 'bg-amber-100 dark:bg-amber-900 border-amber-200 dark:border-amber-800' : ''} ${lessonStatus === 'WRONG' ? 'bg-red-100 dark:bg-red-900 border-red-200 dark:border-red-800' : ''}`}>
            <div className="max-w-3xl mx-auto p-4 md:p-8 flex items-center justify-between gap-4 md:gap-6">
                {lessonStatus !== 'IDLE' && ( <div className="hidden md:block -mt-20"><Mascot mood={lessonStatus === 'CORRECT' ? (activeLesson.isBoss ? MascotMood.BATTLE : MascotMood.HAPPY) : lessonStatus === 'ALMOST' ? MascotMood.THINKING : MascotMood.SAD} className="w-24 h-24 md:w-32 md:h-32" /></div>)}
                {lessonStatus === 'IDLE' ? (
                     <div className="w-full flex flex-col gap-3 safe-area-bottom">
                         <button onClick={checkAnswer} disabled={!selectedOption && Object.keys(sortingState).length === 0 && !spokenText} className="w-full bg-green-500 text-white font-extrabold text-lg py-3 md:py-4 rounded-2xl border-b-[6px] border-green-600 active:border-b-0 active:translate-y-[6px] disabled:opacity-50 disabled:active:translate-y-0 disabled:border-b-[6px] transition-all hover:bg-green-400">CHECK</button>
                         <button onClick={handleNext} className={`w-full font-bold uppercase tracking-widest text-xs md:text-sm transition-colors flex items-center justify-center gap-1 ${activeLesson.isBoss ? 'text-purple-400 hover:text-purple-200' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}>Skip <SkipForward size={14} /></button>
                     </div>
                ) : (
                    <div className="w-full flex flex-col md:flex-row items-center gap-4 safe-area-bottom">
                        <div className="flex flex-col flex-1 w-full">
                             <div className="flex items-center gap-3 mb-1 md:mb-2">
                                <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center border-2 ${lessonStatus === 'CORRECT' ? 'bg-green-500 border-green-600' : lessonStatus === 'ALMOST' ? 'bg-amber-500 border-amber-600' : 'bg-red-500 border-red-600'}`}>{lessonStatus === 'CORRECT' ? <Check className="text-white w-5 h-5 md:w-6 md:h-6" strokeWidth={4}/> : lessonStatus === 'ALMOST' ? <Star className="text-white w-5 h-5 md:w-6 md:h-6" strokeWidth={4}/> : <XIcon className="text-white w-5 h-5 md:w-6 md:h-6" strokeWidth={4}/>}</div>
                                <span className={`font-black text-xl md:text-2xl ${lessonStatus === 'CORRECT' ? 'text-green-700 dark:text-green-300' : lessonStatus === 'ALMOST' ? 'text-amber-700 dark:text-amber-300' : 'text-red-700 dark:text-red-300'}`}>
                                    {lessonStatus === 'CORRECT' ? reactionText : lessonStatus === 'ALMOST' ? (aiHint || 'Almost there!') : 'Incorrect'}
                                </span>
                             </div>
                             {lessonStatus === 'WRONG' && (<p className="text-red-800 dark:text-red-300 text-base md:text-lg font-medium pl-11 md:pl-14 leading-tight">{exercise.explanation}</p>)}
                             {lessonStatus === 'WRONG' && aiHint && (<p className="text-slate-600 dark:text-slate-400 text-xs md:text-sm font-medium pl-11 md:pl-14 mt-1">AI hint: {aiHint}</p>)}
                        </div>
                        <button onClick={handleNext} className={`w-full md:w-auto px-8 md:px-10 py-3 md:py-4 rounded-2xl font-extrabold text-white border-b-[6px] active:border-b-0 active:translate-y-[6px] min-w-[140px] text-lg transition-all ${lessonStatus === 'CORRECT' ? 'bg-green-500 border-green-700 hover:bg-green-400' : lessonStatus === 'ALMOST' ? 'bg-amber-500 border-amber-700 hover:bg-amber-400' : 'bg-red-500 border-red-700 hover:bg-red-400'}`}>CONTINUE</button>
                    </div>
                )}
            </div>
        </div>
      </div>
    );
  };
  
  const buyHearts = () => {
      if (!currentUser) return;
      if (currentUser.progress.hearts >= 5) {
          alert("Hearts are already full!");
          return;
      }
      if (currentUser.progress.gems >= 50) {
          updateUserProgress({
              gems: currentUser.progress.gems - 50,
              hearts: 5
          });
          playSound('correct');
      } else {
          alert("Not enough gems! You need 50 gems.");
      }
  };

  const renderLessonComplete = () => {
      const isBoss = activeLesson?.isBoss;
      const xpGain = isBoss ? 50 : 20;
      const gemGain = isBoss ? 25 : 10;
      
      const total = activeLesson?.exercises.length || 1;
      const score = Math.round((correctAnswersCount / total) * 100);
      const isPassed = score >= 60;

      if (!isPassed) {
          return (
              <div className="fixed inset-0 bg-red-500 z-50 flex flex-col items-center justify-center p-6 animate-fade-in overflow-hidden">
                  <div className="z-10 flex flex-col items-center w-full max-w-md text-white text-center">
                      <Mascot mood={MascotMood.SAD} className="w-32 h-32 md:w-40 md:h-40 mb-6 animate-pulse" />
                      <h2 className="text-3xl md:text-4xl font-black mb-2 tracking-wider">LEVEL FAILED</h2>
                      <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 mb-8 border-2 border-white/30 w-full">
                          <div className="flex items-center justify-center gap-2 mb-2">
                              <AlertTriangle size={32} className="text-white" />
                              <span className="text-2xl font-bold">{score}%</span>
                          </div>
                          <p className="font-bold opacity-90">You need 60% to pass.</p>
                      </div>
                      <button onClick={() => setCurrentView('MAP')} className="w-full bg-white text-red-500 font-extrabold text-lg py-4 rounded-2xl border-b-[6px] border-red-200 active:border-b-0 active:translate-y-[6px] transition-all hover:bg-red-50 uppercase tracking-wider">Try Again</button>
                  </div>
              </div>
          );
      }

      return (
          <div className="flex flex-col items-center justify-center h-full bg-white dark:bg-slate-950 transition-colors duration-300 relative overflow-hidden">
              <Confetti />
              <div className="z-10 flex flex-col items-center w-full max-w-md p-6">
                <h1 className="text-3xl md:text-4xl font-black text-yellow-400 mb-6 animate-bounce text-center uppercase tracking-wider drop-shadow-sm">
                    {isBoss ? 'Victory!' : 'Lesson Complete!'}
                </h1>
                
                <div className="relative mb-8">
                    <div className="absolute inset-0 bg-yellow-400 blur-3xl opacity-20 rounded-full"></div>
                    <Mascot mood={MascotMood.EXCITED} className="w-40 h-40 md:w-56 md:h-56 relative z-10 animate-bounce" />
                </div>

                <div className="grid grid-cols-2 gap-4 w-full mb-8">
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-200 dark:border-yellow-700 rounded-2xl p-4 flex flex-col items-center animate-slide-in-left">
                        <span className="text-yellow-600 dark:text-yellow-400 font-bold text-xs uppercase tracking-wider">Total XP</span>
                        <div className="flex items-center gap-2">
                             <Zap className="text-yellow-500 fill-yellow-500" size={24} />
                             <span className="text-3xl font-black text-yellow-500">+{xpGain}</span>
                        </div>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-700 rounded-2xl p-4 flex flex-col items-center animate-slide-in-right">
                        <span className="text-blue-600 dark:text-blue-400 font-bold text-xs uppercase tracking-wider">Gems</span>
                         <div className="flex items-center gap-2">
                             <div className="w-6 h-6"><img src="https://d35aaqx5ub95lt.cloudfront.net/images/gems/45c14e05be9c1af1d7d0b74bdacce178.svg" alt="gem" /></div>
                             <span className="text-3xl font-black text-blue-500">+{gemGain}</span>
                        </div>
                    </div>
                </div>

                {lastPlantedTree && (
                    <div className="bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-700 rounded-2xl p-6 w-full mb-8 flex flex-col items-center animate-pop">
                        <span className="text-green-600 dark:text-green-400 font-bold text-sm uppercase tracking-wider mb-2">New Tree Planted!</span>
                        <div className="w-24 h-24 relative">
                             <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-4 bg-black/10 rounded-[100%]"></div>
                            <Tree type={lastPlantedTree} className="w-full h-full" />
                        </div>
                        <span className="text-green-700 dark:text-green-300 font-black text-xl mt-2 capitalize">{lastPlantedTree}</span>
                    </div>
                )}

                <button 
                    onClick={() => { playSound('pop'); setCurrentView('MAP'); }}
                    className="w-full bg-green-500 text-white font-extrabold text-xl py-4 rounded-2xl border-b-[6px] border-green-600 active:border-b-0 active:translate-y-[6px] transition-all hover:bg-green-400 shadow-xl"
                >
                    CONTINUE
                </button>
              </div>
          </div>
      );
  };

  // ... (renderShop, renderLeaderboard, renderChat - Update for dark mode)
  const renderShop = () => (
      <div className="flex-1 bg-white dark:bg-slate-950 p-4 pb-32 overflow-y-auto transition-colors duration-300">
          <div className="text-center py-6"><h2 className="text-2xl font-black text-slate-700 dark:text-slate-100">Shop</h2><p className="text-slate-500 dark:text-slate-400">Spend your gems!</p></div>
          <div className="max-w-md mx-auto space-y-6">
              <div className="p-4 border-2 border-slate-200 dark:border-slate-800 rounded-2xl flex items-center justify-between">
                  <Heart className="w-12 h-12 text-red-500 fill-red-500" />
                  <div className="flex-1 px-4"><h3 className="font-bold text-slate-700 dark:text-slate-200 text-lg">Refill Hearts</h3><p className="text-slate-400 dark:text-slate-500 text-sm">Get full health</p></div>
                  <button onClick={buyHearts} disabled={currentUser.progress.hearts === 5} className="bg-blue-500 text-white px-6 py-3 rounded-xl font-bold border-b-4 border-blue-700 active:border-b-0 active:translate-y-1 transition-all disabled:opacity-50 disabled:active:translate-y-0"><div className="flex items-center gap-1"><img src="https://d35aaqx5ub95lt.cloudfront.net/images/gems/45c14e05be9c1af1d7d0b74bdacce178.svg" className="w-5 h-5"/>50</div></button>
              </div>
          </div>
      </div>
  );

  const renderLeaderboard = () => (
      <div className="flex-1 bg-white dark:bg-slate-950 p-4 pb-32 overflow-y-auto transition-colors duration-300">
          <div className="text-center py-6"><h2 className="text-2xl font-black text-slate-700 dark:text-slate-100">Leaderboard</h2><p className="text-slate-500 dark:text-slate-400">Weekly League</p></div>
          <div className="max-w-md mx-auto space-y-3">
              {[
                  { name: "EcoWarrior", xp: 1250, avatar: "bear" },
                  { name: "GreenThumb", xp: 980, avatar: "girl" },
                  { name: currentUser.displayName, xp: currentUser.progress.xp, avatar: currentUser.avatar, isMe: true },
                  { name: "RecycleRex", xp: 450, avatar: "fox" },
                  { name: "SolarSam", xp: 320, avatar: "boy" },
              ].sort((a,b) => b.xp - a.xp).map((u, i) => (
                  <div key={i} className={`flex items-center gap-4 p-4 rounded-2xl border-2 ${u.isMe ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-slate-100 dark:border-slate-800'}`}>
                      <div className={`font-bold w-6 text-center ${i < 3 ? 'text-yellow-500' : 'text-slate-400 dark:text-slate-600'}`}>{i + 1}</div>
                      <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden"><Avatar id={u.avatar} /></div>
                      <div className="flex-1 font-bold text-slate-700 dark:text-slate-200">{u.name}</div>
                      <div className="font-bold text-slate-500 dark:text-slate-400">{u.xp} XP</div>
                  </div>
              ))}
          </div>
      </div>
  );

  const renderChat = () => (
    <div className="flex flex-col h-full bg-slate-100 dark:bg-slate-950 transition-colors duration-300">
        <header className="bg-white dark:bg-slate-900 p-4 flex items-center justify-between border-b-2 border-slate-200 dark:border-slate-800 sticky top-0 z-20 transition-colors duration-300">
            <h2 className="font-black text-slate-700 dark:text-slate-100 text-xl flex items-center gap-3"><Mascot mood={MascotMood.HAPPY} className="w-10 h-10"/> Ask Eco</h2>
            <button onClick={() => setCurrentView('MAP')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                <ChevronLeft className="text-slate-400 dark:text-slate-500" size={32} strokeWidth={2.5} />
            </button>
        </header>
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
             {chatMessages.length === 0 && (
                 <div className="text-center mt-20 text-slate-400 dark:text-slate-500 px-8">
                     <p className="font-bold text-lg mb-2">Welcome to Eco Chat!</p>
                     <p>Ask me anything!</p>
                 </div>
             )}
             {chatMessages.map((msg, i) => (
                 <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                     <div className={`max-w-[85%] p-5 rounded-3xl text-md leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-blue-500 text-white rounded-tr-md' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-tl-md border-2 border-slate-200 dark:border-slate-700'}`}>
                         {msg.text}
                         {msg.sources && msg.sources.length > 0 && (
                            <div className="mt-4 pt-3 border-t border-slate-100/20 dark:border-slate-700/50 flex flex-wrap gap-2">
                                {msg.sources.map((src, k) => src.web?.uri && (
                                    <a key={k} href={src.web.uri} target="_blank" className="flex items-center gap-1 text-xs bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors font-bold"><ExternalLink size={12} /> {src.web.title || 'Source'}</a>
                                ))}
                            </div>
                         )}
                     </div>
                 </div>
             ))}
             <div ref={chatEndRef} />
        </div>
        <form onSubmit={handleChatSubmit} className="p-4 bg-white dark:bg-slate-900 border-t-2 border-slate-200 dark:border-slate-800 flex gap-3 pb-8 transition-colors duration-300">
            <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Type your question..." className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-2xl px-6 py-4 outline-none focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900 border-2 border-transparent focus:border-blue-300 dark:focus:border-blue-700 transition-all font-bold text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500" />
            <button disabled={!chatInput.trim()} className="bg-blue-500 text-white p-4 rounded-2xl border-b-4 border-blue-700 active:border-b-0 active:translate-y-1 disabled:opacity-50 disabled:active:translate-y-0 transition-all"><ArrowRight size={24} strokeWidth={3} /></button>
        </form>
    </div>
  );

  const renderBottomNav = () => (
      <nav className="fixed bottom-0 left-0 w-full bg-white dark:bg-slate-950 border-t-2 border-slate-200 dark:border-slate-800 flex justify-around p-2 z-50 safe-area-bottom transition-colors duration-300">
          <button onClick={() => setCurrentTab('LEARN')} className={`p-2 flex-1 flex items-center justify-center rounded-xl transition-all ${currentTab === 'LEARN' ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}><Home className={currentTab === 'LEARN' ? 'text-blue-500' : 'text-slate-400 dark:text-slate-500'} size={24} md:size={28} strokeWidth={currentTab === 'LEARN' ? 3 : 2.5} /></button>
          <button onClick={() => setCurrentTab('LEADERBOARD')} className={`p-2 flex-1 flex items-center justify-center rounded-xl transition-all ${currentTab === 'LEADERBOARD' ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}><Trophy className={currentTab === 'LEADERBOARD' ? 'text-blue-500' : 'text-slate-400 dark:text-slate-500'} size={24} md:size={28} strokeWidth={currentTab === 'LEADERBOARD' ? 3 : 2.5} /></button>
          <button onClick={() => setCurrentTab('SHOP')} className={`p-2 flex-1 flex items-center justify-center rounded-xl transition-all ${currentTab === 'SHOP' ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}><ShoppingBag className={currentTab === 'SHOP' ? 'text-blue-500' : 'text-slate-400 dark:text-slate-500'} size={24} md:size={28} strokeWidth={currentTab === 'SHOP' ? 3 : 2.5} /></button>
          <button onClick={() => setCurrentTab('PROFILE')} className={`p-2 flex-1 flex items-center justify-center rounded-xl transition-all ${currentTab === 'PROFILE' ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}><UserIcon className={currentTab === 'PROFILE' ? 'text-blue-500' : 'text-slate-400 dark:text-slate-500'} size={24} md:size={28} strokeWidth={currentTab === 'PROFILE' ? 3 : 2.5} /></button>
      </nav>
  );

  return (
    <div className="h-full w-full font-['Nunito'] overflow-hidden flex flex-col bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      {isLoading && (
        <div className="fixed inset-0 bg-green-500 z-[100] flex flex-col items-center justify-center p-8 text-center text-white">
             <Mascot mood={MascotMood.BATTLE} className="w-32 h-32 md:w-40 md:h-40 animate-bounce mb-8 drop-shadow-lg" />
             <h2 className="text-xl md:text-2xl font-black mb-4 uppercase">{loadingTip}</h2>
        </div>
      )}
      {currentView === 'MAP' && renderTopBar()}
      <div className="flex-1 overflow-hidden relative">
        {currentView === 'MAP' && (
            <>
                {currentTab === 'LEARN' && renderMap()}
                {currentTab === 'LEADERBOARD' && renderLeaderboard()}
                {currentTab === 'SHOP' && renderShop()}
                {currentTab === 'PROFILE' && (<Profile user={currentUser} onLogout={() => { authService.logout(); setCurrentUser(null); }} onUpdate={setCurrentUser}/>)}
            </>
        )}
        {currentView === 'LESSON' && renderLesson()}
        {currentView === 'LESSON_COMPLETE' && renderLessonComplete()}
        {currentView === 'CHAT' && renderChat()}
      </div>
      {currentView === 'MAP' && renderBottomNav()}
      <VoiceChat isOpen={isVoiceChatOpen} onClose={() => setIsVoiceChatOpen(false)} />
    </div>
  );
}

export default App;
