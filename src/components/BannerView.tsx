import React from 'react';
import { useGacha } from '../context/GachaContext';
import { BANNERS, filterMapsForBanner } from '../gacha/banners';
import { Banner } from '../types/gacha';
import { sfx } from '../audio/sfx';
import { Sparkles, Flame, Zap, Target, Database } from 'lucide-react';

interface BannerViewProps {
  onSelectBanner: (banner: Banner) => void;
}

export const BannerView: React.FC<BannerViewProps> = ({ onSelectBanner }) => {
  const { activeBanner, pool } = useGacha();

  const handleBannerClick = (b: Banner) => {
    sfx.playClick();
    onSelectBanner(b);
  };

  const bannerFilteredMaps = filterMapsForBanner(pool, activeBanner.id);

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
                  ? 'bg-slate-900 text-white shadow-lg scale-[1.02]'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
              style={{
                borderColor: isActive ? b.themeColor : undefined,
                boxShadow: isActive ? `0 0 20px ${b.themeColor}33` : undefined,
              }}
            >
              {b.id === 'standard' ? (
                <Sparkles className="w-4 h-4 text-pink-400" />
              ) : b.id === 'aimslop' ? (
                <Target className="w-4 h-4 text-pink-500" />
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
      <div
        className="relative w-full rounded-3xl overflow-hidden border-2 bg-slate-950 shadow-2xl transition-all duration-500"
        style={{ borderColor: `${activeBanner.themeColor}88` }}
      >
        {/* Background Image with Ambient Glow */}
        <div className="relative w-full min-h-[220px] sm:min-h-[260px] md:min-h-[280px] overflow-hidden">
          <img
            key={activeBanner.bgImage}
            src={activeBanner.bgImage}
            alt={activeBanner.name}
            className="w-full h-full object-cover object-center filter brightness-50 scale-105 transition-all duration-700 animate-fade-in"
          />

          {/* Gradients for readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0d0d15] via-[#0d0d15]/60 to-transparent pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0d0d15]/95 via-[#0d0d15]/60 to-transparent pointer-events-none" />

          {/* Banner Content Info */}
          <div className="absolute inset-0 p-5 sm:p-7 md:p-8 flex flex-col justify-between z-10">
            {/* Top Bar Badges */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <span
                  className="px-3 py-1 rounded-full text-xs font-mono font-black tracking-wider uppercase border backdrop-blur-md shadow-md text-white"
                  style={{
                    backgroundColor: `${activeBanner.themeColor}40`,
                    borderColor: activeBanner.themeColor,
                  }}
                >
                  {activeBanner.badge}
                </span>

                <span className="text-xs font-mono text-amber-300 backdrop-blur-md bg-black/50 px-2.5 py-1 rounded-full border border-amber-500/30">
                  100-Pull: Guaranteed 5★+
                </span>
              </div>

              {/* Pool Size Badge */}
              <div className="flex items-center space-x-1.5 px-3.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-xs font-mono text-slate-200 shadow-md">
                <Database className="w-3.5 h-3.5 text-cyan-400" />
                <span>Active Pool: <strong className="text-pink-400 font-bold">{bannerFilteredMaps.length.toLocaleString()}</strong> maps</span>
              </div>
            </div>

            {/* Bottom Layout: Title & Description */}
            <div className="max-w-2xl space-y-2 pt-4">
              <span
                className="text-xs font-mono font-bold uppercase tracking-widest"
                style={{ color: activeBanner.themeColor }}
              >
                {activeBanner.subtitle}
              </span>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white uppercase tracking-tight font-display drop-shadow-lg">
                {activeBanner.name}
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 font-sans leading-relaxed drop-shadow">
                {activeBanner.description}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
