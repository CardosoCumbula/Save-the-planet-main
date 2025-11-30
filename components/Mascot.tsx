

import React from 'react';
import { MascotMood } from '../types';

interface MascotProps {
  mood: MascotMood;
  onClick?: () => void;
  className?: string;
}

export const Mascot: React.FC<MascotProps> = ({ mood, onClick, className = '' }) => {
  
  // Dynamic Eye Rendering - Simplified 2D Style
  const renderEyes = () => {
    switch (mood) {
      case MascotMood.HAPPY:
      case MascotMood.EXCITED:
         // Happy closed eyes (inverted arcs)
         return (
            <g fill="none" stroke="#431407" strokeWidth="4" strokeLinecap="round">
                <path d="M33 43 Q 40 36 47 43" />
                <path d="M53 43 Q 60 36 67 43" />
            </g>
         );
      case MascotMood.SAD:
         // Sad eyes
         return (
             <g>
                <circle cx="40" cy="45" r="4" fill="#431407" />
                <circle cx="60" cy="45" r="4" fill="#431407" />
                <path d="M32 38 Q 40 42 48 38" stroke="#431407" strokeWidth="2.5" fill="none" opacity="0.5"/>
                <path d="M52 38 Q 60 42 68 38" stroke="#431407" strokeWidth="2.5" fill="none" opacity="0.5"/>
             </g>
         );
      case MascotMood.THINKING:
         // One eye slightly smaller/squinting
         return (
            <g className="animate-blink origin-center">
              <circle cx="40" cy="45" r="6" fill="#431407" />
              <circle cx="38" cy="43" r="2" fill="white" />
              
              <circle cx="60" cy="45" r="5" fill="#431407" />
              <path d="M54 36 L 66 38" stroke="#431407" strokeWidth="3" strokeLinecap="round" />
            </g>
         );
      case MascotMood.BATTLE:
         // Determined/Angry eyes
         return (
            <g>
               <path d="M28 35 L 45 42" stroke="#431407" strokeWidth="4" strokeLinecap="round" />
               <path d="M72 35 L 55 42" stroke="#431407" strokeWidth="4" strokeLinecap="round" />
               <circle cx="40" cy="48" r="5" fill="#431407" />
               <circle cx="60" cy="48" r="5" fill="#431407" />
            </g>
         );
      case MascotMood.TALKING:
      case MascotMood.IDLE:
      default:
        // Standard wide eyes
        return (
          <g className="animate-blink origin-center">
            {/* Left Eye */}
            <circle cx="40" cy="45" r="6" fill="#431407" />
            <circle cx="37" cy="42" r="2.5" fill="white" />
            
            {/* Right Eye */}
            <circle cx="60" cy="45" r="6" fill="#431407" />
            <circle cx="57" cy="42" r="2.5" fill="white" />
          </g>
        );
    }
  };

  const renderMouth = () => {
      switch (mood) {
          case MascotMood.HAPPY:
             return <path d="M42 60 Q 50 66 58 60" fill="none" stroke="#431407" strokeWidth="3" strokeLinecap="round" />;
          case MascotMood.TALKING:
             return (
                 <path d="M44 60 Q 50 70 56 60 Z" fill="#EF4444" stroke="#431407" strokeWidth="2" strokeLinejoin="round">
                     <animate attributeName="d" values="M44 60 Q 50 70 56 60 Z; M44 60 Q 50 62 56 60 Z; M44 60 Q 50 70 56 60 Z" dur="0.25s" repeatCount="indefinite"/>
                 </path>
             );
          case MascotMood.EXCITED:
             return <path d="M40 58 Q 50 75 60 58 Z" fill="#EF4444" stroke="#431407" strokeWidth="2" strokeLinejoin="round" />;
          case MascotMood.SAD:
              return <path d="M42 64 Q 50 58 58 64" fill="none" stroke="#431407" strokeWidth="3" strokeLinecap="round" />;
          case MascotMood.BATTLE:
             // Gritted teeth / flat line
             return <path d="M42 64 L 58 64" stroke="#431407" strokeWidth="4" strokeLinecap="round" />;
          default:
             // Small cute mouth
             return <path d="M46 60 Q 50 62 54 60" fill="none" stroke="#431407" strokeWidth="3" strokeLinecap="round" />;
      }
  };

  const getAnimationClass = () => {
     switch(mood) {
         case MascotMood.EXCITED: return "animate-bounce";
         case MascotMood.TALKING: return "";
         case MascotMood.IDLE: return "animate-breathe";
         case MascotMood.THINKING: return "animate-float";
         case MascotMood.BATTLE: return "animate-pulse";
         default: return "";
     }
  };

  return (
    <div className={`relative select-none ${getAnimationClass()} ${className}`} onClick={onClick}>
        <style>
        {`
          @keyframes blink {
            0%, 96%, 100% { transform: scaleY(1); }
            98% { transform: scaleY(0.1); }
          }
          .animate-blink {
            transform-origin: center 45px;
            animation: blink 4s infinite;
          }
          @keyframes breathe {
            0%, 100% { transform: scale(1) translateY(0); }
            50% { transform: scale(1.03) translateY(-2px); }
          }
          .animate-breathe {
            animation: breathe 4s ease-in-out infinite;
          }
        `}
      </style>
      <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-md overflow-visible">
         
         {/* -- FLAT DESIGN: Solid Colors & Thick Strokes -- */}
         
         {/* Ears (Back) */}
         <path d="M12 28 C 0 10, 25 5, 32 30" fill="#C2410C" stroke="#431407" strokeWidth="3" strokeLinejoin="round"/>
         <path d="M88 28 C 100 10, 75 5, 68 30" fill="#C2410C" stroke="#431407" strokeWidth="3" strokeLinejoin="round"/>

         {/* Head Shape (Squircle) */}
         <rect x="18" y="18" width="64" height="60" rx="24" fill="#FB923C" stroke="#431407" strokeWidth="3" />
         
         {/* Simple Shadow Accent (Bottom Right) - Hard Edge */}
         <path d="M 28 78 Q 50 85 72 78 L 72 70 Q 50 78 28 70 Z" fill="#EA580C" opacity="0.3" />

         {/* -- FACE FEATURES -- */}

         {/* Snout Patch */}
         <ellipse cx="50" cy="58" rx="22" ry="17" fill="#FFEDD5" stroke="none" />
         
         {/* Nose */}
         <path d="M44 50 Q 50 48 56 50 Q 50 58 44 50" fill="#431407" />
         
         {/* Eyes & Mouth */}
         {renderEyes()}
         {renderMouth()}
         
         {/* Cheeks (Simple Circles) */}
         {(mood === MascotMood.HAPPY || mood === MascotMood.EXCITED) && (
             <>
                <circle cx="25" cy="55" r="5" fill="#FCA5A5" opacity="0.8"/>
                <circle cx="75" cy="55" r="5" fill="#FCA5A5" opacity="0.8"/>
             </>
         )}

         {/* Collar */}
         <path d="M22 75 Q 50 88 78 75" stroke="#EF4444" strokeWidth="6" strokeLinecap="round" fill="none" />
         
         {/* Medal/Tag */}
         <g transform="translate(50, 84)">
            <circle r="7" fill="#FBBF24" stroke="#431407" strokeWidth="2" />
            <text x="0" y="2" textAnchor="middle" fontSize="8" fill="#431407" fontWeight="bold">E</text>
         </g>

      </svg>
      
       {mood === MascotMood.THINKING && (
        <div className="absolute -top-6 -right-6 bg-white px-4 py-2 rounded-2xl shadow-xl text-sm font-black animate-bounce text-slate-700 border-2 border-slate-100 z-10">
          Hmm...
           <div className="absolute bottom-[-6px] left-4 w-3 h-3 bg-white border-b-2 border-r-2 border-slate-100 rotate-45"></div>
        </div>
      )}
    </div>
  );
};