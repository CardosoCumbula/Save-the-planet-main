
import React from 'react';

export const TREE_TYPES = ['oak', 'pine', 'palm', 'apple', 'sakura', 'baobab'];

interface TreeProps {
  type: string;
  className?: string;
}

export const Tree: React.FC<TreeProps> = ({ type, className = "" }) => {
  const strokeColor = "#3f2e00";
  const strokeWidth = "2.5";

  const renderContent = () => {
    switch(type) {
        case 'pine':
            return (
                <g>
                    <rect x="44" y="70" width="12" height="20" fill="#5D4037" stroke={strokeColor} strokeWidth={strokeWidth} />
                    <path d="M20 75 L 50 20 L 80 75 Z" fill="#15803D" stroke={strokeColor} strokeWidth={strokeWidth} strokeLinejoin="round" />
                    <path d="M25 55 L 50 10 L 75 55 Z" fill="#16A34A" stroke={strokeColor} strokeWidth={strokeWidth} strokeLinejoin="round" />
                </g>
            );
        case 'palm':
            return (
                <g>
                    <path d="M45 90 Q 55 50 40 30 L 48 30 Q 65 50 55 90 Z" fill="#D97706" stroke={strokeColor} strokeWidth={strokeWidth} />
                    <path d="M44 32 Q 20 20 10 40" fill="none" stroke="#65A30D" strokeWidth="6" strokeLinecap="round" />
                    <path d="M44 32 Q 30 10 20 10" fill="none" stroke="#65A30D" strokeWidth="6" strokeLinecap="round" />
                    <path d="M46 32 Q 60 5 80 15" fill="none" stroke="#65A30D" strokeWidth="6" strokeLinecap="round" />
                    <path d="M46 32 Q 70 30 85 45" fill="none" stroke="#65A30D" strokeWidth="6" strokeLinecap="round" />
                </g>
            );
        case 'apple':
             return (
                 <g>
                     <rect x="42" y="60" width="16" height="30" fill="#78350F" stroke={strokeColor} strokeWidth={strokeWidth} />
                     <circle cx="50" cy="40" r="35" fill="#4ADE80" stroke={strokeColor} strokeWidth={strokeWidth} />
                     <circle cx="35" cy="30" r="4" fill="#EF4444" stroke={strokeColor} strokeWidth={1} />
                     <circle cx="65" cy="45" r="4" fill="#EF4444" stroke={strokeColor} strokeWidth={1} />
                     <circle cx="50" cy="20" r="4" fill="#EF4444" stroke={strokeColor} strokeWidth={1} />
                 </g>
             );
        case 'sakura':
             return (
                <g>
                     <path d="M50 90 Q 50 70 45 60 L 55 60 Q 50 70 50 90" fill="#5D4037" stroke={strokeColor} strokeWidth={strokeWidth} />
                     <circle cx="30" cy="40" r="20" fill="#FBCFE8" stroke={strokeColor} strokeWidth={strokeWidth} />
                     <circle cx="70" cy="45" r="18" fill="#FBCFE8" stroke={strokeColor} strokeWidth={strokeWidth} />
                     <circle cx="50" cy="30" r="22" fill="#F472B6" stroke={strokeColor} strokeWidth={strokeWidth} />
                     <circle cx="50" cy="50" r="18" fill="#FBCFE8" stroke={strokeColor} strokeWidth={strokeWidth} />
                </g>
             );
        case 'baobab':
            return (
                <g>
                     <path d="M35 90 Q 30 50 40 40 L 60 40 Q 70 50 65 90" fill="#78350F" stroke={strokeColor} strokeWidth={strokeWidth} />
                     <ellipse cx="50" cy="35" rx="40" ry="20" fill="#166534" stroke={strokeColor} strokeWidth={strokeWidth} />
                     <path d="M40 40 L 30 20" stroke="#78350F" strokeWidth="3" />
                     <path d="M60 40 L 70 20" stroke="#78350F" strokeWidth="3" />
                </g>
            );
        default: // Oak/Generic
            return (
                <g>
                    <rect x="42" y="60" width="16" height="30" fill="#78350F" stroke={strokeColor} strokeWidth={strokeWidth} />
                    <circle cx="30" cy="50" r="20" fill="#22C55E" stroke={strokeColor} strokeWidth={strokeWidth} />
                    <circle cx="70" cy="50" r="20" fill="#22C55E" stroke={strokeColor} strokeWidth={strokeWidth} />
                    <circle cx="50" cy="35" r="25" fill="#4ADE80" stroke={strokeColor} strokeWidth={strokeWidth} />
                </g>
            );
    }
  }

  return (
    <svg viewBox="0 0 100 100" className={`overflow-visible drop-shadow-sm ${className}`}>
        {renderContent()}
    </svg>
  );
}
