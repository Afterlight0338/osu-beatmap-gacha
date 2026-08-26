import React, { useState } from 'react';
import { useGacha } from '../context/GachaContext';
import { sfx } from '../audio/sfx';
import { DEFAULT_RARITY_RATES } from '../gacha/probabilities';
import { RARITY_ORDER, RARITY_CONFIGS } from '../gacha/rarity';
import { Sparkles, Zap, Info, ChevronDown, ChevronUp } from 'lucide-react';

interface GachaControlsProps {
  onPull: (count: number) => void;
  isPulling: boolean;
}

export const GachaControls: React.FC<GachaControlsProps> = ({ onPull, isPulling }) => {
  const { settings, updateSettings, energy, countdownSeconds, timeToFullFormatted, pityCount } = useGacha();
  const [showRates, setShowRates] = useState<boolean>(false);

  const handlePullClick = (count: number) => {
    if (isPulling || energy.current < count) return;
    sfx.playClick();
    onPull(count);
  };

  const energyPercent = Math.min(100, Math.max(0, (energy.current / energy.max) * 100));
  const pityPercent = Math.min(100, Math.max(0, (pityCount / 100) * 100));
  const isSoftPity = pityCount >= 80 && pityCount < 100;
  const isHardPity = pityCount >= 100;

  return (
    <div className="w-full flex flex-col items-center space-y-4">
      {/* Top Status Bars: Stamina & 100-Pull Pity System */}
      <div className="w-full max-w-xl grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Pull Energy / Stamina Time-Gate Bar */}
        <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-md space-y-2">
          <div className="flex items-center justify-between text-xs font-mono">
            <div className="flex items-center space-x-1.5">
              <Zap className={`w-4 h-4 ${energy.current > 0 ? 'text-amber-400 animate-pulse' : 'text-slate-600'}`} />
              <span className="font-bold text-slate-200">
                Stamina: <span className="text-amber-300 font-extrabold">{energy.current}</span>/{energy.max}
              </span>
            </div>

            <div className="text-slate-400 text-[10px]">
              {energy.current >= energy.max ? (
                <span className="text-emerald-400 font-bold">MAX</span>
              ) : (
                <span>+{countdownSeconds}s • {timeToFullFormatted}</span>
              )}
            </div>
          </div>

          {/* Stamina Progress Bar */}
          <div className="w-full h-2 rounded-full bg-slate-950 border border-slate-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-500 via-orange-500 to-pink-500 transition-all duration-500 rounded-full"
              style={{ width: `${energyPercent}%` }}
            />
          </div>
        </div>

        {/* 100-Pull Legendary+ Pity Bar */}
        <div className={`p-3.5 rounded-2xl border backdrop-blur-md space-y-2 transition-all ${
          isHardPity
            ? 'bg-rose-950/60 border-rose-500/80 shadow-lg shadow-rose-900/30 animate-pulse'
            : isSoftPity
            ? 'bg-amber-950/40 border-amber-500/60 shadow-md shadow-amber-900/20'
            : 'bg-slate-900/80 border-slate-800'
        }`}>
          <div className="flex items-center justify-between text-xs font-mono">
            <div className="flex items-center space-x-1.5">
              <Sparkles className={`w-4 h-4 ${isHardPity ? 'text-rose-400 animate-spin' : isSoftPity ? 'text-amber-400 animate-pulse' : 'text-purple-400'}`} />
              <span className="font-bold text-slate-200">
                Legendary+ Pity: <span className={isHardPity ? 'text-rose-300 font-extrabold' : isSoftPity ? 'text-amber-300 font-extrabold' : 'text-purple-300 font-bold'}>{pityCount}</span>/100
              </span>
            </div>

            <div className="text-[10px] font-mono">
              {isHardPity ? (
                <span className="text-rose-400 font-black">GUARANTEED 5★+</span>
              ) : isSoftPity ? (
                <span className="text-amber-300 font-bold">SOFT PITY ACTIVE</span>
              ) : (
                <span className="text-slate-400">{100 - pityCount} to guarantee</span>
              )}
            </div>
          </div>

          {/* Pity Progress Bar */}
          <div className="w-full h-2 rounded-full bg-slate-950 border border-slate-800 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                isHardPity
                  ? 'bg-gradient-to-r from-amber-400 via-rose-500 to-pink-500'
                  : isSoftPity
                  ? 'bg-gradient-to-r from-purple-500 via-pink-500 to-amber-400'
                  : 'bg-gradient-to-r from-indigo-500 to-purple-500'
              }`}
              style={{ width: `${pityPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Pull Action Buttons (1x, 5x, 10x) */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3.5 w-full max-w-xl">
        {/* Single Pull (1x) */}
        <button
          disabled={isPulling || energy.current < 1}
          onClick={() => handlePullClick(1)}
          className={`py-3 sm:py-3.5 px-2 sm:px-4 rounded-2xl font-black text-xs sm:text-sm uppercase tracking-wider transition-all duration-200 select-none flex flex-col items-center justify-center space-y-0.5 border shadow-lg ${
            isPulling || energy.current < 1
              ? 'opacity-40 cursor-not-allowed bg-slate-900 text-slate-500 border-slate-800'
              : 'bg-slate-900/90 hover:bg-slate-800 active:scale-95 text-slate-100 border-slate-700 hover:border-pink-500 shadow-slate-950/50 hover:scale-105'
          }`}
        >
          <div className="flex items-center space-x-1 sm:space-x-1.5">
            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-pink-400" />
            <span>1x</span>
          </div>
          <span className="text-[10px] font-mono text-amber-400 font-normal">⚡1</span>
        </button>

        {/* Medium Pull (5x) */}
        <button
          disabled={isPulling || energy.current < 5}
          onClick={() => handlePullClick(5)}
          className={`py-3 sm:py-3.5 px-2 sm:px-4 rounded-2xl font-black text-xs sm:text-sm uppercase tracking-wider transition-all duration-200 select-none flex flex-col items-center justify-center space-y-0.5 border shadow-lg ${
            isPulling || energy.current < 5
              ? 'opacity-40 cursor-not-allowed bg-slate-900 text-slate-500 border-slate-800'
              : 'bg-gradient-to-r from-purple-900/80 to-indigo-900/80 hover:from-purple-800 hover:to-indigo-800 active:scale-95 text-white border-purple-500/60 shadow-purple-950/50 hover:scale-105'
          }`}
        >
          <div className="flex items-center space-x-1 sm:space-x-1.5">
            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-300" />
            <span>5x</span>
          </div>
          <span className="text-[10px] font-mono text-amber-300 font-normal">⚡5</span>
        </button>

        {/* Multi Pull (10x) */}
        <button
          disabled={isPulling || energy.current < 10}
          onClick={() => handlePullClick(10)}
          className={`py-3 sm:py-3.5 px-2 sm:px-4 rounded-2xl font-black text-xs sm:text-sm uppercase tracking-wider transition-all duration-200 select-none flex flex-col items-center justify-center space-y-0.5 border shadow-xl relative overflow-hidden group ${
            isPulling || energy.current < 10
              ? 'opacity-40 cursor-not-allowed bg-slate-900 text-slate-500 border-slate-800'
              : 'bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 hover:from-pink-500 hover:via-purple-500 hover:to-indigo-500 active:scale-95 text-white border-pink-400/50 shadow-pink-600/30 hover:scale-105'
          }`}
        >
          {/* Shimmer light bar */}
          <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />

          <div className="flex items-center space-x-1 sm:space-x-1.5">
            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-300 animate-pulse" />
            <span>10x</span>
          </div>
          <span className="text-[10px] font-mono text-amber-200 font-normal">⚡10</span>
        </button>
      </div>

      {/* Sub-controls: Fast Animation switch & Rates Info toggle */}
      <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-mono text-slate-400 select-none">
        {/* Fast Reveal Switch */}
        <label className="flex items-center space-x-2 cursor-pointer hover:text-slate-200 transition-colors">
          <input
            type="checkbox"
            checked={settings.fastAnimation}
            onChange={(e) => updateSettings({ fastAnimation: e.target.checked })}
            className="rounded border-slate-700 bg-slate-900 text-pink-600 focus:ring-0 cursor-pointer"
          />
          <span className="flex items-center space-x-1">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Fast Reveal Mode</span>
          </span>
        </label>

        <span>•</span>

        {/* View Rates Dropdown */}
        <button
          onClick={() => setShowRates(!showRates)}
          className="flex items-center space-x-1 hover:text-pink-400 transition-colors"
        >
          <Info className="w-3.5 h-3.5" />
          <span>Drop Rates & Pity Rules</span>
          {showRates ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Rarity Drop Rates Panel */}
      {showRates && (
        <div className="w-full max-w-xl p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3 animate-fade-in text-xs">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="font-bold text-slate-200">10-Tier Base Probabilities</span>
            <span className="font-mono text-cyan-400">100-Pull Legendary+ Pity</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {RARITY_ORDER.slice().reverse().map((tier) => {
              const config = RARITY_CONFIGS[tier];
              const pct = DEFAULT_RARITY_RATES[tier] * 100;
              const rateStr = pct < 0.1 ? pct.toFixed(2) : pct < 1 ? pct.toFixed(2) : pct.toFixed(1);
              return (
                <div
                  key={tier}
                  className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 flex flex-col justify-between"
                >
                  <span className="font-bold truncate flex items-center space-x-1 text-[11px]" style={{ color: config.color }}>
                    {tier === 'GOAT' && <span>🐐</span>}
                    <span>{tier}</span>
                  </span>
                  <span className="font-mono text-slate-300 font-semibold mt-1 text-[11px]">{rateStr}%</span>
                </div>
              );
            })}
          </div>

          {/* Pity System Explanation */}
          <div className="p-3 rounded-xl bg-slate-950 border border-cyan-900/40 space-y-1.5 text-[11px] font-mono text-slate-300">
            <div className="font-bold text-cyan-300 flex items-center space-x-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>100-Pull Legendary+ Pity Mechanism:</span>
            </div>
            <ul className="space-y-1 text-slate-400 pl-4 list-disc">
              <li><strong className="text-slate-200">Pulls 1–79:</strong> Standard base probabilities apply.</li>
              <li><strong className="text-amber-300">Pulls 80–99 (Soft Pity):</strong> High-rarity probabilities progressively increase on each pull.</li>
              <li><strong className="text-rose-400">Pull 100 (Hard Pity):</strong> 100% Guaranteed Legendary, Mythic, Celestial, Divine, or GOAT.</li>
              <li>Pulling any <strong className="text-emerald-300">Legendary+</strong> immediately resets your pity counter back to 0.</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
