import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { PullResult } from '../types/gacha';
import { RarityTier } from '../types/beatmap';
import { BeatmapCard } from './BeatmapCard';
import { RarityBadge } from './RarityBadge';
import { RARITY_CONFIGS, compareRarities } from '../gacha/rarity';
import { sfx } from '../audio/sfx';
import { previewPlayer } from '../audio/previewPlayer';
import confetti from 'canvas-confetti';
import { FastForward, RotateCcw, X, Sparkles, Layers, ChevronRight, Crown, Star, Flame, Zap } from 'lucide-react';

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
  const [isAnticipating, setIsAnticipating] = useState<boolean>(false);
  const [screenShake, setScreenShake] = useState<string>('');
  const [showFlashBang, setShowFlashBang] = useState<boolean>(false);

  const anticipationTimerRef = useRef<NodeJS.Timeout | null>(null);

  const highestRarity = useMemo<RarityTier>(() => {
    if (results.length === 0) return 'Common';
    return results.reduce(
      (max, r) => (compareRarities(r.beatmap.rarity, max) > 0 ? r.beatmap.rarity : max),
      results[0].beatmap.rarity
    );
  }, [results]);

  const highestConfig = RARITY_CONFIGS[highestRarity];

  // Trigger confetti for high rarities
  const triggerCelebration = useCallback((rarity: RarityTier) => {
    if (rarity === 'GOAT') {
      confetti({
        particleCount: 260,
        spread: 160,
        origin: { y: 0.55 },
        colors: ['#ffd700', '#ff007f', '#7928ca', '#00dfd8', '#0070f3', '#ffffff', '#ff66aa'],
      });
    } else if (rarity === 'Divine') {
      confetti({
        particleCount: 200,
        spread: 140,
        origin: { y: 0.6 },
        colors: ['#ec4899', '#f43f5e', '#a855f7', '#ffd700', '#ffffff'],
      });
    } else if (rarity === 'Celestial') {
      confetti({
        particleCount: 150,
        spread: 110,
        origin: { y: 0.6 },
        colors: ['#06b6d4', '#38bdf8', '#818cf8', '#ffffff', '#2dd4bf'],
      });
    } else if (rarity === 'Mythic') {
      confetti({
        particleCount: 100,
        spread: 90,
        origin: { y: 0.6 },
        colors: ['#ef4444', '#dc2626', '#f43f5e', '#f97316', '#ffffff'],
      });
    } else if (rarity === 'Legendary') {
      confetti({
        particleCount: 65,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#ef4444', '#f87171', '#fca5a5', '#ffd700', '#ffffff'],
      });
    }
  }, []);

  // Handle single card flip reveal with tiered dramatic anticipation
  const revealCurrentCard = useCallback(
    (index: number) => {
      if (index >= results.length) {
        setPhase('summary');
        return;
      }

      if (anticipationTimerRef.current) {
        clearTimeout(anticipationTimerRef.current);
      }

      const currentPull = results[index];
      const rarity = currentPull.beatmap.rarity;
      setIsCardFlipped(false);
      setShowFlashBang(false);

      if (fastAnimation) {
        setIsAnticipating(false);
        setIsCardFlipped(true);
        sfx.playRarityReveal(rarity);
        triggerCelebration(rarity);
        if (!currentPull.isNew) setTimeout(() => sfx.playDuplicateSound(), 150);
        return;
      }

      const isHighTier =
        rarity === 'Legendary' ||
        rarity === 'Mythic' ||
        rarity === 'Celestial' ||
        rarity === 'Divine' ||
        rarity === 'GOAT';

      if (isHighTier) {
        setIsAnticipating(true);
        sfx.playSummonCharge();

        // Tiered anticipation duration
        const delay =
          rarity === 'GOAT'
            ? 1700
            : rarity === 'Divine'
            ? 1350
            : rarity === 'Celestial'
            ? 1100
            : rarity === 'Mythic'
            ? 850
            : 600; // Legendary

        anticipationTimerRef.current = setTimeout(() => {
          setIsAnticipating(false);
          setShowFlashBang(true);
          setScreenShake(
            rarity === 'GOAT' || rarity === 'Divine' || rarity === 'Mythic'
              ? 'animate-shake-heavy'
              : 'animate-shake-light'
          );

          setTimeout(() => {
            setIsCardFlipped(true);
            sfx.playRarityReveal(rarity);
            triggerCelebration(rarity);
            if (!currentPull.isNew) setTimeout(() => sfx.playDuplicateSound(), 250);
          }, 80);

          setTimeout(() => {
            setScreenShake('');
            setShowFlashBang(false);
          }, 700);
        }, delay);
      } else {
        // Snappy reveal for lower tiers
        setIsAnticipating(false);
        anticipationTimerRef.current = setTimeout(() => {
          setIsCardFlipped(true);
          sfx.playRarityReveal(rarity);
          triggerCelebration(rarity);
          if (!currentPull.isNew) setTimeout(() => sfx.playDuplicateSound(), 200);
        }, 220);
      }
    },
    [results, fastAnimation, triggerCelebration]
  );

  // Start sequence when modal opens or results change
  useEffect(() => {
    if (!isOpen || results.length === 0) return;

    setCurrentIndex(0);
    setIsCardFlipped(false);
    setIsAnticipating(false);
    setScreenShake('');
    setShowFlashBang(false);

    if (fastAnimation) {
      setPhase('summary');
      sfx.playRarityReveal(highestRarity);
      triggerCelebration(highestRarity);
      return;
    }

    setPhase('charging');
    sfx.playSummonCharge();

    // Longer initial summoning vortex duration (1.8s)
    const chargeTimer = setTimeout(() => {
      setPhase('revealing');
      revealCurrentCard(0);
    }, 1800);

    return () => {
      clearTimeout(chargeTimer);
      if (anticipationTimerRef.current) clearTimeout(anticipationTimerRef.current);
    };
  }, [isOpen, results, fastAnimation, highestRarity, triggerCelebration, revealCurrentCard]);

  // Next card in multi-pull
  const handleNext = () => {
    previewPlayer.pause();
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
    if (anticipationTimerRef.current) clearTimeout(anticipationTimerRef.current);
    previewPlayer.pause();
    sfx.playClick();
    setIsAnticipating(false);
    setPhase('summary');
    triggerCelebration(highestRarity);
  };

  const handleClose = () => {
    if (anticipationTimerRef.current) clearTimeout(anticipationTimerRef.current);
    previewPlayer.pause();
    onClose();
  };

  const handlePullAgain = (count: number) => {
    if (anticipationTimerRef.current) clearTimeout(anticipationTimerRef.current);
    previewPlayer.pause();
    onPullAgain(count);
  };

  if (!isOpen || results.length === 0) return null;

  const currentPull = results[currentIndex];
  const currentRarity = currentPull?.beatmap.rarity || 'Common';

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-2xl animate-fade-in overflow-y-auto ${screenShake}`}
    >
      {/* Blinding Flashbang Effect on high-rarity drop */}
      {showFlashBang && (
        <div className="fixed inset-0 z-[60] bg-white pointer-events-none animate-flash-bang" />
      )}

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
          onClick={handleClose}
          className="p-2 rounded-full bg-white/10 hover:bg-rose-600 text-slate-200 hover:text-white border border-white/20 backdrop-blur-md transition-all duration-200"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* PHASE 1: CHARGING ORB / DRAMATIC MULTI-RING SUMMON VORTEX */}
      {phase === 'charging' && (
        <div className="flex flex-col items-center justify-center text-center p-8 space-y-8 animate-scale-up">
          <div className="relative flex items-center justify-center">
            {/* Outer Rotating Cosmic Halo 1 */}
            <div
              className="w-64 h-64 sm:w-72 sm:h-72 rounded-full border-2 border-dashed animate-vortex-slow opacity-60 pointer-events-none"
              style={{ borderColor: highestConfig.color }}
            />
            {/* Middle Rotating Geometric Ring 2 */}
            <div
              className="absolute w-52 h-52 sm:w-56 sm:h-56 rounded-full border-4 border-dotted animate-reverse-spin opacity-70 pointer-events-none"
              style={{ borderColor: highestConfig.glowColor }}
            />
            {/* Core Energy Aura */}
            <div
              className="absolute w-40 h-40 sm:w-44 sm:h-44 rounded-full blur-2xl animate-pulse-glow"
              style={{ backgroundColor: highestConfig.color }}
            />
            {/* Center Glowing Core */}
            <div className="absolute w-28 h-28 sm:w-32 sm:h-32 rounded-full shadow-2xl flex items-center justify-center bg-gradient-to-tr from-purple-900 via-pink-500 to-amber-300 animate-pulse border-2 border-white/80">
              <Sparkles className="w-12 h-12 text-white animate-spin" />
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-2xl sm:text-3xl font-black tracking-widest uppercase text-white font-display">
              {highestRarity === 'GOAT' ? (
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-pink-400 to-cyan-400 animate-pulse">
                  ✦ REALITY SINGULARITY DETECTED ✦
                </span>
              ) : highestRarity === 'Divine' ? (
                <span className="text-pink-300 drop-shadow-[0_0_20px_#ec4899]">
                  ✦ DIVINE SANCTUARY DESCENDING ✦
                </span>
              ) : highestRarity === 'Celestial' ? (
                <span className="text-cyan-300 drop-shadow-[0_0_20px_#06b6d4]">
                  ✦ ASTRAL CONSTELLATION AWAKENS ✦
                </span>
              ) : highestRarity === 'Mythic' ? (
                <span className="text-rose-400 drop-shadow-[0_0_20px_#f43f5e]">
                  ✦ INFERNAL FLAMES RISING ✦
                </span>
              ) : highestRarity === 'Legendary' ? (
                <span className="text-red-400 drop-shadow-[0_0_15px_#ef4444]">
                  ✦ LEGENDARY ECHO RESONATING ✦
                </span>
              ) : (
                <span>SUMMONING BEATMAPS...</span>
              )}
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 font-mono">
              Channeling the global osu! beatmap pool
            </p>
          </div>
        </div>
      )}

      {/* PHASE 2: INDIVIDUAL CARD REVEAL */}
      {phase === 'revealing' && currentPull && (
        <div className="relative flex flex-col items-center justify-center max-w-sm w-full space-y-5 animate-scale-up z-10">
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

          {/* High Rarity Anticipation Charged Orb (shown before card turns for Legendary+) */}
          {isAnticipating ? (
            <div className="relative flex flex-col items-center justify-center py-10 space-y-6 animate-scale-up w-full">
              {/* GOAT: Rainbow Supernova Singularity */}
              {currentRarity === 'GOAT' && (
                <div className="relative flex items-center justify-center">
                  <div className="w-64 h-64 rounded-full border-4 border-dashed border-yellow-400 animate-vortex-fast animate-divine-rainbow opacity-80" />
                  <div className="absolute w-48 h-48 rounded-full blur-2xl bg-gradient-to-r from-yellow-400 via-pink-500 to-cyan-400 animate-pulse-glow" />
                  <div className="absolute w-28 h-28 rounded-full bg-white shadow-[0_0_50px_#ffd700] flex items-center justify-center animate-spin">
                    <Crown className="w-14 h-14 text-yellow-500" />
                  </div>
                </div>
              )}

              {/* Divine: Sacred Geometry God Rays */}
              {currentRarity === 'Divine' && (
                <div className="relative flex items-center justify-center">
                  <div className="w-60 h-60 rounded-full border-4 border-pink-400 animate-reverse-spin opacity-80" />
                  <div className="absolute w-44 h-44 rounded-full blur-2xl bg-pink-600/90 animate-pulse-glow" />
                  <div className="absolute w-24 h-24 rounded-full bg-gradient-to-tr from-pink-500 via-purple-400 to-cyan-300 shadow-[0_0_40px_#ec4899] flex items-center justify-center animate-bounce">
                    <Sparkles className="w-12 h-12 text-white" />
                  </div>
                </div>
              )}

              {/* Celestial: Astral Constellation */}
              {currentRarity === 'Celestial' && (
                <div className="relative flex items-center justify-center">
                  <div className="w-56 h-56 rounded-full border-2 border-cyan-400 animate-vortex-fast opacity-75" />
                  <div className="absolute w-40 h-40 rounded-full blur-2xl bg-cyan-500/80 animate-pulse-glow" />
                  <div className="absolute w-20 h-20 rounded-full bg-gradient-to-br from-cyan-400 to-indigo-600 shadow-[0_0_35px_#06b6d4] flex items-center justify-center">
                    <Star className="w-10 h-10 text-white animate-spin" />
                  </div>
                </div>
              )}

              {/* Mythic: Raging Flame Vortex */}
              {currentRarity === 'Mythic' && (
                <div className="relative flex items-center justify-center">
                  <div className="w-52 h-52 rounded-full border-4 border-dotted border-rose-500 animate-vortex-fast opacity-80" />
                  <div className="absolute w-36 h-36 rounded-full blur-xl bg-rose-600/90 animate-pulse-glow" />
                  <div className="absolute w-20 h-20 rounded-full bg-gradient-to-tr from-red-600 via-rose-500 to-amber-400 shadow-[0_0_30px_#f43f5e] flex items-center justify-center animate-pulse">
                    <Flame className="w-10 h-10 text-white" />
                  </div>
                </div>
              )}

              {/* Legendary: Crimson Pulse */}
              {currentRarity === 'Legendary' && (
                <div className="relative flex items-center justify-center">
                  <div className="w-48 h-48 rounded-full border-2 border-red-500 animate-vortex-slow opacity-80" />
                  <div className="absolute w-32 h-32 rounded-full blur-lg bg-red-600/80 animate-pulse-glow" />
                  <div className="absolute w-16 h-16 rounded-full bg-red-600 shadow-[0_0_25px_#ef4444] flex items-center justify-center">
                    <Zap className="w-8 h-8 text-white animate-bounce" />
                  </div>
                </div>
              )}

              <div className="text-center space-y-1">
                <span className="text-xs font-mono font-black uppercase tracking-widest text-amber-300 animate-pulse">
                  ⚡ HIGH-ENERGY FREQUENCY CONVERGING...
                </span>
              </div>
            </div>
          ) : (
            <>
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

              {/* Card Presentation with 3D Flip & Tiered Halo Auras */}
              <div className="relative w-full max-w-xs flex items-center justify-center">
                {/* Ambient Aura for High Rarities */}
                {isCardFlipped &&
                  (currentRarity === 'GOAT' ||
                    currentRarity === 'Divine' ||
                    currentRarity === 'Celestial' ||
                    currentRarity === 'Mythic' ||
                    currentRarity === 'Legendary') && (
                    <div
                      className={`absolute -inset-4 rounded-3xl blur-2xl opacity-60 pointer-events-none transition-all duration-1000 ${
                        currentRarity === 'GOAT' ? 'animate-divine-rainbow' : 'animate-pulse-glow'
                      }`}
                      style={{ backgroundColor: RARITY_CONFIGS[currentRarity].color }}
                    />
                  )}

                <div
                  className={`w-full transition-all duration-500 relative z-10 ${
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
              </div>

              {/* Next / Continue Action */}
              <button
                onClick={handleNext}
                className="w-full max-w-xs py-3.5 rounded-xl bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 hover:from-pink-500 hover:via-purple-500 hover:to-indigo-500 text-white font-bold text-sm tracking-wider uppercase shadow-lg shadow-pink-600/30 flex items-center justify-center space-x-2 transition-all duration-200 hover:scale-[1.02]"
              >
                <span>{currentIndex + 1 < results.length ? 'Next Beatmap' : 'View Results'}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      )}

      {/* PHASE 3: MULTI-PULL / FINAL SUMMARY GRID */}
      {phase === 'summary' && (
        <div className="flex flex-col items-center justify-center max-w-5xl w-full space-y-6 py-6 animate-scale-up">
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

          {/* Results Grid with Optimized Responsive Sizing */}
          <div
            className={`grid gap-3 w-full ${
              results.length === 1
                ? 'grid-cols-1 max-w-xs mx-auto'
                : results.length === 5
                ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 max-w-5xl'
                : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 max-w-6xl'
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

          {/* Actions: Pull Again 1x, 5x, 10x, Close */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-4 border-t border-slate-800 w-full">
            <button
              onClick={() => handlePullAgain(1)}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 font-semibold text-xs flex items-center space-x-1.5 transition-all hover:scale-105"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Pull 1x (⚡1)</span>
            </button>

            <button
              onClick={() => handlePullAgain(5)}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-800 to-indigo-800 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-xs border border-purple-500/60 flex items-center space-x-1.5 transition-all hover:scale-105 shadow-md shadow-purple-900/30"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-300" />
              <span>Pull 5x (⚡5)</span>
            </button>

            <button
              onClick={() => handlePullAgain(10)}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-pink-600/30 flex items-center space-x-1.5 transition-all hover:scale-105"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Pull 10x (⚡10)</span>
            </button>

            <button
              onClick={handleClose}
              className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 font-semibold text-xs transition-all"
            >
              Done / Return
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
