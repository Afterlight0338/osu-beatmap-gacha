import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Beatmap } from '../types/beatmap';
import { CollectionRecord } from '../types/collection';
import { BeatmapCard } from './BeatmapCard';
import { BeatmapDetailModal } from './BeatmapDetailModal';
import { RarityBadge } from './RarityBadge';
import { BeatmapCoverImage } from './BeatmapCoverImage';
import { RARITY_CONFIGS, compareRarities } from '../gacha/rarity';
import { previewPlayer } from '../audio/previewPlayer';
import { supabase } from '../lib/supabase';
import { sfx } from '../audio/sfx';
import {
  X,
  Heart,
  Layers,
  Crown,
  ExternalLink,
  Search,
  Play,
  Square,
  History,
  ShieldCheck,
  Disc,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { formatUserShortDateTime } from '../utils/timeFormat';

export interface LeaderboardUser {
  osu_id: number;
  username: string;
  avatar_url: string | null;
  country_code: string | null;
  global_rank: number | null;
  total_pulls: number;
  last_login: string;
  uniqueOwned?: number;
  totalCopies?: number;
  rareScore?: number;
  rarestBeatmap?: Beatmap | null;
}

interface UserProfileModalProps {
  user: LeaderboardUser | null;
  poolMap: Map<number, Beatmap>;
  isOpen: boolean;
  onClose: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  user,
  poolMap,
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'spotlight' | 'collection' | 'history'>('spotlight');
  const [collectionRecords, setCollectionRecords] = useState<CollectionRecord[]>([]);
  const [userHistory, setUserHistory] = useState<Array<{ id: string; beatmapId: number; rarity: string; pulledAt: number }>>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedRarity, setSelectedRarity] = useState<string>('ALL');
  const [selectedMapForDetail, setSelectedMapForDetail] = useState<Beatmap | null>(null);
  const [isPlayingRarest, setIsPlayingRarest] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const ITEMS_PER_PAGE = 24;

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen && user) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen, user]);

  // Fetch full user collection using multi-chunk pagination to get all records (fixes PostgREST 1000 limit)
  useEffect(() => {
    if (!isOpen || !user) return;

    let isMounted = true;
    setIsLoading(true);
    setCurrentPage(1);

    async function fetchUserData() {
      try {
        // Fetch up to 5,000 collection records in parallel chunks
        const [c1, c2, c3, c4, histRes] = await Promise.all([
          supabase
            .from('user_collection')
            .select('osu_id, beatmap_id, copies, is_favorite, first_pulled_at, last_pulled_at')
            .eq('osu_id', user!.osu_id)
            .range(0, 999),
          supabase
            .from('user_collection')
            .select('osu_id, beatmap_id, copies, is_favorite, first_pulled_at, last_pulled_at')
            .eq('osu_id', user!.osu_id)
            .range(1000, 1999),
          supabase
            .from('user_collection')
            .select('osu_id, beatmap_id, copies, is_favorite, first_pulled_at, last_pulled_at')
            .eq('osu_id', user!.osu_id)
            .range(2000, 2999),
          supabase
            .from('user_collection')
            .select('osu_id, beatmap_id, copies, is_favorite, first_pulled_at, last_pulled_at')
            .eq('osu_id', user!.osu_id)
            .range(3000, 4999),
          supabase
            .from('user_history')
            .select('id, beatmap_id, rarity, pulled_at')
            .eq('osu_id', user!.osu_id)
            .order('pulled_at', { ascending: false })
            .limit(50),
        ]);

        if (isMounted) {
          const allRows = [
            ...(c1.data || []),
            ...(c2.data || []),
            ...(c3.data || []),
            ...(c4.data || []),
          ];

          const records: CollectionRecord[] = allRows.map((c) => ({
            osuId: c.osu_id,
            beatmapId: c.beatmap_id,
            copies: c.copies,
            isFavorite: c.is_favorite,
            firstPulledAt: c.first_pulled_at,
            lastPulledAt: c.last_pulled_at,
          }));

          setCollectionRecords(records);

          if (histRes.data) {
            setUserHistory(
              histRes.data.map((h) => ({
                id: h.id,
                beatmapId: h.beatmap_id,
                rarity: h.rarity,
                pulledAt: h.pulled_at,
              }))
            );
          }
        }
      } catch (err) {
        console.warn('Error loading user profile cards:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    fetchUserData();
    return () => {
      isMounted = false;
      previewPlayer.pause();
    };
  }, [isOpen, user]);

  // Calculate Rarest Card and Favorites
  const { rarestCard, rarestRecord, favoriteCards, populatedCards } = useMemo(() => {
    let rarest: Beatmap | null = null;
    let rarestRec: CollectionRecord | null = null;
    const favs: Array<{ beatmap: Beatmap; record: CollectionRecord }> = [];
    const allPopulated: Array<{ beatmap: Beatmap; record: CollectionRecord }> = [];

    for (const rec of collectionRecords) {
      const map = poolMap.get(rec.beatmapId);
      if (!map) continue;

      allPopulated.push({ beatmap: map, record: rec });

      if (rec.isFavorite) {
        favs.push({ beatmap: map, record: rec });
      }

      if (!rarest || compareRarities(map.rarity, rarest.rarity) > 0 || (compareRarities(map.rarity, rarest.rarity) === 0 && map.stars > rarest.stars)) {
        rarest = map;
        rarestRec = rec;
      }
    }

    // Sort all populated by rarity descending
    allPopulated.sort((a, b) => compareRarities(b.beatmap.rarity, a.beatmap.rarity) || b.beatmap.stars - a.beatmap.stars);

    return {
      rarestCard: rarest,
      rarestRecord: rarestRec,
      favoriteCards: favs,
      populatedCards: allPopulated,
    };
  }, [collectionRecords, poolMap]);

  // Audio player synchronization
  useEffect(() => {
    if (!rarestCard) return;
    const unsub = previewPlayer.subscribe((playing, currentId) => {
      setIsPlayingRarest(playing && currentId === rarestCard.beatmapsetId);
    });
    return unsub;
  }, [rarestCard]);

  // Filtered collection with memoization
  const filteredCollection = useMemo(() => {
    return populatedCards.filter(({ beatmap }) => {
      if (selectedRarity !== 'ALL' && beatmap.rarity !== selectedRarity) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          beatmap.title.toLowerCase().includes(q) ||
          beatmap.artist.toLowerCase().includes(q) ||
          beatmap.creator.toLowerCase().includes(q) ||
          beatmap.version.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [populatedCards, selectedRarity, searchQuery]);

  // Paginated chunk (Prevents rendering thousands of cards at once!)
  const totalPages = Math.max(1, Math.ceil(filteredCollection.length / ITEMS_PER_PAGE));
  const validPage = Math.min(currentPage, totalPages);

  const paginatedCollection = useMemo(() => {
    const start = (validPage - 1) * ITEMS_PER_PAGE;
    return filteredCollection.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredCollection, validPage]);

  const handlePageChange = (page: number) => {
    sfx.playClick();
    setCurrentPage(Math.max(1, Math.min(totalPages, page)));
  };

  if (!isOpen || !user) return null;

  const handleRarestPlayToggle = () => {
    sfx.playClick();
    if (!rarestCard) return;
    if (isPlayingRarest) {
      previewPlayer.pause();
    } else {
      previewPlayer.play(rarestCard.beatmapsetId, rarestCard.previewUrl);
    }
  };

  const handleClose = () => {
    previewPlayer.pause();
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[9998] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/90 backdrop-blur-2xl animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-4xl rounded-t-3xl sm:rounded-2xl bg-[#11111d] border-t sm:border border-slate-700 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col my-0 sm:my-8 animate-slide-up sm:animate-scale-up">
        {/* Mobile Drag Handle */}
        <div className="sm:hidden flex justify-center pt-2 pb-1 bg-slate-950/80">
          <div className="w-10 h-1 rounded-full bg-slate-600/80" />
        </div>

        {/* User Hero Banner */}
        <div className="relative p-5 sm:p-6 bg-gradient-to-r from-slate-950 via-purple-950/40 to-slate-950 border-b border-slate-800 flex-shrink-0">
          {/* Close button */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/60 hover:bg-rose-600 text-slate-300 hover:text-white border border-white/10 transition-colors z-20"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            {/* User Info */}
            <div className="flex items-center space-x-4">
              <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden bg-slate-950 border-2 border-pink-500/60 shadow-xl shadow-pink-500/20 flex-shrink-0">
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
                ) : (
                  <Disc className="w-8 h-8 text-pink-400 m-auto" />
                )}
              </div>

              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide font-display">
                    {user.username}
                  </h2>
                  {user.country_code && (
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-pink-300 border border-slate-700">
                      {user.country_code}
                    </span>
                  )}
                  {user.username === 'RyoYamada' && (
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-red-950 text-red-300 border border-red-500/40 flex items-center space-x-1">
                      <ShieldCheck className="w-3 h-3" />
                      <span>Admin</span>
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-400">
                  <span>{user.global_rank ? `#${user.global_rank.toLocaleString()} Global` : `ID: ${user.osu_id}`}</span>
                  <span>•</span>
                  <a
                    href={`https://osu.ppy.sh/users/${user.osu_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-pink-400 hover:underline flex items-center space-x-1"
                  >
                    <span>osu! Profile</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-3 gap-2 w-full sm:w-auto">
              <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-center min-w-[80px]">
                <span className="text-[10px] font-mono text-slate-400 uppercase">Pulls</span>
                <p className="text-sm sm:text-base font-black text-pink-400 font-mono">
                  {user.total_pulls.toLocaleString()}
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-center min-w-[80px]">
                <span className="text-[10px] font-mono text-slate-400 uppercase">Unique</span>
                <p className="text-sm sm:text-base font-black text-purple-300 font-mono">
                  {collectionRecords.length.toLocaleString()}
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-center min-w-[80px]">
                <span className="text-[10px] font-mono text-slate-400 uppercase">Score</span>
                <p className="text-sm sm:text-base font-black text-amber-400 font-mono">
                  {(user.rareScore || 0).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center space-x-2 mt-4 pt-3 border-t border-slate-800/80">
            <button
              onClick={() => {
                sfx.playClick();
                setActiveTab('spotlight');
              }}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'spotlight'
                  ? 'bg-pink-600 text-white shadow-md shadow-pink-600/30'
                  : 'bg-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              <Crown className="w-3.5 h-3.5" />
              <span>Spotlight</span>
            </button>

            <button
              onClick={() => {
                sfx.playClick();
                setActiveTab('collection');
              }}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'collection'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                  : 'bg-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Full Collection ({collectionRecords.length.toLocaleString()})</span>
            </button>

            <button
              onClick={() => {
                sfx.playClick();
                setActiveTab('history');
              }}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'history'
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                  : 'bg-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Recent Pulls</span>
            </button>
          </div>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-3">
              <div className="w-10 h-10 rounded-full border-4 border-pink-500/30 border-t-pink-500 animate-spin" />
              <p className="text-xs font-mono text-slate-400">Loading {user.username}&apos;s collection...</p>
            </div>
          ) : (
            <>
              {/* TAB 1: SPOTLIGHT (Rarest Card & Favorites) */}
              {activeTab === 'spotlight' && (
                <div className="space-y-6">
                  {/* Rarest Card Showcase */}
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2 text-amber-300 font-mono text-xs font-bold uppercase tracking-wider">
                      <Crown className="w-4 h-4 text-amber-400" />
                      <span>👑 Rarest Beatmap Pulled</span>
                    </div>

                    {rarestCard ? (
                      <div
                        className="relative rounded-2xl overflow-hidden border-2 p-4 sm:p-5 bg-slate-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl"
                        style={{
                          borderColor: RARITY_CONFIGS[rarestCard.rarity]?.color || '#ffd700',
                          boxShadow: `0 0 30px ${RARITY_CONFIGS[rarestCard.rarity]?.glowColor || '#ffd70033'}`,
                        }}
                      >
                        {/* Cover Image */}
                        <div className="relative w-full sm:w-48 h-32 rounded-xl overflow-hidden bg-slate-900 flex-shrink-0">
                          <BeatmapCoverImage beatmap={rarestCard} alt={rarestCard.title} className="w-full h-full" />
                          <div className="absolute top-2 left-2">
                            <RarityBadge rarity={rarestCard.rarity} size="sm" />
                          </div>
                          <button
                            onClick={handleRarestPlayToggle}
                            className={`absolute bottom-2 right-2 p-2.5 rounded-full backdrop-blur-md border shadow-lg transition-all ${
                              isPlayingRarest
                                ? 'bg-pink-600 text-white border-pink-300 animate-pulse'
                                : 'bg-black/70 text-white border-white/20 hover:bg-pink-600'
                            }`}
                          >
                            {isPlayingRarest ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current translate-x-0.5" />}
                          </button>
                        </div>

                        {/* Song Info */}
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <h3 className="text-base sm:text-lg font-black text-white line-clamp-1 font-display">
                            {rarestCard.title}
                          </h3>
                          <p className="text-xs text-slate-300 line-clamp-1">{rarestCard.artist}</p>
                          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs font-mono">
                            <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-pink-400">
                              [{rarestCard.version}]
                            </span>
                            <span className="text-amber-400">★ {rarestCard.stars.toFixed(2)}</span>
                            <span className="text-slate-400">Mapped by {rarestCard.creator}</span>
                            {rarestRecord && rarestRecord.copies > 1 && (
                              <span className="px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-500/30">
                                x{rarestRecord.copies} copies
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Inspect Button */}
                        <button
                          onClick={() => setSelectedMapForDetail(rarestCard)}
                          className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-bold transition-colors w-full sm:w-auto text-center"
                        >
                          Inspect Card
                        </button>
                      </div>
                    ) : (
                      <div className="p-8 rounded-2xl bg-slate-900/40 border border-slate-800 text-center text-slate-500 font-mono text-xs">
                        No cards collected yet.
                      </div>
                    )}
                  </div>

                  {/* Favorited Cards Gallery */}
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2 text-pink-400 font-mono text-xs font-bold uppercase tracking-wider">
                      <Heart className="w-4 h-4 text-pink-500 fill-current" />
                      <span>Favorite Cards ({favoriteCards.length})</span>
                    </div>

                    {favoriteCards.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-3">
                        {favoriteCards.map(({ beatmap, record }) => (
                          <BeatmapCard
                            key={beatmap.id}
                            beatmap={beatmap}
                            copies={record.copies}
                            isFavorite={true}
                            size="sm"
                            onCardClick={() => setSelectedMapForDetail(beatmap)}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800 text-center text-slate-500 font-mono text-xs">
                        This player hasn&apos;t marked any beatmaps as favorite yet.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: FULL COLLECTION (Fast 24-Card Paginated Grid) */}
              {activeTab === 'collection' && (
                <div className="space-y-4">
                  {/* Search and Filters */}
                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <div className="relative flex-1 w-full">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search player's collection by title, artist, mapper..."
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setCurrentPage(1);
                        }}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-500"
                      />
                    </div>

                    {/* Rarity filter */}
                    <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
                      {['ALL', 'GOAT', 'Divine', 'Celestial', 'Mythic', 'Legendary', 'Epic', 'Rare', 'Common'].map((r) => (
                        <button
                          key={r}
                          onClick={() => {
                            setSelectedRarity(r);
                            setCurrentPage(1);
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold font-mono whitespace-nowrap transition-all ${
                            selectedRarity === r
                              ? 'bg-pink-600 text-white shadow-md'
                              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Summary Bar */}
                  <div className="flex items-center justify-between text-xs font-mono text-slate-400 px-1">
                    <span>Showing {filteredCollection.length.toLocaleString()} cards</span>
                    {totalPages > 1 && (
                      <span>Page {validPage} of {totalPages}</span>
                    )}
                  </div>

                  {/* Paginated 24-card Grid */}
                  {paginatedCollection.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-3">
                      {paginatedCollection.map(({ beatmap, record }) => (
                        <BeatmapCard
                          key={beatmap.id}
                          beatmap={beatmap}
                          copies={record.copies}
                          isFavorite={record.isFavorite}
                          size="sm"
                          onCardClick={() => setSelectedMapForDetail(beatmap)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 rounded-2xl bg-slate-900/40 border border-slate-800 text-center text-slate-500 font-mono text-xs">
                      No matching cards found in {user.username}&apos;s collection.
                    </div>
                  )}

                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center space-x-2 py-4 select-none font-mono text-xs">
                      <button
                        disabled={validPage === 1}
                        onClick={() => handlePageChange(1)}
                        className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800"
                        title="First Page"
                      >
                        <ChevronsLeft className="w-4 h-4" />
                      </button>

                      <button
                        disabled={validPage === 1}
                        onClick={() => handlePageChange(validPage - 1)}
                        className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800"
                        title="Previous Page"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>

                      <span className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-pink-400 font-bold">
                        {validPage} / {totalPages}
                      </span>

                      <button
                        disabled={validPage === totalPages}
                        onClick={() => handlePageChange(validPage + 1)}
                        className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800"
                        title="Next Page"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>

                      <button
                        disabled={validPage === totalPages}
                        onClick={() => handlePageChange(totalPages)}
                        className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800"
                        title="Last Page"
                      >
                        <ChevronsRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: RECENT HISTORY */}
              {activeTab === 'history' && (
                <div className="space-y-2 max-h-[55vh] overflow-y-auto">
                  {userHistory.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 font-mono text-xs">
                      No pull history recorded in Supabase for this player yet.
                    </div>
                  ) : (
                    userHistory.map((item) => {
                      const map = poolMap.get(item.beatmapId);
                      if (!map) return null;
                      return (
                        <div
                          key={item.id}
                          onClick={() => setSelectedMapForDetail(map)}
                          className="flex items-center justify-between p-3 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 transition-colors cursor-pointer group"
                        >
                          <div className="flex items-center space-x-3 min-w-0">
                            <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-950 flex-shrink-0">
                              <BeatmapCoverImage beatmap={map} alt={map.title} className="w-full h-full" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-xs sm:text-sm text-slate-200 group-hover:text-pink-400 transition-colors truncate">
                                {map.title}
                              </p>
                              <p className="text-[11px] text-slate-400 truncate">
                                {map.artist} • [{map.version}]
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2 flex-shrink-0">
                            <RarityBadge rarity={map.rarity} size="sm" showStars={false} />
                            <span className="text-[10px] font-mono text-slate-500">
                              {formatUserShortDateTime(item.pulledAt)}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Inspect Card Detail Modal */}
      {selectedMapForDetail && (
        <BeatmapDetailModal
          beatmap={selectedMapForDetail}
          record={collectionRecords.find((c) => c.beatmapId === selectedMapForDetail.id)}
          isOpen={selectedMapForDetail !== null}
          onClose={() => setSelectedMapForDetail(null)}
          onToggleFavorite={() => {}}
        />
      )}
    </div>,
    document.body
  );
};
