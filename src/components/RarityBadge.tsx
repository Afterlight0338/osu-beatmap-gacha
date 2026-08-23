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
    sm: 'text-xs px-2 py-0.5 space-x-1',
    md: 'text-xs md:text-sm px-2.5 py-1 space-x-1.5',
    lg: 'text-sm md:text-base px-3.5 py-1.5 space-x-2 font-bold',
  }[size];

  const starString = '★'.repeat(config.stars);

  const isDivine = rarity === 'Divine';
  const isMythic = rarity === 'Mythic';
  const isLegendary = rarity === 'Legendary';

  return (
    <div
      className={`inline-flex items-center rounded-full font-mono tracking-wider uppercase border select-none transition-all duration-300 ${sizeClasses} ${
        isDivine
          ? 'bg-gradient-to-r from-pink-600/80 via-purple-600/80 to-cyan-500/80 text-white border-pink-400 shadow-lg shadow-pink-500/40 animate-pulse'
          : isMythic
          ? 'bg-red-950/80 text-rose-300 border-red-500 shadow-md shadow-red-600/30'
          : isLegendary
          ? 'bg-amber-950/80 text-amber-300 border-amber-500 shadow-md shadow-amber-500/30'
          : rarity === 'Epic'
          ? 'bg-purple-950/80 text-purple-300 border-purple-500'
          : rarity === 'Rare'
          ? 'bg-cyan-950/80 text-cyan-300 border-cyan-500'
          : rarity === 'Uncommon'
          ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500'
          : 'bg-slate-900/80 text-slate-300 border-slate-600'
      } ${className}`}
      style={{
        textShadow: isDivine || isMythic || isLegendary ? '0 0 8px currentColor' : undefined,
      }}
    >
      <span className="font-extrabold">{config.label}</span>
      {showStars && (
        <span className="text-[0.8em] tracking-tight opacity-90 text-amber-300 font-sans">
          {starString}
        </span>
      )}
    </div>
  );
};
