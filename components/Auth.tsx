
import React, { useState } from 'react';
import { ArrowRight, ChevronLeft, Check, Globe } from 'lucide-react';
import { authService } from '../services/authService';
import { User } from '../types';
import { Mascot } from './Mascot';
import { MascotMood } from '../types';
import { Avatar, AVATAR_IDS } from './Avatar';

interface AuthProps {
  onLogin: (user: User) => void;
}

type AuthStep = 'WELCOME' | 'LOGIN' | 'LANGUAGE' | 'GOAL' | 'AVATAR' | 'SIGNUP_FORM';

export const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [step, setStep] = useState<AuthStep>('WELCOME');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Signup Data
  const [goal, setGoal] = useState(20);
  const [avatar, setAvatar] = useState('bear');
  const [language, setLanguage] = useState('en'); 
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');

  // Login Data
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const user = await authService.login(loginUser, loginPass);
      onLogin(user);
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 5 || !/[a-zA-Z]/.test(password)) {
        setError("Password must be at least 5 characters and contain a letter");
        return;
    }
    setLoading(true);
    setError(null);
    try {
      const user = await authService.signup({
        username,
        password,
        displayName: displayName || username,
        dailyGoal: goal,
        avatar,
        language
      });
      onLogin(user);
    } catch (err: any) {
      setError(err.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  const renderWelcome = () => (
    <div className="flex flex-col items-center justify-center h-full p-6 text-center animate-fade-in bg-white dark:bg-slate-950 transition-colors duration-300">
      <Mascot mood={MascotMood.EXCITED} className="w-40 h-40 md:w-48 md:h-48 mb-6 md:mb-8" />
      <h1 className="text-2xl md:text-3xl font-black text-slate-700 dark:text-slate-100 mb-4">Learn to Save the Planet for Free</h1>
      <p className="text-base md:text-lg text-slate-500 dark:text-slate-400 font-bold mb-8 md:mb-12">Fun, effective, and 100% free.</p>
      
      <div className="w-full max-w-sm space-y-3 md:space-y-4">
        <button 
          onClick={() => setStep('LANGUAGE')}
          className="w-full bg-green-500 text-white font-extrabold text-base md:text-lg py-3 md:py-4 rounded-2xl border-b-[6px] border-green-600 active:border-b-0 active:translate-y-[6px] transition-all"
        >
          GET STARTED
        </button>
        <button 
          onClick={() => setStep('LOGIN')}
          className="w-full bg-white dark:bg-slate-800 text-blue-500 dark:text-blue-400 font-extrabold text-base md:text-lg py-3 md:py-4 rounded-2xl border-2 border-slate-200 dark:border-slate-700 border-b-[6px] active:border-b-2 active:translate-y-[4px] transition-all"
        >
          I ALREADY HAVE AN ACCOUNT
        </button>
      </div>
    </div>
  );

  const renderLogin = () => (
    <div className="flex flex-col h-full p-6 bg-white dark:bg-slate-950 transition-colors duration-300">
      <button onClick={() => setStep('WELCOME')} className="self-start text-slate-400 dark:text-slate-500 mb-6 md:mb-8"><ChevronLeft size={32} /></button>
      <h2 className="text-2xl font-black text-slate-700 dark:text-slate-100 mb-6 md:mb-8 text-center">Log in</h2>
      <form onSubmit={handleLogin} className="flex-1 flex flex-col gap-4 max-w-sm mx-auto w-full">
        <input 
          type="text" 
          placeholder="Username" 
          value={loginUser}
          onChange={e => setLoginUser(e.target.value)}
          className="w-full bg-slate-100 dark:bg-slate-800 rounded-2xl px-4 py-4 font-bold text-slate-700 dark:text-slate-100 outline-none border-2 border-slate-200 dark:border-slate-700 focus:border-blue-400 transition-colors placeholder-slate-400 dark:placeholder-slate-500"
        />
        <input 
          type="password" 
          placeholder="Password" 
          value={loginPass}
          onChange={e => setLoginPass(e.target.value)}
          className="w-full bg-slate-100 dark:bg-slate-800 rounded-2xl px-4 py-4 font-bold text-slate-700 dark:text-slate-100 outline-none border-2 border-slate-200 dark:border-slate-700 focus:border-blue-400 transition-colors placeholder-slate-400 dark:placeholder-slate-500"
        />
        {error && <p className="text-red-500 font-bold text-center">{error}</p>}
        <button 
          disabled={loading || !loginUser || !loginPass}
          className="w-full bg-blue-500 text-white font-extrabold text-lg py-4 rounded-2xl border-b-[6px] border-blue-600 active:border-b-0 active:translate-y-[6px] transition-all disabled:opacity-50 disabled:active:translate-y-0 mt-4"
        >
          {loading ? 'LOGGING IN...' : 'LOG IN'}
        </button>
      </form>
    </div>
  );

  const renderLanguage = () => (
    <div className="flex flex-col h-full p-6 bg-white dark:bg-slate-950 transition-colors duration-300">
      <button onClick={() => setStep('WELCOME')} className="self-start text-slate-400 dark:text-slate-500 mb-6"><ChevronLeft size={32} /></button>
      <h2 className="text-2xl font-black text-slate-700 dark:text-slate-100 mb-2 text-center">I want to learn in...</h2>
      
      <div className="flex-1 flex flex-col gap-3 md:gap-4 max-w-sm mx-auto w-full mt-8">
        {[
          { code: 'en', label: 'English', flag: '🇺🇸' },
          { code: 'pt', label: 'Português', flag: '🇧🇷' },
          { code: 'es', label: 'Español', flag: '🇪🇸' },
          { code: 'fr', label: 'Français', flag: '🇫🇷' },
        ].map((lang) => (
          <button
            key={lang.code}
            onClick={() => setLanguage(lang.code)}
            className={`
              p-4 rounded-2xl border-2 font-bold text-lg flex items-center gap-4 transition-all
              ${language === lang.code 
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' 
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750'}
            `}
          >
            <span className="text-3xl">{lang.flag}</span>
            <span className="flex-1 text-left">{lang.label}</span>
            {language === lang.code && <Check className="text-blue-500" strokeWidth={4} />}
          </button>
        ))}
      </div>
      
      <button 
        onClick={() => setStep('GOAL')}
        className="w-full max-w-sm mx-auto bg-green-500 text-white font-extrabold text-lg py-4 rounded-2xl border-b-[6px] border-green-600 active:border-b-0 active:translate-y-[6px] transition-all mt-6"
      >
        CONTINUE
      </button>
    </div>
  );

  const renderGoal = () => (
    <div className="flex flex-col h-full p-6 bg-white dark:bg-slate-950 transition-colors duration-300">
      <button onClick={() => setStep('LANGUAGE')} className="self-start text-slate-400 dark:text-slate-500 mb-6"><ChevronLeft size={32} /></button>
      <Mascot mood={MascotMood.HAPPY} className="w-24 h-24 mb-4 self-center" />
      <div className="bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-200 dark:border-blue-800 p-4 rounded-xl mb-8">
        <p className="font-bold text-slate-700 dark:text-blue-200">"How much do you want to learn today?"</p>
      </div>
      
      <div className="flex-1 flex flex-col gap-3 md:gap-4 max-w-sm mx-auto w-full">
        {[
          { label: 'Casual', val: 10 },
          { label: 'Regular', val: 20 },
          { label: 'Serious', val: 30 },
          { label: 'Intense', val: 50 },
        ].map((opt) => (
          <button
            key={opt.val}
            onClick={() => setGoal(opt.val)}
            className={`
              p-4 rounded-2xl border-2 font-bold text-lg flex items-center justify-between transition-all
              ${goal === opt.val 
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' 
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750'}
            `}
          >
            {opt.label}
            {goal === opt.val && <Check className="text-blue-500" strokeWidth={4} />}
          </button>
        ))}
      </div>
      
      <button 
        onClick={() => setStep('AVATAR')}
        className="w-full max-w-sm mx-auto bg-green-500 text-white font-extrabold text-lg py-4 rounded-2xl border-b-[6px] border-green-600 active:border-b-0 active:translate-y-[6px] transition-all mt-6"
      >
        CONTINUE
      </button>
    </div>
  );

  const renderAvatar = () => (
    <div className="flex flex-col h-full p-6 bg-white dark:bg-slate-950 transition-colors duration-300">
      <button onClick={() => setStep('GOAL')} className="self-start text-slate-400 dark:text-slate-500 mb-6"><ChevronLeft size={32} /></button>
      <h2 className="text-2xl font-black text-slate-700 dark:text-slate-100 mb-2 text-center">Pick your Avatar</h2>
      <p className="text-center text-slate-400 dark:text-slate-500 font-bold mb-8">You can change this later</p>
      
      <div className="flex-1 grid grid-cols-2 gap-4 max-w-sm mx-auto w-full auto-rows-min">
        {AVATAR_IDS.map((id) => (
          <button
            key={id}
            onClick={() => setAvatar(id)}
            className={`
              aspect-square flex items-center justify-center rounded-3xl border-2 border-b-4 transition-all p-2
              ${avatar === id 
                ? 'bg-blue-100 dark:bg-blue-900/50 border-blue-400 scale-105' 
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750'}
            `}
          >
            <Avatar id={id} />
          </button>
        ))}
      </div>
      
      <button 
        onClick={() => setStep('SIGNUP_FORM')}
        className="w-full max-w-sm mx-auto bg-green-500 text-white font-extrabold text-lg py-4 rounded-2xl border-b-[6px] border-green-600 active:border-b-0 active:translate-y-[6px] transition-all mt-6"
      >
        CONTINUE
      </button>
    </div>
  );

  const renderSignupForm = () => (
    <div className="flex flex-col h-full p-6 bg-white dark:bg-slate-950 transition-colors duration-300">
      <button onClick={() => setStep('AVATAR')} className="self-start text-slate-400 dark:text-slate-500 mb-8"><ChevronLeft size={32} /></button>
      <h2 className="text-2xl font-black text-slate-700 dark:text-slate-100 mb-8 text-center">Create your profile</h2>
      
      <form onSubmit={handleSignup} className="flex-1 flex flex-col gap-4 max-w-sm mx-auto w-full">
        <input 
          type="text" 
          placeholder="Name (optional)" 
          value={displayName}
          onChange={e => setDisplayName(e.target.value)}
          className="w-full bg-slate-100 dark:bg-slate-800 rounded-2xl px-4 py-4 font-bold text-slate-700 dark:text-slate-100 outline-none border-2 border-slate-200 dark:border-slate-700 focus:border-blue-400 transition-colors placeholder-slate-400 dark:placeholder-slate-500"
        />
        <input 
          type="text" 
          placeholder="Username" 
          value={username}
          onChange={e => setUsername(e.target.value)}
          className="w-full bg-slate-100 dark:bg-slate-800 rounded-2xl px-4 py-4 font-bold text-slate-700 dark:text-slate-100 outline-none border-2 border-slate-200 dark:border-slate-700 focus:border-blue-400 transition-colors placeholder-slate-400 dark:placeholder-slate-500"
          required
        />
        <input 
          type="password" 
          placeholder="Password" 
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full bg-slate-100 dark:bg-slate-800 rounded-2xl px-4 py-4 font-bold text-slate-700 dark:text-slate-100 outline-none border-2 border-slate-200 dark:border-slate-700 focus:border-blue-400 transition-colors placeholder-slate-400 dark:placeholder-slate-500"
          required
        />
        
        {error && <p className="text-red-500 font-bold text-center">{error}</p>}
        
        <button 
          disabled={loading || !username || !password}
          className="w-full bg-blue-500 text-white font-extrabold text-lg py-4 rounded-2xl border-b-[6px] border-blue-600 active:border-b-0 active:translate-y-[6px] transition-all disabled:opacity-50 disabled:active:translate-y-0 mt-4"
        >
          {loading ? 'CREATING ACCOUNT...' : 'CREATE ACCOUNT'}
        </button>
      </form>
    </div>
  );

  return (
    <div className="h-full w-full bg-white dark:bg-slate-950 overflow-y-auto transition-colors duration-300">
      {step === 'WELCOME' && renderWelcome()}
      {step === 'LOGIN' && renderLogin()}
      {step === 'LANGUAGE' && renderLanguage()}
      {step === 'GOAL' && renderGoal()}
      {step === 'AVATAR' && renderAvatar()}
      {step === 'SIGNUP_FORM' && renderSignupForm()}
    </div>
  );
};