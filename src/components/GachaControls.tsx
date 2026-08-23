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
  const { settings, updateSettings, energy, countdownSeconds, timeToFullFormatted } = useGacha();
  const [showRates, setShowRates] = useState<boolean>(false);

  const handlePullClick = (count: number) => {
    if (isPulling || energy.current < count) return;
    sfx.playClick();
    onPull(count);
  };

  const energyPercent = Math.min(100, Math.max(0, (energy.current / energy.max) * 100));

  return (
    <div className="w-full flex flex-col items-center space-y-5">
      {/* Pull Energy / Stamina Time-Gate Bar */}
      <div className="w-full max-w-xl p-4 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-md space-y-2">
        <div className="flex items-center justify-between text-xs font-mono">
          <div className="flex items-center space-x-2">
            <Zap className={`w-4 h-4 ${energy.current > 0 ? 'text-amber-400 animate-pulse' : 'text-slate-600'}`} />
            <span className="font-bold text-slate-200">
              Pull Stamina: <span className="text-amber-300 font-extrabold text-sm">{energy.current}</span> / {energy.max}
            </span>
          </div>

          <div className="text-slate-400 text-[11px]">
            {energy.current >= energy.max ? (
              <span className="text-emerald-400 font-bold">MAX CAPACITY</span>
            ) : (
              <span>
                +1 in <span className="text-amber-300 font-bold">{countdownSeconds}s</span> • Full in {timeToFullFormatted}
              </span>
            )}
          </div>
        </div>

        {/* Stamina Progress Bar */}
        <div className="w-full h-2.5 rounded-full bg-slate-950 border border-slate-800 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-500 via-orange-500 to-pink-500 transition-all duration-500 rounded-full"
            style={{ width: `${energyPercent}%` }}
          />
        </div>
      </div>

      {/* Pull Action Buttons (1x, 5x, 10x) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-xl">
        {/* Single Pull (1x) */}
        <button
          disabled={isPulling || energy.current < 1}
          onClick={() => handlePullClick(1)}
          className={`py-3.5 px-4 rounded-2xl font-black text-sm uppercase tracking-wider transition-all duration-200 select-none flex flex-col items-center justify-center space-y-0.5 border shadow-lg ${
            isPulling || energy.current < 1
              ? 'opacity-40 cursor-not-allowed bg-slate-900 text-slate-500 border-slate-800'
              : 'bg-slate-900/90 hover:bg-slate-800 text-slate-100 border-slate-700 hover:border-pink-500 shadow-slate-950/50 hover:scale-105'
          }`}
        >
          <div className="flex items-center space-x-1.5">
            <Sparkles className="w-4 h-4 text-pink-400" />
            <span>PULL 1x</span>
          </div>
          <span className="text-[10px] font-mono text-amber-400 font-normal">Cost: ⚡1</span>
        </button>

        {/* Medium Pull (5x) */}
        <button
          disabled={isPulling || energy.current < 5}
          onClick={() => handlePullClick(5)}
          className={`py-3.5 px-4 rounded-2xl font-black text-sm uppercase tracking-wider transition-all duration-200 select-none flex flex-col items-center justify-center space-y-0.5 border shadow-lg ${
            isPulling || energy.current < 5
              ? 'opacity-40 cursor-not-allowed bg-slate-900 text-slate-500 border-slate-800'
              : 'bg-gradient-to-r from-purple-900/80 to-indigo-900/80 hover:from-purple-800 hover:to-indigo-800 text-white border-purple-500/60 shadow-purple-950/50 hover:scale-105'
          }`}
        >
          <div className="flex items-center space-x-1.5">
            <Sparkles className="w-4 h-4 text-purple-300" />
            <span>PULL 5x</span>
          </div>
          <span className="text-[10px] font-mono text-amber-300 font-normal">Cost: ⚡5</span>
        </button>

        {/* Multi Pull (10x) */}
        <button
          disabled={isPulling || energy.current < 10}
          onClick={() => handlePullClick(10)}
          className={`py-3.5 px-4 rounded-2xl font-black text-sm uppercase tracking-wider transition-all duration-200 select-none flex flex-col items-center justify-center space-y-0.5 border shadow-xl relative overflow-hidden group ${
            isPulling || energy.current < 10
              ? 'opacity-40 cursor-not-allowed bg-slate-900 text-slate-500 border-slate-800'
              : 'bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 hover:from-pink-500 hover:via-purple-500 hover:to-indigo-500 text-white border-pink-400/50 shadow-pink-600/30 hover:scale-105'
          }`}
        >
          {/* Shimmer light bar */}
          <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />

          <div className="flex items-center space-x-1.5">
            <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
            <span>PULL 10x</span>
          </div>
          <span className="text-[10px] font-mono text-amber-200 font-normal">Cost: ⚡10</span>

          {/* Guaranteed badge */}
          <span className="absolute -top-1 right-2 text-[8px] font-mono font-bold bg-amber-400 text-slate-950 px-1.5 py-0.2 rounded-full uppercase">
            Rare+
          </span>
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
          <span>Drop Rates & Rules</span>
          {showRates ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Rarity Drop Rates Panel */}
      {showRates && (
        <div className="w-full max-w-lg p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3 animate-fade-in text-xs">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="font-bold text-slate-200">Rarity Tier Rates</span>
            <span className="font-mono text-slate-400">10-Pull: Rare+ Guaranteed</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {RARITY_ORDER.slice().reverse().map((tier) => {
              const config = RARITY_CONFIGS[tier];
              const rate = (DEFAULT_RARITY_RATES[tier] * 100).toFixed(1);
              return (
                <div
                  key={tier}
                  className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 flex flex-col justify-between"
                >
                  <span className="font-bold truncate" style={{ color: config.color }}>
                    {tier}
                  </span>
                  <span className="font-mono text-slate-300 font-semibold mt-1">{rate}%</span>
                </div>
              );
            })}
          </div>

          <p className="text-[11px] text-slate-500 font-sans leading-relaxed">
            * Rarity is calculated based on beatmap popularity (log-normalized playcount & favourites) across the global pool.
          </p>
        </div>
      )}
    </div>
  );
};
