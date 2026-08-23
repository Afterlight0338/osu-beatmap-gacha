import React from 'react';
import { useGacha } from '../context/GachaContext';
import { BeatmapCard } from '../components/BeatmapCard';
import { RARITY_ORDER, RARITY_CONFIGS } from '../gacha/rarity';
import { DEFAULT_RARITY_RATES } from '../gacha/probabilities';
import {
  Trophy,
  Sparkles,
  Layers,
  Star,
  Award,
  BarChart2,
  TrendingUp,
} from 'lucide-react';

export const StatsPage: React.FC = () => {
  const { stats, datasetInfo, history } = useGacha();

  // Compute pull counts by rarity from history
  const pullRarityCounts: Record<string, number> = {
    Common: 0,
    Uncommon: 0,
    Rare: 0,
    Epic: 0,
    Legendary: 0,
    Mythic: 0,
    Divine: 0,
  };

  history.forEach((h) => {
    if (pullRarityCounts[h.rarity] !== undefined) {
      pullRarityCounts[h.rarity]++;
    }
  });

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 pb-16">
      {/* Page Header */}
      <div className="space-y-1 text-center md:text-left">
        <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight font-display">
          COLLECTION STATISTICS
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 font-mono">
          Detailed metrics, rarity distributions, and luck analytics
        </p>
      </div>

      {/* Top Level Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Pulls */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
          <div className="flex items-center space-x-2 text-slate-400 text-xs font-mono">
            <Sparkles className="w-4 h-4 text-pink-400" />
            <span>Total Pulls</span>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-white font-mono">
            {stats.totalPulls.toLocaleString()}
          </p>
        </div>

        {/* Unique Maps Owned */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
          <div className="flex items-center space-x-2 text-slate-400 text-xs font-mono">
            <Trophy className="w-4 h-4 text-amber-400" />
            <span>Unique Owned</span>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-white font-mono">
            {stats.uniqueOwned.toLocaleString()}
          </p>
          <span className="text-[10px] text-slate-500 font-mono">
            of {stats.totalInPool.toLocaleString()} pool maps
          </span>
        </div>

        {/* Total Copies */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
          <div className="flex items-center space-x-2 text-slate-400 text-xs font-mono">
            <Layers className="w-4 h-4 text-purple-400" />
            <span>Total Copies</span>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-purple-300 font-mono">
            {stats.totalCopies.toLocaleString()}
          </p>
          <span className="text-[10px] text-slate-500 font-mono">
            {stats.totalCopies - stats.uniqueOwned} duplicates
          </span>
        </div>

        {/* Average Star Rating */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
          <div className="flex items-center space-x-2 text-slate-400 text-xs font-mono">
            <Star className="w-4 h-4 text-amber-400" />
            <span>Avg Star Rating</span>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-amber-300 font-mono">
            ★ {stats.averageStarRating.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Main Progress Bar Card */}
      <div className="p-5 sm:p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-white uppercase tracking-wider font-mono">
              Overall Completion
            </h2>
            <p className="text-xs text-slate-400 font-sans">
              Percentage of total beatmap pool collected
            </p>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-pink-400 font-mono">
            {stats.completionPercentage}%
          </div>
        </div>

        {/* Progress bar container */}
        <div className="w-full h-4 rounded-full bg-slate-950 border border-slate-800 overflow-hidden p-0.5">
          <div
            className="h-full bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-400 rounded-full transition-all duration-700 shadow-md"
            style={{ width: `${Math.min(100, Math.max(1, stats.completionPercentage))}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-xs font-mono text-slate-400 pt-1">
          <span>{stats.uniqueOwned.toLocaleString()} owned</span>
          <span>{(stats.totalInPool - stats.uniqueOwned).toLocaleString()} remaining</span>
        </div>
      </div>

      {/* Rarity Tier Breakdown & Luck Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Rarity Breakdown */}
        <div className="p-5 sm:p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
          <div className="flex items-center space-x-2">
            <BarChart2 className="w-5 h-5 text-cyan-400" />
            <h2 className="font-bold text-white text-base uppercase tracking-wider font-mono">
              Rarity Tier Breakdown
            </h2>
          </div>

          <div className="space-y-3">
            {RARITY_ORDER.slice().reverse().map((tier) => {
              const config = RARITY_CONFIGS[tier];
              const ownedCount = stats.rarityCounts[tier] || 0;
              const poolTotal = datasetInfo?.rarityCounts[tier] || 1;
              const percent = poolTotal > 0 ? Math.round((ownedCount / poolTotal) * 100) : 0;

              return (
                <div key={tier} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="font-bold" style={{ color: config.color }}>
                      {config.label}
                    </span>
                    <span className="text-slate-300">
                      {ownedCount} / {poolTotal} ({percent}%)
                    </span>
                  </div>

                  <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        backgroundColor: config.color,
                        width: `${Math.min(100, percent)}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pull Rate & Luck Analysis */}
        <div className="p-5 sm:p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-5 h-5 text-pink-400" />
            <h2 className="font-bold text-white text-base uppercase tracking-wider font-mono">
              Pull Rate & Luck Tracking
            </h2>
          </div>

          <div className="space-y-3 text-xs font-mono">
            <div className="grid grid-cols-3 font-bold text-slate-400 border-b border-slate-800 pb-2">
              <span>Tier</span>
              <span className="text-center">Actual %</span>
              <span className="text-right">Expected %</span>
            </div>

            {RARITY_ORDER.slice().reverse().map((tier) => {
              const config = RARITY_CONFIGS[tier];
              const actualPulled = pullRarityCounts[tier] || 0;
              const historyTotal = history.length || 1;
              const actualRate = history.length > 0 ? ((actualPulled / historyTotal) * 100).toFixed(1) : '0.0';
              const expectedRate = (DEFAULT_RARITY_RATES[tier] * 100).toFixed(1);

              return (
                <div key={tier} className="grid grid-cols-3 items-center py-1">
                  <span className="font-bold" style={{ color: config.color }}>
                    {tier}
                  </span>
                  <span className="text-center text-slate-200 font-bold">{actualRate}%</span>
                  <span className="text-right text-slate-500">{expectedRate}%</span>
                </div>
              );
            })}
          </div>

          <p className="text-[11px] text-slate-500 font-sans leading-relaxed border-t border-slate-800 pt-3">
            * Actual rate reflects your logged pulls history. Probabilities are strictly client-side simulation.
          </p>
        </div>
      </div>

      {/* Highlight: Most Duplicated Beatmap */}
      {stats.mostCopiesMap && (
        <div className="p-5 sm:p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
          <div className="flex items-center space-x-2">
            <Award className="w-5 h-5 text-purple-400" />
            <h2 className="font-bold text-white text-base uppercase tracking-wider font-mono">
              Most Pulled Beatmap ({stats.mostCopiesMap.copies} Copies)
            </h2>
          </div>

          <div className="max-w-xs">
            <BeatmapCard
              beatmap={stats.mostCopiesMap.beatmap}
              copies={stats.mostCopiesMap.copies}
              size="md"
            />
          </div>
        </div>
      )}
    </div>
  );
};
