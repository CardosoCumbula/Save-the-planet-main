
import React from 'react';
import { User } from '../types';
import { Settings, LogOut, Flame, Zap, Trophy, Heart, Sun, Moon } from 'lucide-react';
import { authService } from '../services/authService';
import { Avatar, AVATAR_IDS } from './Avatar';

interface ProfileProps {
  user: User;
  onLogout: () => void;
  onUpdate: (user: User) => void;
}

export const Profile: React.FC<ProfileProps> = ({ user, onLogout, onUpdate }) => {
  
  const handleEditAvatar = () => {
     const currentIdx = AVATAR_IDS.indexOf(user.avatar);
     const nextAvatar = AVATAR_IDS[(currentIdx + 1) % AVATAR_IDS.length];
     const updatedUser = { ...user, avatar: nextAvatar };
     authService.saveUser(updatedUser);
     onUpdate(updatedUser);
  };

  const toggleTheme = () => {
      const newTheme = user.theme === 'dark' ? 'light' : 'dark';
      const updatedUser = { ...user, theme: newTheme };
      authService.saveUser(updatedUser);
      onUpdate(updatedUser);
  };

  return (
    <div className="h-full bg-slate-100 dark:bg-slate-950 overflow-y-auto pb-32 transition-colors duration-300">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b-2 border-slate-200 dark:border-slate-800 p-4 md:p-6 transition-colors duration-300">
        <div className="flex justify-between items-start mb-4 md:mb-6">
          <div className="flex flex-col">
            <h1 className="text-xl md:text-2xl font-black text-slate-800 dark:text-slate-100">{user.displayName}</h1>
            <p className="text-slate-400 dark:text-slate-500 font-bold">@{user.username}</p>
            <p className="text-slate-400 dark:text-slate-500 text-xs md:text-sm mt-1">Joined {new Date(user.joinedDate).toLocaleDateString()}</p>
          </div>
          <button onClick={onLogout} className="p-2 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl">
             <LogOut />
          </button>
        </div>
        
        <div className="flex gap-4 md:gap-6 items-center">
            <div className="relative group cursor-pointer w-20 h-20 md:w-24 md:h-24" onClick={handleEditAvatar}>
               <div className="w-full h-full rounded-full overflow-hidden border-4 border-slate-200 dark:border-slate-700 bg-blue-50 dark:bg-blue-900/30">
                  <Avatar id={user.avatar} />
               </div>
               <div className="absolute bottom-0 right-0 bg-blue-500 p-1.5 rounded-full border-2 border-white dark:border-slate-900">
                 <Settings size={12} className="text-white"/>
               </div>
            </div>
            
            <div className="flex gap-4 md:gap-8">
               <div className="flex flex-col">
                   <span className="font-black text-lg md:text-xl text-slate-700 dark:text-slate-200">{user.progress.streak}</span>
                   <span className="text-slate-400 dark:text-slate-500 text-xs md:text-sm font-bold">Day Streak</span>
               </div>
               <div className="flex flex-col">
                   <span className="font-black text-lg md:text-xl text-slate-700 dark:text-slate-200">{user.progress.xp}</span>
                   <span className="text-slate-400 dark:text-slate-500 text-xs md:text-sm font-bold">Total XP</span>
               </div>
            </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
         <h2 className="font-bold text-lg md:text-xl text-slate-700 dark:text-slate-200">Statistics</h2>
         <div className="grid grid-cols-2 gap-3 md:gap-4">
             <div className="bg-white dark:bg-slate-900 p-3 md:p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-800 flex items-center gap-2 md:gap-3 transition-colors duration-300">
                 <Flame className="text-orange-500" size={20} />
                 <div>
                     <div className="font-black text-base md:text-lg text-slate-700 dark:text-slate-200">{user.progress.streak}</div>
                     <div className="text-[10px] md:text-xs font-bold text-slate-400 uppercase">Streak</div>
                 </div>
             </div>
             <div className="bg-white dark:bg-slate-900 p-3 md:p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-800 flex items-center gap-2 md:gap-3 transition-colors duration-300">
                 <Zap className="text-yellow-500" size={20} />
                 <div>
                     <div className="font-black text-base md:text-lg text-slate-700 dark:text-slate-200">{user.progress.xp}</div>
                     <div className="text-[10px] md:text-xs font-bold text-slate-400 uppercase">Total XP</div>
                 </div>
             </div>
             <div className="bg-white dark:bg-slate-900 p-3 md:p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-800 flex items-center gap-2 md:gap-3 transition-colors duration-300">
                 <Trophy className="text-yellow-600" size={20} />
                 <div>
                     <div className="font-black text-base md:text-lg text-slate-700 dark:text-slate-200">Emerald</div>
                     <div className="text-[10px] md:text-xs font-bold text-slate-400 uppercase">League</div>
                 </div>
             </div>
              <div className="bg-white dark:bg-slate-900 p-3 md:p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-800 flex items-center gap-2 md:gap-3 transition-colors duration-300">
                 <div className="w-5 h-5 md:w-6 md:h-6 flex items-center justify-center font-black text-blue-500 border-2 border-blue-500 rounded-md text-[10px] md:text-xs">
                     {user.progress.level}
                 </div>
                 <div>
                     <div className="font-black text-base md:text-lg text-slate-700 dark:text-slate-200">{user.progress.completedLessons.length}</div>
                     <div className="text-[10px] md:text-xs font-bold text-slate-400 uppercase">Lessons</div>
                 </div>
             </div>
         </div>

         <h2 className="font-bold text-lg md:text-xl text-slate-700 dark:text-slate-200 mt-6 md:mt-8">Settings</h2>
         <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-slate-200 dark:border-slate-800 overflow-hidden transition-colors duration-300">
             <div className="p-3 md:p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer" onClick={toggleTheme}>
                 <span className="font-bold text-slate-700 dark:text-slate-200 text-sm md:text-base">Theme</span>
                 <div className="flex items-center gap-2 font-bold text-blue-500 text-sm md:text-base">
                     {user.theme === 'dark' ? <Moon size={18}/> : <Sun size={18}/>}
                     <span className="capitalize">{user.theme || 'Light'}</span>
                 </div>
             </div>
             <div className="p-3 md:p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                 <span className="font-bold text-slate-700 dark:text-slate-200 text-sm md:text-base">Daily Goal</span>
                 <span className="font-bold text-blue-500 text-sm md:text-base">{user.dailyGoal} XP</span>
             </div>
             <div className="p-3 md:p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                 <span className="font-bold text-slate-700 dark:text-slate-200 text-sm md:text-base">Sound Effects</span>
                 <span className="font-bold text-blue-500 text-sm md:text-base">On</span>
             </div>
             <div className="p-3 md:p-4 flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-red-500">
                 <span className="font-bold text-sm md:text-base">Delete Account</span>
             </div>
         </div>

         <h2 className="font-bold text-lg md:text-xl text-slate-700 dark:text-slate-200 mt-6 md:mt-8">Creators</h2>
         <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-slate-200 dark:border-slate-800 p-4 md:p-6 transition-colors duration-300">
             <div className="flex items-center gap-2 mb-3 md:mb-4">
                <Heart className="text-red-500 fill-red-500" size={18} />
                <h3 className="font-black text-slate-700 dark:text-slate-200 text-sm md:text-base">Special Thanks</h3>
             </div>
             <p className="text-slate-400 dark:text-slate-500 font-bold mb-3 md:mb-4 text-xs md:text-sm">Made possible by these amazing people:</p>
             <div className="grid grid-cols-2 gap-3">
                {['Ivandro', 'Wendy', 'Cardoso', 'Neyton', 'Horacio'].map((name) => (
                    <div key={name} className="bg-green-50 dark:bg-green-900/20 border-2 border-green-100 dark:border-green-800 rounded-xl p-2 md:p-3 flex items-center justify-center hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors">
                        <span className="font-bold text-green-700 dark:text-green-400 text-sm md:text-base">{name}</span>
                    </div>
                ))}
             </div>
         </div>
      </div>
    </div>
  );
};