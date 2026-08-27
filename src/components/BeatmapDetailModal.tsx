import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Beatmap } from '../types/beatmap';
import { CollectionRecord } from '../types/collection';
import { RarityBadge } from './RarityBadge';
import { BeatmapCoverImage } from './BeatmapCoverImage';
import { previewPlayer } from '../audio/previewPlayer';
import { sfx } from '../audio/sfx';
import {
  X,
  Play,
  Square,
  Heart,
  ExternalLink,
  Download,
  Clock,
  Activity,
  Flame,
  Calendar,
  Crown,
} from 'lucide-react';
import { getMapsetStarRange } from '../data/loader';
import { formatUserDateTime, formatUserDate } from '../utils/timeFormat';

interface BeatmapDetailModalProps {
  beatmap: Beatmap | null;
  record?: CollectionRecord;
  isOpen: boolean;
  onClose: () => void;
  onToggleFavorite: (beatmapId: number) => void;
}

export const BeatmapDetailModal: React.FC<BeatmapDetailModalProps> = ({
  beatmap,
  record,
  isOpen,
  onClose,
  onToggleFavorite,
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  useEffect(() => {
    if (!beatmap) return;
    const unsub = previewPlayer.subscribe((playing, currentId) => {
      setIsPlaying(playing && currentId === beatmap.beatmapsetId);
    });
    return unsub;
  }, [beatmap]);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen && beatmap) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen, beatmap]);

  if (!isOpen || !beatmap) return null;

  const handlePlayToggle = () => {
    sfx.playClick();
    if (isPlaying) {
      previewPlayer.pause();
    } else {
      previewPlayer.play(beatmap.beatmapsetId, beatmap.previewUrl);
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  const formatTime = (secs: number): string => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const formatDate = (timestamp?: number): string => {
    if (!timestamp) return 'Never';
    return formatUserDateTime(timestamp);
  };

  const osuWebUrl = `https://osu.ppy.sh/beatmapsets/${beatmap.beatmapsetId}#osu/${beatmap.id}`;
  const osuDirectUrl = `osu://b/${beatmap.id}`;
  const beatconnectUrl = `https://beatconnect.io/b/${beatmap.beatmapsetId}`;
  const sayobotUrl = `https://txy1.sayobot.cn/beatmaps/download/full/${beatmap.beatmapsetId}`;
  const mapperProfileUrl = `https://osu.ppy.sh/users/${encodeURIComponent(beatmap.creator)}`;

  const copies = record?.copies || 0;
  const isOwned = copies > 0;
  const isFavorite = record?.isFavorite || false;

  const handleClose = () => {
    previewPlayer.pause();
    onClose();
  };

  return createPortal(
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      className="fixed inset-0 z-[9998] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in overflow-y-auto"
    >
      <div className="relative w-full max-w-2xl rounded-t-3xl sm:rounded-2xl bg-[#141420] border-t sm:border border-slate-700 shadow-2xl overflow-hidden max-h-[92vh] overflow-y-auto my-0 sm:my-8 animate-slide-up sm:animate-scale-up">
        {/* Mobile Drag Indicator */}
        <div className="sm:hidden flex justify-center pt-2 pb-1 bg-[#141420]">
          <div className="w-10 h-1 rounded-full bg-slate-600/80" />
        </div>

        {/* Cover Header Banner */}
        <div className="relative w-full h-44 sm:h-48 md:h-60 bg-slate-950 overflow-hidden">
          <BeatmapCoverImage
            beatmap={beatmap}
            alt={beatmap.title}
            className="w-full h-full"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#141420] via-[#141420]/40 to-black/60 pointer-events-none" />

          {/* Close Button */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/60 hover:bg-rose-600 text-white backdrop-blur-md border border-white/20 transition-colors z-20"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Top Info Bar */}
          <div className="absolute top-4 left-4 flex items-center space-x-2 z-20">
            <RarityBadge rarity={beatmap.rarity} size="md" />
            <div className="flex items-center space-x-1 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md border border-amber-400/50 text-amber-300 text-xs font-bold font-mono">
              <span>★</span>
              <span>{getMapsetStarRange(beatmap.beatmapsetId, beatmap.stars).label}</span>
            </div>
          </div>

          {/* Play Preview floating action */}
          <button
            onClick={handlePlayToggle}
            className={`absolute bottom-4 right-4 p-3.5 rounded-full backdrop-blur-md border shadow-xl transition-all duration-300 z-20 ${
              isPlaying
                ? 'bg-pink-600 text-white border-pink-300 scale-110 shadow-pink-500/50 animate-pulse'
                : 'bg-black/70 text-white border-white/30 hover:bg-pink-600 hover:scale-105'
            }`}
          >
            {isPlaying ? <Square className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current translate-x-0.5" />}
          </button>

          {/* Title overlay */}
          <div className="absolute bottom-4 left-4 right-20 z-10">
            <h2 className="text-xl md:text-2xl font-black text-white line-clamp-1 font-display drop-shadow-md">
              {beatmap.title}
            </h2>
            <p className="text-sm text-slate-300 line-clamp-1 drop-shadow">
              {beatmap.artist}
            </p>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 md:p-6 space-y-6">
          {/* EX Handpicked Tier Lore & Reason Banner */}
          {(beatmap.rarity === 'EX' || beatmap.exReason) && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950/80 via-indigo-950/80 to-pink-950/80 border-2 border-purple-400/80 shadow-[0_0_25px_rgba(168,85,247,0.35)] space-y-2 animate-fade-in">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-400/40">
                  <Crown className="w-4 h-4 text-purple-300 animate-pulse" />
                </div>
                <div>
                  <span className="text-[10px] font-mono font-black uppercase tracking-wider text-purple-300">
                    💎 Admin Handpicked EX Special Tier
                  </span>
                </div>
              </div>
              <p className="text-xs sm:text-sm text-slate-100 font-sans leading-relaxed pl-1 italic">
                "{beatmap.exReason || 'This beatmap was personally handpicked by the administrator for its monumental status in osu! rhythm game history.'}"
              </p>
            </div>
          )}

          {/* Difficulty and Mapper */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-slate-900/80 border border-slate-800">
            <div>
              <span className="text-xs font-mono uppercase text-slate-500">Difficulty</span>
              <p className="text-sm font-bold text-pink-400">[{beatmap.version}]</p>
            </div>

            <div>
              <span className="text-xs font-mono uppercase text-slate-500">Mapped By</span>
              <p className="text-sm font-bold text-slate-200">
                <a
                  href={mapperProfileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-pink-400 transition-colors inline-flex items-center space-x-1"
                >
                  <span>{beatmap.creator}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </p>
            </div>

            <div>
              <span className="text-xs font-mono uppercase text-slate-500">Status</span>
              <p
                className={`text-sm font-bold uppercase ${
                  beatmap.status === 'loved'
                    ? 'text-pink-400'
                    : beatmap.status === 'qualified'
                    ? 'text-blue-400'
                    : beatmap.status === 'graveyard' || beatmap.status === 'unranked'
                    ? 'text-slate-400'
                    : 'text-emerald-400'
                }`}
              >
                {beatmap.status}
              </p>
            </div>

            {isOwned && (
              <button
                onClick={() => onToggleFavorite(beatmap.id)}
                className={`p-2.5 rounded-xl border transition-colors flex items-center space-x-1.5 text-xs font-semibold ${
                  isFavorite
                    ? 'bg-pink-900/60 text-pink-200 border-pink-500'
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                }`}
              >
                <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current text-pink-400' : ''}`} />
                <span>{isFavorite ? 'Favorited' : 'Favorite'}</span>
              </button>
            )}
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
              <div className="flex items-center space-x-1.5 text-slate-400 text-xs font-mono">
                <Activity className="w-3.5 h-3.5 text-pink-400" />
                <span>BPM</span>
              </div>
              <p className="text-base font-bold text-slate-100 mt-1">{beatmap.bpm}</p>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
              <div className="flex items-center space-x-1.5 text-slate-400 text-xs font-mono">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                <span>Length</span>
              </div>
              <p className="text-base font-bold text-slate-100 mt-1">{formatTime(beatmap.length)}</p>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
              <div className="flex items-center space-x-1.5 text-slate-400 text-xs font-mono">
                <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                <span>Ranked Date</span>
              </div>
              <p className="text-sm font-bold text-emerald-300 mt-1 font-mono">
                {beatmap.rankedDate ? formatUserDate(beatmap.rankedDate) : 'N/A'}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
              <div className="flex items-center space-x-1.5 text-slate-400 text-xs font-mono">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                <span>Playcount</span>
              </div>
              <p className="text-base font-bold text-cyan-300 mt-1">{formatNumber(beatmap.playcount)}</p>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
              <div className="flex items-center space-x-1.5 text-slate-400 text-xs font-mono">
                <Heart className="w-3.5 h-3.5 text-rose-400" />
                <span>Favourites</span>
              </div>
              <p className="text-base font-bold text-pink-300 mt-1">{formatNumber(beatmap.favouriteCount)}</p>
            </div>
          </div>

          {/* Collection Status Breakdown */}
          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
            <h4 className="text-xs font-mono uppercase text-slate-400 font-bold tracking-wider">
              Collection Status
            </h4>
            {isOwned ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono text-slate-300 pt-1">
                <div>
                  <span className="text-slate-500">Copies Owned: </span>
                  <span className="font-bold text-purple-300">{copies}</span>
                </div>
                <div>
                  <span className="text-slate-500">First Pulled: </span>
                  <span>{formatDate(record?.firstPulledAt)}</span>
                </div>
                <div>
                  <span className="text-slate-500">Last Pulled: </span>
                  <span>{formatDate(record?.lastPulledAt)}</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-amber-400/90 font-mono">
                🔒 You have not pulled this beatmap yet. Pull from the gacha pool to add it to your collection!
              </p>
            )}
          </div>

          {/* External Links / osu! Integration */}
          <div className="space-y-2">
            <h4 className="text-xs font-mono uppercase text-slate-400 font-bold tracking-wider">
              Play & Download Beatmap
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <a
                href={osuWebUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl bg-pink-600/90 hover:bg-pink-500 text-white font-semibold text-xs transition-colors shadow-md shadow-pink-600/20"
              >
                <ExternalLink className="w-4 h-4" />
                <span>View on osu! Official</span>
              </a>

              <a
                href={osuDirectUrl}
                className="flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 font-semibold text-xs transition-colors"
              >
                <Download className="w-4 h-4 text-cyan-400" />
                <span>Open in osu!direct</span>
              </a>

              <a
                href={beatconnectUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center space-x-2 py-2 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs transition-colors"
              >
                <span>Beatconnect Mirror</span>
              </a>

              <a
                href={sayobotUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center space-x-2 py-2 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs transition-colors"
              >
                <span>Sayobot Mirror</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
