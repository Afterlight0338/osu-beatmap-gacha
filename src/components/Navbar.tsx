import React, { useState } from 'react';
import { useGacha } from '../context/GachaContext';
import { useAuth } from '../context/AuthContext';
import { isAdmin } from '../config/admin';
import { sfx } from '../audio/sfx';
import { UserAuthButton } from './UserAuthButton';
import { MathQuizModal } from './MathQuizModal';
import { AnnouncementModal } from './AnnouncementModal';
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
  Calculator,
  Bell,
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
  const { stats, settings, updateSettings, pool, energy, totalEnergy, addBonusEnergy, activeEvent, forceCloudSync } = useGacha();
  const { user } = useAuth();
  const showAdmin = isAdmin(user?.username);

  const [isQuizOpen, setIsQuizOpen] = useState<boolean>(false);
  const [isAnnouncementOpen, setIsAnnouncementOpen] = useState<boolean>(false);

  const handleTabClick = (tab: 'gacha' | 'collection' | 'leaderboard' | 'stats' | 'changelog' | 'about' | 'admin') => {
    sfx.playClick();
    setActiveTab(tab);
  };

  const handleMuteToggle = () => {
    sfx.playClick();
    updateSettings({ soundEnabled: !settings.soundEnabled });
  };

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-[#0d0d15]/95 border-b border-slate-800/80">
      <div className="max-w-[1440px] mx-auto px-2 sm:px-4 lg:px-6 h-16 flex items-center justify-between gap-2 sm:gap-3">
        {/* Brand Logo */}
        <div
          onClick={() => handleTabClick('gacha')}
          className="flex items-center space-x-2.5 cursor-pointer group select-none flex-shrink-0"
        >
          <div className="relative flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-tr from-pink-600 to-pink-400 border-2 border-pink-300 shadow-md shadow-pink-500/30 group-hover:scale-105 transition-transform flex-shrink-0">
            <Disc className="w-5 h-5 text-white animate-spin-slow" />
            <Sparkles className="w-3.5 h-3.5 text-white absolute -top-0.5 -right-0.5 animate-pulse" />
          </div>

          <div>
            <span className="font-display font-black text-base sm:text-lg tracking-tight text-white group-hover:text-pink-400 transition-colors">
              osu!<span className="text-pink-500 font-sans">gacha</span>
            </span>
            <div className="hidden lg:flex items-center space-x-1 text-[9px] font-mono text-slate-400">
              <span>{pool.length.toLocaleString()} Maps</span>
              {activeEvent && (
                <span className="text-amber-400 font-bold animate-pulse">• EVENT ACTIVE</span>
              )}
            </div>
          </div>
        </div>

        {/* Center Navigation Tabs (Responsive & Compact to prevent right-edge overflow) */}
        <nav className="hidden md:flex items-center space-x-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800/90 flex-shrink min-w-0 overflow-x-auto">
          {/* Summon */}
          <button
            onClick={() => handleTabClick('gacha')}
            className={`flex items-center space-x-1 px-2.5 lg:px-3 py-1.5 rounded-lg text-xs font-bold transition-all select-none whitespace-nowrap ${
              activeTab === 'gacha'
                ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-md shadow-pink-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-pink-400" />
            <span>Summon</span>
          </button>

          {/* Collection */}
          <button
            onClick={() => handleTabClick('collection')}
            className={`flex items-center space-x-1 px-2.5 lg:px-3 py-1.5 rounded-lg text-xs font-bold transition-all select-none whitespace-nowrap relative ${
              activeTab === 'collection'
                ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-md shadow-pink-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-purple-400" />
            <span>Collection</span>
            {stats.uniqueOwned > 0 && (
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-slate-800 text-pink-300">
                {stats.uniqueOwned > 999 ? '999+' : stats.uniqueOwned}
              </span>
            )}
          </button>

          {/* Leaderboard */}
          <button
            onClick={() => handleTabClick('leaderboard')}
            className={`flex items-center space-x-1 px-2.5 lg:px-3 py-1.5 rounded-lg text-xs font-bold transition-all select-none whitespace-nowrap ${
              activeTab === 'leaderboard'
                ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-md shadow-pink-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span>Rank</span>
          </button>

          {/* Stats */}
          <button
            onClick={() => handleTabClick('stats')}
            className={`flex items-center space-x-1 px-2.5 lg:px-3 py-1.5 rounded-lg text-xs font-bold transition-all select-none whitespace-nowrap ${
              activeTab === 'stats'
                ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-md shadow-pink-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-cyan-400" />
            <span>Stats</span>
          </button>

          {/* Changelog */}
          <button
            onClick={() => handleTabClick('changelog')}
            className={`flex items-center space-x-1 px-2.5 lg:px-3 py-1.5 rounded-lg text-xs font-bold transition-all select-none whitespace-nowrap ${
              activeTab === 'changelog'
                ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-md shadow-pink-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <History className="w-3.5 h-3.5 text-amber-400" />
            <span>Logs</span>
          </button>

          {/* About */}
          <button
            onClick={() => handleTabClick('about')}
            className={`flex items-center space-x-1 px-2.5 lg:px-3 py-1.5 rounded-lg text-xs font-bold transition-all select-none whitespace-nowrap ${
              activeTab === 'about'
                ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-md shadow-pink-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Info className="w-3.5 h-3.5 text-pink-400" />
            <span>About</span>
          </button>

          {/* Admin tab — only visible to RyoYamada */}
          {showAdmin && (
            <button
              onClick={() => handleTabClick('admin')}
              className={`flex items-center space-x-1 px-2.5 lg:px-3 py-1.5 rounded-lg text-xs font-bold transition-all select-none whitespace-nowrap ${
                activeTab === 'admin'
                  ? 'bg-gradient-to-r from-red-700 to-red-600 text-white shadow-md shadow-red-600/30'
                  : 'text-red-400/80 hover:text-red-300 hover:bg-red-950/40'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
              <span>Admin</span>
            </button>
          )}
        </nav>

        {/* Right Tools & Buttons (Guaranteed No Overflow on Mobile) */}
        <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
          {/* Quick 3-Tier Stamina Pill */}
          <div
            onClick={() => setIsQuizOpen(true)}
            title={`Main: ${energy.current}/50 | Reserve: ${energy.reserve || 0}/100 | Bonus: ${energy.bonus || 0} | Click for Math Quiz!`}
            className="cursor-pointer group flex items-center space-x-1 px-2 sm:px-2.5 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/50 font-mono text-xs transition-all select-none flex-shrink-0"
          >
            <Zap className={`w-3.5 h-3.5 ${totalEnergy > 0 ? 'text-amber-400 animate-pulse' : 'text-slate-600'}`} />
            <span className="text-amber-300 font-extrabold">{energy.current}</span>
            {(energy.reserve || 0) > 0 && (
              <span className="text-cyan-400 text-[10px] font-bold">+{energy.reserve}R</span>
            )}
            {(energy.bonus || 0) > 0 && (
              <span className="text-pink-400 text-[10px] font-bold">+{energy.bonus}B</span>
            )}
          </div>

          {/* Math Quiz Bonus Stamina Button (hidden on mobile, accessible via stamina pill) */}
          <button
            onClick={() => {
              sfx.playClick();
              setIsQuizOpen(true);
            }}
            title="Answer quick math question for +15 Bonus Stamina!"
            className="hidden sm:flex p-2 rounded-xl bg-purple-950/50 hover:bg-purple-900/60 text-purple-300 hover:text-purple-100 border border-purple-500/40 transition-colors flex-shrink-0"
          >
            <Calculator className="w-4 h-4 text-purple-400" />
          </button>

          {/* Announcement Modal Bell */}
          <button
            onClick={() => {
              sfx.playClick();
              setIsAnnouncementOpen(true);
            }}
            title="View Announcements & Events"
            className="p-1.5 sm:p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-amber-400 border border-slate-800 transition-colors relative flex-shrink-0"
          >
            <Bell className="w-4 h-4" />
          </button>

          {/* History Button */}
          <button
            onClick={() => {
              sfx.playClick();
              onOpenHistory();
            }}
            title="View Pull History"
            className="hidden sm:flex p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-cyan-400 border border-slate-800 transition-colors flex-shrink-0"
          >
            <History className="w-4 h-4" />
          </button>

          {/* Audio Mute Toggle (hidden on small mobile, accessible in settings) */}
          <button
            onClick={handleMuteToggle}
            title={settings.soundEnabled ? 'Mute Sound' : 'Unmute Sound'}
            className="hidden md:flex p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-pink-400 border border-slate-800 transition-colors flex-shrink-0"
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
            title="Settings & Backup"
            className="p-1.5 sm:p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors flex-shrink-0"
          >
            <Sliders className="w-4 h-4" />
          </button>

          {/* osu! OAuth2 Login & Profile Button */}
          <UserAuthButton onForceSync={forceCloudSync} />
        </div>
      </div>

      {/* Popups & Modals */}
      <MathQuizModal
        isOpen={isQuizOpen}
        onClose={() => setIsQuizOpen(false)}
        onReward={(bonus) => addBonusEnergy(bonus)}
      />

      <AnnouncementModal
        isOpen={isAnnouncementOpen}
        onClose={() => setIsAnnouncementOpen(false)}
        onClaimBonus={(bonus) => addBonusEnergy(bonus)}
      />
    </header>
  );
};
