import React, { useEffect, useState } from 'react';

export type BossState = 'IDLE' | 'HIT' | 'ATTACK' | 'DEAD';

interface BossMonsterProps {
  type: 'plastic' | 'smog' | 'sludge';
  state: BossState;
  health: number;
  maxHealth: number;
  className?: string;
}

export const BossMonster: React.FC<BossMonsterProps> = ({ type, state, health, maxHealth, className = '' }) => {
  const [shake, setShake] = useState(false);
  const isEnraged = health <= maxHealth / 2;

  useEffect(() => {
    if (state === 'HIT') {
      setShake(true);
      const timer = setTimeout(() => setShake(false), 500);
      return () => clearTimeout(timer);
    }
  }, [state]);

  const getAnimationClass = () => {
    if (state === 'DEAD') return 'animate-ping opacity-0 duration-1000';
    if (state === 'ATTACK') return 'animate-bounce';
    if (shake) return 'animate-shake';
    if (isEnraged) return 'animate-pulse'; // Faster/more intense when enraged
    return 'animate-float'; // Idle float
  };

  const getMonsterColor = (defaultColor: string, enragedColor: string) => {
      return isEnraged ? enragedColor : defaultColor;
  };

  const renderMonster = () => {
    switch(type) {
      case 'plastic':
        return (
          <g>
            {/* Enraged Aura */}
            {isEnraged && <circle cx="50" cy="50" r="45" fill="red" opacity="0.2" className="animate-ping" />}
            
            {/* Plastic Golem Body */}
            <path d="M30 80 L 20 50 L 30 30 L 70 30 L 80 50 L 70 80 Z" fill={getMonsterColor("#0EA5E9", "#7C3AED")} stroke="#0369A1" strokeWidth="3" opacity="0.8" />
            <rect x="35" y="35" width="30" height="40" rx="5" fill={getMonsterColor("#BAE6FD", "#C4B5FD")} stroke="#0369A1" strokeWidth="2" />
            {/* Eyes */}
            <circle cx="40" cy="45" r="5" fill={isEnraged ? "#EF4444" : "#BEF264"} />
            <circle cx="60" cy="45" r="5" fill={isEnraged ? "#EF4444" : "#BEF264"} />
            {/* Mouth */}
            <path d={isEnraged ? "M40 68 L 50 60 L 60 68" : "M40 65 L 60 65"} stroke="#0369A1" strokeWidth="3" fill="none" />
            {/* Trash Details */}
            <circle cx="25" cy="40" r="4" fill="#EF4444" opacity="0.7" />
            <rect x="70" y="60" width="8" height="12" fill="#F59E0B" transform="rotate(20)" />
          </g>
        );
      case 'smog':
        return (
          <g>
            {isEnraged && <circle cx="50" cy="50" r="45" fill="#B91C1C" opacity="0.2" className="animate-ping" />}
            {/* Smog Cloud Body */}
            <path d="M20 60 Q 10 40 30 30 Q 50 10 70 30 Q 90 40 80 60 Q 70 80 50 80 Q 30 80 20 60 Z" fill={getMonsterColor("#64748B", "#475569")} stroke="#334155" strokeWidth="3" />
            {/* Eyes */}
            <path d="M35 45 L 45 50 L 35 55" fill={isEnraged ? "#FCA5A5" : "#EF4444"} />
            <path d="M65 45 L 55 50 L 65 55" fill={isEnraged ? "#FCA5A5" : "#EF4444"} />
            {/* Gas Particles */}
            <circle cx="20" cy="30" r="3" fill="#94A3B8" className="animate-pulse" />
            <circle cx="80" cy="70" r="4" fill="#94A3B8" className="animate-pulse" />
          </g>
        );
      default: // Sludge
        return (
          <g>
            {isEnraged && <circle cx="50" cy="50" r="45" fill="#3F6212" opacity="0.3" className="animate-ping" />}
            {/* Sludge Blob */}
            <path d="M20 80 Q 20 40 50 30 Q 80 40 80 80 Z" fill={getMonsterColor("#65A30D", "#365314")} stroke="#365314" strokeWidth="3" />
            <path d="M20 80 L 80 80" stroke="#365314" strokeWidth="3" />
            {/* Melting Eye */}
            <circle cx="40" cy="50" r="8" fill="white" stroke="#365314" strokeWidth="2" />
            <circle cx="40" cy="50" r={isEnraged ? 2 : 3} fill={isEnraged ? "red" : "black"} />
            {/* Other Eye */}
            <circle cx="65" cy="55" r="6" fill="white" stroke="#365314" strokeWidth="2" />
            <circle cx="65" cy="55" r={isEnraged ? 1 : 2} fill={isEnraged ? "red" : "black"} />
            {/* Dripping mouth */}
            <path d={isEnraged ? "M40 75 Q 50 60 60 75" : "M40 70 Q 50 65 60 70"} fill="none" stroke="#365314" strokeWidth="3" />
          </g>
        );
    }
  };

  const hpPercent = (health / maxHealth) * 100;

  return (
    <div className={`relative flex flex-col items-center justify-center ${className}`}>
      {/* HP Bar */}
      <div className={`absolute -top-4 w-full h-3 bg-slate-700 rounded-full border-2 border-slate-800 overflow-hidden shadow-lg ${isEnraged ? 'animate-shake' : ''}`}>
        <div 
          className={`h-full transition-all duration-300 ${isEnraged ? 'bg-orange-500' : 'bg-red-500'}`}
          style={{ width: `${hpPercent}%` }}
        ></div>
      </div>
      
      {/* Monster SVG */}
      <svg viewBox="0 0 100 100" className={`w-full h-full drop-shadow-2xl overflow-visible ${getAnimationClass()}`}>
        {renderMonster()}
        {state === 'HIT' && (
           <text x="50" y="50" textAnchor="middle" fill="white" fontSize="40" fontWeight="black" stroke="black" strokeWidth="2" className="animate-pop">-1</text>
        )}
      </svg>
    </div>
  );
};