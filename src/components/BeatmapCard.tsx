import React, { useState, useRef, useEffect } from 'react';
import { Beatmap } from '../types/beatmap';
import { RarityBadge } from './RarityBadge';
import { BeatmapCoverImage } from './BeatmapCoverImage';
import { previewPlayer } from '../audio/previewPlayer';
import { sfx } from '../audio/sfx';
import { Play, Square, Heart, Layers, ExternalLink } from 'lucide-react';
import { getMapsetStarRange } from '../data/loader';

interface BeatmapCardProps {
  beatmap: Beatmap;
  copies?: number;
  isNew?: boolean;
  isFavorite?: boolean;
  isUnowned?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showPlayPreview?: boolean;
  onCardClick?: () => void;
  onToggleFavorite?: (e: React.MouseEvent) => void;
  animateReveal?: boolean;
}

export const BeatmapCard: React.FC<BeatmapCardProps> = ({
  beatmap,
  copies = 1,
  isNew = false,
  isFavorite = false,
  isUnowned = false,
  size = 'md',
  showPlayPreview = true,
  onCardClick,
  onToggleFavorite,
  animateReveal = false,
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [rotateX, setRotateX] = useState<number>(0);
  const [rotateY, setRotateY] = useState<number>(0);
  const [glarePos, setGlarePos] = useState<{ x: number; y: number }>({ x: 50, y: 50 });
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const isHighTier = beatmap.rarity === 'Legendary' || beatmap.rarity === 'Mythic' || beatmap.rarity === 'Divine';

  // Listen to audio player
  useEffect(() => {
    const unsub = previewPlayer.subscribe((playing, currentId) => {
      setIsPlaying(playing && currentId === beatmap.beatmapsetId);
    });
    return unsub;
  }, [beatmap.beatmapsetId]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rX = ((y - centerY) / centerY) * -10;
    const rY = ((x - centerX) / centerX) * 10;

    setRotateX(rX);
    setRotateY(rY);
    setGlarePos({
      x: Math.round((x / rect.width) * 100),
      y: Math.round((y / rect.height) * 100),
    });
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setRotateX(0);
    setRotateY(0);
  };

  const handlePlayToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    sfx.playClick();
    if (isPlaying) {
      previewPlayer.pause();
    } else {
      previewPlayer.play(beatmap.beatmapsetId, beatmap.previewUrl);
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatTime = (secs: number): string => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Status badge styling
  const statusColor =
    beatmap.status === 'ranked' || beatmap.status === 'approved'
      ? 'bg-blue-600/80 text-blue-100 border-blue-400/40'
      : beatmap.status === 'loved'
      ? 'bg-pink-600/80 text-pink-100 border-pink-400/40'
      : 'bg-emerald-600/80 text-emerald-100 border-emerald-400/40';

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onCardClick}
      className={`group relative rounded-2xl transition-transform duration-200 ease-out cursor-pointer select-none ${
        animateReveal ? 'animate-card-reveal' : ''
      } ${isUnowned ? 'opacity-40 grayscale hover:grayscale-0 hover:opacity-80' : ''}`}
      style={{
        perspective: '1000px',
        transform: isHovered
          ? `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`
          : 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)',
      }}
    >
      {/* Outer Card Frame with Dynamic Rarity Border */}
      <div
        className={`relative overflow-hidden rounded-2xl border-2 transition-all duration-300 bg-[#12121c] flex flex-col ${
          beatmap.rarity === 'GOAT'
            ? 'border-yellow-300 shadow-[0_0_30px_rgba(255,215,0,0.6)] ring-1 ring-yellow-400/50'
            : beatmap.rarity === 'Divine'
            ? 'border-pink-400/80 shadow-[0_0_25px_rgba(255,0,127,0.4)]'
            : beatmap.rarity === 'Mythic'
            ? 'border-rose-500/80 shadow-[0_0_20px_rgba(239,68,68,0.35)]'
            : beatmap.rarity === 'Legendary'
            ? 'border-amber-400/75 shadow-[0_0_18px_rgba(245,158,11,0.3)]'
            : beatmap.rarity === 'Epic'
            ? 'border-purple-500/60 shadow-[0_0_12px_rgba(168,85,247,0.25)]'
            : beatmap.rarity === 'Rare'
            ? 'border-cyan-500/50 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
            : beatmap.rarity === 'Uncommon'
            ? 'border-emerald-500/40'
            : 'border-slate-700/60'
        }`}
      >
        {/* Holographic / Foil Glare Overlay on hover */}
        {isHovered && !isUnowned && (
          <div
            className="pointer-events-none absolute inset-0 z-30 opacity-40 mix-blend-overlay transition-opacity duration-300"
            style={{
              background: `radial-gradient(circle 250px at ${glarePos.x}% ${glarePos.y}%, ${
                beatmap.rarity === 'GOAT'
                  ? 'rgba(255, 230, 0, 0.9), rgba(255, 170, 0, 0.7), transparent 70%'
                  : beatmap.rarity === 'Divine'
                  ? 'rgba(255, 0, 150, 0.8), rgba(0, 210, 255, 0.6), transparent 70%'
                  : isHighTier
                  ? 'rgba(255, 220, 100, 0.7), transparent 70%'
                  : 'rgba(255, 255, 255, 0.4), transparent 70%'
              })`,
            }}
          />
        )}

        {/* GOAT / Divine Animated Border Shimmer */}
        {beatmap.rarity === 'GOAT' && !isUnowned && (
          <div className="pointer-events-none absolute -inset-[2px] rounded-2xl bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-500 opacity-80 blur-xs animate-pulse z-0" />
        )}
        {beatmap.rarity === 'Divine' && !isUnowned && (
          <div className="pointer-events-none absolute -inset-[2px] rounded-2xl bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 opacity-60 blur-xs animate-divine-rainbow z-0" />
        )}

        {/* Top Cover Artwork Container */}
        <div className="relative w-full aspect-[16/9] overflow-hidden bg-slate-900 z-10">
          <BeatmapCoverImage
            beatmap={beatmap}
            alt={`${beatmap.artist} - ${beatmap.title}`}
            className="transition-transform duration-500 ease-out group-hover:scale-105"
          />

          {/* Dark gradient overlay for text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#12121c] via-transparent to-black/60 pointer-events-none" />

          {/* Top Bar Badges */}
          <div className="absolute top-2 left-2 right-2 flex items-center justify-between z-20">
            <RarityBadge rarity={beatmap.rarity} size={size === 'sm' ? 'sm' : 'md'} />

            <div className="flex items-center space-x-1.5">
              {/* Star Rating Badge */}
              <div className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md border border-amber-400/40 text-amber-300 text-xs font-bold font-mono shadow-sm">
                <span>★</span>
                <span>{getMapsetStarRange(beatmap.beatmapsetId, beatmap.stars).label}</span>
              </div>

              {/* Duplicate Copies Pill */}
              {!isUnowned && copies > 1 && (
                <div className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-purple-900/80 border border-purple-400/60 text-purple-200 text-xs font-bold font-mono">
                  <Layers className="w-3 h-3" />
                  <span>x{copies}</span>
                </div>
              )}

              {/* NEW Badge */}
              {isNew && (
                <div className="px-2 py-0.5 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 text-white text-xs font-extrabold tracking-wider animate-bounce shadow-md">
                  NEW!
                </div>
              )}
            </div>
          </div>

          {/* Audio Preview Button Overlay */}
          {showPlayPreview && !isUnowned && (
            <button
              onClick={handlePlayToggle}
              title={isPlaying ? 'Pause preview' : 'Play audio preview'}
              className={`absolute bottom-2 right-2 z-20 p-2.5 rounded-full backdrop-blur-md border transition-all duration-200 shadow-lg ${
                isPlaying
                  ? 'bg-pink-600 text-white border-pink-300 scale-110 shadow-pink-500/50 animate-pulse'
                  : 'bg-black/60 text-slate-200 border-white/20 hover:bg-pink-600 hover:text-white hover:scale-105'
              }`}
            >
              {isPlaying ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current translate-x-0.5" />}
            </button>
          )}

          {/* Favorite Toggle Button */}
          {onToggleFavorite && !isUnowned && (
            <button
              onClick={onToggleFavorite}
              title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              className={`absolute bottom-2 left-2 z-20 p-2 rounded-full backdrop-blur-md border transition-all duration-200 ${
                isFavorite
                  ? 'bg-pink-600/90 text-white border-pink-400 shadow-md shadow-pink-500/30'
                  : 'bg-black/50 text-slate-400 border-white/20 hover:text-pink-400 hover:bg-black/70'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${isFavorite ? 'fill-current' : ''}`} />
            </button>
          )}

          {/* External osu! Web Link Button */}
          <a
            href={`https://osu.ppy.sh/beatmapsets/${beatmap.beatmapsetId}#osu/${beatmap.id}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            title="Open on osu! website"
            className="absolute bottom-2 left-10 z-20 p-2 rounded-full backdrop-blur-md border border-white/20 bg-black/50 text-slate-400 hover:text-cyan-300 hover:bg-cyan-950/80 hover:border-cyan-400/60 transition-all duration-200"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* Card Body Information */}
        <div className={`flex flex-col flex-grow justify-between z-10 bg-[#12121c] ${size === 'sm' ? 'p-2.5' : 'p-3.5'}`}>
          {/* Song & Artist Info */}
          <div className="space-y-0.5">
            <h3
              className={`font-bold text-slate-100 line-clamp-2 group-hover:text-pink-400 transition-colors leading-tight tracking-wide ${
                size === 'sm' ? 'text-xs min-h-[2rem]' : 'text-sm md:text-base min-h-[2.5rem]'
              }`}
              title={beatmap.title}
            >
              {beatmap.title}
            </h3>
            <p className="text-[11px] text-slate-400 line-clamp-1 truncate" title={beatmap.artist}>
              {beatmap.artist}
            </p>
          </div>

          {/* Mapper & Ranked Status */}
          <div className={`rounded-lg bg-slate-900/70 border border-slate-800/80 flex items-center justify-between ${size === 'sm' ? 'mt-1.5 py-1 px-2 text-[10px]' : 'mt-2.5 py-1.5 px-2.5 text-xs'}`}>
            <div className="truncate pr-2">
              <span className="text-slate-400">by </span>
              <span className="text-slate-200 font-semibold">{beatmap.creator}</span>
            </div>
            <span className={`text-[9px] uppercase font-bold px-1.5 py-0.2 rounded border flex-shrink-0 ${statusColor}`}>
              {beatmap.status}
            </span>
          </div>

          {/* Beatmap Metrics (BPM, Length, Playcount, Favourites) */}
          <div className={`grid grid-cols-2 gap-1 font-mono text-slate-400 border-t border-slate-800/80 ${size === 'sm' ? 'mt-2 pt-1.5 text-[10px]' : 'mt-3 pt-2 text-[11px]'}`}>
            <div>
              <span className="text-slate-500">BPM: </span>
              <span className="text-slate-200 font-semibold">{beatmap.bpm}</span>
            </div>
            <div className="text-right">
              <span className="text-slate-500">Time: </span>
              <span className="text-slate-200 font-semibold">{formatTime(beatmap.length)}</span>
            </div>
            <div>
              <span className="text-slate-500">Plays: </span>
              <span className="text-cyan-300 font-semibold">{formatNumber(beatmap.playcount)}</span>
            </div>
            <div className="text-right">
              <span className="text-slate-500">Favs: </span>
              <span className="text-pink-300 font-semibold">{formatNumber(beatmap.favouriteCount)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
