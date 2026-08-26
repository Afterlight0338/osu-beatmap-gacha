import React from 'react';
import { RarityTier } from '../types/beatmap';
import { RARITY_CONFIGS } from '../gacha/rarity';

interface RarityBadgeProps {
  rarity: RarityTier;
  size?: 'sm' | 'md' | 'lg';
  showStars?: boolean;
  className?: string;
}

export const RarityBadge: React.FC<RarityBadgeProps> = ({
  rarity,
  size = 'md',
  showStars = true,
  className = '',
}) => {
  const config = RARITY_CONFIGS[rarity] || RARITY_CONFIGS.Common;

  const sizeClasses = {
    sm: 'text-[9px] sm:text-[10px] px-1.5 py-0.5 space-x-0.5 whitespace-nowrap',
    md: 'text-xs md:text-sm px-2.5 py-1 space-x-1.5 whitespace-nowrap',
    lg: 'text-sm md:text-base px-3.5 py-1.5 space-x-2 font-bold whitespace-nowrap',
  }[size];

  const starString = '★'.repeat(config.stars);

  const isEX = rarity === 'EX';
  const isGOAT = rarity === 'GOAT';
  const isDivine = rarity === 'Divine';
  const isCelestial = rarity === 'Celestial';
  const isMythic = rarity === 'Mythic';
  const isLegendary = rarity === 'Legendary';

  return (
    <div
      className={`inline-flex items-center rounded-full font-mono tracking-wider uppercase border select-none transition-all duration-300 ${sizeClasses} ${
        isEX
          ? 'bg-gradient-to-r from-purple-600 via-pink-500 to-amber-400 text-white font-black border-purple-300 shadow-[0_0_22px_rgba(216,180,254,0.9)] animate-pulse'
          : isGOAT
          ? 'bg-gradient-to-r from-amber-500 via-yellow-300 to-amber-500 text-slate-950 font-black border-yellow-300 shadow-[0_0_20px_rgba(255,215,0,0.8)] animate-pulse'
          : isDivine
          ? 'bg-gradient-to-r from-pink-600/90 via-purple-600/90 to-cyan-500/90 text-white border-pink-400 shadow-lg shadow-pink-500/40 animate-pulse'
          : isCelestial
          ? 'bg-gradient-to-r from-cyan-600/80 via-teal-500/80 to-indigo-600/80 text-white border-cyan-300 shadow-md shadow-cyan-400/40 animate-pulse'
          : isMythic
          ? 'bg-red-950/80 text-rose-300 border-rose-500 shadow-md shadow-rose-600/30'
          : isLegendary
          ? 'bg-red-950/80 text-red-300 border-red-500 shadow-md shadow-red-500/30'
          : rarity === 'Epic'
          ? 'bg-orange-950/80 text-orange-300 border-orange-500'
          : rarity === 'Rare'
          ? 'bg-purple-950/80 text-purple-300 border-purple-500'
          : rarity === 'Uncommon+'
          ? 'bg-sky-950/80 text-sky-300 border-sky-500'
          : rarity === 'Uncommon'
          ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500'
          : 'bg-slate-900/80 text-slate-300 border-slate-600'
      } ${className}`}
      style={{
        textShadow: isEX || isGOAT ? 'none' : isDivine || isCelestial || isMythic || isLegendary ? '0 0 8px currentColor' : undefined,
      }}
    >
      <span className="font-black flex items-center space-x-1">
        {isEX && <span className="text-[1.1em]">💎</span>}
        {isGOAT && <span className="text-[1.1em]">🐐</span>}
        {isDivine && <span className="text-[1.0em]">👑</span>}
        {isCelestial && <span className="text-[1.0em]">✨</span>}
        {isMythic && <span className="text-[1.0em]">🔥</span>}
        {isLegendary && <span className="text-[1.0em]">🔴</span>}
        {rarity === 'Epic' && <span className="text-[1.0em]">🟠</span>}
        {rarity === 'Rare' && <span className="text-[1.0em]">🟣</span>}
        {rarity === 'Uncommon+' && <span className="text-[1.0em]">🔵</span>}
        {rarity === 'Uncommon' && <span className="text-[1.0em]">🟢</span>}
        {rarity === 'Common' && <span className="text-[1.0em]">⚪</span>}
        <span>{config.label}</span>
      </span>
      {showStars && (
        <span
          className={`${size === 'sm' ? 'text-[8px] tracking-tighter' : 'text-[10px] tracking-tight'} opacity-90`}
          style={{ color: isGOAT ? '#0f172a' : config.color }}
        >
          {starString}
        </span>
      )}
    </div>
  );
};
