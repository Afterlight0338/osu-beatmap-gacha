import React from 'react';
import { useGacha } from '../context/GachaContext';
import { useAuth } from '../context/AuthContext';
import { isAdmin } from '../config/admin';
import { sfx } from '../audio/sfx';
import {
  Sparkles,
  Layers,
  BarChart3,
  History,
  ShieldAlert,
  Info,
  Trophy,
} from 'lucide-react';

interface MobileBottomNavProps {
  activeTab: 'gacha' | 'collection' | 'leaderboard' | 'stats' | 'changelog' | 'about' | 'admin';
  setActiveTab: (tab: 'gacha' | 'collection' | 'leaderboard' | 'stats' | 'changelog' | 'about' | 'admin') => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  setActiveTab,
}) => {
  const { stats } = useGacha();
  const { user } = useAuth();
  const showAdmin = isAdmin(user?.username);

  const handleTabClick = (tab: 'gacha' | 'collection' | 'leaderboard' | 'stats' | 'changelog' | 'about' | 'admin') => {
    sfx.playClick();
    setActiveTab(tab);
  };

  return (
    <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 px-3 py-2 bg-[#0a0a10]/95 backdrop-blur-2xl border-t border-slate-800/90 pb-safe">
      <nav className="flex items-center justify-around">
        {/* Summon / Gacha */}
        <button
          onClick={() => handleTabClick('gacha')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all ${
            activeTab === 'gacha'
              ? 'text-pink-400 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div
            className={`p-1.5 rounded-xl transition-all ${
              activeTab === 'gacha'
                ? 'bg-gradient-to-tr from-pink-600 to-purple-600 text-white shadow-lg shadow-pink-600/40 scale-110'
                : 'bg-transparent'
            }`}
          >
            <Sparkles className="w-5 h-5" />
          </div>
          <span className="text-[10px] tracking-tight mt-0.5">Summon</span>
        </button>

        {/* Collection */}
        <button
          onClick={() => handleTabClick('collection')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all relative ${
            activeTab === 'collection'
              ? 'text-purple-400 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div
            className={`p-1.5 rounded-xl transition-all ${
              activeTab === 'collection'
                ? 'bg-gradient-to-tr from-pink-600 to-purple-600 text-white shadow-lg shadow-purple-600/40 scale-110'
                : 'bg-transparent'
            }`}
          >
            <Layers className="w-5 h-5" />
          </div>
          <span className="text-[10px] tracking-tight mt-0.5">Collection</span>
          {stats.uniqueOwned > 0 && (
            <span className="absolute top-0 right-1.5 text-[9px] font-mono font-bold px-1 rounded-full bg-pink-600 text-white">
              {stats.uniqueOwned > 999 ? '999+' : stats.uniqueOwned}
            </span>
          )}
        </button>

        {/* Leaderboard */}
        <button
          onClick={() => handleTabClick('leaderboard')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all ${
            activeTab === 'leaderboard'
              ? 'text-amber-400 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div
            className={`p-1.5 rounded-xl transition-all ${
              activeTab === 'leaderboard'
                ? 'bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 shadow-lg shadow-amber-500/40 scale-110'
                : 'bg-transparent'
            }`}
          >
            <Trophy className="w-5 h-5" />
          </div>
          <span className="text-[10px] tracking-tight mt-0.5">Rank</span>
        </button>

        {/* Stats */}
        <button
          onClick={() => handleTabClick('stats')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all ${
            activeTab === 'stats'
              ? 'text-cyan-400 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div
            className={`p-1.5 rounded-xl transition-all ${
              activeTab === 'stats'
                ? 'bg-gradient-to-tr from-pink-600 to-purple-600 text-white shadow-lg shadow-cyan-600/40 scale-110'
                : 'bg-transparent'
            }`}
          >
            <BarChart3 className="w-5 h-5" />
          </div>
          <span className="text-[10px] tracking-tight mt-0.5">Stats</span>
        </button>

        {/* Changelog */}
        <button
          onClick={() => handleTabClick('changelog')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all ${
            activeTab === 'changelog'
              ? 'text-amber-400 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div
            className={`p-1.5 rounded-xl transition-all ${
              activeTab === 'changelog'
                ? 'bg-gradient-to-tr from-pink-600 to-purple-600 text-white shadow-lg shadow-amber-600/40 scale-110'
                : 'bg-transparent'
            }`}
          >
            <History className="w-5 h-5" />
          </div>
          <span className="text-[10px] tracking-tight mt-0.5">Logs</span>
        </button>

        {/* About / Disclaimers */}
        <button
          onClick={() => handleTabClick('about')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all ${
            activeTab === 'about'
              ? 'text-pink-400 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div
            className={`p-1.5 rounded-xl transition-all ${
              activeTab === 'about'
                ? 'bg-gradient-to-tr from-pink-600 to-purple-600 text-white shadow-lg shadow-pink-600/40 scale-110'
                : 'bg-transparent'
            }`}
          >
            <Info className="w-5 h-5" />
          </div>
          <span className="text-[10px] tracking-tight mt-0.5">About</span>
        </button>

        {/* Admin (Only for RyoYamada) */}
        {showAdmin && (
          <button
            onClick={() => handleTabClick('admin')}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all ${
              activeTab === 'admin'
                ? 'text-red-400 font-bold'
                : 'text-red-400/70 hover:text-red-300'
            }`}
          >
            <div
              className={`p-1.5 rounded-xl transition-all ${
                activeTab === 'admin'
                  ? 'bg-gradient-to-tr from-red-700 to-red-600 text-white shadow-lg shadow-red-600/40 scale-110'
                  : 'bg-transparent'
              }`}
            >
              <ShieldAlert className="w-5 h-5 text-red-400" />
            </div>
            <span className="text-[10px] tracking-tight mt-0.5">Admin</span>
          </button>
        )}
      </nav>
    </div>
  );
};
