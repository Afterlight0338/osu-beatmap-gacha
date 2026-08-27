import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Target,
  RefreshCw,
  Zap,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Play,
  Pause,
  Clock,
  Award,
  ShieldCheck,
  Trash2,
  Crown,
  Flame,
  Package,
  Sparkles,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useGacha } from '../context/GachaContext';
import { useAuth } from '../context/AuthContext';
import { sfx } from '../audio/sfx';
import { previewPlayer } from '../audio/previewPlayer';
import { Bounty, ActiveBounty, CompletedBounty, BountyDifficulty, OsuScoreData, BountyPack, CompletedPackRecord } from '../types/bounty';
import {
  generateRandomBounties,
  loadSavedBounties,
  saveAvailableBounties,
  loadActiveBounty,
  saveActiveBounty,
  loadCompletedBounties,
  saveCompletedBounty,
  loadClaimedScoreIds,
  fetchBossBounties,
  fetchBountyPacks,
  loadCompletedPacks,
  saveCompletedPack,
} from '../services/bountyService';
import { fetchScoreDetails, verifyScoreForBounty, formatRankDisplay } from '../services/scoreService';

interface BountiesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DIFFICULTY_STYLES: Record<
  BountyDifficulty,
  { badge: string; text: string; border: string; glow: string }
> = {
  Beginner: {
    badge: 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
    glow: 'shadow-emerald-950/40',
  },
  Intermediate: {
    badge: 'bg-cyan-950/80 text-cyan-300 border-cyan-500/40',
    text: 'text-cyan-400',
    border: 'border-cyan-500/30',
    glow: 'shadow-cyan-950/40',
  },
  Advanced: {
    badge: 'bg-purple-950/80 text-purple-300 border-purple-500/40',
    text: 'text-purple-400',
    border: 'border-purple-500/30',
    glow: 'shadow-purple-950/40',
  },
  Expert: {
    badge: 'bg-rose-950/80 text-rose-300 border-rose-500/40',
    text: 'text-rose-400',
    border: 'border-rose-500/30',
    glow: 'shadow-rose-950/40',
  },
  Master: {
    badge: 'bg-amber-950/80 text-amber-300 border-amber-500/40',
    text: 'text-amber-400',
    border: 'border-amber-500/30',
    glow: 'shadow-amber-950/40',
  },
  Boss: {
    badge: 'bg-gradient-to-r from-red-950 via-rose-950 to-amber-950 text-amber-300 border-red-500/80 shadow-md shadow-red-500/20',
    text: 'text-amber-300 font-black',
    border: 'border-red-500/60 shadow-lg shadow-red-950/50',
    glow: 'shadow-red-950/60',
  },
};

export const BountiesModal: React.FC<BountiesModalProps> = ({ isOpen, onClose }) => {
  const { pool, addBonusEnergy } = useGacha();
  const { user, isAuthenticated, loginWithOsu } = useAuth();

  const [bounties, setBounties] = useState<Bounty[]>([]);
  const [bossBounties, setBossBounties] = useState<Bounty[]>([]);
  const [bountyPacks, setBountyPacks] = useState<BountyPack[]>([]);
  const [completedPacks, setCompletedPacks] = useState<CompletedPackRecord[]>([]);
  const [activeBounty, setActiveBounty] = useState<ActiveBounty | null>(null);
  const [completedBounties, setCompletedBounties] = useState<CompletedBounty[]>([]);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('All');
  const [activeTab, setActiveTab] = useState<'bounties' | 'packs' | 'history'>('bounties');

  // Verification Form State
  const [scoreInput, setScoreInput] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifySuccess, setVerifySuccess] = useState<{
    score: OsuScoreData;
    reward: number;
    packBonus?: { stamina: number; points: number; title: string };
  } | null>(null);

  // Audio Preview State
  const [playingSetId, setPlayingSetId] = useState<number | null>(null);

  useEffect(() => {
    const unsub = previewPlayer.subscribe((isPlaying, setId) => {
      setPlayingSetId(isPlaying ? setId : null);
    });
    return unsub;
  }, []);

  // Time elapsed state for active bounty
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  // Initialize and load saved state
  useEffect(() => {
    if (!isOpen) return;

    // Load Boss Bounties & Bounty Packs from Supabase
    fetchBossBounties().then((bosses) => {
      if (bosses) setBossBounties(bosses);
    });
    fetchBountyPacks().then((packs) => {
      if (packs) setBountyPacks(packs.filter((p) => p.active !== false));
    });
    setCompletedPacks(loadCompletedPacks());

    const saved = loadSavedBounties();
    if (saved && saved.length > 0) {
      setBounties(saved);
    } else if (pool.length > 0) {
      const generated = generateRandomBounties(pool, 10);
      setBounties(generated);
      saveAvailableBounties(generated);
    }

    setActiveBounty(loadActiveBounty());
    setCompletedBounties(loadCompletedBounties());
  }, [isOpen, pool]);

  // Live Timer for Active Bounty
  useEffect(() => {
    if (!activeBounty) {
      setElapsedSeconds(0);
      return;
    }

    const updateTimer = () => {
      const sec = Math.floor((Date.now() - activeBounty.startedAt) / 1000);
      setElapsedSeconds(Math.max(0, sec));
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [activeBounty]);

  // Handle Modal Body Scroll Lock
  useEffect(() => {
    if (isOpen) {
      const original = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = original;
        previewPlayer.pause();
      };
    }
  }, [isOpen]);

  const handleRerollBounties = () => {
    sfx.playClick();
    if (pool.length === 0) return;
    const newBounties = generateRandomBounties(pool, 10);
    setBounties(newBounties);
    saveAvailableBounties(newBounties);
    setVerifyError(null);
  };

  const handleAcceptBounty = (bounty: Bounty) => {
    if (!isAuthenticated || !user?.osuId) {
      sfx.playClick();
      alert('You must be logged in with your osu! account to accept bounties and claim stamina rewards!');
      return;
    }
    sfx.playSummonCharge();
    const newActive: ActiveBounty = {
      bounty,
      startedAt: Date.now(),
    };
    setActiveBounty(newActive);
    saveActiveBounty(newActive);
    setScoreInput('');
    setVerifyError(null);
    setVerifySuccess(null);
  };

  const handleAbandonBounty = () => {
    sfx.playClick();
    if (window.confirm('Are you sure you want to abandon this active bounty?')) {
      setActiveBounty(null);
      saveActiveBounty(null);
      setVerifyError(null);
      setVerifySuccess(null);
    }
  };

  const handleToggleAudio = (setId: number, previewUrl?: string) => {
    previewPlayer.toggle(setId, previewUrl);
  };

  const handleVerifyScore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBounty || !scoreInput.trim()) return;

    if (!isAuthenticated || !user?.osuId) {
      setVerifyError('You must be logged in with your osu! account to verify and submit scores.');
      sfx.playClick();
      return;
    }

    setIsVerifying(true);
    setVerifyError(null);
    setVerifySuccess(null);

    try {
      // 1. Fetch score from osu! via Worker API
      const score = await fetchScoreDetails(scoreInput.trim());

      // 2. Validate against active bounty criteria
      const claimedIds = loadClaimedScoreIds();
      const result = verifyScoreForBounty(
        score,
        activeBounty.bounty,
        activeBounty.startedAt,
        user?.osuId,
        user?.username,
        claimedIds
      );

      if (!result.valid) {
        setVerifyError(result.error || 'Score verification failed.');
        sfx.playClick();
        return;
      }

      // 3. Score is VALID! Award 50 Stamina!
      sfx.playRarityReveal('Legendary');
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#00ffff', '#ec4899', '#eab308', '#22c55e'],
      });

      const rewardAmount = activeBounty.bounty.rewardStamina || 50;
      const rewardPts = activeBounty.bounty.rewardPoints || 25;
      await addBonusEnergy(rewardAmount);

      // 4. Save to Completed Bounties
      const completed: CompletedBounty = {
        id: `comp-${Date.now()}`,
        bountyId: activeBounty.bounty.id,
        beatmapId: activeBounty.bounty.beatmap.id,
        beatmapTitle: activeBounty.bounty.beatmap.title,
        beatmapArtist: activeBounty.bounty.beatmap.artist,
        beatmapVersion: activeBounty.bounty.beatmap.version,
        stars: activeBounty.bounty.beatmap.stars,
        difficulty: activeBounty.bounty.difficulty,
        scoreId: score.id,
        scoreRank: score.rank,
        scoreAccuracy: score.accuracy,
        scoreMods: score.mods,
        scorePp: score.pp,
        completedAt: Date.now(),
        rewardStamina: rewardAmount,
        rewardPoints: rewardPts,
        isBoss: activeBounty.bounty.isBoss,
        bossReason: activeBounty.bounty.bossReason,
        packId: activeBounty.bounty.packId,
      };

      await saveCompletedBounty(
        completed,
        user ? { osuId: user.osuId, username: user.username, avatarUrl: user.avatarUrl } : undefined
      );
      setCompletedBounties((prev) => [completed, ...prev]);

      // 5. Check if completing this bounty finished a Bounty Pack!
      let packBonusInfo: { stamina: number; points: number; title: string } | undefined;
      if (activeBounty.bounty.packId) {
        const pack = bountyPacks.find((p) => p.id === activeBounty.bounty.packId);
        if (pack) {
          const allCompletedScores = [completed, ...completedBounties];
          const packMapsCompleted = pack.bounties.every((pb) =>
            allCompletedScores.some((c) => c.beatmapId === pb.beatmap.id)
          );
          const alreadyClaimed = completedPacks.some((cp) => cp.packId === pack.id);

          if (packMapsCompleted && !alreadyClaimed) {
            const packRecord: CompletedPackRecord = {
              packId: pack.id,
              completedAt: Date.now(),
              bonusStamina: pack.bonusRewardStamina || 500,
              bonusPoints: pack.bonusRewardPoints || 500,
            };
            saveCompletedPack(packRecord);
            setCompletedPacks((prev) => [packRecord, ...prev]);
            await addBonusEnergy(pack.bonusRewardStamina || 500);
            packBonusInfo = {
              stamina: pack.bonusRewardStamina || 500,
              points: pack.bonusRewardPoints || 500,
              title: pack.title,
            };
          }
        }
      }

      setVerifySuccess({
        score,
        reward: rewardAmount,
        packBonus: packBonusInfo,
      });

      // Clear active bounty & replace from pool
      setActiveBounty(null);
      saveActiveBounty(null);
      setScoreInput('');

      // Replace completed bounty in the 10-bounty board
      setBounties((prev) => {
        const remaining = prev.filter((b) => b.id !== activeBounty.bounty.id);
        const [fresh] = generateRandomBounties(pool, 1);
        const updated = fresh ? [...remaining, fresh] : remaining;
        saveAvailableBounties(updated);
        return updated;
      });
    } catch (err: any) {
      setVerifyError(err.message || 'An error occurred while verifying your score.');
    } finally {
      setIsVerifying(false);
    }
  };

  const formatElapsedTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s < 10 ? '0' : ''}${s}s`;
  };

  const filteredBounties = useMemo(() => {
    if (selectedDifficulty === 'All') return bounties;
    return bounties.filter((b) => b.difficulty === selectedDifficulty);
  }, [bounties, selectedDifficulty]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-xl animate-fade-in">
      <div className="relative w-full max-w-5xl max-h-[92vh] rounded-3xl bg-[#0c0c16] border border-cyan-500/30 shadow-2xl shadow-cyan-950/50 flex flex-col overflow-hidden animate-scale-up">
        {/* Top Glowing Header Accent */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-cyan-500 via-pink-500 to-amber-500" />

        {/* Modal Header */}
        <div className="p-4 sm:p-6 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/60 flex-shrink-0">
          <div className="flex items-center space-x-3.5">
            <div className="p-2.5 rounded-2xl bg-cyan-950/80 border border-cyan-500/40 text-cyan-400 shadow-lg shadow-cyan-950/50">
              <Target className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg sm:text-2xl font-black text-white font-display tracking-tight flex items-center space-x-2">
                  <span>osu! Beatmap Bounties</span>
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-mono text-[10px] font-bold">
                  {activeBounty ? `+${activeBounty.bounty.rewardStamina} ⚡ (+${activeBounty.bounty.rewardPoints} Pts)` : '25–200 ⚡'}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-sans hidden sm:block">
                Pick a bounty, play it in osu!, and verify your score link to claim instant stamina!
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                sfx.playClick();
                onClose();
              }}
              className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Unauthenticated Login Prompt Banner */}
          {!isAuthenticated && (
            <div className="p-4 rounded-2xl bg-amber-950/80 border border-amber-500/60 text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg shadow-amber-950/40 animate-fade-in">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-amber-900/80 text-amber-300 flex-shrink-0">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-white font-display text-sm">
                    Login Required for Bounties
                  </h4>
                  <p className="text-xs text-amber-300 font-mono">
                    You must log in with your osu! account to accept bounties, submit scores, and earn stamina & points!
                  </p>
                </div>
              </div>
              <button
                onClick={loginWithOsu}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-black font-bold text-xs font-display flex-shrink-0 shadow-md transition-transform active:scale-95"
              >
                Log In with osu!
              </button>
            </div>
          )}

          {/* Active Bounty Banner (If Active) */}
          {activeBounty && (
            <div className="relative rounded-3xl bg-gradient-to-br from-slate-900/95 via-[#121226] to-[#1c1228] border-2 border-cyan-500/60 shadow-xl shadow-cyan-950/40 p-4 sm:p-6 overflow-hidden animate-fade-in">
              {/* Background Art Overlay */}
              <div
                className="absolute inset-0 bg-cover bg-center opacity-15 filter blur-sm pointer-events-none"
                style={{ backgroundImage: `url(${activeBounty.bounty.beatmap.covers.cover})` }}
              />

              <div className="relative z-10 space-y-5">
                {/* Active Header Tag */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                  <div className="flex items-center space-x-2 font-mono">
                    <span className="flex h-3 w-3 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
                    </span>
                    <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider">
                      Active Bounty in Progress
                    </span>
                  </div>

                  <div className="flex items-center space-x-3 text-xs font-mono">
                    <span className="text-slate-400 flex items-center space-x-1">
                      <Clock className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Elapsed: {formatElapsedTime(elapsedSeconds)}</span>
                    </span>
                    <button
                      onClick={handleAbandonBounty}
                      className="text-slate-500 hover:text-red-400 transition-colors flex items-center space-x-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Abandon</span>
                    </button>
                  </div>
                </div>

                {/* Beatmap & Mission Requirements */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                  <div className="md:col-span-2 flex items-center space-x-4">
                    <img
                      src={activeBounty.bounty.beatmap.covers.card || activeBounty.bounty.beatmap.covers.cover}
                      alt="Cover"
                      className="w-20 h-20 rounded-2xl object-cover border border-slate-700 shadow-md flex-shrink-0"
                    />
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center space-x-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                            DIFFICULTY_STYLES[activeBounty.bounty.difficulty].badge
                          }`}
                        >
                          {activeBounty.bounty.difficulty}
                        </span>
                        <span className="text-xs font-mono text-amber-400 font-bold">
                          ★ {activeBounty.bounty.beatmap.stars.toFixed(2)}
                        </span>
                      </div>
                      <h3 className="text-base sm:text-lg font-bold text-white truncate font-sans">
                        {activeBounty.bounty.beatmap.title}
                      </h3>
                      <p className="text-xs text-slate-300 truncate font-mono">
                        {activeBounty.bounty.beatmap.artist} [{activeBounty.bounty.beatmap.version}]
                      </p>
                      <div className="pt-1 flex items-center space-x-2 text-[11px] font-mono text-cyan-300">
                        <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Objective: {activeBounty.bounty.description}</span>
                      </div>
                    </div>
                  </div>

                  {/* Direct Launch & Links */}
                  <div className="flex flex-col sm:flex-row md:flex-col gap-2 justify-center">
                    <a
                      href={`osu://b/${activeBounty.bounty.beatmap.id}`}
                      className="px-3 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold font-mono text-center flex items-center justify-center space-x-1.5 shadow-md shadow-pink-900/40 transition-all hover:scale-[1.02]"
                    >
                      <Zap className="w-3.5 h-3.5 fill-white" />
                      <span>Direct osu! Launch</span>
                    </a>
                    <div className="flex items-center space-x-2">
                      <a
                        href={`https://osu.ppy.sh/b/${activeBounty.bounty.beatmap.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-mono text-center flex items-center justify-center space-x-1 transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Beatmap Page</span>
                      </a>
                      <button
                        onClick={() =>
                          handleToggleAudio(
                            activeBounty.bounty.beatmap.beatmapsetId || activeBounty.bounty.beatmap.id,
                            activeBounty.bounty.beatmap.previewUrl
                          )
                        }
                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                        title="Preview Song"
                      >
                        {playingSetId === (activeBounty.bounty.beatmap.beatmapsetId || activeBounty.bounty.beatmap.id) ? (
                          <Pause className="w-3.5 h-3.5 text-pink-400" />
                        ) : (
                          <Play className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Score Link Submission Box */}
                <form
                  onSubmit={handleVerifyScore}
                  className="pt-2 border-t border-slate-800/80 space-y-3"
                >
                  <label className="text-xs font-mono text-slate-300 font-semibold block">
                    Submit Score Verification Link:
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={scoreInput}
                      onChange={(e) => setScoreInput(e.target.value)}
                      placeholder="e.g. https://osu.ppy.sh/scores/6821398994 or Score ID"
                      disabled={isVerifying}
                      className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-cyan-500/40 text-sm text-white font-mono placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                    />
                    <button
                      type="submit"
                      disabled={isVerifying || !scoreInput.trim()}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 text-white font-bold font-display text-sm shadow-lg shadow-cyan-900/30 flex items-center justify-center space-x-2 transition-all"
                    >
                      {isVerifying ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Verifying...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Verify & Claim +{activeBounty.bounty.rewardStamina} ⚡ (+{activeBounty.bounty.rewardPoints} Pts)</span>
                        </>
                      )}
                    </button>
                  </div>

                  {verifyError && (
                    <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs flex items-start space-x-2 animate-fade-in">
                      <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                      <span className="font-sans leading-relaxed">{verifyError}</span>
                    </div>
                  )}

                  <p className="text-[11px] font-mono text-slate-400 leading-relaxed">
                    💡 <strong>How it works:</strong> Pass the map in osu! (solo), click your score in your
                    osu! client or profile to copy its link, and paste it here. The score timestamp must be
                    after you accepted this bounty!
                  </p>
                </form>
              </div>
            </div>
          )}

          {/* Success Banner (Just Claimed) */}
          {verifySuccess && !activeBounty && (
            <div className="p-4 sm:p-5 rounded-2xl bg-emerald-950/80 border border-emerald-500/60 text-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-scale-up shadow-xl shadow-emerald-950/50">
              <div className="flex items-start sm:items-center space-x-3.5">
                <div className="p-3 rounded-xl bg-emerald-900 text-emerald-300 flex-shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-white font-display text-base">
                    Bounty Completed! +{verifySuccess.reward} Stamina & Points Awarded!
                  </h4>
                  <p className="text-xs text-emerald-300 font-mono">
                    Score #{verifySuccess.score.id} verified for player {verifySuccess.score.username} (
                    {formatRankDisplay(verifySuccess.score.rank)} Rank · {verifySuccess.score.accuracy.toFixed(2)}% ·{' '}
                    {verifySuccess.score.pp.toFixed(1)}pp).
                  </p>
                  {verifySuccess.packBonus && (
                    <div className="mt-2 p-2 rounded-xl bg-amber-950/80 border border-amber-500/60 text-amber-200 text-xs font-mono font-bold flex items-center space-x-2 animate-bounce">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <span>
                        🏆 PACK BONUS UNLOCKED ({verifySuccess.packBonus.title}): +{verifySuccess.packBonus.stamina} ⚡ & +{verifySuccess.packBonus.points} Pts!
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={() => setVerifySuccess(null)}
                className="px-3 py-1.5 rounded-lg bg-emerald-900/60 hover:bg-emerald-800 text-xs font-mono text-emerald-200 self-end sm:self-auto"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Board Navigation & Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            {/* Tabs */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => {
                  sfx.playClick();
                  setActiveTab('bounties');
                }}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold font-display transition-all ${
                  activeTab === 'bounties'
                    ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                    : 'bg-slate-900 text-slate-400 hover:text-white'
                }`}
              >
                Active Board (10 Bounties)
              </button>

              <button
                onClick={() => {
                  sfx.playClick();
                  setActiveTab('packs');
                }}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold font-display transition-all flex items-center space-x-1.5 ${
                  activeTab === 'packs'
                    ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                    : 'bg-slate-900 text-slate-400 hover:text-white'
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                <span>Bounty Packs ({bountyPacks.length})</span>
              </button>

              <button
                onClick={() => {
                  sfx.playClick();
                  setActiveTab('history');
                }}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold font-display transition-all flex items-center space-x-1.5 ${
                  activeTab === 'history'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                    : 'bg-slate-900 text-slate-400 hover:text-white'
                }`}
              >
                <Award className="w-3.5 h-3.5" />
                <span>Completed History ({completedBounties.length})</span>
              </button>
            </div>

            {/* Reroll & Difficulty Filter (When in Bounties Tab) */}
            {activeTab === 'bounties' && (
              <div className="flex items-center space-x-2">
                <select
                  value={selectedDifficulty}
                  onChange={(e) => setSelectedDifficulty(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
                >
                  <option value="All">All Difficulties</option>
                  <option value="Boss">👑 Raid Bosses</option>
                  <option value="Beginner">Beginner (★2–★4)</option>
                  <option value="Intermediate">Intermediate (★4–★5.3)</option>
                  <option value="Advanced">Advanced (★5.3–★6.5)</option>
                  <option value="Expert">Expert (★6.5+)</option>
                </select>

                <button
                  onClick={handleRerollBounties}
                  className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs font-mono font-bold flex items-center space-x-1.5 transition-colors"
                  title="Generate 10 new random bounties"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reroll</span>
                </button>
              </div>
            )}
          </div>

          {/* ── TAB 1: BOUNTIES GRID (With Boss Raid Spotlight) ───────────── */}
          {activeTab === 'bounties' && (
            <div className="space-y-6">
              {/* 👑 ACTIVE BOSS RAID BOUNTIES */}
              {bossBounties.length > 0 && (selectedDifficulty === 'All' || selectedDifficulty === 'Boss') && (
                <div className="space-y-3">
                  <div className="flex items-center space-x-2 text-xs font-mono font-bold text-red-400 uppercase tracking-wider">
                    <Flame className="w-4 h-4 text-red-500 animate-pulse" />
                    <span>👑 ACTIVE RAID BOSS CHALLENGES (+300 ⚡ / +300 Pts)</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {bossBounties.map((b) => {
                      const isThisActive = activeBounty?.bounty.id === b.id;
                      return (
                        <div
                          key={b.id}
                          className={`relative rounded-3xl bg-gradient-to-b from-red-950/60 via-slate-900/90 to-slate-950 border-2 border-red-500/70 p-5 transition-all duration-200 flex flex-col justify-between space-y-3 overflow-hidden shadow-xl shadow-red-950/40 ${
                            isThisActive ? 'ring-2 ring-red-400 scale-[1.01]' : 'hover:border-red-400'
                          }`}
                        >
                          <div className="flex items-start space-x-3.5">
                            <img
                              src={b.beatmap.covers.card || b.beatmap.covers.cover}
                              alt="Boss Cover"
                              className="w-20 h-20 rounded-2xl object-cover border-2 border-red-500/50 flex-shrink-0"
                            />
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-black bg-gradient-to-r from-red-600 to-amber-600 text-white shadow-md shadow-red-900/50 flex items-center space-x-1">
                                  <Crown className="w-3 h-3 fill-current" />
                                  <span>RAID BOSS</span>
                                </span>
                                <span className="text-xs font-mono text-amber-300 font-black">
                                  ★ {b.beatmap.stars.toFixed(2)}
                                </span>
                              </div>
                              <h4 className="text-base font-black text-white truncate font-display">
                                {b.beatmap.title}
                              </h4>
                              <p className="text-xs text-slate-300 truncate font-mono">
                                {b.beatmap.artist} [{b.beatmap.version}]
                              </p>
                            </div>
                          </div>

                          {/* Boss Lore Box */}
                          {b.bossReason && (
                            <div className="p-3 rounded-2xl bg-red-950/80 border border-red-500/40 text-xs text-amber-200 font-sans space-y-1 shadow-inner">
                              <div className="flex items-center space-x-1.5 text-[10px] font-mono font-bold text-red-300 uppercase">
                                <Flame className="w-3 h-3 text-red-400" />
                                <span>Why this song was chosen:</span>
                              </div>
                              <p className="italic leading-relaxed">"{b.bossReason}"</p>
                            </div>
                          )}

                          {/* Objective */}
                          <div className="p-2.5 rounded-xl bg-slate-950/80 border border-red-900/60 text-xs flex items-center justify-between font-mono">
                            <span className="text-slate-400">Objective:</span>
                            <span className="font-bold text-amber-300">{b.description}</span>
                          </div>

                          {/* Footer Actions */}
                          <div className="flex items-center justify-between pt-1">
                            <div className="flex items-center space-x-2 text-xs font-mono font-bold text-amber-400">
                              <div className="flex items-center space-x-1">
                                <Zap className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                                <span>+{b.rewardStamina || 300} ⚡</span>
                              </div>
                              <span className="text-amber-300 font-extrabold">+{b.rewardPoints || 300} Pts</span>
                            </div>

                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => handleToggleAudio(b.beatmap.beatmapsetId || b.beatmap.id, b.beatmap.previewUrl)}
                                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                                title="Preview Audio"
                              >
                                {playingSetId === (b.beatmap.beatmapsetId || b.beatmap.id) ? (
                                  <Pause className="w-3.5 h-3.5 text-pink-400" />
                                ) : (
                                  <Play className="w-3.5 h-3.5" />
                                )}
                              </button>

                              {isThisActive ? (
                                <span className="px-3.5 py-1.5 rounded-xl bg-red-950 border border-red-500 text-red-300 text-xs font-mono font-bold">
                                  In Progress
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleAcceptBounty(b)}
                                  disabled={activeBounty !== null}
                                  className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-black font-mono transition-all shadow-md shadow-red-950/60"
                                >
                                  Accept Raid
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Standard Daily Bounties Grid */}
              {selectedDifficulty !== 'Boss' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredBounties.map((b) => {
                    const isThisActive = activeBounty?.bounty.id === b.id;
                    const style = DIFFICULTY_STYLES[b.difficulty] || DIFFICULTY_STYLES.Intermediate;

                    return (
                      <div
                        key={b.id}
                        className={`group relative rounded-2xl bg-slate-900/80 border hover:border-cyan-500/50 p-4 transition-all duration-200 flex flex-col justify-between space-y-3 overflow-hidden ${
                          isThisActive ? 'border-cyan-500 shadow-lg shadow-cyan-950/40' : 'border-slate-800'
                        }`}
                      >
                        <div className="flex items-start space-x-3.5">
                          <img
                            src={b.beatmap.covers.card || b.beatmap.covers.cover}
                            alt="Cover"
                            className="w-16 h-16 rounded-xl object-cover border border-slate-800 flex-shrink-0 group-hover:scale-105 transition-transform"
                          />
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center justify-between">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold border ${style.badge}`}
                              >
                                {b.difficulty}
                              </span>
                              <span className="text-xs font-mono text-amber-400 font-bold">
                                ★ {b.beatmap.stars.toFixed(2)}
                              </span>
                            </div>
                            <h4 className="text-sm font-bold text-white truncate font-sans group-hover:text-cyan-300 transition-colors">
                              {b.beatmap.title}
                            </h4>
                            <p className="text-xs text-slate-400 truncate font-mono">
                              {b.beatmap.artist} [{b.beatmap.version}]
                            </p>
                          </div>
                        </div>

                        {/* Mission Objective */}
                        <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs space-y-1">
                          <div className="flex items-center justify-between text-[11px] font-mono">
                            <span className="text-slate-400">Objective:</span>
                            <span className="font-bold text-cyan-300">{b.description}</span>
                          </div>
                        </div>

                        {/* Footer Actions */}
                        <div className="flex items-center justify-between pt-1">
                          <div className="flex items-center space-x-2 text-xs font-mono font-bold text-amber-400">
                            <div className="flex items-center space-x-1">
                              <Zap className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                              <span>+{b.rewardStamina} ⚡</span>
                            </div>
                            <span className="text-cyan-400 font-extrabold">+{b.rewardPoints} Pts</span>
                          </div>

                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleToggleAudio(b.beatmap.beatmapsetId || b.beatmap.id, b.beatmap.previewUrl)}
                              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                              title="Preview Audio"
                            >
                              {playingSetId === (b.beatmap.beatmapsetId || b.beatmap.id) ? (
                                <Pause className="w-3.5 h-3.5 text-pink-400" />
                              ) : (
                                <Play className="w-3.5 h-3.5" />
                              )}
                            </button>

                            {isThisActive ? (
                              <span className="px-3.5 py-1.5 rounded-xl bg-cyan-950 border border-cyan-500 text-cyan-300 text-xs font-mono font-bold">
                                In Progress
                              </span>
                            ) : (
                              <button
                                onClick={() => handleAcceptBounty(b)}
                                disabled={activeBounty !== null}
                                className="px-3.5 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold font-mono transition-all shadow-md shadow-cyan-950/40"
                              >
                                Accept
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── TAB 2: BOUNTY PACKS (Playlist Challenges) ─────────────────── */}
          {activeTab === 'packs' && (
            <div className="space-y-6">
              {bountyPacks.length === 0 ? (
                <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800/60 space-y-2">
                  <Package className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-sm font-bold text-slate-300">No Bounty Packs Available</p>
                  <p className="text-xs text-slate-500 font-mono max-w-sm mx-auto">
                    The admin hasn&apos;t published any curated playlist packs yet. Check back soon!
                  </p>
                </div>
              ) : (
                bountyPacks.map((pack) => {
                  const completedMapsCount = pack.bounties.filter((pb) =>
                    completedBounties.some((cb) => cb.beatmapId === pb.beatmap.id)
                  ).length;
                  const isPackFullyDone = completedMapsCount === pack.bounties.length;
                  const isClaimed = completedPacks.some((cp) => cp.packId === pack.id);

                  return (
                    <div
                      key={pack.id}
                      className={`p-5 rounded-3xl bg-slate-900/90 border transition-all space-y-4 ${
                        isPackFullyDone
                          ? 'border-amber-500/60 shadow-xl shadow-amber-950/40'
                          : 'border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {/* Pack Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="px-2.5 py-0.5 rounded-full bg-amber-950 border border-amber-500/60 text-amber-300 font-mono text-[10px] font-bold flex items-center space-x-1">
                              <Package className="w-3 h-3 text-amber-400" />
                              <span>BOUNTY PACK</span>
                            </span>
                            {pack.badgeTitle && (
                              <span className="px-2 py-0.5 rounded-full bg-purple-950 border border-purple-500/60 text-purple-300 font-mono text-[10px] font-bold">
                                Title: {pack.badgeTitle}
                              </span>
                            )}
                            {isPackFullyDone && (
                              <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 border border-emerald-500 text-emerald-300 font-mono text-[10px] font-bold">
                                {isClaimed ? '✓ BONUS CLAIMED' : '✓ 100% COMPLETE'}
                              </span>
                            )}
                          </div>
                          <h3 className="text-lg font-black text-white font-display">{pack.title}</h3>
                          <p className="text-xs text-slate-400 font-sans">{pack.description}</p>
                        </div>

                        {/* Bonus Rewards */}
                        <div className="p-3 rounded-2xl bg-slate-950/80 border border-amber-500/40 text-right flex-shrink-0 space-y-0.5">
                          <span className="text-[10px] font-mono text-amber-300 block uppercase">Pack Completion Bonus:</span>
                          <span className="text-sm font-mono font-black text-amber-400 block">
                            +{pack.bonusRewardStamina} ⚡ · +{pack.bonusRewardPoints} Pts
                          </span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                          <span>Playlist Progress</span>
                          <span className="font-bold text-white">
                            {completedMapsCount} / {pack.bounties.length} Maps Cleared
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden border border-slate-800">
                          <div
                            className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all duration-500"
                            style={{ width: `${(completedMapsCount / Math.max(1, pack.bounties.length)) * 100}%` }}
                          />
                        </div>
                      </div>

                      {/* Maps in this pack */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {pack.bounties.map((pb, idx) => {
                          const isCleared = completedBounties.some((cb) => cb.beatmapId === pb.beatmap.id);
                          const isThisActive = activeBounty?.bounty.id === pb.id;

                          return (
                            <div
                              key={pb.id || idx}
                              className={`p-3 rounded-2xl bg-slate-950/60 border flex flex-col justify-between space-y-2 ${
                                isCleared ? 'border-emerald-500/50 bg-emerald-950/20' : 'border-slate-800'
                              }`}
                            >
                              <div className="flex items-start space-x-2.5">
                                <img
                                  src={pb.beatmap.covers.card || pb.beatmap.covers.cover}
                                  alt="Cover"
                                  className="w-12 h-12 rounded-xl object-cover flex-shrink-0"
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-mono text-amber-400 font-bold">
                                      ★ {pb.beatmap.stars.toFixed(2)}
                                    </span>
                                    {isCleared && (
                                      <span className="text-[10px] font-mono font-bold text-emerald-400">
                                        ✓ Done
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs font-bold text-white truncate">{pb.beatmap.title}</p>
                                  <p className="text-[10px] text-slate-400 truncate">[{pb.beatmap.version}]</p>
                                </div>
                              </div>

                              <p className="text-[11px] font-mono text-slate-300 bg-slate-900/80 p-1.5 rounded-lg">
                                {pb.description}
                              </p>

                              <div className="flex items-center justify-between pt-1">
                                <span className="text-[10px] font-mono font-bold text-emerald-400">
                                  +{pb.rewardStamina} ⚡ · +{pb.rewardPoints} Pts
                                </span>

                                {!isCleared && (
                                  isThisActive ? (
                                    <span className="px-2.5 py-1 rounded-lg bg-cyan-950 border border-cyan-500 text-cyan-300 text-[10px] font-mono font-bold">
                                      Active
                                    </span>
                                  ) : (
                                    <button
                                      onClick={() => handleAcceptBounty({ ...pb, packId: pack.id, packName: pack.title })}
                                      disabled={activeBounty !== null}
                                      className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[10px] font-mono font-bold transition-colors"
                                    >
                                      Play Map
                                    </button>
                                  )
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ── TAB 3: COMPLETED HISTORY ──────────────────────────────────── */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              {completedBounties.length === 0 ? (
                <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800/60 space-y-2">
                  <Award className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-sm font-bold text-slate-300">No Bounties Completed Yet</p>
                  <p className="text-xs text-slate-500 font-mono max-w-sm mx-auto">
                    Accept a bounty from the active board, pass the map in osu!, and verify your score link!
                  </p>
                </div>
              ) : (
                completedBounties.map((c) => (
                  <div
                    key={c.id}
                    className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-0.5 rounded-md bg-emerald-950 text-emerald-300 border border-emerald-700/50 font-mono text-[10px] font-bold">
                          ✓ Verified Score #{c.scoreId}
                        </span>
                        <span className="text-xs font-mono text-amber-400 font-bold">★ {c.stars.toFixed(2)}</span>
                        {c.difficulty && (
                          <span className="px-2 py-0.5 rounded-md bg-cyan-950 text-cyan-300 border border-cyan-700/50 font-mono text-[10px] font-bold">
                            {c.difficulty}
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-bold text-white truncate font-sans">
                        {c.beatmapArtist} — {c.beatmapTitle} [{c.beatmapVersion}]
                      </h4>
                      <p className="text-[11px] font-mono text-slate-400">
                        Rank: <strong className="text-pink-400">{c.scoreRank}</strong> · Acc:{' '}
                        <strong>{c.scoreAccuracy.toFixed(2)}%</strong> · PP:{' '}
                        <strong>{c.scorePp.toFixed(1)}pp</strong> · Mods:{' '}
                        <strong>{c.scoreMods.join(', ') || 'Nomod'}</strong>
                      </p>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <span className="text-xs font-mono font-bold text-emerald-400 block">
                        +{c.rewardStamina} ⚡
                      </span>
                      <span className="text-[11px] font-mono font-bold text-cyan-400 block">
                        +{c.rewardPoints || 25} Pts
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">
                        {new Date(c.completedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
