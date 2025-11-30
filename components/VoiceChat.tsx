
import React, { useEffect, useRef, useState } from 'react';
import { X, Mic, MicOff, Volume2 } from 'lucide-react';
import { LiveClient } from '../services/geminiService';
import { Mascot } from './Mascot';
import { MascotMood } from '../types';

interface VoiceChatProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VoiceChat: React.FC<VoiceChatProps> = ({ isOpen, onClose }) => {
  const [isListening, setIsListening] = useState(false);
  const [isEcoSpeaking, setIsEcoSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientRef = useRef<LiveClient | null>(null);

  useEffect(() => {
    if (isOpen) {
      startSession();
    } else {
      stopSession();
    }
    return () => stopSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const startSession = async () => {
    setError(null);
    setIsListening(true);
    clientRef.current = new LiveClient(
      (playing) => setIsEcoSpeaking(playing),
      (err) => {
        console.error(err);
        setError("Connection error. Please try again.");
        setIsListening(false);
      }
    );
    await clientRef.current.connect();
  };

  const stopSession = () => {
    if (clientRef.current) {
      clientRef.current.disconnect();
      clientRef.current = null;
    }
    setIsListening(false);
    setIsEcoSpeaking(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md p-6 relative overflow-hidden transition-colors duration-300">
        {/* Background blobs */}
        <div className="absolute top-0 left-0 w-32 h-32 bg-green-200 dark:bg-green-900 rounded-full blur-3xl opacity-50 -translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 right-0 w-32 h-32 bg-blue-200 dark:bg-blue-900 rounded-full blur-3xl opacity-50 translate-x-1/2 translate-y-1/2"></div>

        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
        >
          <X size={24} />
        </button>

        <div className="flex flex-col items-center justify-center space-y-8 mt-4">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Chat with Eco</h2>
            <p className="text-slate-500 dark:text-slate-400">Ask me anything about nature!</p>
          </div>

          <div className="relative">
             {/* Ripple effect when Eco speaks */}
             {isEcoSpeaking && (
                <div className="absolute inset-0 rounded-full animate-ping bg-green-200 dark:bg-green-800 opacity-75"></div>
             )}
            <Mascot 
              mood={isEcoSpeaking ? MascotMood.TALKING : MascotMood.HAPPY} 
              className="w-48 h-48 relative z-10"
            />
          </div>

          <div className="w-full flex justify-center pb-4">
            {error ? (
              <div className="text-red-500 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/20 px-4 py-2 rounded-full">
                {error}
              </div>
            ) : (
              <div className={`
                flex items-center gap-2 px-6 py-3 rounded-full font-semibold transition-all duration-300
                ${isListening 
                  ? 'bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 animate-pulse border border-red-200 dark:border-red-800' 
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'}
              `}>
                {isEcoSpeaking ? (
                  <>
                    <Volume2 size={20} />
                    <span>Eco is speaking...</span>
                  </>
                ) : (
                  <>
                    {isListening ? <Mic size={20} /> : <MicOff size={20} />}
                    <span>{isListening ? "Listening..." : "Paused"}</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};