import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useGacha } from '../context/GachaContext';
import { RarityBadge } from './RarityBadge';
import { BeatmapCoverImage } from './BeatmapCoverImage';
import { Beatmap } from '../types/beatmap';
import { X, History } from 'lucide-react';

interface PullHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectBeatmap: (beatmap: Beatmap) => void;
}

export const PullHistoryModal: React.FC<PullHistoryModalProps> = ({
  isOpen,
  onClose,
  onSelectBeatmap,
}) => {
  const { history } = useGacha();

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return createPortal(
    <div className="fixed inset-0 z-[9998] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-t-3xl sm:rounded-2xl bg-[#141420] border-t sm:border border-slate-700 shadow-2xl overflow-hidden max-h-[88vh] flex flex-col my-0 sm:my-8 animate-slide-up sm:animate-scale-up">
        {/* Mobile Drag Pill */}
        <div className="sm:hidden flex justify-center pt-2 pb-1 bg-slate-900/60">
          <div className="w-10 h-1 rounded-full bg-slate-600/80" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-900/60 flex-shrink-0">
          <div className="flex items-center space-x-2.5">
            <History className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-bold text-white font-display">Pull History</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* History List */}
        <div className="p-4 max-h-[70vh] overflow-y-auto space-y-2">
          {history.length === 0 ? (
            <div className="text-center py-12 text-slate-500 font-mono text-sm">
              No pulls recorded yet. Perform your first summon!
            </div>
          ) : (
            history.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  onSelectBeatmap(item.beatmap);
                  onClose();
                }}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-900/70 hover:bg-slate-800/90 border border-slate-800/80 transition-all cursor-pointer group"
              >
                {/* Thumbnail & Title */}
                <div className="flex items-center space-x-3 min-w-0">
                  <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-slate-950">
                    <BeatmapCoverImage
                      beatmap={item.beatmap}
                      alt={item.beatmap.title}
                      className="w-full h-full"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-slate-200 group-hover:text-pink-400 transition-colors truncate">
                      {item.beatmap.title}
                    </p>
                    <p className="text-xs text-slate-400 truncate">
                      {item.beatmap.artist} • [{item.beatmap.version}]
                    </p>
                  </div>
                </div>

                {/* Badges & Date */}
                <div className="flex items-center space-x-3 flex-shrink-0">
                  <div className="flex flex-col items-end space-y-1">
                    <RarityBadge rarity={item.beatmap.rarity} size="sm" showStars={false} />
                    <span className="text-[10px] font-mono text-slate-500">
                      {formatDate(item.pulledAt)}
                    </span>
                  </div>

                  {item.isNew ? (
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-500/50 px-1.5 py-0.5 rounded">
                      NEW
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-purple-400 bg-purple-950/80 border border-purple-500/50 px-1.5 py-0.5 rounded">
                      DUP
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
