import React, { useEffect, useState } from 'react';
import { BrainCircuit, Sparkles, Trophy, ListChecks, Info, WifiOff } from 'lucide-react';
import { AiInsights as AiInsightsType, User } from '../types';
import {
  checkAiEngineAvailability,
  getInsights,
  isAiEngineAvailable,
} from '../services/aiEngineService';

interface AiInsightsProps {
  user: User;
}

// Shows the Python ML layer's view of a learner inside the Profile view.
export const AiInsights: React.FC<AiInsightsProps> = ({ user }) => {
  const [insights, setInsights] = useState<AiInsightsType | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      await checkAiEngineAvailability();
      if (!active) return;
      if (!isAiEngineAvailable()) {
        setUnavailable(true);
        return;
      }
      const data = await getInsights(user.id);
      if (!active) return;
      if (data) setInsights(data);
      else setUnavailable(true);
    })();
    return () => { active = false; };
  }, [user.id]);

  const masteryEntries = insights ? Object.entries(insights.per_topic_mastery)
    .sort((a, b) => Number(b[1]) - Number(a[1])) : [];

  return (
    <div className="mt-6 md:mt-8">
      <h2 className="font-bold text-lg md:text-xl text-slate-700 dark:text-slate-200 flex items-center gap-2">
        <BrainCircuit className="text-blue-500" size={20} /> AI Insights
      </h2>

      {unavailable && (
        <div className="mt-3 bg-white dark:bg-slate-900 rounded-2xl border-2 border-slate-200 dark:border-slate-800 p-4 flex items-center gap-3">
          <WifiOff className="text-slate-400" size={18} />
          <span className="text-slate-500 dark:text-slate-400 font-bold text-sm">AI service unavailable</span>
        </div>
      )}

      {insights && (
        <div className="mt-3 space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-slate-200 dark:border-slate-800 p-4 transition-colors">
            <div className="flex items-center gap-2 mb-2 font-black text-slate-700 dark:text-slate-200 text-sm uppercase tracking-wide">
              <ListChecks size={16} className="text-green-500" /> Topic mastery
            </div>
            <div className="space-y-2">
              {masteryEntries.length === 0 && <p className="text-slate-400 font-bold text-sm">Complete a lesson to see mastery.</p>}
              {masteryEntries.slice(0, 5).map(([topic, acc]) => (
                <div key={topic} className="flex items-center gap-2">
                  <span className="w-40 shrink-0 text-slate-600 dark:text-slate-300 text-sm font-bold truncate">{topic}</span>
                  <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full" style={{ width: `${Math.round(Number(acc) * 100)}%` }} />
                  </div>
                  <span className="w-10 text-right text-slate-500 dark:text-slate-400 text-sm font-bold">{Math.round(Number(acc) * 100)}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-slate-200 dark:border-slate-800 p-4">
            <div className="flex items-center gap-2 mb-1 font-black text-slate-700 dark:text-slate-200 text-sm uppercase tracking-wide">
              <Sparkles size={16} className="text-blue-500" /> Next difficulty
            </div>
            <p className="font-black text-blue-600 dark:text-blue-400 text-xl">{insights.predicted_next_difficulty}</p>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mt-1 leading-tight">{insights.reason}</p>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-slate-200 dark:border-slate-800 p-4">
            <div className="flex items-center gap-2 mb-2 font-black text-slate-700 dark:text-slate-200 text-sm uppercase tracking-wide">
              <Trophy size={16} className="text-yellow-500" /> Recommended topics
            </div>
            <ol className="space-y-1">
              {insights.recommended_topics.map((item, i) => (
                <li key={item.topic} className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-300 text-sm font-bold">{i + 1}. {item.topic}</span>
                  <span className="text-slate-500 dark:text-slate-400 text-xs font-bold">{item.score.toFixed(2)}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-slate-200 dark:border-slate-800 p-4">
            <div className="flex items-center gap-2 mb-2 font-black text-slate-700 dark:text-slate-200 text-sm uppercase tracking-wide">
              <Info size={16} className="text-slate-500" /> Model information
            </div>
            <ul className="text-sm text-slate-600 dark:text-slate-300 font-medium space-y-0.5">
              <li>Mastery: {insights.model_information.mastery}</li>
              <li>Answer Grader: {insights.model_information.grader}</li>
              <li>Recommendation: {insights.model_information.recommender}</li>
            </ul>
            <p className="mt-3 text-xs text-slate-400 font-medium">
              These models are trained on simulated learner data and will be
              retrained as real interaction logs accumulate.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};