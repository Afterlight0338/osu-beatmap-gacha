import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PullResult } from '../types/gacha';
import { RarityTier } from '../types/beatmap';
import { BeatmapCard } from './BeatmapCard';
import { RarityBadge } from './RarityBadge';
import { RARITY_CONFIGS, compareRarities } from '../gacha/rarity';
import { sfx } from '../audio/sfx';
import confetti from 'canvas-confetti';
import { FastForward, RotateCcw, X, Sparkles, Layers, ChevronRight } from 'lucide-react';

interface PullRevealModalProps {
  results: PullResult[];
  isOpen: boolean;
  onClose: () => void;
  onPullAgain: (count: number) => void;
  onToggleFavorite: (beatmapId: number) => void;
  fastAnimation?: boolean;
}

export const PullRevealModal: React.FC<PullRevealModalProps> = ({
  results,
  isOpen,
  onClose,
  onPullAgain,
  onToggleFavorite,
  fastAnimation = false,
}) => {
  // Phase: 'charging' -> 'revealing' -> 'summary'
  const [phase, setPhase] = useState<'charging' | 'revealing' | 'summary'>('charging');
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isCardFlipped, setIsCardFlipped] = useState<boolean>(false);

  const highestRarity = useMemo<RarityTier>(() => {
    if (results.length === 0) return 'Common';
    return results.reduce((max, r) => (compareRarities(r.beatmap.rarity, max) > 0 ? r.beatmap.rarity : max), results[0].beatmap.rarity);
  }, [results]);

  const highestConfig = RARITY_CONFIGS[highestRarity];

  // Trigger confetti for high rarities
  const triggerCelebration = useCallback((rarity: RarityTier) => {
    if (rarity === 'Divine') {
      confetti({
        particleCount: 150,
        spread: 120,
        origin: { y: 0.6 },
        colors: ['#ff007f', '#7928ca', '#0070f3', '#00dfd8', '#ffdf00', '#ffffff'],
      });
    } else if (rarity === 'Mythic') {
      confetti({
        particleCount: 90,
        spread: 90,
        origin: { y: 0.6 },
        colors: ['#ef4444', '#dc2626', '#f43f5e', '#ffffff'],
      });
    } else if (rarity === 'Legendary') {
      confetti({
        particleCount: 60,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#f59e0b', '#fbbf24', '#fef08a', '#ffffff'],
      });
    }
  }, []);

  // Handle single card flip reveal
  const revealCurrentCard = useCallback((index: number) => {
    if (index >= results.length) {
      setPhase('summary');
      return;
    }

    const currentPull = results[index];
    setIsCardFlipped(false);

    // Play reveal sound
    setTimeout(() => {
      setIsCardFlipped(true);
      sfx.playRarityReveal(currentPull.beatmap.rarity);
      triggerCelebration(currentPull.beatmap.rarity);

      if (!currentPull.isNew) {
        setTimeout(() => sfx.playDuplicateSound(), 200);
      }
    }, fastAnimation ? 50 : 250);
  }, [results, fastAnimation, triggerCelebration]);

  // Start sequence when modal opens or results change
  useEffect(() => {
    if (!isOpen || results.length === 0) return;

    setCurrentIndex(0);
    setIsCardFlipped(false);

    if (fastAnimation) {
      setPhase('summary');
      sfx.playRarityReveal(highestRarity);
      triggerCelebration(highestRarity);
      return;
    }

    setPhase('charging');
    sfx.playSummonCharge();

    const chargeTimer = setTimeout(() => {
      setPhase('revealing');
      revealCurrentCard(0);
    }, 700);

    return () => clearTimeout(chargeTimer);
  }, [isOpen, results, fastAnimation, highestRarity, triggerCelebration, revealCurrentCard]);

  // Next card in multi-pull
  const handleNext = () => {
    sfx.playClick();
    if (currentIndex + 1 < results.length) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      revealCurrentCard(nextIdx);
    } else {
      setPhase('summary');
    }
  };

  // Skip directly to summary
  const handleSkip = () => {
    sfx.playClick();
    setPhase('summary');
    triggerCelebration(highestRarity);
  };

  if (!isOpen || results.length === 0) return null;

  const currentPull = results[currentIndex];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-fade-in overflow-y-auto">
      {/* Top Controls: Skip & Close */}
      <div className="absolute top-4 right-4 z-50 flex items-center space-x-3">
        {phase === 'revealing' && (
          <button
            onClick={handleSkip}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-slate-200 border border-white/20 text-xs font-semibold backdrop-blur-md transition-all duration-200"
          >
            <FastForward className="w-3.5 h-3.5" />
            <span>Skip All</span>
          </button>
        )}
        <button
          onClick={onClose}
          className="p-2 rounded-full bg-white/10 hover:bg-rose-600 text-slate-200 hover:text-white border border-white/20 backdrop-blur-md transition-all duration-200"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* PHASE 1: CHARGING ORB / SUMMON VORTEX */}
      {phase === 'charging' && (
        <div className="flex flex-col items-center justify-center text-center p-8 space-y-6">
          <div className="relative flex items-center justify-center">
            {/* Pulsing Glowing Outer Rings */}
            <div
              className="w-48 h-48 rounded-full border-4 border-dashed animate-spin-slow opacity-60"
              style={{ borderColor: highestConfig.color }}
            />
            <div
              className="absolute w-36 h-36 rounded-full blur-xl animate-pulse-glow"
              style={{ backgroundColor: highestConfig.color }}
            />
            <div
              className="absolute w-24 h-24 rounded-full shadow-2xl flex items-center justify-center bg-radial from-white via-pink-400 to-purple-800 animate-bounce"
            >
              <Sparkles className="w-10 h-10 text-white animate-spin" />
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-black tracking-widest uppercase text-white font-display">
              SUMMONING...
            </h2>
            <p className="text-xs text-slate-400 font-mono">Channeling osu! Beatmap Spirits</p>
          </div>
        </div>
      )}

      {/* PHASE 2: INDIVIDUAL CARD REVEAL */}
      {phase === 'revealing' && currentPull && (
        <div className="flex flex-col items-center justify-center max-w-sm w-full space-y-5 animate-scale-up">
          {/* Progress Indicator for Multi-Pull */}
          {results.length > 1 && (
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono text-slate-400">
                Card {currentIndex + 1} of {results.length}
              </span>
              <div className="flex space-x-1">
                {results.map((_, i) => (
                  <div
                    key={i}
                    className={`w-2 h-2 rounded-full transition-all duration-300 ${
                      i === currentIndex
                        ? 'bg-pink-500 w-4'
                        : i < currentIndex
                        ? 'bg-slate-500'
                        : 'bg-slate-800'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Rarity & Duplicate Alert Banner */}
          <div className="flex flex-col items-center space-y-1 text-center">
            <RarityBadge rarity={currentPull.beatmap.rarity} size="lg" />
            {!currentPull.isNew ? (
              <div className="inline-flex items-center space-x-1 px-3 py-1 rounded-full bg-purple-900/80 border border-purple-400/60 text-purple-200 text-xs font-bold font-mono tracking-wider animate-pulse">
                <Layers className="w-3.5 h-3.5" />
                <span>DUPLICATE • +1 COPY (x{currentPull.currentCopies})</span>
              </div>
            ) : (
              <div className="inline-flex items-center space-x-1 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-400/60 text-emerald-300 text-xs font-bold font-mono tracking-wider">
                <Sparkles className="w-3.5 h-3.5" />
                <span>NEW BEATMAP UNLOCKED!</span>
              </div>
            )}
          </div>

          {/* Card Presentation with 3D Flip */}
          <div
            className={`w-full max-w-xs transition-all duration-500 ${
              isCardFlipped ? 'scale-100 opacity-100' : 'scale-90 opacity-0'
            }`}
          >
            <BeatmapCard
              beatmap={currentPull.beatmap}
              copies={currentPull.currentCopies}
              isNew={currentPull.isNew}
              animateReveal={true}
              onToggleFavorite={() => onToggleFavorite(currentPull.beatmap.id)}
            />
          </div>

          {/* Next / Continue Action */}
          <button
            onClick={handleNext}
            className="w-full max-w-xs py-3 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-bold text-sm tracking-wider uppercase shadow-lg shadow-pink-600/30 flex items-center justify-center space-x-2 transition-all duration-200 hover:scale-[1.02]"
          >
            <span>{currentIndex + 1 < results.length ? 'Next Beatmap' : 'View Results'}</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* PHASE 3: MULTI-PULL / FINAL SUMMARY GRID */}
      {phase === 'summary' && (
        <div className="flex flex-col items-center justify-center max-w-4xl w-full space-y-6 py-6 animate-scale-up">
          {/* Header */}
          <div className="text-center space-y-1">
            <h2 className="text-2xl md:text-3xl font-black text-white uppercase tracking-wider font-display">
              SUMMON RESULTS
            </h2>
            <p className="text-xs md:text-sm text-slate-400 font-mono">
              Pulled {results.length} beatmap{results.length > 1 ? 's' : ''} • Highest Rarity:{' '}
              <span className="font-bold" style={{ color: highestConfig.color }}>
                {highestConfig.label}
              </span>
            </p>
          </div>

          {/* Results Grid */}
          <div
            className={`grid gap-3 md:gap-4 w-full ${
              results.length === 1
                ? 'grid-cols-1 max-w-xs mx-auto'
                : results.length <= 5
                ? 'grid-cols-2 md:grid-cols-3'
                : 'grid-cols-2 md:grid-cols-5'
            }`}
          >
            {results.map((res, idx) => (
              <div key={idx} className="w-full">
                <BeatmapCard
                  beatmap={res.beatmap}
                  copies={res.currentCopies}
                  isNew={res.isNew}
                  size="sm"
                  onToggleFavorite={() => onToggleFavorite(res.beatmap.id)}
                />
              </div>
            ))}
          </div>

          {/* Actions: Pull Again 1x, Pull Again 10x, Close */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-4 border-t border-slate-800 w-full">
            <button
              onClick={() => onPullAgain(1)}
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 font-semibold text-xs md:text-sm flex items-center space-x-2 transition-all hover:scale-105"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Pull 1x Again</span>
            </button>

            <button
              onClick={() => onPullAgain(10)}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-bold text-xs md:text-sm shadow-lg shadow-pink-600/30 flex items-center space-x-2 transition-all hover:scale-105"
            >
              <Sparkles className="w-4 h-4" />
              <span>Pull 10x Again</span>
            </button>

            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 font-semibold text-xs md:text-sm transition-all"
            >
              Done / Return
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
