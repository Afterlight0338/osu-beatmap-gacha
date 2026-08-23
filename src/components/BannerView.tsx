import React from 'react';
import { useGacha } from '../context/GachaContext';
import { BANNERS } from '../gacha/banners';
import { Banner } from '../types/gacha';
import { sfx } from '../audio/sfx';
import { Sparkles, Flame, Zap } from 'lucide-react';

interface BannerViewProps {
  onSelectBanner: (banner: Banner) => void;
}

export const BannerView: React.FC<BannerViewProps> = ({ onSelectBanner }) => {
  const { activeBanner } = useGacha();

  const handleBannerClick = (b: Banner) => {
    sfx.playClick();
    onSelectBanner(b);
  };

  return (
    <div className="w-full space-y-4">
      {/* Banner Selector Tabs */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {BANNERS.map((b) => {
          const isActive = activeBanner.id === b.id;
          return (
            <button
              key={b.id}
              onClick={() => handleBannerClick(b)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs md:text-sm font-bold tracking-wide transition-all border select-none ${
                isActive
                  ? 'bg-slate-900 border-pink-500 text-white shadow-lg shadow-pink-500/20 scale-[1.02]'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              {b.id === 'standard' ? (
                <Sparkles className="w-4 h-4 text-pink-400" />
              ) : b.id === 'stream' ? (
                <Zap className="w-4 h-4 text-cyan-400" />
              ) : (
                <Flame className="w-4 h-4 text-amber-400" />
              )}
              <span>{b.name}</span>
            </button>
          );
        })}
      </div>

      {/* Main Banner Billboard / Showcase Card */}
      <div className="relative w-full rounded-3xl overflow-hidden border-2 border-slate-800/80 bg-slate-950 shadow-2xl transition-all duration-300">
        {/* Background Image with Ambient Glow */}
        <div className="relative w-full h-56 sm:h-72 md:h-80 overflow-hidden">
          <img
            src={activeBanner.bgImage}
            alt={activeBanner.name}
            className="w-full h-full object-cover object-center filter brightness-60 scale-105 transition-transform duration-700 hover:scale-110"
          />

          {/* Gradients for readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0d0d15] via-[#0d0d15]/50 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0d0d15]/90 via-[#0d0d15]/40 to-transparent" />

          {/* Banner Content Info */}
          <div className="absolute inset-0 p-6 md:p-8 flex flex-col justify-between z-10">
            {/* Top Badge */}
            <div className="flex items-center space-x-2">
              <span
                className="px-3 py-1 rounded-full text-xs font-mono font-black tracking-wider uppercase border backdrop-blur-md shadow-md text-white"
                style={{
                  backgroundColor: `${activeBanner.themeColor}33`,
                  borderColor: activeBanner.themeColor,
                }}
              >
                {activeBanner.badge}
              </span>

              <span className="text-xs font-mono text-slate-300 backdrop-blur-md bg-black/40 px-2.5 py-1 rounded-full border border-white/10">
                10-Pull: Guaranteed Rare+
              </span>
            </div>

            {/* Title & Description */}
            <div className="max-w-xl space-y-2">
              <span className="text-xs font-mono font-bold uppercase tracking-widest text-pink-400">
                {activeBanner.subtitle}
              </span>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white uppercase tracking-tight font-display drop-shadow-lg">
                {activeBanner.name}
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 font-sans line-clamp-2 drop-shadow">
                {activeBanner.description}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
