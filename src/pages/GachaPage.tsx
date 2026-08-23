import React, { useState } from 'react';
import { useGacha } from '../context/GachaContext';
import { BannerView } from '../components/BannerView';
import { GachaControls } from '../components/GachaControls';
import { BeatmapCard } from '../components/BeatmapCard';
import { PullRevealModal } from '../components/PullRevealModal';
import { BeatmapDetailModal } from '../components/BeatmapDetailModal';
import { PullResult } from '../types/gacha';
import { Beatmap } from '../types/beatmap';
import { Sparkles, Trophy } from 'lucide-react';

export const GachaPage: React.FC = () => {
  const {
    pull,
    stats,
    recentPulls,
    setActiveBanner,
    toggleFavorite,
    collectionMap,
    settings,
  } = useGacha();

  const [isPulling, setIsPulling] = useState<boolean>(false);
  const [modalResults, setModalResults] = useState<PullResult[]>([]);
  const [isRevealOpen, setIsRevealOpen] = useState<boolean>(false);
  const [selectedMapForDetail, setSelectedMapForDetail] = useState<Beatmap | null>(null);

  const handleExecutePull = async (count: number) => {
    if (isPulling) return;
    setIsPulling(true);
    try {
      const results = await pull(count);
      setModalResults(results);
      setIsRevealOpen(true);
    } catch (err: any) {
      console.error('Pull execution error:', err);
    } finally {
      setIsPulling(false);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8 pb-12">
      {/* Banner Showcase */}
      <BannerView onSelectBanner={setActiveBanner} />

      {/* Main Gacha Controls */}
      <div className="py-2">
        <GachaControls onPull={handleExecutePull} isPulling={isPulling} />
      </div>

      {/* Collection Quick Status Bar */}
      <div className="p-4 md:p-5 rounded-2xl bg-slate-900/70 border border-slate-800 backdrop-blur-md flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-4 w-full md:w-auto">
          <div className="p-3 rounded-xl bg-pink-600/20 border border-pink-500/40 text-pink-400">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-bold text-slate-100 text-sm md:text-base">
                Collection Progress: {stats.uniqueOwned.toLocaleString()} / {stats.totalInPool.toLocaleString()}
              </h3>
              <span className="font-mono text-xs font-bold text-pink-400">
                ({stats.completionPercentage}%)
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Total Pulls: <span className="font-bold text-slate-200">{stats.totalPulls}</span> • Duplicates: <span className="font-bold text-purple-300">{stats.totalCopies - stats.uniqueOwned}</span>
            </p>
          </div>
        </div>

        {/* Mini progress bar */}
        <div className="w-full md:w-64 h-3 rounded-full bg-slate-950 border border-slate-800 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-400 transition-all duration-500 rounded-full"
            style={{ width: `${Math.min(100, Math.max(1, stats.completionPercentage))}%` }}
          />
        </div>
      </div>

      {/* Recent Pulls Section */}
      {recentPulls.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-pink-400" />
              <h2 className="font-bold text-slate-200 text-sm uppercase tracking-wider font-mono">
                Recent Pulls
              </h2>
            </div>
            <span className="text-xs font-mono text-slate-500">Last {recentPulls.length} items</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {recentPulls.slice(0, 4).map((r, i) => (
              <BeatmapCard
                key={i}
                beatmap={r.beatmap}
                copies={r.currentCopies}
                isNew={r.isNew}
                size="sm"
                onCardClick={() => setSelectedMapForDetail(r.beatmap)}
                onToggleFavorite={() => toggleFavorite(r.beatmap.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Reveal Modal */}
      <PullRevealModal
        isOpen={isRevealOpen}
        results={modalResults}
        onClose={() => setIsRevealOpen(false)}
        onPullAgain={(count) => handleExecutePull(count)}
        onToggleFavorite={toggleFavorite}
        fastAnimation={settings.fastAnimation}
      />

      {/* Detail Modal */}
      <BeatmapDetailModal
        beatmap={selectedMapForDetail}
        record={selectedMapForDetail ? collectionMap.get(selectedMapForDetail.id) : undefined}
        isOpen={selectedMapForDetail !== null}
        onClose={() => setSelectedMapForDetail(null)}
        onToggleFavorite={toggleFavorite}
      />
    </div>
  );
};
