import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { getMapsetStarRange } from '../data/loader';

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
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-2xl bg-[#141420] border border-slate-700 shadow-2xl overflow-hidden my-8">
        {/* Cover Header Banner */}
        <div className="relative w-full h-48 md:h-60 bg-slate-950 overflow-hidden">
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
              <p className="text-sm font-bold uppercase text-blue-400">{beatmap.status}</p>
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
                {beatmap.rankedDate
                  ? new Date(beatmap.rankedDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
                  : 'N/A'}
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
    </div>
  );
};
