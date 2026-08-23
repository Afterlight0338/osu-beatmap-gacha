import React from 'react';
import { useGacha } from '../context/GachaContext';
import { sfx } from '../audio/sfx';
import {
  Sparkles,
  Layers,
  BarChart3,
  Sliders,
  History,
  Volume2,
  VolumeX,
  Disc,
} from 'lucide-react';

interface NavbarProps {
  activeTab: 'gacha' | 'collection' | 'stats';
  setActiveTab: (tab: 'gacha' | 'collection' | 'stats') => void;
  onOpenSettings: () => void;
  onOpenHistory: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenSettings,
  onOpenHistory,
}) => {
  const { stats, settings, updateSettings, pool } = useGacha();

  const handleTabClick = (tab: 'gacha' | 'collection' | 'stats') => {
    sfx.playClick();
    setActiveTab(tab);
  };

  const handleMuteToggle = () => {
    sfx.playClick();
    updateSettings({ soundEnabled: !settings.soundEnabled });
  };

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-[#0d0d15]/85 border-b border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <div
          onClick={() => handleTabClick('gacha')}
          className="flex items-center space-x-3 cursor-pointer group select-none"
        >
          <div className="relative flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-tr from-pink-600 to-pink-400 border-2 border-pink-300 shadow-md shadow-pink-500/30 group-hover:scale-105 transition-transform">
            <Disc className="w-5 h-5 text-white animate-spin-slow" />
            <Sparkles className="w-3.5 h-3.5 text-white absolute -top-0.5 -right-0.5 animate-pulse" />
          </div>

          <div>
            <span className="font-display font-black text-lg md:text-xl tracking-tight text-white group-hover:text-pink-400 transition-colors">
              osu!<span className="text-pink-500 font-sans">gacha</span>
            </span>
            <div className="hidden sm:flex items-center space-x-1.5 text-[10px] font-mono text-slate-400">
              <span>Beatmap Collection</span>
              <span>•</span>
              <span className="text-emerald-400">{pool.length.toLocaleString()} Maps</span>
            </div>
          </div>
        </div>

        {/* Center Tabs */}
        <nav className="flex items-center space-x-1 sm:space-x-2 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => handleTabClick('gacha')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-all select-none ${
              activeTab === 'gacha'
                ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-md shadow-pink-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Summon</span>
          </button>

          <button
            onClick={() => handleTabClick('collection')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-all select-none relative ${
              activeTab === 'collection'
                ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-md shadow-pink-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Collection</span>
            {stats.uniqueOwned > 0 && (
              <span className="hidden md:inline-block text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-slate-800 text-pink-300 ml-1">
                {stats.uniqueOwned}
              </span>
            )}
          </button>

          <button
            onClick={() => handleTabClick('stats')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-all select-none ${
              activeTab === 'stats'
                ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-md shadow-pink-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Stats</span>
          </button>
        </nav>

        {/* Right Tools & Buttons */}
        <div className="flex items-center space-x-2">
          {/* Quick Pulls Counter Pill */}
          <div className="hidden lg:flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800 font-mono text-xs text-slate-300">
            <span className="text-slate-500">Pulls:</span>
            <span className="text-pink-400 font-bold">{stats.totalPulls}</span>
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
        </div>
      </div>
    </header>
  );
};
