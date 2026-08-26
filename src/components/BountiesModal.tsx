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
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useGacha } from '../context/GachaContext';
import { useAuth } from '../context/AuthContext';
import { sfx } from '../audio/sfx';
import { Bounty, ActiveBounty, CompletedBounty, BountyDifficulty, OsuScoreData } from '../types/bounty';
import {
  generateRandomBounties,
  loadSavedBounties,
  saveAvailableBounties,
  loadActiveBounty,
  saveActiveBounty,
  loadCompletedBounties,
  saveCompletedBounty,
  loadClaimedScoreIds,
} from '../services/bountyService';
import { fetchScoreDetails, verifyScoreForBounty } from '../services/scoreService';

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
};

export const BountiesModal: React.FC<BountiesModalProps> = ({ isOpen, onClose }) => {
  const { pool, addBonusEnergy } = useGacha();
  const { user } = useAuth();

  const [bounties, setBounties] = useState<Bounty[]>([]);
  const [activeBounty, setActiveBounty] = useState<ActiveBounty | null>(null);
  const [completedBounties, setCompletedBounties] = useState<CompletedBounty[]>([]);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('All');
  const [activeTab, setActiveTab] = useState<'bounties' | 'history'>('bounties');

  // Verification Form State
  const [scoreInput, setScoreInput] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifySuccess, setVerifySuccess] = useState<{
    score: OsuScoreData;
    reward: number;
  } | null>(null);

  // Audio Preview State
  const [playingMapId, setPlayingMapId] = useState<number | null>(null);
  const [audioElem, setAudioElem] = useState<HTMLAudioElement | null>(null);

  // Time elapsed state for active bounty
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  // Initialize and load saved state
  useEffect(() => {
    if (!isOpen) return;

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
        if (audioElem) {
          audioElem.pause();
        }
      };
    }
  }, [isOpen, audioElem]);

  const handleRerollBounties = () => {
    sfx.playClick();
    if (pool.length === 0) return;
    const newBounties = generateRandomBounties(pool, 10);
    setBounties(newBounties);
    saveAvailableBounties(newBounties);
    setVerifyError(null);
  };

  const handleAcceptBounty = (bounty: Bounty) => {
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

  const handleToggleAudio = (mapId: number, previewUrl?: string) => {
    if (!previewUrl) return;
    if (playingMapId === mapId) {
      if (audioElem) {
        audioElem.pause();
      }
      setPlayingMapId(null);
      return;
    }

    if (audioElem) {
      audioElem.pause();
    }

    const audio = new Audio(previewUrl);
    audio.volume = 0.4;
    audio.play().catch(() => {});
    audio.onended = () => setPlayingMapId(null);
    setAudioElem(audio);
    setPlayingMapId(mapId);
  };

  const handleVerifyScore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBounty || !scoreInput.trim()) return;

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

      await addBonusEnergy(50);

      // 4. Save to Completed Bounties
      const completed: CompletedBounty = {
        id: `comp-${Date.now()}`,
        bountyId: activeBounty.bounty.id,
        beatmapId: activeBounty.bounty.beatmap.id,
        beatmapTitle: activeBounty.bounty.beatmap.title,
        beatmapArtist: activeBounty.bounty.beatmap.artist,
        beatmapVersion: activeBounty.bounty.beatmap.version,
        stars: activeBounty.bounty.beatmap.stars,
        scoreId: score.id,
        scoreRank: score.rank,
        scoreAccuracy: score.accuracy,
        scoreMods: score.mods,
        scorePp: score.pp,
        completedAt: Date.now(),
        rewardStamina: 50,
      };

      saveCompletedBounty(completed);
      setCompletedBounties((prev) => [completed, ...prev]);

      setVerifySuccess({
        score,
        reward: 50,
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
                  +50 Stamina
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
                            activeBounty.bounty.beatmap.id,
                            activeBounty.bounty.beatmap.previewUrl
                          )
                        }
                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                        title="Preview Song"
                      >
                        {playingMapId === activeBounty.bounty.beatmap.id ? (
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
                          <span>Verify & Claim +50 ⚡</span>
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
            <div className="p-4 sm:p-5 rounded-2xl bg-emerald-950/80 border border-emerald-500/60 text-emerald-200 flex items-center justify-between gap-4 animate-scale-up shadow-xl shadow-emerald-950/50">
              <div className="flex items-center space-x-3.5">
                <div className="p-3 rounded-xl bg-emerald-900 text-emerald-300">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-white font-display text-base">
                    Bounty Completed! +{verifySuccess.reward} Stamina Awarded!
                  </h4>
                  <p className="text-xs text-emerald-300 font-mono">
                    Score #{verifySuccess.score.id} verified for player {verifySuccess.score.username} (
                    {verifySuccess.score.rank} Rank · {verifySuccess.score.accuracy.toFixed(2)}% ·{' '}
                    {verifySuccess.score.pp.toFixed(1)}pp).
                  </p>
                </div>
              </div>
              <button
                onClick={() => setVerifySuccess(null)}
                className="px-3 py-1.5 rounded-lg bg-emerald-900/60 hover:bg-emerald-800 text-xs font-mono text-emerald-200"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Board Navigation & Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            {/* Tabs */}
            <div className="flex items-center space-x-2">
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

          {/* ── TAB 1: BOUNTIES GRID ──────────────────────────────────────── */}
          {activeTab === 'bounties' && (
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
                      <div className="flex items-center space-x-1.5 text-xs font-mono font-bold text-amber-400">
                        <Zap className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        <span>+{b.rewardStamina} Stamina</span>
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleToggleAudio(b.beatmap.id, b.beatmap.previewUrl)}
                          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                          title="Preview Audio"
                        >
                          {playingMapId === b.beatmap.id ? (
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

          {/* ── TAB 2: COMPLETED HISTORY ──────────────────────────────────── */}
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
