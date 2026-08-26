import React from 'react';
import { useGacha } from '../context/GachaContext';
import { useAuth } from '../context/AuthContext';
import { isAdmin } from '../config/admin';
import { sfx } from '../audio/sfx';
import { UserAuthButton } from './UserAuthButton';
import {
  Sparkles,
  Layers,
  BarChart3,
  Sliders,
  History,
  Volume2,
  VolumeX,
  Disc,
  Zap,
  ShieldAlert,
  Info,
  Trophy,
} from 'lucide-react';

interface NavbarProps {
  activeTab: 'gacha' | 'collection' | 'leaderboard' | 'stats' | 'changelog' | 'about' | 'admin';
  setActiveTab: (tab: 'gacha' | 'collection' | 'leaderboard' | 'stats' | 'changelog' | 'about' | 'admin') => void;
  onOpenSettings: () => void;
  onOpenHistory: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenSettings,
  onOpenHistory,
}) => {
  const { stats, settings, updateSettings, pool, energy, forceCloudSync } = useGacha();
  const { user } = useAuth();
  const showAdmin = isAdmin(user?.username);

  const handleTabClick = (tab: 'gacha' | 'collection' | 'leaderboard' | 'stats' | 'changelog' | 'about' | 'admin') => {
    sfx.playClick();
    setActiveTab(tab);
  };

  const handleMuteToggle = () => {
    sfx.playClick();
    updateSettings({ soundEnabled: !settings.soundEnabled });
  };

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-[#0d0d15]/90 border-b border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <div
          onClick={() => handleTabClick('gacha')}
          className="flex items-center space-x-3 cursor-pointer group select-none flex-shrink-0"
        >
          <div className="relative flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-tr from-pink-600 to-pink-400 border-2 border-pink-300 shadow-md shadow-pink-500/30 group-hover:scale-105 transition-transform flex-shrink-0">
            <Disc className="w-5 h-5 text-white animate-spin-slow" />
            <Sparkles className="w-3.5 h-3.5 text-white absolute -top-0.5 -right-0.5 animate-pulse" />
          </div>

          <div>
            <span className="font-display font-black text-lg sm:text-xl tracking-tight text-white group-hover:text-pink-400 transition-colors">
              osu!<span className="text-pink-500 font-sans">gacha</span>
            </span>
            <div className="hidden sm:flex items-center space-x-1.5 text-[10px] font-mono text-slate-400">
              <span>Beatmap Collection</span>
              <span>•</span>
              <span className="text-emerald-400 font-bold">{pool.length.toLocaleString()} Maps</span>
            </div>
          </div>
        </div>

        {/* Center Tabs (Desktop) */}
        <nav className="hidden md:flex items-center space-x-1 sm:space-x-1.5 bg-slate-900/90 p-1 rounded-xl border border-slate-800 flex-shrink-0">
          <button
            onClick={() => handleTabClick('gacha')}
            className={`flex items-center space-x-1.5 px-2.5 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all select-none ${
              activeTab === 'gacha'
                ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-md shadow-pink-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-pink-400" />
            <span>Summon</span>
          </button>

          <button
            onClick={() => handleTabClick('collection')}
            className={`flex items-center space-x-1.5 px-2.5 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all select-none relative ${
              activeTab === 'collection'
                ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-md shadow-pink-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-400" />
            <span>Collection</span>
            {stats.uniqueOwned > 0 && (
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-slate-800 text-pink-300">
                {stats.uniqueOwned}
              </span>
            )}
          </button>

          <button
            onClick={() => handleTabClick('leaderboard')}
            className={`flex items-center space-x-1.5 px-2.5 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all select-none ${
              activeTab === 'leaderboard'
                ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-md shadow-pink-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
            <span>Leaderboard</span>
          </button>

          <button
            onClick={() => handleTabClick('stats')}
            className={`flex items-center space-x-1.5 px-2.5 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all select-none ${
              activeTab === 'stats'
                ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-md shadow-pink-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400" />
            <span>Stats</span>
          </button>

          <button
            onClick={() => handleTabClick('changelog')}
            className={`flex items-center space-x-1.5 px-2.5 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all select-none ${
              activeTab === 'changelog'
                ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-md shadow-pink-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <History className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
            <span>Changelog</span>
          </button>

          <button
            onClick={() => handleTabClick('about')}
            className={`flex items-center space-x-1.5 px-2.5 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all select-none ${
              activeTab === 'about'
                ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-md shadow-pink-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Info className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-pink-400" />
            <span>About</span>
          </button>

          {/* Admin tab — only visible to RyoYamada */}
          {showAdmin && (
            <button
              onClick={() => handleTabClick('admin')}
              className={`flex items-center space-x-1.5 px-2.5 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all select-none ${
                activeTab === 'admin'
                  ? 'bg-gradient-to-r from-red-700 to-red-600 text-white shadow-md shadow-red-600/30'
                  : 'text-red-400/80 hover:text-red-300 hover:bg-red-950/40'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-400" />
              <span>Admin</span>
            </button>
          )}
        </nav>

        {/* Right Tools & Buttons */}
        <div className="flex items-center space-x-2 flex-shrink-0">
          {/* Quick Energy / Stamina Pill */}
          <div
            title={`Pull Stamina: ${energy.current}/${energy.max} (Regens +1 every 15s)`}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800 font-mono text-xs text-slate-300"
          >
            <Zap className={`w-3.5 h-3.5 ${energy.current > 0 ? 'text-amber-400 animate-pulse' : 'text-slate-600'}`} />
            <span className="text-amber-300 font-bold">{energy.current}</span>
            <span className="text-slate-600">/</span>
            <span className="text-slate-400 text-[11px]">{energy.max}</span>
          </div>

          {/* History Button */}
          <button
            onClick={() => {
              sfx.playClick();
              onOpenHistory();
            }}
            title="View Pull History"
            className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-cyan-400 border border-slate-800 transition-colors"
          >
            <History className="w-4 h-4" />
          </button>

          {/* Audio Mute Toggle */}
          <button
            onClick={handleMuteToggle}
            title={settings.soundEnabled ? 'Mute Sound Effects' : 'Unmute Sound Effects'}
            className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-pink-400 border border-slate-800 transition-colors"
          >
            {settings.soundEnabled ? (
              <Volume2 className="w-4 h-4 text-pink-400" />
            ) : (
              <VolumeX className="w-4 h-4 text-slate-500" />
            )}
          </button>

          {/* Settings Button */}
          <button
            onClick={() => {
              sfx.playClick();
              onOpenSettings();
            }}
            title="Settings & Storage Backup"
            className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors"
          >
            <Sliders className="w-4 h-4" />
          </button>

          {/* osu! OAuth2 Login & Profile Button */}
          <UserAuthButton onForceSync={forceCloudSync} />
        </div>
      </div>
    </header>
  );
};
