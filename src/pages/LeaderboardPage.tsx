import React, { useState, useEffect, useMemo } from 'react';
import { useGacha } from '../context/GachaContext';
import { supabase } from '../lib/supabase';
import { LeaderboardUser, UserProfileModal } from '../components/UserProfileModal';
import { RarityBadge } from '../components/RarityBadge';
import { compareRarities } from '../gacha/rarity';
import { Beatmap } from '../types/beatmap';
import { sfx } from '../audio/sfx';
import {
  Trophy,
  Sparkles,
  Crown,
  Search,
  RefreshCw,
  Disc,
} from 'lucide-react';

const RARITY_WEIGHTS: Record<string, number> = {
  EX: 150000,
  GOAT: 100000,
  Divine: 40000,
  Celestial: 15000,
  Mythic: 5000,
  Legendary: 1500,
  Epic: 350,
  'Rare+': 100,
  Rare: 60,
  'Uncommon+': 20,
  Uncommon: 10,
  Common: 2,
};

export const LeaderboardPage: React.FC = () => {
  const { pool } = useGacha();
  const poolMap = useMemo(() => new Map<number, Beatmap>(pool.map((m) => [m.id, m])), [pool]);

  const [rankingType, setRankingType] = useState<'pulls' | 'rare'>('pulls');
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedUser, setSelectedUser] = useState<LeaderboardUser | null>(null);

  // Fetch users & collection statistics from Supabase
  const loadLeaderboardData = async () => {
    setIsLoading(true);
    try {
      // PostgREST limits single requests to 1000 rows. Fetch collection in parallel chunks.
      const rangeChunks = [
        [0, 999], [1000, 1999], [2000, 2999], [3000, 3999],
        [4000, 4999], [5000, 5999], [6000, 6999], [7000, 7999],
        [8000, 8999], [9000, 9999], [10000, 10999], [11000, 11999],
        [12000, 12999], [13000, 13999], [14000, 14999], [15000, 15999],
        [16000, 16999], [17000, 17999], [18000, 19999]
      ];

      const [usersRes, ...chunkResponses] = await Promise.all([
        supabase
          .from('users')
          .select('osu_id, username, avatar_url, country_code, global_rank, total_pulls, last_login')
          .eq('is_banned', false)
          .order('total_pulls', { ascending: false }),
        ...rangeChunks.map(([from, to]) =>
          supabase
            .from('user_collection')
            .select('osu_id, beatmap_id, copies, is_favorite')
            .range(from, to)
        ),
      ]);

      if (usersRes.data) {
        const collectionsByUser = new Map<number, Array<{ beatmap_id: number; copies: number }>>();

        for (const chunk of chunkResponses) {
          if (chunk.data) {
            for (const item of chunk.data) {
              const list = collectionsByUser.get(item.osu_id) || [];
              list.push(item);
              collectionsByUser.set(item.osu_id, list);
            }
          }
        }

        const calculatedUsers: LeaderboardUser[] = usersRes.data.map((u) => {
          const userCards = collectionsByUser.get(u.osu_id) || [];
          let rareScore = 0;
          let rarest: Beatmap | null = null;

          for (const item of userCards) {
            const map = poolMap.get(item.beatmap_id);
            if (!map) continue;

            const weight = RARITY_WEIGHTS[map.rarity] || 2;
            rareScore += weight * Math.min(item.copies, 5);

            if (!rarest || compareRarities(map.rarity, rarest.rarity) > 0 || (compareRarities(map.rarity, rarest.rarity) === 0 && map.stars > rarest.stars)) {
              rarest = map;
            }
          }

          // Add unique count bonus
          rareScore += userCards.length * 10;

          return {
            ...u,
            uniqueOwned: userCards.length,
            rareScore,
            rarestBeatmap: rarest,
          };
        });

        setUsers(calculatedUsers);
      }
    } catch (err) {
      console.warn('Error loading leaderboard:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLeaderboardData();
  }, [poolMap]);

  // Sorted and filtered users
  const rankedUsers = useMemo(() => {
    const sorted = [...users].sort((a, b) => {
      if (rankingType === 'pulls') {
        return b.total_pulls - a.total_pulls || (b.rareScore || 0) - (a.rareScore || 0);
      } else {
        return (b.rareScore || 0) - (a.rareScore || 0) || b.total_pulls - a.total_pulls;
      }
    });

    if (!searchQuery.trim()) return sorted;
    const q = searchQuery.toLowerCase();
    return sorted.filter((u) => u.username.toLowerCase().includes(q) || u.osu_id.toString().includes(q));
  }, [users, rankingType, searchQuery]);

  const top3 = rankedUsers.slice(0, 3);

  const handleUserClick = (u: LeaderboardUser) => {
    sfx.playClick();
    setSelectedUser(u);
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 pb-16">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-md">
        <div className="flex items-center space-x-3">
          <div className="p-3 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 font-black shadow-lg shadow-amber-500/30">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-wide font-display">
              Global Player Leaderboard
            </h1>
            <p className="text-xs text-slate-400 font-mono">
              Live standings powered by Supabase PostgreSQL • Click any player to inspect cards
            </p>
          </div>
        </div>

        {/* Ranking Mode Toggle & Refresh */}
        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 flex-1 sm:flex-none">
            <button
              onClick={() => {
                sfx.playClick();
                setRankingType('pulls');
              }}
              className={`flex-1 sm:flex-none flex items-center justify-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                rankingType === 'pulls'
                  ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Most Pulls</span>
            </button>

            <button
              onClick={() => {
                sfx.playClick();
                setRankingType('rare');
              }}
              className={`flex-1 sm:flex-none flex items-center justify-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                rankingType === 'rare'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Crown className="w-3.5 h-3.5" />
              <span>Rare Cards Score</span>
            </button>
          </div>

          <button
            onClick={() => {
              sfx.playClick();
              loadLeaderboardData();
            }}
            disabled={isLoading}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-pink-400 transition-colors"
            title="Refresh Leaderboard"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Top 3 Podium Showcase */}
      {top3.length > 0 && !searchQuery.trim() && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          {/* #2 Silver (Left on desktop) */}
          {top3[1] && (
            <div
              onClick={() => handleUserClick(top3[1])}
              className="order-2 sm:order-1 p-5 rounded-2xl bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 border border-slate-600/60 hover:border-slate-400 shadow-xl space-y-3 cursor-pointer transition-all hover:scale-[1.02] relative group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-black px-2.5 py-1 rounded-full bg-slate-800 text-slate-200 border border-slate-600">
                  🥈 #2 Rank
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {rankingType === 'pulls' ? `${top3[1].total_pulls.toLocaleString()} Pulls` : `${(top3[1].rareScore || 0).toLocaleString()} Pts`}
                </span>
              </div>

              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-900 border border-slate-500 flex-shrink-0">
                  {top3[1].avatar_url ? (
                    <img src={top3[1].avatar_url} alt={top3[1].username} className="w-full h-full object-cover" />
                  ) : (
                    <Disc className="w-6 h-6 text-slate-400 m-auto" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-white text-sm group-hover:text-pink-400 transition-colors truncate">
                    {top3[1].username}
                  </p>
                  <p className="text-[11px] font-mono text-slate-400">
                    {top3[1].uniqueOwned || 0} unique cards
                  </p>
                </div>
              </div>

              {top3[1].rarestBeatmap && (
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="text-[10px] font-mono text-slate-500">Rarest:</span>
                  <RarityBadge rarity={top3[1].rarestBeatmap.rarity} size="sm" showStars={false} />
                </div>
              )}
            </div>
          )}

          {/* #1 Gold Crown (Center on desktop, elevated) */}
          {top3[0] && (
            <div
              onClick={() => handleUserClick(top3[0])}
              className="order-1 sm:order-2 p-5 sm:p-6 rounded-2xl bg-gradient-to-b from-amber-950/50 via-slate-950 to-slate-950 border-2 border-amber-400 shadow-2xl shadow-amber-500/20 space-y-3 cursor-pointer transition-all hover:scale-[1.03] relative group sm:-translate-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-black px-3 py-1 rounded-full bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/40 flex items-center space-x-1">
                  <Crown className="w-3.5 h-3.5 fill-current" />
                  <span>👑 CHAMPION #1</span>
                </span>
                <span className="text-xs font-mono font-bold text-amber-400">
                  {rankingType === 'pulls' ? `${top3[0].total_pulls.toLocaleString()} Pulls` : `${(top3[0].rareScore || 0).toLocaleString()} Pts`}
                </span>
              </div>

              <div className="flex items-center space-x-3.5">
                <div className="w-14 h-14 rounded-2xl overflow-hidden bg-slate-900 border-2 border-amber-400 shadow-lg shadow-amber-500/30 flex-shrink-0">
                  {top3[0].avatar_url ? (
                    <img src={top3[0].avatar_url} alt={top3[0].username} className="w-full h-full object-cover" />
                  ) : (
                    <Disc className="w-7 h-7 text-amber-400 m-auto" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-black text-white text-base group-hover:text-amber-400 transition-colors truncate font-display">
                    {top3[0].username}
                  </p>
                  <p className="text-xs font-mono text-amber-200/80">
                    {top3[0].uniqueOwned || 0} unique cards owned
                  </p>
                </div>
              </div>

              {top3[0].rarestBeatmap && (
                <div className="pt-2 border-t border-amber-500/30 flex items-center justify-between text-xs">
                  <span className="text-[10px] font-mono text-amber-300/70">Top Signature:</span>
                  <RarityBadge rarity={top3[0].rarestBeatmap.rarity} size="sm" />
                </div>
              )}
            </div>
          )}

          {/* #3 Bronze (Right on desktop) */}
          {top3[2] && (
            <div
              onClick={() => handleUserClick(top3[2])}
              className="order-3 p-5 rounded-2xl bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 border border-amber-700/60 hover:border-amber-500 shadow-xl space-y-3 cursor-pointer transition-all hover:scale-[1.02] relative group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-black px-2.5 py-1 rounded-full bg-amber-900/60 text-amber-300 border border-amber-700">
                  🥉 #3 Rank
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {rankingType === 'pulls' ? `${top3[2].total_pulls.toLocaleString()} Pulls` : `${(top3[2].rareScore || 0).toLocaleString()} Pts`}
                </span>
              </div>

              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-900 border border-amber-700 flex-shrink-0">
                  {top3[2].avatar_url ? (
                    <img src={top3[2].avatar_url} alt={top3[2].username} className="w-full h-full object-cover" />
                  ) : (
                    <Disc className="w-6 h-6 text-slate-400 m-auto" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-white text-sm group-hover:text-pink-400 transition-colors truncate">
                    {top3[2].username}
                  </p>
                  <p className="text-[11px] font-mono text-slate-400">
                    {top3[2].uniqueOwned || 0} unique cards
                  </p>
                </div>
              </div>

              {top3[2].rarestBeatmap && (
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="text-[10px] font-mono text-slate-500">Rarest:</span>
                  <RarityBadge rarity={top3[2].rarestBeatmap.rarity} size="sm" showStars={false} />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Search Bar */}
      <div className="relative w-full">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search leaderboard players by username or osu! ID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-slate-900/90 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-500 backdrop-blur-md"
        />
      </div>

      {/* Full Leaderboard Table */}
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden shadow-2xl backdrop-blur-md">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <div className="w-10 h-10 rounded-full border-4 border-pink-500/30 border-t-pink-500 animate-spin" />
            <p className="text-xs font-mono text-slate-400">Syncing live standings from Supabase...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/70 text-slate-400 font-mono uppercase text-[11px]">
                  <th className="py-3.5 px-4 text-center w-16">Rank</th>
                  <th className="py-3.5 px-4">Player</th>
                  <th className="py-3.5 px-4 text-center">osu! Rank</th>
                  <th className="py-3.5 px-4 text-right">Lifetime Pulls</th>
                  <th className="py-3.5 px-4 text-right">Unique Cards</th>
                  <th className="py-3.5 px-4 text-right">Collector Score</th>
                  <th className="py-3.5 px-4 text-center hidden md:table-cell">Rarest Card</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {rankedUsers.map((u, idx) => {
                  const rankNumber = idx + 1;
                  return (
                    <tr
                      key={u.osu_id}
                      onClick={() => handleUserClick(u)}
                      className="hover:bg-slate-800/60 transition-colors cursor-pointer group"
                    >
                      {/* Rank Number */}
                      <td className="py-3.5 px-4 text-center font-mono font-bold">
                        {rankNumber === 1 ? (
                          <span className="text-amber-400 text-sm">👑 1</span>
                        ) : rankNumber === 2 ? (
                          <span className="text-slate-300 text-sm">🥈 2</span>
                        ) : rankNumber === 3 ? (
                          <span className="text-amber-600 text-sm">🥉 3</span>
                        ) : (
                          <span className="text-slate-500">#{rankNumber}</span>
                        )}
                      </td>

                      {/* Player Username & Avatar */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-9 h-9 rounded-xl overflow-hidden bg-slate-950 border border-slate-700 flex-shrink-0 group-hover:border-pink-500 transition-colors">
                            {u.avatar_url ? (
                              <img src={u.avatar_url} alt={u.username} className="w-full h-full object-cover" />
                            ) : (
                              <Disc className="w-5 h-5 text-slate-500 m-auto" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center space-x-1.5">
                              <span className="font-bold text-white group-hover:text-pink-400 transition-colors">
                                {u.username}
                              </span>
                              {u.country_code && (
                                <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-slate-800 text-slate-300">
                                  {u.country_code}
                                </span>
                              )}
                              {u.username === 'RyoYamada' && (
                                <span className="text-[9px] font-mono px-1 rounded bg-red-950 text-red-300 border border-red-500/30">
                                  ADMIN
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] font-mono text-slate-500">ID: {u.osu_id}</span>
                          </div>
                        </div>
                      </td>

                      {/* osu! Rank */}
                      <td className="py-3.5 px-4 text-center font-mono text-slate-400">
                        {u.global_rank ? `#${u.global_rank.toLocaleString()}` : '-'}
                      </td>

                      {/* Total Lifetime Pulls */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-pink-400">
                        {u.total_pulls.toLocaleString()}
                      </td>

                      {/* Unique Cards */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-purple-300">
                        {u.uniqueOwned ? u.uniqueOwned.toLocaleString() : '0'}
                      </td>

                      {/* Collector Score */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-amber-400">
                        {(u.rareScore || 0).toLocaleString()}
                      </td>

                      {/* Rarest Card */}
                      <td className="py-3.5 px-4 text-center hidden md:table-cell">
                        {u.rarestBeatmap ? (
                          <RarityBadge rarity={u.rarestBeatmap.rarity} size="sm" showStars={false} />
                        ) : (
                          <span className="text-slate-600 font-mono">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* User Profile Modal on row click */}
      {selectedUser && (
        <UserProfileModal
          user={selectedUser}
          poolMap={poolMap}
          isOpen={selectedUser !== null}
          onClose={() => setSelectedUser(null)}
        />
      )}
    </div>
  );
};
