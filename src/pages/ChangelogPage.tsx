import React, { useState, useMemo } from "react";
import { useGacha } from "../context/GachaContext";
import { Beatmap, RarityTier } from "../types/beatmap";
import { BeatmapCoverImage } from "../components/BeatmapCoverImage";
import { RARITY_CONFIGS, RARITY_ORDER } from "../gacha/rarity";
import { previewPlayer } from "../audio/previewPlayer";
import { sfx } from "../audio/sfx";
import { CHANGELOG_VERSIONS } from "../data/changelogData";
import {
  History,
  Sparkles,
  Search,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Play,
  Square,
  Filter,
  CheckCircle2,
  Layers,
} from "lucide-react";

interface ChangelogPageProps {
  onSelectBeatmap?: (beatmap: Beatmap) => void;
}

interface TierShiftItem {
  map: Beatmap;
  currentRank: number;
  currentRarity: RarityTier;
  oldRank: number;
  oldRarity: string;
  tierDelta: number;
  rankDelta: number;
  favRate: string;
  year: number;
  isNewGraveyard: boolean;
}

export const ChangelogPage: React.FC<ChangelogPageProps> = ({ onSelectBeatmap }) => {
  const { pool } = useGacha();
  const [selectedVersion, setSelectedVersion] = useState<string>("v7.0");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeFilter, setActiveFilter] = useState<
    "all" | "to_goat" | "to_divine" | "to_celestial" | "to_mythic" | "graveyard" | "major_buffs" | "all_buffs" | "all_nerfs"
  >("all");
  const [sortBy, setSortBy] = useState<"tierDelta" | "rank" | "plays" | "favs">("tierDelta");
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const PAGE_SIZE = 24;

  React.useEffect(() => {
    const unsub = previewPlayer.subscribe((playing, currentId) => {
      setPlayingId(playing ? currentId : null);
    });
    return unsub;
  }, []);

  const handlePlayToggle = (e: React.MouseEvent, map: Beatmap) => {
    e.stopPropagation();
    sfx.playClick();
    if (playingId === map.beatmapsetId) {
      previewPlayer.pause();
    } else {
      previewPlayer.play(map.beatmapsetId, map.previewUrl);
    }
  };

  const allShifts = useMemo<TierShiftItem[]>(() => {
    if (!pool || pool.length === 0) return [];

    // Strictly sort pool by MCDA Popularity Score descending to ensure accurate 1..N ranks
    const sortedPool = [...pool].sort((a, b) => (b.popularityScore || 0) - (a.popularityScore || 0));

    // Baseline Legacy Linear scoring (pre-v7.0 formula)
    const linearScored = sortedPool.map((m) => {
      const p = Math.log10(Math.max(1, m.playcount));
      const f = Math.log10(Math.max(1, m.favouriteCount));
      const pNorm = Math.min(1, Math.max(0, (p - 2.0) / (8.2 - 2.0)));
      const fNorm = Math.min(1, Math.max(0, (f - 0.3) / (4.7 - 0.3)));
      const score = pNorm * 0.70 + fNorm * 0.30;
      return { id: m.id, map: m, score };
    });

    linearScored.sort((a, b) => b.score - a.score);
    const oldRankMap = new Map<number, { oldRank: number; oldRarity: string; isNewGraveyard: boolean }>();

    function getLegacyRarity(rank: number, status: string): string {
      if (status === "graveyard" || status === "unranked") return "Unranked / New";
      if (rank <= 10) return "GOAT";
      if (rank <= 40) return "Divine";
      if (rank <= 115) return "Celestial";
      if (rank <= 265) return "Mythic";
      if (rank <= 665) return "Legendary";
      if (rank <= 2665) return "Epic";
      if (rank <= 8665) return "Rare";
      if (rank <= 18665) return "Uncommon+";
      if (rank <= 29665) return "Uncommon";
      return "Common";
    }

    linearScored.forEach((item, idx) => {
      const isNewGraveyard = item.map.status === "graveyard" || item.map.status === "unranked";
      oldRankMap.set(item.id, {
        oldRank: idx + 1,
        oldRarity: getLegacyRarity(idx + 1, item.map.status),
        isNewGraveyard,
      });
    });

    return sortedPool
      .map((m, idx) => {
        const currentRank = idx + 1;
        const currentRarity = m.rarity;
        const { oldRank, oldRarity, isNewGraveyard } = oldRankMap.get(m.id) || {
          oldRank: currentRank,
          oldRarity: currentRarity,
          isNewGraveyard: false,
        };

        const oldRarityIndex = RARITY_ORDER.indexOf(oldRarity as RarityTier);
        const currentRarityIndex = RARITY_ORDER.indexOf(currentRarity);
        const tierDelta = isNewGraveyard
          ? currentRarityIndex + 1
          : (oldRarityIndex !== -1 ? currentRarityIndex - oldRarityIndex : 0);

        const rankDelta = oldRank - currentRank;
        const p = Math.max(0, m.playcount);
        const f = Math.max(0, m.favouriteCount);
        const favRate = p > 0 ? ((f / p) * 1000).toFixed(2) : "0.00";
        const year = m.rankedDate ? new Date(m.rankedDate).getFullYear() : 2020;

        return {
          map: m,
          currentRank,
          currentRarity,
          oldRank,
          oldRarity,
          tierDelta,
          rankDelta,
          favRate,
          year,
          isNewGraveyard,
        };
      })
      .filter((s) => s.isNewGraveyard || s.tierDelta !== 0 || Math.abs(s.rankDelta) >= 50);
  }, [pool]);

  const stats = useMemo(() => {
    const totalChanged = allShifts.filter((s) => s.tierDelta !== 0 || s.isNewGraveyard).length;
    const promotedToGoat = allShifts.filter((s) => s.currentRarity === "GOAT" && s.tierDelta > 0).length;
    const promotedToDivine = allShifts.filter((s) => s.currentRarity === "Divine" && s.tierDelta > 0).length;
    const graveyardCount = allShifts.filter((s) => s.isNewGraveyard).length;
    const majorBuffs = allShifts.filter((s) => s.tierDelta >= 2).length;
    const totalBuffs = allShifts.filter((s) => s.tierDelta > 0).length;
    const totalNerfs = allShifts.filter((s) => s.tierDelta < 0 && !s.isNewGraveyard).length;

    return { totalChanged, promotedToGoat, promotedToDivine, graveyardCount, majorBuffs, totalBuffs, totalNerfs };
  }, [allShifts]);

  const filteredShifts = useMemo(() => {
    let list = allShifts;

    if (activeFilter === "to_goat") {
      list = list.filter((s) => s.currentRarity === "GOAT" && s.tierDelta > 0);
    } else if (activeFilter === "to_divine") {
      list = list.filter((s) => s.currentRarity === "Divine" && s.tierDelta > 0);
    } else if (activeFilter === "to_celestial") {
      list = list.filter((s) => s.currentRarity === "Celestial" && s.tierDelta > 0);
    } else if (activeFilter === "to_mythic") {
      list = list.filter((s) => s.currentRarity === "Mythic" && s.tierDelta > 0);
    } else if (activeFilter === "graveyard") {
      list = list.filter((s) => s.isNewGraveyard);
    } else if (activeFilter === "major_buffs") {
      list = list.filter((s) => s.tierDelta >= 2);
    } else if (activeFilter === "all_buffs") {
      list = list.filter((s) => s.tierDelta > 0);
    } else if (activeFilter === "all_nerfs") {
      list = list.filter((s) => s.tierDelta < 0);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (s) =>
          s.map.title.toLowerCase().includes(q) ||
          s.map.artist.toLowerCase().includes(q) ||
          s.map.creator.toLowerCase().includes(q)
      );
    }

    return [...list].sort((a, b) => {
      if (sortBy === "tierDelta") {
        if (b.tierDelta !== a.tierDelta) return b.tierDelta - a.tierDelta;
        return b.rankDelta - a.rankDelta;
      }
      if (sortBy === "rank") return a.currentRank - b.currentRank;
      if (sortBy === "plays") return b.map.playcount - a.map.playcount;
      if (sortBy === "favs") return b.map.favouriteCount - a.map.favouriteCount;
      return 0;
    });
  }, [allShifts, activeFilter, searchQuery, sortBy]);

  const totalPages = Math.ceil(filteredShifts.length / PAGE_SIZE);
  const paginatedShifts = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredShifts.slice(start, start + PAGE_SIZE);
  }, [filteredShifts, currentPage]);

  const currentVersionData = CHANGELOG_VERSIONS.find((v) => v.version === selectedVersion) || CHANGELOG_VERSIONS[0];

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in pb-12">
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-[#171728] via-[#1c1c36] to-[#121220] border border-slate-800 p-6 sm:p-8 shadow-2xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-pink-500/10 border border-pink-500/30 text-pink-400 text-xs font-mono font-bold tracking-wider">
              <History className="w-3.5 h-3.5" />
              <span>TIER TRANSITIONS & RANKING CHANGELOG</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-wide font-display">
              Beatmap Tier & Ranking Shifts
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl font-sans leading-relaxed">
              Track how the <strong className="text-cyan-400 font-mono">MCDA Multi-Factor Popularity Model</strong> evaluates beatmaps across Reach, Affection, Passion Ratio, and Historical Era Standing.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 flex-shrink-0">
            <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 text-center">
              <span className="text-[10px] font-mono text-slate-400 uppercase block">Total Changed</span>
              <span className="text-lg font-black text-white font-mono">{stats.totalChanged.toLocaleString()}</span>
            </div>
            <div className="p-3 rounded-2xl bg-yellow-950/40 border border-yellow-500/40 text-center">
              <span className="text-[10px] font-mono text-yellow-300 uppercase block">GOAT Tier</span>
              <span className="text-lg font-black text-yellow-400 font-mono">25 Maps</span>
            </div>
            <div className="p-3 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-center">
              <span className="text-[10px] font-mono text-emerald-300 uppercase block">Buffed Tiers</span>
              <span className="text-lg font-black text-emerald-400 font-mono">+{stats.totalBuffs.toLocaleString()}</span>
            </div>
            <div className="p-3 rounded-2xl bg-pink-950/40 border border-pink-500/40 text-center">
              <span className="text-[10px] font-mono text-pink-300 uppercase block">Major Buffs (+2)</span>
              <span className="text-lg font-black text-pink-400 font-mono">+{stats.majorBuffs}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {CHANGELOG_VERSIONS.map((v) => (
            <button
              key={v.version}
              onClick={() => setSelectedVersion(v.version)}
              className={
                "px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all border flex items-center space-x-2 " +
                (selectedVersion === v.version
                  ? "bg-gradient-to-r from-pink-600 to-purple-600 text-white border-pink-400/60 shadow-lg shadow-pink-600/20 scale-[1.02]"
                  : "bg-slate-900/80 hover:bg-slate-800 text-slate-400 border-slate-800")
              }
            >
              <span>{v.version}</span>
              <span className="text-[10px] opacity-75">• {v.date}</span>
            </button>
          ))}
        </div>

        <div className="p-5 sm:p-6 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center space-x-2 font-display">
                <span>{currentVersionData.version}: {currentVersionData.title}</span>
              </h2>
              <p className="text-xs text-slate-400 font-mono mt-0.5">{currentVersionData.highlight}</p>
            </div>
            <span className="px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-[11px] font-mono text-slate-300 self-start sm:self-auto">
              {currentVersionData.date}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-sans text-slate-300">
            <div className="space-y-2">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-300 flex items-center space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                <span>Key Model Enhancements:</span>
              </h3>
              <ul className="space-y-1.5 pl-4 list-disc text-slate-400 font-mono leading-relaxed text-[11px]">
                {currentVersionData.details.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </div>

            {currentVersionData.keyPromotions && (
              <div className="space-y-2">
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-pink-300 flex items-center space-x-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-pink-400" />
                  <span>Spotlight Tier Shifts:</span>
                </h3>
                <div className="space-y-1.5">
                  {currentVersionData.keyPromotions.map((kp, i) => (
                    <div
                      key={i}
                      className="p-2 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between text-[11px] font-mono"
                    >
                      <div className="truncate mr-2">
                        <strong className="text-slate-200">{kp.artist} - {kp.title}</strong>
                        <span className="text-slate-500 block text-[10px] truncate">{kp.reason}</span>
                      </div>
                      <div className="flex items-center space-x-1 flex-shrink-0 text-[10px]">
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">{kp.fromTier}</span>
                        <ArrowRight className="w-3 h-3 text-pink-400" />
                        <span className="px-1.5 py-0.5 rounded bg-pink-950 border border-pink-500/50 text-pink-300 font-bold">
                          {kp.toTier}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-white uppercase tracking-wide font-display flex items-center space-x-2">
              <Layers className="w-5 h-5 text-pink-400" />
              <span>Explore All Tier-Shifted Beatmaps</span>
            </h2>
            <p className="text-xs text-slate-400 font-mono">
              Showing {filteredShifts.length.toLocaleString()} beatmaps matching current filter
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search shifted map..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-pink-500 font-mono"
              />
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300 focus:outline-none focus:border-pink-500 cursor-pointer"
            >
              <option value="tierDelta">Sort: Tier Increase</option>
              <option value="rank">Sort: Final Rank</option>
              <option value="plays">Sort: Playcount</option>
              <option value="favs">Sort: Favourites</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: "all", label: "All Shifts", count: allShifts.length },
            { id: "to_goat", label: "🌟 Promoted to GOAT", count: stats.promotedToGoat },
            { id: "to_divine", label: "👑 Promoted to Divine", count: stats.promotedToDivine },
            { id: "graveyard", label: "🪦 Graveyard Landmarks", count: stats.graveyardCount },
            { id: "major_buffs", label: "🚀 Major Buffs (+2)", count: stats.majorBuffs },
            { id: "all_buffs", label: "⬆️ All Upgrades", count: stats.totalBuffs },
            { id: "all_nerfs", label: "⬇️ Adjustments", count: stats.totalNerfs },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => {
                setActiveFilter(f.id as any);
                setCurrentPage(1);
              }}
              className={
                "px-3 py-1.5 rounded-xl text-xs font-mono transition-all border flex items-center space-x-1.5 " +
                (activeFilter === f.id
                  ? "bg-slate-800 text-pink-300 border-pink-500/60 shadow-sm"
                  : "bg-slate-950/60 hover:bg-slate-900 text-slate-400 border-slate-800/80")
              }
            >
              <span>{f.label}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-900 text-slate-300">
                {f.count}
              </span>
            </button>
          ))}
        </div>

        {paginatedShifts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {paginatedShifts.map((s) => {
              const isPlaying = playingId === s.map.beatmapsetId;
              const isBuff = s.tierDelta > 0;
              const isMajorBuff = s.tierDelta >= 2;

              return (
                <div
                  key={s.map.id}
                  onClick={() => onSelectBeatmap && onSelectBeatmap(s.map)}
                  className={
                    "group relative rounded-2xl bg-slate-900/80 border p-3.5 transition-all duration-200 hover:scale-[1.01] hover:bg-slate-800/80 cursor-pointer shadow-lg space-y-3 " +
                    (s.isNewGraveyard
                      ? "border-purple-500/60 bg-purple-950/20"
                      : isMajorBuff
                      ? "border-pink-500/50 shadow-pink-950/20"
                      : isBuff
                      ? "border-emerald-500/40"
                      : "border-slate-800")
                  }
                >
                  <div className="flex items-center space-x-3">
                    <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-slate-950 flex-shrink-0 border border-slate-800">
                      <BeatmapCoverImage beatmap={s.map} alt={s.map.title} className="w-full h-full" />
                      <button
                        onClick={(e) => handlePlayToggle(e, s.map)}
                        className={
                          "absolute inset-0 flex items-center justify-center bg-black/50 transition-opacity " +
                          (isPlaying ? "opacity-100" : "opacity-0 group-hover:opacity-100")
                        }
                      >
                        {isPlaying ? (
                          <Square className="w-5 h-5 text-pink-400 fill-pink-400 animate-pulse" />
                        ) : (
                          <Play className="w-5 h-5 text-white fill-white" />
                        )}
                      </button>
                    </div>

                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center space-x-1.5">
                        <h4 className="text-xs font-bold text-white truncate group-hover:text-pink-400 transition-colors">
                          {s.map.title}
                        </h4>
                        {s.isNewGraveyard && (
                          <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-purple-950 border border-purple-500/40 text-purple-300 flex-shrink-0">
                            🪦 Landmark
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 truncate">{s.map.artist}</p>
                      <div className="flex items-center space-x-2 text-[10px] font-mono text-slate-500">
                        <span>★ {s.map.stars?.toFixed(2) || "4.00"}</span>
                        <span>•</span>
                        <span>{s.year}</span>
                        <span>•</span>
                        <span>{s.map.creator}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950/80 border border-slate-800/80">
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-400">
                        {s.oldRarity}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                      <span
                        className="text-[10px] font-mono font-bold px-2 py-0.5 rounded border shadow-sm flex items-center space-x-1"
                        style={{
                          color: RARITY_CONFIGS[s.currentRarity].color,
                          borderColor: RARITY_CONFIGS[s.currentRarity].color,
                          backgroundColor: RARITY_CONFIGS[s.currentRarity].color + "15",
                        }}
                      >
                        {s.currentRarity === "GOAT" && <span>🐐</span>}
                        <span>{s.currentRarity}</span>
                      </span>
                    </div>

                    <div className="flex items-center space-x-1 text-[11px] font-mono font-bold">
                      {s.isNewGraveyard ? (
                        <span className="text-purple-300 flex items-center space-x-0.5">
                          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                          <span>New Addition</span>
                        </span>
                      ) : s.tierDelta > 0 ? (
                        <span className="text-emerald-400 flex items-center space-x-0.5">
                          <TrendingUp className="w-3.5 h-3.5" />
                          <span>+{s.tierDelta} Tier{s.tierDelta > 1 ? "s" : ""}</span>
                        </span>
                      ) : s.tierDelta < 0 ? (
                        <span className="text-rose-400 flex items-center space-x-0.5">
                          <TrendingDown className="w-3.5 h-3.5" />
                          <span>{s.tierDelta} Tier{Math.abs(s.tierDelta) > 1 ? "s" : ""}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400">Rank #{s.currentRank}</span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 text-[10px] font-mono text-center">
                    <div className="p-1 rounded-lg bg-slate-950 border border-slate-800/60 text-slate-400">
                      <span className="text-slate-500 block text-[9px]">Plays</span>
                      <span className="text-slate-200 font-semibold">{formatNumber(s.map.playcount)}</span>
                    </div>
                    <div className="p-1 rounded-lg bg-slate-950 border border-slate-800/60 text-slate-400">
                      <span className="text-slate-500 block text-[9px]">Favs</span>
                      <span className="text-pink-300 font-semibold">{formatNumber(s.map.favouriteCount)}</span>
                    </div>
                    <div className="p-1 rounded-lg bg-slate-950 border border-slate-800/60 text-slate-400">
                      <span className="text-slate-500 block text-[9px]">Passion Rate</span>
                      <span className="text-cyan-300 font-semibold">{s.favRate}‰</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-12 text-center rounded-3xl bg-slate-900/50 border border-slate-800 space-y-2">
            <Filter className="w-8 h-8 text-slate-600 mx-auto animate-pulse" />
            <p className="text-sm font-bold text-slate-300 font-mono">No matching tier shifts found</p>
            <p className="text-xs text-slate-500 font-mono">Try adjusting your search query or filter chip.</p>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t border-slate-800 text-xs font-mono">
            <span className="text-slate-400">
              Page {currentPage} of {totalPages} ({filteredShifts.length.toLocaleString()} total shifted maps)
            </span>

            <div className="flex space-x-2">
              <button
                disabled={currentPage <= 1}
                onClick={() => {
                  setCurrentPage((p) => Math.max(1, p - 1));
                  window.scrollTo({ top: 400, behavior: "smooth" });
                }}
                className={
                  "px-3 py-1.5 rounded-xl border " +
                  (currentPage <= 1
                    ? "opacity-40 cursor-not-allowed bg-slate-900 text-slate-600 border-slate-800"
                    : "bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-700")
                }
              >
                Previous
              </button>

              <button
                disabled={currentPage >= totalPages}
                onClick={() => {
                  setCurrentPage((p) => Math.min(totalPages, p + 1));
                  window.scrollTo({ top: 400, behavior: "smooth" });
                }}
                className={
                  "px-3 py-1.5 rounded-xl border " +
                  (currentPage >= totalPages
                    ? "opacity-40 cursor-not-allowed bg-slate-900 text-slate-600 border-slate-800"
                    : "bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-700")
                }
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "k";
  return num.toLocaleString();
}