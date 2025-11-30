
import React from 'react';

export const AVATAR_IDS = ['bear', 'fox', 'girl', 'boy', 'grandma', 'robot', 'ninja', 'alien'];

interface AvatarProps {
  id: string;
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({ id, className = "w-full h-full" }) => {
  const strokeColor = "#431407"; 
  const strokeWidth = "3.5";

  const renderContent = () => {
    switch(id) {
        case 'bear':
            return (
                <g>
                    <circle cx="50" cy="50" r="48" fill="#C4B5FD" stroke={strokeColor} strokeWidth={strokeWidth} />
                    <circle cx="25" cy="30" r="14" fill="#7C3AED" stroke={strokeColor} strokeWidth={strokeWidth} />
                    <circle cx="75" cy="30" r="14" fill="#7C3AED" stroke={strokeColor} strokeWidth={strokeWidth} />
                    <circle cx="50" cy="55" r="32" fill="#8B5CF6" stroke={strokeColor} strokeWidth={strokeWidth} />
                    <ellipse cx="50" cy="62" rx="14" ry="11" fill="#DDD6FE" />
                    <circle cx="50" cy="58" r="4" fill={strokeColor} />
                    <circle cx="38" cy="48" r="4" fill={strokeColor} />
                    <circle cx="62" cy="48" r="4" fill={strokeColor} />
                </g>
            );
        case 'fox':
            return (
                <g>
                    <circle cx="50" cy="50" r="48" fill="#FED7AA" stroke={strokeColor} strokeWidth={strokeWidth} />
                    <path d="M20 30 L35 60 L10 50 Z" fill="#EA580C" stroke={strokeColor} strokeWidth={strokeWidth} />
                    <path d="M80 30 L65 60 L90 50 Z" fill="#EA580C" stroke={strokeColor} strokeWidth={strokeWidth} />
                    <circle cx="50" cy="55" r="32" fill="#F97316" stroke={strokeColor} strokeWidth={strokeWidth} />
                    <path d="M50 87 L35 60 L65 60 Z" fill="white" />
                    <circle cx="38" cy="50" r="4" fill={strokeColor} />
                    <circle cx="62" cy="50" r="4" fill={strokeColor} />
                    <circle cx="50" cy="60" r="3" fill={strokeColor} />
                </g>
            );
        case 'girl':
             return (
                <g>
                    <circle cx="50" cy="50" r="48" fill="#FBCFE8" stroke={strokeColor} strokeWidth={strokeWidth} />
                    <path d="M20 40 Q 50 10 80 40" stroke="#DB2777" strokeWidth="25" strokeLinecap="round" fill="none"/>
                    <circle cx="50" cy="55" r="28" fill="#FDE047" stroke={strokeColor} strokeWidth={strokeWidth} />
                    <path d="M25 40 Q 50 25 75 40" fill="#DB2777" stroke={strokeColor} strokeWidth={strokeWidth} />
                    <circle cx="40" cy="55" r="4" fill={strokeColor} />
                    <circle cx="60" cy="55" r="4" fill={strokeColor} />
                    <path d="M45 68 Q 50 72 55 68" fill="none" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" />
                </g>
            );
        case 'boy':
            return (
                <g>
                    <circle cx="50" cy="50" r="48" fill="#BAE6FD" stroke={strokeColor} strokeWidth={strokeWidth} />
                    <circle cx="50" cy="58" r="28" fill="#FDBA74" stroke={strokeColor} strokeWidth={strokeWidth} />
                    <path d="M20 45 Q 50 10 80 45" fill="#0284C7" stroke={strokeColor} strokeWidth={strokeWidth} />
                    <rect x="20" y="42" width="60" height="10" rx="4" fill="#0369A1" stroke={strokeColor} strokeWidth={strokeWidth} />
                    <circle cx="40" cy="60" r="4" fill={strokeColor} />
                    <circle cx="60" cy="60" r="4" fill={strokeColor} />
                    <path d="M45 72 Q 50 75 55 72" fill="none" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" />
                </g>
            );
        case 'grandma':
            return (
                <g>
                     <circle cx="50" cy="50" r="48" fill="#E5E7EB" stroke={strokeColor} strokeWidth={strokeWidth} />
                     <circle cx="50" cy="25" r="12" fill="#9CA3AF" stroke={strokeColor} strokeWidth={strokeWidth} />
                     <circle cx="50" cy="55" r="30" fill="#FFEDD5" stroke={strokeColor} strokeWidth={strokeWidth} />
                     <path d="M25 50 Q 50 30 75 50" fill="#9CA3AF" stroke={strokeColor} strokeWidth={strokeWidth} />
                     <circle cx="40" cy="55" r="8" fill="#BFDBFE" stroke={strokeColor} strokeWidth="2" opacity="0.8"/>
                     <circle cx="60" cy="55" r="8" fill="#BFDBFE" stroke={strokeColor} strokeWidth="2" opacity="0.8"/>
                     <line x1="48" y1="55" x2="52" y2="55" stroke={strokeColor} strokeWidth="2" />
                     <path d="M46 72 Q 50 75 54 72" fill="none" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" />
                </g>
            );
         case 'robot':
            return (
                <g>
                    <circle cx="50" cy="50" r="48" fill="#E2E8F0" stroke={strokeColor} strokeWidth={strokeWidth} />
                    <line x1="50" y1="20" x2="50" y2="35" stroke={strokeColor} strokeWidth="3" />
                    <circle cx="50" cy="18" r="5" fill="#EF4444" stroke={strokeColor} strokeWidth={strokeWidth} />
                    <rect x="25" y="35" width="50" height="45" rx="8" fill="#94A3B8" stroke={strokeColor} strokeWidth={strokeWidth} />
                    <rect x="32" y="45" width="36" height="14" rx="4" fill="#0F172A" />
                    <circle cx="42" cy="52" r="3" fill="#22C55E" />
                    <circle cx="58" cy="52" r="3" fill="#22C55E" />
                    <line x1="40" y1="70" x2="60" y2="70" stroke={strokeColor} strokeWidth="3" />
                </g>
            );
        case 'ninja':
            return (
                <g>
                    <circle cx="50" cy="50" r="48" fill="#FECACA" stroke={strokeColor} strokeWidth={strokeWidth} />
                    <circle cx="50" cy="55" r="30" fill="#1F2937" stroke={strokeColor} strokeWidth={strokeWidth} />
                    <path d="M30 50 Q 50 45 70 50 L 70 60 Q 50 65 30 60 Z" fill="#FCA5A5" />
                    <circle cx="42" cy="55" r="3" fill={strokeColor} />
                    <circle cx="58" cy="55" r="3" fill={strokeColor} />
                    <path d="M75 50 L 85 45 L 85 55 Z" fill="#EF4444" stroke={strokeColor} strokeWidth={strokeWidth} />
                    <path d="M22 55 Q 50 50 78 55" fill="none" stroke="#EF4444" strokeWidth="4" strokeLinecap="round" />
                </g>
            );
        case 'alien':
            return (
                <g>
                    <circle cx="50" cy="50" r="48" fill="#1E293B" stroke={strokeColor} strokeWidth={strokeWidth} />
                    <path d="M30 40 Q 50 20 70 40 L 70 70 Q 50 85 30 70 Z" fill="#84CC16" stroke={strokeColor} strokeWidth={strokeWidth} />
                    <circle cx="35" cy="50" r="6" fill="white" stroke={strokeColor} strokeWidth="2"/>
                    <circle cx="35" cy="50" r="2" fill="black" />
                    <circle cx="50" cy="45" r="8" fill="white" stroke={strokeColor} strokeWidth="2"/>
                    <circle cx="50" cy="45" r="3" fill="black" />
                    <circle cx="65" cy="50" r="6" fill="white" stroke={strokeColor} strokeWidth="2"/>
                    <circle cx="65" cy="50" r="2" fill="black" />
                    <path d="M45 70 Q 50 72 55 70" fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" />
                </g>
            );
        default:
             return (
                 <g>
                     <circle cx="50" cy="50" r="48" fill="#E5E7EB" stroke={strokeColor} strokeWidth={strokeWidth} />
                     <circle cx="35" cy="45" r="5" fill={strokeColor} />
                     <circle cx="65" cy="45" r="5" fill={strokeColor} />
                     <path d="M30 65 Q 50 80 70 65" fill="none" stroke={strokeColor} strokeWidth={3} strokeLinecap="round" />
                 </g>
             )
    }
  }

  return (
    <svg viewBox="0 0 100 100" className={className}>
        {renderContent()}
    </svg>
  );
}
