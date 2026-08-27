import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useGacha } from '../context/GachaContext';
import { isAdmin } from '../config/admin';
import { DEFAULT_RARITY_RATES } from '../gacha/probabilities';
import { Beatmap, RarityTier } from '../types/beatmap';
import { RarityRates } from '../types/gacha';
import {
  ShieldAlert, Users, Database, RefreshCw, Trash2, Activity, TrendingUp,
  Star, Clock, AlertTriangle, ChevronDown, ChevronUp, Search, Crown,
  Zap, PlusCircle, Edit3, Sliders, BarChart3, Save, X, Wrench, Gift, Table,
  CheckCircle2, Bell, Sparkles, Send, ArrowLeftRight, Target, Undo2,
  Flame, Package,
} from 'lucide-react';
import { formatUserDateTime, formatUserDate } from '../utils/timeFormat';
import { supabase } from '../lib/supabase';
import { injectionService, PullInjection } from '../services/injectionService';
import { giftingService, PlayerTransaction } from '../services/giftingService';
import { tradingService, PlayerTrade } from '../services/tradingService';
import { fetchBeatmapMetadata, FetchedBeatmapMetadata } from '../services/beatmapFetchService';
import { Bounty, BountyPack, BountyRankRequirement } from '../types/bounty';
import {
  fetchBossBounties,
  saveBossBounties,
  fetchBountyPacks,
  saveBountyPacks,
} from '../services/bountyService';

const RARITY_ORDER: RarityTier[] = ['GOAT','EX','Divine','Celestial','Mythic','Legendary','Epic','Rare','Uncommon+','Uncommon','Common'];
const RARITY_COLORS: Record<string, string> = {
  EX:'text-purple-300', GOAT:'text-yellow-300', Divine:'text-purple-300', Celestial:'text-cyan-300',
  Mythic:'text-pink-300', Legendary:'text-orange-300', Epic:'text-violet-300',
  Rare:'text-blue-300', 'Uncommon+':'text-teal-300', Uncommon:'text-green-300', Common:'text-slate-400',
};

interface AdminStats {
  totalUsers: number;
  totalSessions: number;
  totalCollectionRecords: number;
  totalHistoryRecords: number;
  topUsers: {
    osuId: number;
    username: string;
    avatarUrl: string | null;
    globalRank: number | null;
    totalPulls: number;
    uniqueCards: number;
    lastLogin: string;
  }[];
  recentLogins: {
    osuId: number;
    username: string;
    avatarUrl: string | null;
    lastLogin: string;
    totalPulls: number;
  }[];
}

interface UserCollCard {
  beatmapId: number;
  title: string;
  artist: string;
  version: string;
  stars: number;
  rarity: RarityTier;
  copies: number;
  firstPulledAt: number;
  lastPulledAt: number;
  isFavorite: boolean;
}

type AdminTab = 'overview' | 'events' | 'cards' | 'bounties' | 'announcements' | 'users' | 'transactions' | 'rewards' | 'inspector' | 'config';

const AdminPage: React.FC = () => {
  const { user } = useAuth();
  const {
    pool,
    energy,
    adminRefillEnergy,
    cardOverrides,
    setCardTierOverride,
    removeCardTierOverride,
    customBeatmaps,
    addCustomBeatmap,
    removeCustomBeatmap,
  } = useGacha();

  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [expandedUser, setExpandedUser] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionMsg, setActionMsg] = useState<{text:string;ok:boolean}|null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Cards Sub-Tab: Tier Assignment vs Add Custom Beatmap
  const [cardsSubTab, setCardsSubTab] = useState<'tier_assignment' | 'add_beatmap'>('tier_assignment');

  // Manual Card Tier & EX Assignment state
  const [cardAssignSearch, setCardAssignSearch] = useState('');
  const [selectedAssignCardId, setSelectedAssignCardId] = useState<number | null>(null);
  const [assignTier, setAssignTier] = useState<RarityTier>('EX');
  const [assignExReason, setAssignExReason] = useState('');

  // Register / Inject Custom Beatmap state
  const [autofillUrlInput, setAutofillUrlInput] = useState('');
  const [isAutofilling, setIsAutofilling] = useState(false);
  const [manualMapId, setManualMapId] = useState('');
  const [manualSetId, setManualSetId] = useState('');
  const [manualTitle, setManualTitle] = useState('');
  const [manualArtist, setManualArtist] = useState('');
  const [manualCreator, setManualCreator] = useState('');
  const [manualVersion, setManualVersion] = useState('Extra');
  const [manualStars, setManualStars] = useState('6.00');
  const [manualBpm, setManualBpm] = useState('180');
  const [manualLength, setManualLength] = useState('210');
  const [manualPlaycount, setManualPlaycount] = useState('10000');
  const [manualFavouriteCount, setManualFavouriteCount] = useState('100');
  const [manualStatus, setManualStatus] = useState<'ranked' | 'loved' | 'graveyard'>('ranked');
  const [manualRarity, setManualRarity] = useState<RarityTier>('Epic');
  const [manualExReason, setManualExReason] = useState('');
  const [manualCoverUrl, setManualCoverUrl] = useState('');
  const [manualPreviewUrl, setManualPreviewUrl] = useState('');

  // User management state
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedUsername, setSelectedUsername] = useState<string>('');
  const [userColl, setUserColl] = useState<UserCollCard[]>([]);
  const [userCollLoading, setUserCollLoading] = useState(false);
  const [userCollSearch, setUserCollSearch] = useState('');
  const [userCollRarity, setUserCollRarity] = useState<string>('All');
  const [userCollPage, setUserCollPage] = useState(1);
  const [pullsInput, setPullsInput] = useState('');
  const [pullsMode, setPullsMode] = useState<'set'|'add'>('add');
  const [energyInput, setEnergyInput] = useState('50');
  const [addCardId, setAddCardId] = useState('');
  const [addCardSearch, setAddCardSearch] = useState('');
  const [addCardCopies, setAddCardCopies] = useState('1');
  const [addCardRarity, setAddCardRarity] = useState<RarityTier>('Common');
  const [editingCard, setEditingCard] = useState<{beatmapId:number;copies:number}|null>(null);

  // Mass Rewards state
  const [rewardType, setRewardType] = useState<'stamina' | 'pulls' | 'card'>('stamina');
  const [rewardAmount, setRewardAmount] = useState('50');
  const [rewardCardId, setRewardCardId] = useState('');
  const [rewardCardSearch, setRewardCardSearch] = useState('');
  const [rewardCardCopies, setRewardCardCopies] = useState('1');
  const [rewardCardRarity, setRewardCardRarity] = useState<RarityTier>('Legendary');

  // Database Inspector state
  const [selectedTable, setSelectedTable] = useState<string>('users');
  const [tableData, setTableData] = useState<{ rows: Record<string, unknown>[]; total: number; limit: number; offset: number } | null>(null);
  const [tableLoading, setTableLoading] = useState(false);
  const [tableOffset, setTableOffset] = useState(0);

  // Event Presets state
  const [eventName, setEventName] = useState('Weekend Fever: 2x Boost & Fast Stamina');
  const [eventDesc, setEventDesc] = useState('Special weekend celebration! Enjoy 5s turbo stamina recharge and 2x higher Legendary/Mythic/Divine rates!');
  const [fastRecharge, setFastRecharge] = useState(true);
  const [rateMultiplier, setRateMultiplier] = useState(2);
  const [bonusDropRate, setBonusDropRate] = useState(true);
  const [eventDurationHours, setEventDurationHours] = useState(24);
  const [activeEventData, setActiveEventData] = useState<any>(null);

  // Announcements state
  const [annTitle, setAnnTitle] = useState('Welcome to osu! Beatmap Gacha');
  const [annMessage, setAnnMessage] = useState('Welcome summoners! Collect over 50,000+ ranked beatmaps from 2007 to present. Sign in to sync your collection across all devices.');
  const [annType, setAnnType] = useState<'info' | 'event' | 'update' | 'giveaway'>('event');
  const [annBonusStamina, setAnnBonusStamina] = useState(50);
  const [annDurationHours, setAnnDurationHours] = useState(48);
  const [activeAnnData, setActiveAnnData] = useState<any>(null);

  // Mini Broadcast state
  const [miniMsg, setMiniMsg] = useState('');
  const [miniBadge, setMiniBadge] = useState('ADMIN NOTE');
  const [miniType, setMiniType] = useState<'info' | 'success' | 'warning' | 'tip' | 'event'>('info');
  const [miniLinkUrl, setMiniLinkUrl] = useState('');
  const [miniLinkText, setMiniLinkText] = useState('');
  const [activeMiniBroadcast, setActiveMiniBroadcast] = useState<any>(null);

  // Bounties & Boss Raids state
  const [bountiesSubTab, setBountiesSubTab] = useState<'boss_songs' | 'bounty_packs'>('boss_songs');
  const [bossList, setBossList] = useState<Bounty[]>([]);
  const [bossUrlInput, setBossUrlInput] = useState('');
  const [isFetchingBossMeta, setIsFetchingBossMeta] = useState(false);
  const [bossFetchedMeta, setBossFetchedMeta] = useState<FetchedBeatmapMetadata | null>(null);
  const [bossLoreReason, setBossLoreReason] = useState('');
  const [bossObjective, setBossObjective] = useState('');
  const [bossMinRank, setBossMinRank] = useState<BountyRankRequirement>('Pass');
  const [bossReqMods, setBossReqMods] = useState('None');
  const [bossRewardStamina, setBossRewardStamina] = useState('300');
  const [bossRewardPoints, setBossRewardPoints] = useState('300');
  const [bossAddToPoolIfMissing, setBossAddToPoolIfMissing] = useState(true);
  const [bossPoolRarity, setBossPoolRarity] = useState<RarityTier>('EX');

  // Bounty Pack Builder state
  const [packsList, setPacksList] = useState<BountyPack[]>([]);
  const [packTitle, setPackTitle] = useState('');
  const [packDescription, setPackDescription] = useState('');
  const [packThemeColor, setPackThemeColor] = useState<'red' | 'purple' | 'amber' | 'emerald' | 'cyan'>('amber');
  const [packBonusStamina, setPackBonusStamina] = useState('500');
  const [packBonusPoints, setPackBonusPoints] = useState('500');
  const [packBadgeTitle, setPackBadgeTitle] = useState('');
  const [packDraftBounties, setPackDraftBounties] = useState<Bounty[]>([]);
  const [packMapInput, setPackMapInput] = useState('');
  const [isFetchingPackMap, setIsFetchingPackMap] = useState(false);
  const [packMapMeta, setPackMapMeta] = useState<FetchedBeatmapMetadata | null>(null);
  const [packMapObjective, setPackMapObjective] = useState('');
  const [packMapMinRank, setPackMapMinRank] = useState<BountyRankRequirement>('A');
  const [packMapReqMods, setPackMapReqMods] = useState('None');
  const [packMapStamina, setPackMapStamina] = useState('60');
  const [packMapPoints, setPackMapPoints] = useState('35');

  // Config state
  const [configRates, setConfigRates] = useState<RarityRates>({...DEFAULT_RARITY_RATES});
  const [configStamina, setConfigStamina] = useState<{max:number;regenSeconds:number}>({max:50,regenSeconds:15});
  const [ratesTotal, setRatesTotal] = useState(1.0);

  // Maintenance & Server Control state
  const [maintenanceEnabled, setMaintenanceEnabled] = useState<boolean>(true);
  const [maintenanceTitle, setMaintenanceTitle] = useState('Emergency Maintenance');
  const [maintenanceHeadline, setMaintenanceHeadline] = useState('Database Engine Maintenance & Data Integrity Protection');
  const [maintenanceMessage, setMaintenanceMessage] = useState('osu! Beatmap Gacha is currently in emergency maintenance mode while we conduct database recovery and engine optimization. Player collections and sync pipelines are temporarily paused to protect data integrity.');
  const [maintenanceEstimatedTime, setMaintenanceEstimatedTime] = useState('Back online soon');
  const [maintenanceSaving, setMaintenanceSaving] = useState(false);
  const [dbRepairing, setDbRepairing] = useState(false);
  const [dbRepairResults, setDbRepairResults] = useState<string | null>(null);

  // Player Transactions & Gifts state
  const [transactions, setTransactions] = useState<PlayerTransaction[]>([]);
  const [trades, setTrades] = useState<PlayerTrade[]>([]);
  const [txTypeFilter, setTxTypeFilter] = useState<'all' | 'gifts' | 'trades'>('all');
  const [txSearch, setTxSearch] = useState<string>('');
  const [txFilter, setTxFilter] = useState<'all' | 'pending' | 'claimed' | 'accepted' | 'revoked'>('all');
  const [txLoading, setTxLoading] = useState<boolean>(false);

  // Secret Pull Injections (Destiny Drop) state
  const [injections, setInjections] = useState<Record<string, PullInjection>>({});
  const [injectSearch, setInjectSearch] = useState<string>('');
  const [selectedInjectBeatmap, setSelectedInjectBeatmap] = useState<Beatmap | null>(null);

  if (!isAdmin(user?.username)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 text-center">
        <ShieldAlert className="w-16 h-16 text-red-500" />
        <h2 className="text-2xl font-black text-red-400">Access Denied</h2>
        <p className="text-slate-400 font-mono text-sm">Restricted to administrator RyoYamada.</p>
      </div>
    );
  }

  const poolMap = useMemo(() => new Map<number, Beatmap>(pool.map((m) => [m.id, m])), [pool]);

  const showMsg = (text: string, ok = true) => {
    setActionMsg({ text, ok });
    setTimeout(() => setActionMsg(null), 5000);
  };

  // ─── Direct Supabase Overview Stats ─────────────────────────
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError(null);
    try {
      const [
        { count: totalUsers },
        { count: totalSessions },
        { count: totalCollectionRecords },
        { count: totalHistoryRecords },
        { data: users, error: uErr },
      ] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('user_sessions').select('*', { count: 'exact', head: true }),
        supabase.from('user_collection').select('*', { count: 'exact', head: true }),
        supabase.from('user_history').select('*', { count: 'exact', head: true }),
        supabase.from('users').select('*'),
      ]);

      if (uErr) throw new Error(uErr.message);

      // Fetch user collection copies to compute exact unique cards & total pulls
      const pageSize = 1000;
      const totalPages = Math.max(1, Math.ceil((totalCollectionRecords || 0) / pageSize));
      const chunkPromises = [];
      for (let i = 0; i < totalPages; i++) {
        chunkPromises.push(
          supabase.from('user_collection').select('osu_id, copies').range(i * pageSize, (i + 1) * pageSize - 1)
        );
      }

      const chunkResults = await Promise.all(chunkPromises);
      const userCollCounts = new Map<number, { unique: number; copies: number }>();
      for (const cRes of chunkResults) {
        if (cRes.data) {
          for (const item of cRes.data) {
            const prev = userCollCounts.get(item.osu_id) || { unique: 0, copies: 0 };
            prev.unique += 1;
            prev.copies += item.copies || 1;
            userCollCounts.set(item.osu_id, prev);
          }
        }
      }

      const topUsers = (users || [])
        .map((u) => {
          const cStats = userCollCounts.get(u.osu_id) || { unique: 0, copies: 0 };
          const safePulls = Math.max(u.total_pulls || 0, cStats.copies, cStats.unique);
          return {
            osuId: u.osu_id,
            username: u.username,
            avatarUrl: u.avatar_url,
            globalRank: u.global_rank,
            totalPulls: safePulls,
            uniqueCards: cStats.unique,
            lastLogin: u.last_login,
          };
        })
        .sort((a, b) => b.totalPulls - a.totalPulls);

      const recentLogins = [...(users || [])]
        .sort((a, b) => new Date(b.last_login || 0).getTime() - new Date(a.last_login || 0).getTime())
        .slice(0, 10)
        .map((u) => {
          const cStats = userCollCounts.get(u.osu_id) || { unique: 0, copies: 0 };
          return {
            osuId: u.osu_id,
            username: u.username,
            avatarUrl: u.avatar_url,
            lastLogin: u.last_login,
            totalPulls: Math.max(u.total_pulls || 0, cStats.copies, cStats.unique),
          };
        });

      setStats({
        totalUsers: totalUsers || 0,
        totalSessions: totalSessions || 0,
        totalCollectionRecords: totalCollectionRecords || 0,
        totalHistoryRecords: totalHistoryRecords || 0,
        topUsers,
        recentLogins,
      });
    } catch (e: any) {
      setStatsError(e instanceof Error ? e.message : 'Failed to load stats');
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // ─── Maintenance & Server Handlers ───────────────────────────
  const loadMaintenanceConfig = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('admin_config')
        .select('value')
        .eq('key', 'maintenance_mode')
        .maybeSingle();

      if (data && data.value) {
        setMaintenanceEnabled(!!data.value.enabled);
        if (data.value.title) setMaintenanceTitle(data.value.title);
        if (data.value.headline) setMaintenanceHeadline(data.value.headline);
        if (data.value.message) setMaintenanceMessage(data.value.message);
        if (data.value.estimatedTime) setMaintenanceEstimatedTime(data.value.estimatedTime);
      }
    } catch (e) {
      console.warn('Failed to load maintenance config:', e);
    }
  }, []);

  const handleToggleMaintenance = async (newEnabled: boolean) => {
    setMaintenanceSaving(true);
    try {
      const payload = {
        enabled: newEnabled,
        title: maintenanceTitle,
        headline: maintenanceHeadline,
        message: maintenanceMessage,
        estimatedTime: maintenanceEstimatedTime,
        updated_at: new Date().toISOString(),
        updated_by: user?.username || 'Admin',
      };

      const { error } = await supabase.from('admin_config').upsert({
        key: 'maintenance_mode',
        value: payload,
        updated_at: new Date().toISOString(),
      });

      if (!error) {
        setMaintenanceEnabled(newEnabled);
        // Also trigger force refresh broadcast so all clients reload immediately
        await supabase.from('admin_config').upsert({
          key: 'force_client_refresh',
          value: {
            timestamp: Date.now(),
            reason: newEnabled ? 'Maintenance Enabled' : 'Maintenance Disabled - Site Live',
          },
          updated_at: new Date().toISOString(),
        });

        showMsg(
          newEnabled
            ? '🚨 Emergency Maintenance is now ACTIVE for all non-admin users'
            : '🟢 Maintenance turned OFF — Website is LIVE for all players!'
        );
      } else {
        showMsg(`Error: ${error.message}`, false);
      }
    } catch (err: any) {
      showMsg(`Failed: ${err.message}`, false);
    } finally {
      setMaintenanceSaving(false);
    }
  };

  const handleSaveMaintenanceText = async () => {
    setMaintenanceSaving(true);
    try {
      const payload = {
        enabled: maintenanceEnabled,
        title: maintenanceTitle,
        headline: maintenanceHeadline,
        message: maintenanceMessage,
        estimatedTime: maintenanceEstimatedTime,
        updated_at: new Date().toISOString(),
        updated_by: user?.username || 'Admin',
      };

      const { error } = await supabase.from('admin_config').upsert({
        key: 'maintenance_mode',
        value: payload,
        updated_at: new Date().toISOString(),
      });

      if (!error) {
        showMsg('✓ Maintenance screen text configuration saved successfully!');
      } else {
        showMsg(`Error: ${error.message}`, false);
      }
    } catch (err: any) {
      showMsg(`Failed: ${err.message}`, false);
    } finally {
      setMaintenanceSaving(false);
    }
  };

  const handleBroadcastRefresh = async () => {
    try {
      const ts = Date.now();
      await supabase.from('admin_config').upsert({
        key: 'force_client_refresh',
        value: {
          timestamp: ts,
          reason: 'Admin Manual Trigger',
        },
        updated_at: new Date().toISOString(),
      });
      showMsg('🔄 Global force-refresh signal sent to all connected users!');
    } catch (e: any) {
      showMsg(`Failed: ${e.message}`, false);
    }
  };

  const handleRepairDatabaseStats = async () => {
    setDbRepairing(true);
    setDbRepairResults(null);
    try {
      const { data: users, error: uErr } = await supabase.from('users').select('*');
      if (uErr || !users) throw new Error(uErr?.message || 'Could not fetch users');

      let repairedCount = 0;
      const logs: string[] = [];

      for (const u of users) {
        let allCards: { copies: number }[] = [];
        let page = 0;
        const pageSize = 1000;
        while (true) {
          const { data, error } = await supabase
            .from('user_collection')
            .select('copies')
            .eq('osu_id', u.osu_id)
            .range(page * pageSize, (page + 1) * pageSize - 1);
          if (error || !data || data.length === 0) break;
          allCards = allCards.concat(data);
          if (data.length < pageSize) break;
          page++;
        }

        const totalCopies = allCards.reduce((acc, c) => acc + (c.copies || 1), 0);
        const correctedPulls = Math.max(u.total_pulls || 0, totalCopies, allCards.length);

        if (correctedPulls > (u.total_pulls || 0)) {
          await supabase.from('users').update({ total_pulls: correctedPulls }).eq('osu_id', u.osu_id);
          repairedCount++;
          logs.push(`${u.username}: ${u.total_pulls} ➔ ${correctedPulls} pulls (${allCards.length} unique cards)`);
        }
      }

      setDbRepairResults(
        `Audited ${users.length} accounts. Repaired ${repairedCount} accounts:\n` +
          (logs.length > 0 ? logs.join('\n') : 'All accounts already 100% verified and synchronized!')
      );
      showMsg(`✓ Database audit complete! ${repairedCount} accounts repaired.`);
      fetchStats();
    } catch (e: any) {
      showMsg(`Repair failed: ${e.message}`, false);
    } finally {
      setDbRepairing(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'overview') {
      fetchStats();
      loadMaintenanceConfig();
    }
  }, [activeTab, fetchStats, loadMaintenanceConfig]);

  // ─── Direct Supabase User Management ────────────────────────
  const fetchUserColl = useCallback(
    async (osuId: number) => {
      setUserCollLoading(true);
      try {
        const { data: uData } = await supabase.from('users').select('username').eq('osu_id', osuId).maybeSingle();
        setSelectedUsername(uData?.username || String(osuId));

        const { count } = await supabase
          .from('user_collection')
          .select('*', { count: 'exact', head: true })
          .eq('osu_id', osuId);

        const totalPages = Math.max(1, Math.ceil((count || 0) / 1000));
        const pagePromises = [];
        for (let p = 0; p < totalPages; p++) {
          pagePromises.push(
            supabase
              .from('user_collection')
              .select('beatmap_id, copies, first_pulled_at, last_pulled_at, is_favorite')
              .eq('osu_id', osuId)
              .range(p * 1000, (p + 1) * 1000 - 1)
          );
        }

        const results = await Promise.all(pagePromises);
        const cards: UserCollCard[] = [];
        for (const res of results) {
          if (res.data) {
            for (const c of res.data) {
              const map = poolMap.get(c.beatmap_id);
              cards.push({
                beatmapId: c.beatmap_id,
                title: map?.title || `Beatmap #${c.beatmap_id}`,
                artist: map?.artist || 'Unknown Artist',
                version: map?.version || 'Normal',
                stars: map?.stars || 0,
                rarity: map?.rarity || 'Common',
                copies: c.copies,
                firstPulledAt: c.first_pulled_at,
                lastPulledAt: c.last_pulled_at,
                isFavorite: c.is_favorite,
              });
            }
          }
        }

        setUserColl(cards);
        setUserCollPage(1);
      } catch (e: any) {
        showMsg(e.message || 'Failed to load collection', false);
      } finally {
        setUserCollLoading(false);
      }
    },
    [poolMap]
  );

  const filteredUserColl = useMemo(() => {
    let list = userColl;
    if (userCollRarity !== 'All') {
      list = list.filter((c) => c.rarity === userCollRarity);
    }
    if (userCollSearch.trim()) {
      const q = userCollSearch.trim().toLowerCase();
      list = list.filter((c) => {
        return (
          String(c.beatmapId).includes(q) ||
          c.title.toLowerCase().includes(q) ||
          c.artist.toLowerCase().includes(q) ||
          c.version.toLowerCase().includes(q)
        );
      });
    }
    return list;
  }, [userColl, userCollRarity, userCollSearch]);

  const USER_COLL_PAGE_SIZE = 50;
  const totalUserCollPages = Math.max(1, Math.ceil(filteredUserColl.length / USER_COLL_PAGE_SIZE));
  const paginatedUserColl = useMemo(() => {
    const start = (userCollPage - 1) * USER_COLL_PAGE_SIZE;
    return filteredUserColl.slice(start, start + USER_COLL_PAGE_SIZE);
  }, [filteredUserColl, userCollPage]);

  const handleSetPulls = async (osuId: number) => {
    if (!pullsInput) return;
    setActionLoading(true);
    try {
      let newPulls = Number(pullsInput);
      if (pullsMode === 'add') {
        const { data: curr } = await supabase.from('users').select('total_pulls').eq('osu_id', osuId).maybeSingle();
        newPulls = (curr?.total_pulls || 0) + Number(pullsInput);
      }
      await supabase.from('users').update({ total_pulls: newPulls }).eq('osu_id', osuId);
      showMsg(`✓ ${selectedUsername}'s total pulls updated to ${newPulls}`);
      fetchStats();
    } catch (e: any) {
      showMsg(e.message || 'Failed to update pulls', false);
    } finally {
      setActionLoading(false);
      setPullsInput('');
    }
  };

  const handleEnergyOverride = async (osuId: number) => {
    const amount = Number(energyInput);
    if (!amount || amount < 1) return;
    setActionLoading(true);
    try {
      if (osuId === user?.osuId) await adminRefillEnergy(amount);
      await supabase.from('user_energy_overrides').upsert({
        osu_id: osuId,
        energy_amount: amount,
      });
      showMsg(`⚡ Energy override of ${amount} queued for ${selectedUsername}`);
    } catch (e: any) {
      showMsg(e.message || 'Failed to set energy override', false);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAutoFillBeatmap = async (queryOverride?: string) => {
    const query = (queryOverride || autofillUrlInput || manualMapId || manualSetId || '').trim();
    if (!query) {
      showMsg('Please enter a Beatmap ID, Set ID, or paste a link from hinamizawa.ai / osu.ppy.sh', false);
      return;
    }
    setIsAutofilling(true);
    try {
      const data = await fetchBeatmapMetadata(query);
      if (!data) {
        showMsg('Could not parse or fetch beatmap info from that input.', false);
        return;
      }
      if (data.id) setManualMapId(String(data.id));
      if (data.beatmapsetId) setManualSetId(String(data.beatmapsetId));
      if (data.title) setManualTitle(data.title);
      if (data.artist) setManualArtist(data.artist);
      if (data.creator) setManualCreator(data.creator);
      if (data.version) setManualVersion(data.version);
      if (data.stars) setManualStars(String(data.stars));
      if (data.bpm) setManualBpm(String(data.bpm));
      if (data.length) setManualLength(String(data.length));
      if (data.playcount !== undefined) setManualPlaycount(String(data.playcount));
      if (data.favouriteCount !== undefined) setManualFavouriteCount(String(data.favouriteCount));
      if (data.status) {
        if (data.status === 'ranked' || data.status === 'approved') setManualStatus('ranked');
        else if (data.status === 'loved') setManualStatus('loved');
        else setManualStatus('graveyard');
      }
      if (data.coverUrl) setManualCoverUrl(data.coverUrl);
      if (data.previewUrl) setManualPreviewUrl(data.previewUrl);
      if (data.suggestedRarity) {
        setManualRarity(data.suggestedRarity);
      }
      showMsg(`✓ Auto-filled "${data.title || data.id}" by ${data.artist || 'Unknown'} (★${data.stars} · ${data.version} · ${Number(data.playcount || 0).toLocaleString()} plays)!`);
      setAutofillUrlInput('');
    } catch (e: any) {
      showMsg('Autofill error: ' + e.message, false);
    } finally {
      setIsAutofilling(false);
    }
  };

  const handleSaveCustomBeatmap = async () => {
    const bId = Number(manualMapId);
    const sId = Number(manualSetId) || bId;
    if (!bId || !manualTitle.trim() || !manualArtist.trim()) {
      showMsg('Beatmap ID, Title, and Artist are required.', false);
      return;
    }
    setActionLoading(true);
    try {
      const cover = manualCoverUrl.trim() || `https://assets.ppy.sh/beatmaps/${sId}/covers/cover.jpg`;
      const preview = manualPreviewUrl.trim() || `https://b.ppy.sh/preview/${sId}.mp3`;
      const starsNum = Math.round(Number(manualStars || 5.0) * 100) / 100;
      const playcountNum = Number(manualPlaycount) || 10000;
      const favCountNum = Number(manualFavouriteCount) || 100;
      const popScore = Math.round(Math.log10(playcountNum + 1) * 10 + Math.sqrt(favCountNum));

      const newBeatmap: Beatmap = {
        id: bId,
        beatmapsetId: sId,
        title: manualTitle.trim(),
        artist: manualArtist.trim(),
        creator: manualCreator.trim() || 'Unknown Mapper',
        version: manualVersion.trim() || 'Normal',
        stars: starsNum,
        bpm: Number(manualBpm) || 120,
        length: Number(manualLength) || 180,
        status: manualStatus,
        playcount: playcountNum,
        favouriteCount: favCountNum,
        popularityScore: popScore,
        rarity: manualRarity,
        exReason: manualRarity === 'EX' ? manualExReason.trim() : undefined,
        covers: {
          cover,
          card: cover,
          list: cover,
          slimcover: cover,
        },
        previewUrl: preview,
      };

      await addCustomBeatmap(newBeatmap);
      showMsg(`🎉 Successfully registered "${newBeatmap.title}" (#${bId}) into the Global Gacha Pool!`);

      // Reset form
      setManualMapId('');
      setManualSetId('');
      setManualTitle('');
      setManualArtist('');
      setManualCreator('');
      setManualCoverUrl('');
      setManualPreviewUrl('');
      setManualExReason('');
    } catch (e: any) {
      showMsg('Failed to save custom beatmap: ' + e.message, false);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteCustomBeatmap = async (beatmapId: number, title: string) => {
    if (!confirm(`Remove "${title}" (#${beatmapId}) from the Global Gacha Pool?`)) return;
    setActionLoading(true);
    try {
      await removeCustomBeatmap(beatmapId);
      showMsg(`✓ Removed "${title}" (#${beatmapId}) from the Global Pool`);
    } catch (e: any) {
      showMsg('Failed to remove beatmap: ' + e.message, false);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddCard = async (osuId: number) => {
    const bid = Number(addCardId || addCardSearch);
    if (!bid) return;
    setActionLoading(true);
    try {
      const now = Date.now();
      const copiesToAdd = Number(addCardCopies) || 1;
      const { data: existing } = await supabase
        .from('user_collection')
        .select('copies, first_pulled_at')
        .eq('osu_id', osuId)
        .eq('beatmap_id', bid)
        .maybeSingle();

      const newCopies = (existing?.copies || 0) + copiesToAdd;
      await supabase.from('user_collection').upsert({
        osu_id: osuId,
        beatmap_id: bid,
        copies: newCopies,
        first_pulled_at: existing?.first_pulled_at || now,
        last_pulled_at: now,
        is_favorite: false,
      });

      showMsg(`✓ Added beatmap #${bid} (×${copiesToAdd}) to ${selectedUsername}`);
      fetchUserColl(osuId);
      setAddCardId('');
      setAddCardSearch('');
      setAddCardCopies('1');
    } catch (e: any) {
      showMsg(e.message || 'Failed to add card', false);
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditCard = async (osuId: number, beatmapId: number, copies: number) => {
    setActionLoading(true);
    try {
      await supabase
        .from('user_collection')
        .update({ copies })
        .eq('osu_id', osuId)
        .eq('beatmap_id', beatmapId);
      showMsg(`✓ Updated copies for beatmap #${beatmapId}`);
      fetchUserColl(osuId);
      setEditingCard(null);
    } catch (e: any) {
      showMsg(e.message || 'Failed to edit card copies', false);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteCard = async (osuId: number, beatmapId: number) => {
    if (!confirm(`Remove beatmap #${beatmapId} from ${selectedUsername}?`)) return;
    setActionLoading(true);
    try {
      await supabase
        .from('user_collection')
        .delete()
        .eq('osu_id', osuId)
        .eq('beatmap_id', beatmapId);
      showMsg(`✓ Removed beatmap #${beatmapId}`);
      fetchUserColl(osuId);
    } catch (e: any) {
      showMsg(e.message || 'Failed to delete card', false);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevokeSession = async (osuId: number) => {
    setActionLoading(true);
    try {
      await supabase.from('user_sessions').delete().eq('osu_id', osuId);
      showMsg(`✓ All active sessions revoked for user ${osuId}`);
      fetchStats();
    } catch (e: any) {
      showMsg(e.message || 'Failed to revoke sessions', false);
    } finally {
      setActionLoading(false);
    }
  };

  const selectUser = (osuId:number, username:string) => {
    setSelectedUserId(osuId);
    setSelectedUsername(username);
    setActiveTab('users');
    fetchUserColl(osuId);
  };

  // ─── Mass Rewards Dispatcher ────────────────────────────────
  const handleDispatchMassReward = async () => {
    if (!confirm(`Confirm mass distribution of ${rewardType} to ALL users in Supabase?`)) return;
    setActionLoading(true);
    try {
      const { data: users, error: uErr } = await supabase.from('users').select('osu_id, username');
      if (uErr || !users || users.length === 0) throw new Error('No registered users found in Supabase.');

      if (rewardType === 'stamina' || rewardType === 'pulls') {
        const amount = Math.max(1, Number(rewardAmount) || 50);
        for (const u of users) {
          await supabase.from('user_energy_overrides').upsert({
            osu_id: u.osu_id,
            energy_amount: amount,
          });
        }

        // Also publish an active announcement gift
        await supabase.from('admin_config').upsert({
          key: 'active_announcement',
          value: {
            id: `gift-${Date.now()}`,
            title: `🎁 Mass Gift: +${amount} Free Summons!`,
            message: `The administrator has dispatched a global reward of +${amount} stamina/pulls to all summoners! Enjoy your rolls!`,
            type: 'giveaway',
            bonusStamina: amount,
            active: true,
            publishedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
          },
          updated_at: new Date().toISOString(),
        });

        if (user?.osuId) {
          await adminRefillEnergy(amount);
        }

        showMsg(`🎉 Successfully dispatched +${amount} pulls to all ${users.length} registered users in Supabase!`);
      } else if (rewardType === 'card') {
        const bid = Number(rewardCardId || rewardCardSearch);
        if (!bid) throw new Error('Please select a valid beatmap ID');
        const copies = Math.max(1, Number(rewardCardCopies) || 1);
        const now = Date.now();

        for (const u of users) {
          await supabase.from('user_collection').upsert({
            osu_id: u.osu_id,
            beatmap_id: bid,
            copies: copies,
            first_pulled_at: now,
            last_pulled_at: now,
            is_favorite: false,
          });
        }

        showMsg(`🎉 Successfully gifted Beatmap #${bid} (×${copies}) to all ${users.length} registered users!`);
      }

      fetchStats();
    } catch (e: any) {
      showMsg(e.message || 'Mass reward dispatch failed', false);
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Direct Supabase Database Inspector ───────────────────
  const fetchTableData = useCallback(async (table: string, offset = 0) => {
    setTableLoading(true);
    try {
      const { data, count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact' })
        .range(offset, offset + 49);

      if (error) throw error;
      setTableData({
        rows: (data as Record<string, unknown>[]) || [],
        total: count || 0,
        limit: 50,
        offset,
      });
      setTableOffset(offset);
    } catch (e: any) {
      showMsg(e.message || 'Failed to load table data', false);
    } finally {
      setTableLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'inspector') {
      fetchTableData(selectedTable, 0);
    }
  }, [activeTab, selectedTable, fetchTableData]);

  // ─── Bounties & Boss Raids Handlers ─────────────────────────
  const fetchBountiesData = useCallback(async () => {
    setActionLoading(true);
    try {
      const [bosses, packs] = await Promise.all([
        fetchBossBounties(),
        fetchBountyPacks(),
      ]);
      if (bosses) setBossList(bosses);
      if (packs) setPacksList(packs);
    } catch (e: any) {
      showMsg(e.message || 'Failed to load bounties data', false);
    } finally {
      setActionLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'bounties') {
      fetchBountiesData();
    }
  }, [activeTab, fetchBountiesData]);

  const handleFetchBossMeta = async () => {
    const query = (bossUrlInput || '').trim();
    if (!query) {
      showMsg('Please enter a Beatmap ID, Set ID, or paste an osu! link', false);
      return;
    }
    setIsFetchingBossMeta(true);
    try {
      const data = await fetchBeatmapMetadata(query);
      if (!data) {
        showMsg('Could not parse or fetch beatmap metadata from that input.', false);
        return;
      }
      setBossFetchedMeta(data);
      if (!bossObjective) {
        setBossObjective(`Pass ${data.title} on osu! with any grade`);
      }
      showMsg(`✓ Found: ${data.artist} - ${data.title} [${data.version}] (★${data.stars.toFixed(2)})!`, true);
    } catch (e: any) {
      showMsg('Fetch error: ' + e.message, false);
    } finally {
      setIsFetchingBossMeta(false);
    }
  };

  const handlePublishBossBounty = async () => {
    if (!bossFetchedMeta) {
      showMsg('Please fetch beatmap metadata first.', false);
      return;
    }
    if (!bossLoreReason.trim()) {
      showMsg('Please provide a story/reason for why this song is a Boss Bounty.', false);
      return;
    }

    setActionLoading(true);
    try {
      // 1. Add to custom card pool if missing and option is checked
      if (bossAddToPoolIfMissing) {
        const existing = pool.some((m) => m.id === bossFetchedMeta.id);
        if (!existing) {
          const newMap: Beatmap = {
            id: bossFetchedMeta.id,
            beatmapsetId: bossFetchedMeta.beatmapsetId,
            title: bossFetchedMeta.title,
            artist: bossFetchedMeta.artist,
            version: bossFetchedMeta.version,
            creator: bossFetchedMeta.creator,
            stars: bossFetchedMeta.stars,
            bpm: bossFetchedMeta.bpm,
            length: bossFetchedMeta.length,
            status: bossFetchedMeta.status as any,
            playcount: bossFetchedMeta.playcount || 10000,
            favouriteCount: bossFetchedMeta.favouriteCount || 100,
            covers: {
              cover: bossFetchedMeta.coverUrl,
              card: bossFetchedMeta.coverUrl,
              list: bossFetchedMeta.coverUrl,
              slimcover: bossFetchedMeta.coverUrl,
            },
            previewUrl: bossFetchedMeta.previewUrl,
            rarity: bossPoolRarity,
            popularityScore: 95,
            exReason: bossPoolRarity === 'EX' ? bossLoreReason.trim() : undefined,
          };
          await addCustomBeatmap(newMap);
        }
      }

      // 2. Build Boss Bounty
      const newBoss: Bounty = {
        id: `boss-${bossFetchedMeta.id}-${Date.now()}`,
        beatmap: {
          id: bossFetchedMeta.id,
          beatmapsetId: bossFetchedMeta.beatmapsetId,
          title: bossFetchedMeta.title,
          artist: bossFetchedMeta.artist,
          version: bossFetchedMeta.version,
          creator: bossFetchedMeta.creator,
          stars: bossFetchedMeta.stars,
          bpm: bossFetchedMeta.bpm,
          length: bossFetchedMeta.length,
          status: bossFetchedMeta.status as any,
          playcount: bossFetchedMeta.playcount || 10000,
          favouriteCount: bossFetchedMeta.favouriteCount || 100,
          covers: {
            cover: bossFetchedMeta.coverUrl,
            card: bossFetchedMeta.coverUrl,
            list: bossFetchedMeta.coverUrl,
            slimcover: bossFetchedMeta.coverUrl,
          },
          previewUrl: bossFetchedMeta.previewUrl,
          rarity: bossPoolRarity,
          popularityScore: 99,
          exReason: bossLoreReason.trim(),
        },
        title: `👑 RAID BOSS: ${bossFetchedMeta.title}`,
        description: bossObjective.trim() || `Pass ${bossFetchedMeta.title} [${bossFetchedMeta.version}] on osu!`,
        difficulty: 'Boss',
        requirements: {
          minRank: bossMinRank,
          requiredMods: bossReqMods && bossReqMods !== 'None' ? [bossReqMods] : undefined,
        },
        rewardStamina: Number(bossRewardStamina) || 300,
        rewardPoints: Number(bossRewardPoints) || 300,
        isBoss: true,
        bossReason: bossLoreReason.trim(),
        createdAt: Date.now(),
      };

      const updated = [newBoss, ...bossList.filter((b) => b.beatmap.id !== bossFetchedMeta.id)];
      const ok = await saveBossBounties(updated);
      if (ok) {
        setBossList(updated);
        setBossUrlInput('');
        setBossFetchedMeta(null);
        setBossLoreReason('');
        setBossObjective('');
        showMsg(`✓ Boss Raid "${newBoss.beatmap.title}" published successfully (+${newBoss.rewardStamina}⚡ / +${newBoss.rewardPoints} Pts)!`, true);
      } else {
        showMsg('Failed to save boss bounty to Supabase.', false);
      }
    } catch (e: any) {
      showMsg('Error publishing boss bounty: ' + e.message, false);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteBossBounty = async (id: string, title: string) => {
    setActionLoading(true);
    try {
      const updated = bossList.filter((b) => b.id !== id);
      const ok = await saveBossBounties(updated);
      if (ok) {
        setBossList(updated);
        showMsg(`✓ Removed boss bounty: ${title}`, true);
      }
    } catch (e: any) {
      showMsg('Error deleting boss bounty: ' + e.message, false);
    } finally {
      setActionLoading(false);
    }
  };

  const handleFetchPackMapMeta = async () => {
    const query = (packMapInput || '').trim();
    if (!query) return;
    setIsFetchingPackMap(true);
    try {
      const data = await fetchBeatmapMetadata(query);
      if (data) {
        setPackMapMeta(data);
        if (!packMapObjective) {
          setPackMapObjective(`Pass with Grade ${packMapMinRank} or higher`);
        }
        showMsg(`✓ Found for Pack: ${data.artist} - ${data.title} [${data.version}]`, true);
      } else {
        showMsg('Could not fetch beatmap metadata for pack.', false);
      }
    } catch (e: any) {
      showMsg('Fetch error: ' + e.message, false);
    } finally {
      setIsFetchingPackMap(false);
    }
  };

  const handleAddMapToPackDraft = () => {
    if (!packMapMeta) {
      showMsg('Fetch beatmap metadata first.', false);
      return;
    }

    const draftBounty: Bounty = {
      id: `packmap-${packMapMeta.id}-${Date.now()}`,
      beatmap: {
        id: packMapMeta.id,
        beatmapsetId: packMapMeta.beatmapsetId,
        title: packMapMeta.title,
        artist: packMapMeta.artist,
        version: packMapMeta.version,
        creator: packMapMeta.creator,
        stars: packMapMeta.stars,
        bpm: packMapMeta.bpm,
        length: packMapMeta.length,
        status: packMapMeta.status as any,
        playcount: packMapMeta.playcount || 10000,
        favouriteCount: packMapMeta.favouriteCount || 100,
        covers: {
          cover: packMapMeta.coverUrl,
          card: packMapMeta.coverUrl,
          list: packMapMeta.coverUrl,
          slimcover: packMapMeta.coverUrl,
        },
        previewUrl: packMapMeta.previewUrl,
        rarity: packMapMeta.suggestedRarity || 'Epic',
        popularityScore: 80,
      },
      title: packMapMeta.title,
      description: packMapObjective.trim() || `Pass ${packMapMeta.title} [${packMapMeta.version}]`,
      difficulty: 'Advanced',
      requirements: {
        minRank: packMapMinRank,
        requiredMods: packMapReqMods && packMapReqMods !== 'None' ? [packMapReqMods] : undefined,
      },
      rewardStamina: Number(packMapStamina) || 60,
      rewardPoints: Number(packMapPoints) || 35,
      createdAt: Date.now(),
    };

    setPackDraftBounties((prev) => [...prev, draftBounty]);
    setPackMapInput('');
    setPackMapMeta(null);
    setPackMapObjective('');
    showMsg(`✓ Added "${draftBounty.beatmap.title}" to pack draft!`, true);
  };

  const handleRemoveMapFromPackDraft = (index: number) => {
    setPackDraftBounties((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreateBountyPack = async () => {
    if (!packTitle.trim()) {
      showMsg('Please enter a pack title.', false);
      return;
    }
    if (packDraftBounties.length < 2) {
      showMsg('A bounty pack must contain at least 2 beatmaps.', false);
      return;
    }

    setActionLoading(true);
    try {
      const newPack: BountyPack = {
        id: `pack-${Date.now()}`,
        title: packTitle.trim(),
        description: packDescription.trim() || 'Complete all maps in this curated challenge playlist!',
        themeColor: packThemeColor,
        bounties: packDraftBounties,
        bonusRewardStamina: Number(packBonusStamina) || 500,
        bonusRewardPoints: Number(packBonusPoints) || 500,
        badgeTitle: packBadgeTitle.trim() || undefined,
        active: true,
        createdAt: Date.now(),
      };

      const updatedPacks = [newPack, ...packsList];
      const ok = await saveBountyPacks(updatedPacks);
      if (ok) {
        setPacksList(updatedPacks);
        setPackTitle('');
        setPackDescription('');
        setPackBadgeTitle('');
        setPackDraftBounties([]);
        showMsg(`✓ Bounty Pack "${newPack.title}" created with ${newPack.bounties.length} maps!`, true);
      } else {
        showMsg('Failed to save bounty pack.', false);
      }
    } catch (e: any) {
      showMsg('Error creating bounty pack: ' + e.message, false);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteBountyPack = async (packId: string, title: string) => {
    setActionLoading(true);
    try {
      const updated = packsList.filter((p) => p.id !== packId);
      const ok = await saveBountyPacks(updated);
      if (ok) {
        setPacksList(updated);
        showMsg(`✓ Deleted bounty pack: ${title}`, true);
      }
    } catch (e: any) {
      showMsg('Error deleting pack: ' + e.message, false);
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Direct Supabase Config & Rates ─────────────────────────
  const fetchConfig = useCallback(async () => {
    setActionLoading(true);
    try {
      const { data } = await supabase.from('admin_config').select('key, value');
      if (data) {
        for (const item of data) {
          if (item.key === 'rates' && item.value) setConfigRates(item.value as RarityRates);
          if ((item.key === 'stamina_config' || item.key === 'stamina') && item.value) {
            setConfigStamina(item.value as { max: number; regenSeconds: number });
          }
        }
      }
    } catch {
      // ignore
    } finally {
      setActionLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'config') fetchConfig();
  }, [activeTab, fetchConfig]);

  useEffect(() => {
    const sum = RARITY_ORDER.reduce((a, t) => a + (configRates[t] || 0), 0);
    setRatesTotal(Math.round(sum * 10000) / 10000);
  }, [configRates]);

  const handleSaveRates = async () => {
    if (Math.abs(ratesTotal - 1.0) > 0.001) {
      showMsg('Rates must sum to exactly 1.0 (100%)', false);
      return;
    }
    setActionLoading(true);
    try {
      await supabase.from('admin_config').upsert({
        key: 'rates',
        value: configRates,
        updated_at: new Date().toISOString(),
      });
      showMsg('✓ Rates saved to Supabase — active across the entire app');
    } catch (e: any) {
      showMsg(e.message || 'Failed to save rates', false);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveStamina = async () => {
    setActionLoading(true);
    try {
      await Promise.all([
        supabase.from('admin_config').upsert({
          key: 'stamina_config',
          value: configStamina,
          updated_at: new Date().toISOString(),
        }),
        supabase.from('admin_config').upsert({
          key: 'stamina',
          value: configStamina,
          updated_at: new Date().toISOString(),
        }),
      ]);
      showMsg('✓ Stamina config saved to Supabase');
    } catch (e: any) {
      showMsg(e.message || 'Failed to save stamina', false);
    } finally {
      setActionLoading(false);
    }
  };

  const resetRates = () => setConfigRates({...DEFAULT_RARITY_RATES});

  // Beatmap search matchers
  const poolMatches = addCardSearch.length >= 2
    ? pool.filter(m => m.title.toLowerCase().includes(addCardSearch.toLowerCase()) || m.artist.toLowerCase().includes(addCardSearch.toLowerCase()) || String(m.id).startsWith(addCardSearch)).slice(0,8)
    : [];

  const rewardPoolMatches = rewardCardSearch.length >= 2
    ? pool.filter(m => m.title.toLowerCase().includes(rewardCardSearch.toLowerCase()) || m.artist.toLowerCase().includes(rewardCardSearch.toLowerCase()) || String(m.id).startsWith(rewardCardSearch)).slice(0,8)
    : [];

  const filteredTopUsers = stats?.topUsers.filter(u => u.username.toLowerCase().includes(searchQuery.toLowerCase())) ?? [];

  // Load event and announcement from Supabase
  const loadEventAndAnnouncement = useCallback(async () => {
    try {
      const [evRes, annRes, miniRes] = await Promise.all([
        supabase.from('admin_config').select('value').eq('key', 'active_event_preset').maybeSingle(),
        supabase.from('admin_config').select('value').eq('key', 'active_announcement').maybeSingle(),
        supabase.from('admin_config').select('value').eq('key', 'mini_broadcast').maybeSingle(),
      ]);
      if (evRes.data && evRes.data.value && evRes.data.value.active) {
        setActiveEventData(evRes.data.value);
      }
      if (annRes.data && annRes.data.value && annRes.data.value.active) {
        setActiveAnnData(annRes.data.value);
      }
      if (miniRes.data && miniRes.data.value && miniRes.data.value.active) {
        setActiveMiniBroadcast(miniRes.data.value);
      }
    } catch (e) {
      console.warn('Error loading admin configs:', e);
    }
  }, []);

  useEffect(() => {
    loadEventAndAnnouncement();
  }, [loadEventAndAnnouncement]);

  const handleLaunchEvent = async () => {
    if (!eventName.trim()) {
      showMsg('Please enter an event name', false);
      return;
    }
    setActionLoading(true);
    try {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + eventDurationHours * 3600 * 1000).toISOString();
      const eventPayload = {
        id: `ev-${Date.now()}`,
        name: eventName.trim(),
        description: eventDesc.trim(),
        fastRecharge,
        rateMultiplier,
        bonusDropRate,
        active: true,
        startsAt: now.toISOString(),
        expiresAt,
      };

      // Auto-generate announcement for the event
      const annPayload = {
        id: `ann-${Date.now()}`,
        title: `🎉 EVENT: ${eventName.trim()}`,
        message: `${eventDesc.trim()}\n\n⚡ Fast Stamina: ${fastRecharge ? 'Active (5s/stamina)' : 'Standard'}\n🌟 Rarity Multiplier: ${rateMultiplier}x\n⏳ Event Duration: ${eventDurationHours} hours (Ends: ${new Date(expiresAt).toLocaleTimeString()})`,
        type: 'event',
        bonusStamina: 50,
        active: true,
        publishedAt: now.toISOString(),
        expiresAt,
      };

      await Promise.all([
        supabase.from('admin_config').upsert({
          key: 'active_event_preset',
          value: eventPayload,
          updated_at: now.toISOString(),
        }),
        supabase.from('admin_config').upsert({
          key: 'active_announcement',
          value: annPayload,
          updated_at: now.toISOString(),
        }),
      ]);

      setActiveEventData(eventPayload);
      setActiveAnnData(annPayload);
      showMsg('🚀 Event launched & Global Announcement broadcasted successfully!');
    } catch (e: any) {
      showMsg('Failed to launch event: ' + e.message, false);
    } finally {
      setActionLoading(false);
    }
  };

  const handleEndEvent = async () => {
    if (!confirm('End the currently active event?')) return;
    setActionLoading(true);
    try {
      await supabase.from('admin_config').upsert({
        key: 'active_event_preset',
        value: { active: false, endedAt: new Date().toISOString() },
        updated_at: new Date().toISOString(),
      });
      setActiveEventData(null);
      showMsg('🛑 Active event has been ended.');
    } catch (e: any) {
      showMsg('Failed to end event: ' + e.message, false);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePublishAnnouncement = async () => {
    if (!annTitle.trim() || !annMessage.trim()) {
      showMsg('Please fill in announcement title and message', false);
      return;
    }
    setActionLoading(true);
    try {
      const now = new Date();
      const expiresAt = annDurationHours > 0 ? new Date(now.getTime() + annDurationHours * 3600 * 1000).toISOString() : undefined;
      const annPayload = {
        id: `ann-${Date.now()}`,
        title: annTitle.trim(),
        message: annMessage.trim(),
        type: annType,
        bonusStamina: annBonusStamina > 0 ? annBonusStamina : undefined,
        active: true,
        publishedAt: now.toISOString(),
        expiresAt,
      };

      await supabase.from('admin_config').upsert({
        key: 'active_announcement',
        value: annPayload,
        updated_at: now.toISOString(),
      });

      setActiveAnnData(annPayload);
      showMsg('📢 Announcement published & broadcast to all players!');
    } catch (e: any) {
      showMsg('Failed to publish announcement: ' + e.message, false);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeactivateAnnouncement = async () => {
    if (!confirm('Deactivate the active announcement popup?')) return;
    setActionLoading(true);
    try {
      await supabase.from('admin_config').upsert({
        key: 'active_announcement',
        value: { active: false, deactivatedAt: new Date().toISOString() },
        updated_at: new Date().toISOString(),
      });
      setActiveAnnData(null);
      showMsg('✓ Active announcement deactivated.');
    } catch (e: any) {
      showMsg('Failed: ' + e.message, false);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePublishMiniBroadcast = async () => {
    if (!miniMsg.trim()) {
      showMsg('Please enter a mini broadcast message', false);
      return;
    }
    setActionLoading(true);
    try {
      const payload = {
        id: `mini-${Date.now()}`,
        message: miniMsg.trim(),
        badge: miniBadge.trim() || 'ADMIN NOTE',
        type: miniType,
        linkUrl: miniLinkUrl.trim() || undefined,
        linkText: miniLinkText.trim() || undefined,
        active: true,
        publishedAt: new Date().toISOString(),
      };

      await supabase.from('admin_config').upsert({
        key: 'mini_broadcast',
        value: payload,
        updated_at: new Date().toISOString(),
      });

      setActiveMiniBroadcast(payload);
      showMsg('🚀 Floating Mini Broadcast published to all players!');
    } catch (e: any) {
      showMsg('Failed to publish mini broadcast: ' + e.message, false);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeactivateMiniBroadcast = async () => {
    if (!confirm('Clear the floating side broadcast notification?')) return;
    setActionLoading(true);
    try {
      await supabase.from('admin_config').upsert({
        key: 'mini_broadcast',
        value: { active: false, deactivatedAt: new Date().toISOString() },
        updated_at: new Date().toISOString(),
      });
      setActiveMiniBroadcast(null);
      showMsg('✓ Mini Broadcast cleared.');
    } catch (e: any) {
      showMsg('Failed to clear: ' + e.message, false);
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Player Transactions & Revoke Handler ───────────────────
  const fetchTransactionsData = useCallback(async () => {
    setTxLoading(true);
    try {
      const [txs, trs] = await Promise.all([
        giftingService.fetchTransactions(),
        tradingService.fetchTrades(),
      ]);
      setTransactions(txs);
      setTrades(trs);
    } catch (e: any) {
      showMsg('Failed to load transactions: ' + e.message, false);
    } finally {
      setTxLoading(false);
    }
  }, []);

  const handleRevokeTransaction = async (tx: PlayerTransaction) => {
    if (!confirm(`Revoke transaction ${tx.id} from ${tx.senderUsername} to ${tx.recipientUsername}? This will reverse the transferred item.`)) return;
    setActionLoading(true);
    try {
      const res = await giftingService.revokeTransaction(tx.id);
      if (!res.success) {
        showMsg(res.error || 'Failed to revoke transaction', false);
      } else {
        showMsg(`✓ Transaction ${tx.id} revoked & reversed successfully!`);
        await fetchTransactionsData();
      }
    } catch (e: any) {
      showMsg('Failed to revoke: ' + e.message, false);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevokeTrade = async (trade: PlayerTrade) => {
    if (!confirm(`Revoke trade ${trade.id} between ${trade.senderUsername} and ${trade.recipientUsername}? This will reverse the swapped cards.`)) return;
    setActionLoading(true);
    try {
      const res = await tradingService.revokeTrade(trade.id);
      if (!res.success) {
        showMsg(res.error || 'Failed to revoke trade', false);
      } else {
        showMsg(`✓ Trade ${trade.id} revoked & cards reversed successfully!`);
        await fetchTransactionsData();
      }
    } catch (e: any) {
      showMsg('Failed to revoke trade: ' + e.message, false);
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Secret Next-Pull Injections Handler ─────────────────────
  const fetchInjectionsData = useCallback(async () => {
    try {
      const injs = await injectionService.getInjections();
      setInjections(injs);
    } catch {}
  }, []);

  const handleSetPullInjection = async (targetOsuId: number) => {
    if (!selectedInjectBeatmap) {
      showMsg('Please select a beatmap to inject.', false);
      return;
    }
    setActionLoading(true);
    try {
      const res = await injectionService.setInjection({
        osuId: targetOsuId,
        beatmapId: selectedInjectBeatmap.id,
        injectedBy: user?.username || 'Admin',
      });
      if (!res.success) {
        showMsg(res.error || 'Failed to set injection', false);
      } else {
        showMsg(`🎯 Injected "${selectedInjectBeatmap.title}" into ${selectedUsername}'s next summon! (Pity will be preserved safely)`);
        setSelectedInjectBeatmap(null);
        setInjectSearch('');
        await fetchInjectionsData();
      }
    } catch (e: any) {
      showMsg('Failed: ' + e.message, false);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemovePullInjection = async (targetOsuId: number) => {
    setActionLoading(true);
    try {
      const res = await injectionService.removeInjection(targetOsuId);
      if (!res.success) {
        showMsg(res.error || 'Failed to cancel injection', false);
      } else {
        showMsg(`✓ Cancelled next-pull injection for osu! ID #${targetOsuId}`);
        await fetchInjectionsData();
      }
    } catch (e: any) {
      showMsg('Failed: ' + e.message, false);
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'transactions') {
      fetchTransactionsData();
    }
    if (activeTab === 'users') {
      fetchInjectionsData();
    }
  }, [activeTab, fetchTransactionsData, fetchInjectionsData]);

  // ─── Render ──────────────────────────────────────────────────
  return (
    <div className="space-y-6 pb-20 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-red-950/80 via-slate-900 to-slate-900 border border-red-900/60 shadow-xl">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-red-950/60 border border-red-800/60 shadow-lg shadow-red-950/40">
            <Crown className="w-6 h-6 text-red-400" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white">Admin Command Center</h1>
            <p className="text-xs text-slate-400 font-mono">
              Administrator: <span className="text-red-400 font-bold">{user?.username}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/50 text-emerald-300 text-xs font-mono">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Supabase & Worker Active</span>
          </span>
        </div>
      </div>

      {/* Action Notification Banner */}
      {actionMsg && (
        <div className={`p-3.5 rounded-2xl border text-xs sm:text-sm font-mono flex items-center space-x-2 animate-fade-in ${
          actionMsg.ok ? 'bg-emerald-950/60 border-emerald-800/80 text-emerald-300' : 'bg-red-950/60 border-red-800/80 text-red-300'
        }`}>
          {actionMsg.ok ? <Activity className="w-4 h-4 flex-shrink-0"/> : <AlertTriangle className="w-4 h-4 flex-shrink-0"/>}
          <span>{actionMsg.text}</span>
        </div>
      )}

      {/* Navigation Tabs (Scrollable on mobile) */}
      <div className="flex items-center space-x-1 bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800 overflow-x-auto scrollbar-none w-full sm:w-fit">
        {([
          ['overview','Overview',<BarChart3 className="w-4 h-4"/>],
          ['events','Event Presets',<Sparkles className="w-4 h-4 text-amber-400"/>],
          ['cards','Card Tiers & EX',<Crown className="w-4 h-4 text-purple-400"/>],
          ['bounties','Bounties & Bosses',<Target className="w-4 h-4 text-rose-400"/>],
          ['announcements','Announcements',<Bell className="w-4 h-4 text-cyan-400"/>],
          ['users','Users & Destiny Drop',<Users className="w-4 h-4"/>],
          ['transactions','Transactions & Gifts',<ArrowLeftRight className="w-4 h-4 text-emerald-400"/>],
          ['rewards','Mass Rewards',<Gift className="w-4 h-4"/>],
          ['inspector','DB Inspector',<Table className="w-4 h-4"/>],
          ['config','Config',<Sliders className="w-4 h-4"/>],
        ] as [AdminTab, string, React.ReactNode][]).map(([id, label, icon]) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center space-x-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex-shrink-0 ${
              activeTab === id
                ? 'bg-gradient-to-r from-red-700 to-red-600 text-white shadow-md shadow-red-700/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            {icon}
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* ── 1. OVERVIEW TAB ───────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* ========================================================= */}
          {/* MAINTENANCE & SERVER SWITCHBOARD                          */}
          {/* ========================================================= */}
          <div className={`p-5 sm:p-6 rounded-2xl border transition-all shadow-xl ${
            maintenanceEnabled
              ? 'bg-gradient-to-br from-red-950/80 via-slate-900 to-slate-900 border-red-500/50 shadow-red-950/40'
              : 'bg-gradient-to-br from-emerald-950/60 via-slate-900 to-slate-900 border-emerald-500/40 shadow-emerald-950/20'
          }`}>
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center space-x-3.5">
                <div className={`p-3 rounded-2xl border ${
                  maintenanceEnabled
                    ? 'bg-red-950 border-red-700 text-red-400 animate-pulse'
                    : 'bg-emerald-950 border-emerald-700 text-emerald-400'
                }`}>
                  <Wrench className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-base sm:text-lg font-bold text-white font-display">
                      Server Maintenance Switchboard
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                      maintenanceEnabled
                        ? 'bg-red-500 text-white shadow-md shadow-red-500/30'
                        : 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
                    }`}>
                      {maintenanceEnabled ? 'Maintenance Active' : 'Site Live'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 font-sans mt-0.5">
                    {maintenanceEnabled
                      ? 'Non-admin visitors are currently redirected to the Emergency Maintenance screen.'
                      : 'Website is public and open. All players can summon, sync, and view leaderboards.'}
                  </p>
                </div>
              </div>

              {/* Maintenance Toggle & Server Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => handleToggleMaintenance(!maintenanceEnabled)}
                  disabled={maintenanceSaving}
                  className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] ${
                    maintenanceEnabled
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-600/30'
                      : 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 shadow-red-600/30'
                  }`}
                >
                  <Wrench className="w-4 h-4" />
                  <span>
                    {maintenanceSaving
                      ? 'Updating Cloud...'
                      : maintenanceEnabled
                      ? 'Turn Maintenance OFF (Go Live)'
                      : 'Turn Maintenance ON (Emergency)'}
                  </span>
                </button>

                <button
                  onClick={handleBroadcastRefresh}
                  className="flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition-colors"
                  title="Forces all open browser tabs to reload immediately"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Force Refresh All</span>
                </button>

                <button
                  onClick={handleRepairDatabaseStats}
                  disabled={dbRepairing}
                  className="flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 text-xs font-semibold transition-colors"
                  title="Audit and repair user lifetime total_pulls from card collections"
                >
                  <Database className={`w-3.5 h-3.5 ${dbRepairing ? 'animate-spin text-pink-400' : 'text-amber-400'}`} />
                  <span>{dbRepairing ? 'Repairing DB...' : 'Self-Heal DB Pulls'}</span>
                </button>
              </div>
            </div>

            {/* DB Repair Results Display */}
            {dbRepairResults && (
              <div className="mt-4 p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs font-mono text-slate-300 whitespace-pre-line animate-fade-in">
                {dbRepairResults}
              </div>
            )}

            {/* Maintenance Message Form (Collapsible/Editable) */}
            <div className="mt-4 pt-4 border-t border-slate-800/80 space-y-3">
              <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider block">
                Maintenance Display Customizer:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-mono text-slate-400 block mb-1">Headline Text</label>
                  <input
                    type="text"
                    value={maintenanceHeadline}
                    onChange={(e) => setMaintenanceHeadline(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-mono text-slate-400 block mb-1">Estimated Duration Text</label>
                  <input
                    type="text"
                    value={maintenanceEstimatedTime}
                    onChange={(e) => setMaintenanceEstimatedTime(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white"
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1">Detailed Message</label>
                <textarea
                  rows={2}
                  value={maintenanceMessage}
                  onChange={(e) => setMaintenanceMessage(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono"
                />
              </div>
              <div className="flex justify-end">
                <button
                  onClick={handleSaveMaintenanceText}
                  disabled={maintenanceSaving}
                  className="flex items-center space-x-1.5 px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 transition-colors"
                >
                  <Save className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Save Screen Text</span>
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={fetchStats}
              disabled={statsLoading}
              className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs sm:text-sm font-semibold transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${statsLoading ? 'animate-spin text-pink-400' : 'text-slate-400'}`}/>
              <span>Refresh Stats</span>
            </button>
          </div>

          {statsError && (
            <div className="p-4 rounded-2xl bg-red-950/40 border border-red-800/60 text-red-300 text-sm">
              {statsError}
            </div>
          )}

          {stats && (
            <>
              {/* Stat Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {[
                  {label:'Registered Users', val:stats.totalUsers, icon:<Users className="w-5 h-5 text-pink-300"/>, bg:'bg-pink-950/60'},
                  {label:'Active Sessions', val:stats.totalSessions, icon:<Activity className="w-5 h-5 text-emerald-300"/>, bg:'bg-emerald-950/60'},
                  {label:'Cards Collected', val:stats.totalCollectionRecords, icon:<Database className="w-5 h-5 text-cyan-300"/>, bg:'bg-cyan-950/60'},
                  {label:'Total Pull History', val:stats.totalHistoryRecords, icon:<TrendingUp className="w-5 h-5 text-purple-300"/>, bg:'bg-purple-950/60'},
                ].map(c => (
                  <div key={c.label} className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center space-x-3 sm:space-x-4">
                    <div className={`p-2.5 sm:p-3 rounded-xl ${c.bg}`}>{c.icon}</div>
                    <div>
                      <p className="text-xl sm:text-2xl font-black text-white font-mono">{c.val.toLocaleString()}</p>
                      <p className="text-[11px] sm:text-xs text-slate-400">{c.label}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Leaderboard */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                    <Star className="w-5 h-5 text-amber-400"/>
                    <span>Player Leaderboard</span>
                  </h2>
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none"/>
                    <input
                      type="text"
                      placeholder="Search username…"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-4 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-xs font-mono placeholder-slate-600 focus:outline-none focus:border-pink-500/60"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  {filteredTopUsers.map((u, i) => (
                    <div key={u.osuId} className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden">
                      <button
                        onClick={() => setExpandedUser(expandedUser === u.osuId ? null : u.osuId)}
                        className="w-full flex items-center space-x-3 p-3.5 hover:bg-slate-800/60 transition-colors text-left"
                      >
                        <div className={`w-7 h-7 flex-shrink-0 rounded-full flex items-center justify-center text-xs font-black ${
                          i === 0 ? 'bg-amber-500 text-amber-950' :
                          i === 1 ? 'bg-slate-300 text-slate-900' :
                          i === 2 ? 'bg-amber-700 text-amber-100' :
                          'bg-slate-800 text-slate-400'
                        }`}>
                          {i + 1}
                        </div>
                        <div className="w-9 h-9 rounded-xl overflow-hidden bg-pink-950/60 border border-pink-900/40 flex-shrink-0">
                          {u.avatarUrl ? (
                            <img src={u.avatarUrl} alt="" className="w-full h-full object-cover"/>
                          ) : (
                            <Users className="w-4 h-4 text-pink-400 m-2.5"/>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-white truncate text-sm">{u.username}</span>
                            {u.globalRank && (
                              <span className="text-[10px] font-mono text-slate-400 px-1.5 py-0.5 rounded bg-slate-800 flex-shrink-0">
                                #{u.globalRank.toLocaleString()}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] font-mono text-slate-400">
                            <span className="text-pink-300 font-bold">{u.totalPulls.toLocaleString()} pulls</span>
                            <span className="mx-1">·</span>{u.uniqueCards} cards
                            <span className="mx-1">·</span>ID {u.osuId}
                          </div>
                        </div>
                        {expandedUser === u.osuId ? <ChevronUp className="w-4 h-4 text-slate-500"/> : <ChevronDown className="w-4 h-4 text-slate-500"/>}
                      </button>

                      {expandedUser === u.osuId && (
                        <div className="px-4 pb-4 border-t border-slate-800/60 pt-3 flex flex-wrap gap-2 items-center">
                          <span className="text-xs font-mono text-slate-500 flex-1">
                            Last login: {formatUserDateTime(u.lastLogin)}
                          </span>
                          <button
                            onClick={() => selectUser(u.osuId, u.username)}
                            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-blue-950/60 hover:bg-blue-900/60 border border-blue-800/60 text-blue-300 text-xs font-semibold"
                          >
                            <Edit3 className="w-3.5 h-3.5"/>
                            <span>Manage Cards & Pulls</span>
                          </button>
                          <a
                            href={`https://osu.ppy.sh/users/${u.osuId}`}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-1.5 rounded-lg bg-pink-950/60 hover:bg-pink-900/60 border border-pink-800/60 text-pink-300 text-xs font-semibold"
                          >
                            osu! Profile
                          </a>
                          <button
                            onClick={() => handleRevokeSession(u.osuId)}
                            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-red-950/60 hover:bg-red-900/60 border border-red-800/60 text-red-300 text-xs font-semibold"
                          >
                            <Trash2 className="w-3.5 h-3.5"/>
                            <span>Revoke Sessions</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Logins */}
              <div className="space-y-3">
                <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                  <Clock className="w-5 h-5 text-cyan-400"/>
                  <span>Recent Logins</span>
                </h2>
                <div className="rounded-2xl bg-slate-900/80 border border-slate-800 divide-y divide-slate-800/60">
                  {stats.recentLogins.map(u => (
                    <div key={u.osuId} className="flex items-center space-x-3 p-3 hover:bg-slate-800/30 transition-colors">
                      <div className="w-8 h-8 rounded-lg overflow-hidden bg-pink-950/60 border border-pink-900/40 flex-shrink-0">
                        {u.avatarUrl ? (
                          <img src={u.avatarUrl} alt="" className="w-full h-full object-cover"/>
                        ) : (
                          <Users className="w-4 h-4 text-pink-400 m-2"/>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <button
                          onClick={() => selectUser(u.osuId, u.username)}
                          className="text-sm font-semibold text-slate-200 hover:text-pink-300 truncate"
                        >
                          {u.username}
                        </button>
                        <div className="text-[10px] font-mono text-slate-500">
                          {new Date(u.lastLogin).toLocaleString()} · {u.totalPulls.toLocaleString()} pulls
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-slate-600">ID {u.osuId}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── 2. EVENT PRESETS TAB ─────────────────────── */}
      {activeTab === 'events' && (
        <div className="space-y-6">
          {/* Active Event Status Card */}
          {activeEventData && activeEventData.active ? (
            <div className="p-6 rounded-2xl bg-gradient-to-r from-amber-950/60 via-slate-900 to-purple-950/60 border border-amber-500/50 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div className="flex items-center space-x-3">
                  <div className="p-3 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40">
                    <Sparkles className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-500 text-emerald-300">
                        ● LIVE EVENT ACTIVE
                      </span>
                      {activeEventData.expiresAt && (
                        <span className="text-[10px] font-mono text-slate-400">
                          Ends: {formatUserDateTime(activeEventData.expiresAt, true)}
                        </span>
                      )}
                    </div>
                    <h2 className="text-xl font-black text-white font-display mt-0.5">
                      {activeEventData.name}
                    </h2>
                  </div>
                </div>

                <button
                  onClick={handleEndEvent}
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl bg-red-950/80 hover:bg-red-900 border border-red-800 text-red-300 font-bold text-xs transition-colors self-start sm:self-auto"
                >
                  🛑 Stop / End Event
                </button>
              </div>

              <p className="text-xs sm:text-sm text-slate-300 font-sans leading-relaxed">
                {activeEventData.description}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center space-x-3">
                  <Zap className="w-5 h-5 text-amber-400" />
                  <div>
                    <p className="text-[10px] font-mono text-slate-400">Stamina Recharge</p>
                    <p className="text-xs font-bold text-amber-300 font-mono">
                      {activeEventData.fastRecharge ? '⚡ 5s Turbo (3x Speed)' : '15s Standard'}
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center space-x-3">
                  <Sparkles className="w-5 h-5 text-purple-400" />
                  <div>
                    <p className="text-[10px] font-mono text-slate-400">High Rarity Rates</p>
                    <p className="text-xs font-bold text-purple-300 font-mono">
                      {activeEventData.rateMultiplier}x Drop Multiplier
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center space-x-3">
                  <Gift className="w-5 h-5 text-pink-400" />
                  <div>
                    <p className="text-[10px] font-mono text-slate-400">Pull Bonus Drops</p>
                    <p className="text-xs font-bold text-pink-300 font-mono">
                      {activeEventData.bonusDropRate ? 'Active on 10x Pulls' : 'Disabled'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Sparkles className="w-6 h-6 text-slate-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-300">No Event Currently Active</h3>
                  <p className="text-xs text-slate-500 font-mono">Launch an event preset below to boost player rates and recharge speed!</p>
                </div>
              </div>
            </div>
          )}

          {/* Event Preset Creator Form */}
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-5">
            <h2 className="font-bold text-white text-lg flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <span>Launch Event Preset</span>
            </h2>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-mono text-slate-300">Event Title</label>
                <input
                  type="text"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  placeholder="e.g. Weekend Fever: 2x Boost & Fast Stamina"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white font-sans focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-mono text-slate-300">Event Description & Perks</label>
                <textarea
                  rows={3}
                  value={eventDesc}
                  onChange={(e) => setEventDesc(e.target.value)}
                  placeholder="Describe the event perks and what players receive..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white font-sans focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>

              {/* Event Modifiers / Checkboxes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <label className="flex items-start space-x-3 p-4 rounded-xl bg-slate-950/80 border border-slate-800 cursor-pointer hover:border-slate-700 transition-colors">
                  <input
                    type="checkbox"
                    checked={fastRecharge}
                    onChange={(e) => setFastRecharge(e.target.checked)}
                    className="mt-1 accent-amber-500 w-4 h-4 rounded"
                  />
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-white flex items-center space-x-1">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      <span>Turbo Recovery</span>
                    </p>
                    <p className="text-[11px] text-slate-400 font-mono">5s per stamina (3x speed)</p>
                  </div>
                </label>

                <label className="flex items-start space-x-3 p-4 rounded-xl bg-slate-950/80 border border-slate-800 cursor-pointer hover:border-slate-700 transition-colors">
                  <input
                    type="checkbox"
                    checked={bonusDropRate}
                    onChange={(e) => setBonusDropRate(e.target.checked)}
                    className="mt-1 accent-pink-500 w-4 h-4 rounded"
                  />
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-white flex items-center space-x-1">
                      <Gift className="w-3.5 h-3.5 text-pink-400" />
                      <span>Bonus Pull Drops</span>
                    </p>
                    <p className="text-[11px] text-slate-400 font-mono">Bonus stamina on 10x</p>
                  </div>
                </label>

                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                  <div className="flex items-center space-x-1 text-xs font-bold text-white">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    <span>Rate Multiplier</span>
                  </div>
                  <select
                    value={rateMultiplier}
                    onChange={(e) => setRateMultiplier(Number(e.target.value))}
                    className="w-full px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-white focus:outline-none"
                  >
                    <option value={1}>1.0x (Standard)</option>
                    <option value={1.5}>1.5x Boosted Odds</option>
                    <option value={2}>2.0x Double Rates</option>
                    <option value={3}>3.0x Triple Rates</option>
                  </select>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                  <div className="flex items-center space-x-1 text-xs font-bold text-white">
                    <Clock className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Event Duration</span>
                  </div>
                  <select
                    value={eventDurationHours}
                    onChange={(e) => setEventDurationHours(Number(e.target.value))}
                    className="w-full px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-white focus:outline-none"
                  >
                    <option value={1}>1 Hour Flash Event</option>
                    <option value={6}>6 Hours</option>
                    <option value={12}>12 Hours</option>
                    <option value={24}>24 Hours (1 Day)</option>
                    <option value={72}>3 Days (Weekend)</option>
                    <option value={168}>7 Days (1 Week)</option>
                  </select>
                </div>
              </div>

              <button
                onClick={handleLaunchEvent}
                disabled={actionLoading}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-600 via-orange-600 to-pink-600 hover:from-amber-500 hover:to-pink-500 text-white font-black text-sm shadow-xl shadow-amber-600/30 transition-all flex items-center justify-center space-x-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>🚀 Launch Event & Auto-Broadcast Announcement</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CARD TIERS & POOL MANAGEMENT TAB ───────────────────────── */}
      {activeTab === 'cards' && (
        <div className="space-y-6 animate-fade-in">
          {/* Sub-Tab Navigation */}
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
            <button
              onClick={() => setCardsSubTab('tier_assignment')}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                cardsSubTab === 'tier_assignment'
                  ? 'bg-purple-950/90 text-purple-200 border border-purple-500/60 shadow-lg shadow-purple-950/50'
                  : 'bg-slate-900/60 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Crown className="w-4 h-4 text-purple-400" />
              <span>Manual Card Tier & EX Assignment</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-purple-900/60 text-purple-300">
                {Object.keys(cardOverrides).length}
              </span>
            </button>

            <button
              onClick={() => setCardsSubTab('add_beatmap')}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                cardsSubTab === 'add_beatmap'
                  ? 'bg-emerald-950/90 text-emerald-200 border border-emerald-500/60 shadow-lg shadow-emerald-950/50'
                  : 'bg-slate-900/60 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <PlusCircle className="w-4 h-4 text-emerald-400" />
              <span>Register / Inject Custom Beatmap</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-emerald-900/60 text-emerald-300">
                {customBeatmaps.length} Injected
              </span>
            </button>
          </div>

          {cardsSubTab === 'tier_assignment' ? (
            <>
              {/* Header Description */}
              <div className="p-6 rounded-2xl bg-gradient-to-r from-purple-950/80 via-slate-900 to-slate-900 border border-purple-800/60 shadow-xl space-y-2">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/40">
                    <Crown className="w-6 h-6 animate-pulse text-purple-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white font-display flex items-center space-x-2">
                      <span>Manual Card Tier & EX Assignment</span>
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-purple-900/80 text-purple-200 border border-purple-500/60">
                        Admin Exclusive
                      </span>
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-300">
                      Manually assign any beatmap to any rarity tier. Handpicked <strong className="text-purple-300">EX Tier</strong> cards require a lore explanation that will be displayed whenever pulled by players.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left: Card Search & Tier Assignment Form */}
                <div className="lg:col-span-6 space-y-4 p-5 sm:p-6 rounded-2xl bg-slate-900/80 border border-slate-800">
                  <h3 className="text-base font-bold text-white flex items-center space-x-2">
                    <Search className="w-4 h-4 text-purple-400" />
                    <span>Search & Select Beatmap</span>
                  </h3>

                  {/* Search Input */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono text-slate-300">Search by Title, Artist, or Beatmap ID</label>
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                      <input
                        type="text"
                        value={cardAssignSearch}
                        onChange={(e) => setCardAssignSearch(e.target.value)}
                        placeholder="e.g. Freedom Dive, Big Black, 129891..."
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white font-sans focus:outline-none focus:border-purple-500"
                      />
                      {cardAssignSearch && (
                        <button
                          onClick={() => setCardAssignSearch('')}
                          className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Search Suggestions */}
                  {cardAssignSearch.trim() && (
                    <div className="space-y-1 max-h-56 overflow-y-auto rounded-xl bg-slate-950 p-2 border border-slate-800">
                      {pool
                        .filter((m) => {
                          const q = cardAssignSearch.toLowerCase();
                          return (
                            String(m.id).includes(q) ||
                            m.title.toLowerCase().includes(q) ||
                            m.artist.toLowerCase().includes(q) ||
                            m.creator.toLowerCase().includes(q)
                          );
                        })
                        .slice(0, 8)
                        .map((m) => (
                          <button
                            key={m.id}
                            onClick={() => {
                              setSelectedAssignCardId(m.id);
                              setAssignTier(m.rarity || 'EX');
                              setAssignExReason(m.exReason || '');
                              setCardAssignSearch('');
                            }}
                            className="w-full text-left p-2 rounded-lg hover:bg-purple-950/40 border border-transparent hover:border-purple-800/60 flex items-center justify-between transition-colors"
                          >
                            <div className="min-w-0 pr-2">
                              <p className="text-xs font-bold text-white truncate">{m.title}</p>
                              <p className="text-[11px] text-slate-400 truncate">
                                {m.artist} [{m.version}] • {m.stars}★ • #{m.id}
                              </p>
                            </div>
                            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${RARITY_COLORS[m.rarity]}`}>
                              {m.rarity}
                            </span>
                          </button>
                        ))}
                    </div>
                  )}

                  {/* Selected Card Form */}
                  {selectedAssignCardId && (
                    <div className="mt-4 p-4 rounded-xl bg-purple-950/30 border border-purple-800/60 space-y-4 animate-fade-in">
                      {(() => {
                        const card = poolMap.get(selectedAssignCardId);
                        if (!card) return <p className="text-xs text-slate-400">Card #{selectedAssignCardId} not found.</p>;

                        return (
                          <>
                            <div className="flex items-start justify-between gap-3 border-b border-purple-900/60 pb-3">
                              <div>
                                <span className="text-[10px] font-mono text-purple-300 uppercase">Selected Card #{card.id}</span>
                                <h4 className="text-base font-bold text-white">{card.title}</h4>
                                <p className="text-xs text-slate-300 font-mono">
                                  {card.artist} [{card.version}] • Mapper: {card.creator}
                                </p>
                              </div>
                              <button
                                onClick={() => setSelectedAssignCardId(null)}
                                className="text-slate-400 hover:text-white text-xs font-mono"
                              >
                                Cancel
                              </button>
                            </div>

                            {/* Target Tier Selection */}
                            <div className="space-y-1.5">
                              <label className="text-xs font-mono text-slate-300">Assign Target Rarity Tier</label>
                              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                {RARITY_ORDER.map((tier) => (
                                  <button
                                    key={tier}
                                    type="button"
                                    onClick={() => setAssignTier(tier)}
                                    className={`py-2 px-2 rounded-xl text-xs font-bold font-mono transition-all border ${
                                      assignTier === tier
                                        ? 'bg-purple-600 text-white border-white shadow-lg scale-105'
                                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                                    }`}
                                  >
                                    {tier === 'EX' ? '👑 EX' : tier}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* EX Tier Lore Explanation Box */}
                            <div className="space-y-1.5">
                              <label className="text-xs font-mono text-slate-300 flex items-center justify-between">
                                <span>{assignTier === 'EX' ? '👑 EX Handpicked Lore Explanation' : 'Optional Override Note'}</span>
                                {assignTier === 'EX' && <span className="text-amber-400 font-bold">*Required for EX</span>}
                              </label>
                              <textarea
                                rows={3}
                                value={assignExReason}
                                onChange={(e) => setAssignExReason(e.target.value)}
                                placeholder={
                                  assignTier === 'EX'
                                    ? "Explain why this beatmap is legendary (e.g. 'Cookiezi 727pp Freedom Dive HDHR play which set osu! history forever.')"
                                    : 'Optional note explaining this tier override...'
                                }
                                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white font-sans focus:outline-none focus:border-purple-500 resize-none"
                              />
                            </div>

                            {/* Save Action */}
                            <button
                              onClick={async () => {
                                if (assignTier === 'EX' && !assignExReason.trim()) {
                                  showMsg('Please provide a reason explaining why this card is an EX tier handpick.', false);
                                  return;
                                }
                                setActionLoading(true);
                                try {
                                  await setCardTierOverride(card.id, assignTier, assignExReason);
                                  showMsg(`✓ Assigned #${card.id} [${card.title}] to ${assignTier} tier!`);
                                } catch (e: any) {
                                  showMsg('Failed to save tier: ' + e.message, false);
                                } finally {
                                  setActionLoading(false);
                                }
                              }}
                              disabled={actionLoading}
                              className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 hover:from-purple-500 hover:to-amber-400 text-white font-black text-sm shadow-xl shadow-purple-600/30 transition-all flex items-center justify-center space-x-2"
                            >
                              <Crown className="w-4 h-4" />
                              <span>Save Card Tier Assignment</span>
                            </button>
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>

                {/* Right: Active Manual Overrides & EX Handpicked List */}
                <div className="lg:col-span-6 space-y-4 p-5 sm:p-6 rounded-2xl bg-slate-900/80 border border-slate-800">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-white flex items-center space-x-2">
                      <Crown className="w-4 h-4 text-amber-400" />
                      <span>Active Handpicked & Overridden Cards</span>
                    </h3>
                    <span className="text-xs font-mono text-purple-300 font-bold px-2 py-0.5 rounded-full bg-purple-950 border border-purple-500/40">
                      {Object.keys(cardOverrides).length} Assigned
                    </span>
                  </div>

                  {Object.keys(cardOverrides).length === 0 ? (
                    <div className="p-8 rounded-xl bg-slate-950/60 border border-slate-800 text-center space-y-2">
                      <Crown className="w-8 h-8 text-slate-600 mx-auto" />
                      <p className="text-sm font-bold text-slate-300">No Manual Card Overrides Yet</p>
                      <p className="text-xs text-slate-500 font-mono">
                        Search for a beatmap on the left to assign it to EX tier or customize its rarity tier!
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[580px] overflow-y-auto pr-1">
                      {Object.entries(cardOverrides).map(([bidStr, override]) => {
                        const bid = Number(bidStr);
                        const card = poolMap.get(bid);

                        return (
                          <div
                            key={bidStr}
                            className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-purple-800/80 transition-all space-y-2"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <span className="text-[10px] font-mono text-slate-400">Beatmap #{bid}</span>
                                <h4 className="text-sm font-bold text-white truncate">
                                  {card?.title || `Beatmap #${bid}`}
                                </h4>
                                <p className="text-xs text-slate-400 truncate">
                                  {card ? `${card.artist} [${card.version}] • ${card.stars}★` : 'Custom Assignment'}
                                </p>
                              </div>

                              <div className="flex flex-col items-end space-y-1">
                                <span className={`text-xs font-mono font-black px-2 py-0.5 rounded border border-purple-500/60 ${RARITY_COLORS[override.tier]} bg-purple-950/80`}>
                                  💎 {override.tier}
                                </span>
                                <button
                                  onClick={async () => {
                                    if (!confirm(`Restore natural rarity tier for beatmap #${bid}?`)) return;
                                    setActionLoading(true);
                                    try {
                                      await removeCardTierOverride(bid);
                                      showMsg(`✓ Restored natural tier for beatmap #${bid}`);
                                    } catch (e: any) {
                                      showMsg('Failed to restore: ' + e.message, false);
                                    } finally {
                                      setActionLoading(false);
                                    }
                                  }}
                                  className="text-[11px] font-mono text-red-400 hover:text-red-300 underline"
                                >
                                  Reset
                                </button>
                              </div>
                            </div>

                            {override.exReason && (
                              <div className="p-2.5 rounded-lg bg-purple-950/40 border border-purple-900/60 text-xs text-slate-200 font-sans italic">
                                "{override.exReason}"
                              </div>
                            )}

                            <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-1 border-t border-slate-900">
                              <span>Assigned by: {override.assignedBy || 'Admin'}</span>
                              <span>{override.assignedAt ? formatUserDate(new Date(override.assignedAt).getTime()) : ''}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            /* ── REGISTER / INJECT CUSTOM BEATMAP SUB-TAB ────────────── */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
              {/* Left: Custom Beatmap Registration Form */}
              <div className="lg:col-span-6 space-y-5 p-5 sm:p-6 rounded-2xl bg-slate-900/80 border border-emerald-800/60 shadow-xl">
                <div className="flex items-center space-x-3 border-b border-slate-800 pb-3">
                  <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    <PlusCircle className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Register New Beatmap into Global Pool</h3>
                    <p className="text-xs text-slate-400 font-mono">
                      Injected beatmaps will immediately be pullable by all players in gacha summons!
                    </p>
                  </div>
                </div>

                {/* Universal Quick Importer Box */}
                <div className="p-3.5 rounded-2xl bg-slate-950/90 border border-emerald-500/40 shadow-inner space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-mono font-bold text-emerald-400 flex items-center space-x-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Universal Auto-Fill (Hinamizawa / osu! / ID)</span>
                    </label>
                    <span className="text-[10px] font-mono text-slate-400">hinamizawa.ai & osu.ppy.sh</span>
                  </div>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={autofillUrlInput}
                      onChange={(e) => setAutofillUrlInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAutoFillBeatmap(autofillUrlInput); }}
                      placeholder="Paste e.g. https://hinamizawa.ai/osu/beatmaps/2414163 or map ID"
                      className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => handleAutoFillBeatmap(autofillUrlInput)}
                      disabled={isAutofilling}
                      className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-mono text-xs font-bold transition-all shadow-md flex items-center space-x-1.5 flex-shrink-0"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isAutofilling ? 'animate-spin' : ''}`} />
                      <span>{isAutofilling ? 'Fetching…' : '⚡ Auto-Fill'}</span>
                    </button>
                  </div>
                  <p className="text-[10px] font-mono text-slate-400">
                    Instantly extracts Title, Artist, Mapper, Stars, BPM, Length, Artwork & Audio Preview URL!
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-mono text-slate-300">Beatmap ID (Top Diff)</label>
                    <input
                      type="text"
                      value={manualMapId}
                      onChange={(e) => setManualMapId(e.target.value)}
                      placeholder="e.g. 129891 or paste link"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-mono text-slate-300">Beatmapset ID</label>
                    <div className="flex space-x-1.5">
                      <input
                        type="text"
                        value={manualSetId}
                        onChange={(e) => setManualSetId(e.target.value)}
                        placeholder="e.g. 39804"
                        className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                      />
                      <button
                        type="button"
                        onClick={() => handleAutoFillBeatmap(manualMapId || manualSetId)}
                        disabled={isAutofilling}
                        className="px-2.5 py-1 rounded-xl bg-emerald-950 border border-emerald-700 hover:bg-emerald-900 text-emerald-300 text-xs font-mono font-bold"
                        title="Auto-fills metadata from ID or link"
                      >
                        Auto-Fill
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-xs font-mono text-slate-300">Song Title</label>
                    <input
                      type="text"
                      value={manualTitle}
                      onChange={(e) => setManualTitle(e.target.value)}
                      placeholder="e.g. FREEDOM DiVE"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white font-sans focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-mono text-slate-300">Artist</label>
                    <input
                      type="text"
                      value={manualArtist}
                      onChange={(e) => setManualArtist(e.target.value)}
                      placeholder="e.g. xi"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white font-sans focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-mono text-slate-300">Mapper / Creator</label>
                    <input
                      type="text"
                      value={manualCreator}
                      onChange={(e) => setManualCreator(e.target.value)}
                      placeholder="e.g. Nakagawa-Kanon"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white font-sans focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-mono text-slate-300">Difficulty Name</label>
                    <input
                      type="text"
                      value={manualVersion}
                      onChange={(e) => setManualVersion(e.target.value)}
                      placeholder="e.g. FOUR DIMENSIONS"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white font-sans focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-mono text-slate-300">Star Rating (★)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={manualStars}
                      onChange={(e) => setManualStars(e.target.value)}
                      placeholder="e.g. 7.56"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-mono text-slate-300">BPM</label>
                    <input
                      type="number"
                      value={manualBpm}
                      onChange={(e) => setManualBpm(e.target.value)}
                      placeholder="e.g. 222"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-mono text-slate-300">Length (Seconds)</label>
                    <input
                      type="number"
                      value={manualLength}
                      onChange={(e) => setManualLength(e.target.value)}
                      placeholder="e.g. 257"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-mono text-slate-300">Play Count</label>
                    <input
                      type="number"
                      value={manualPlaycount}
                      onChange={(e) => setManualPlaycount(e.target.value)}
                      placeholder="e.g. 250000"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-mono text-slate-300">Favorites (♥)</label>
                    <input
                      type="number"
                      value={manualFavouriteCount}
                      onChange={(e) => setManualFavouriteCount(e.target.value)}
                      placeholder="e.g. 1500"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-mono text-slate-300">Leaderboard Status</label>
                    <select
                      value={manualStatus}
                      onChange={(e) => setManualStatus(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white font-sans focus:outline-none focus:border-emerald-500"
                    >
                      <option value="ranked">Ranked</option>
                      <option value="loved">Loved</option>
                      <option value="graveyard">Graveyard / Unranked</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-mono text-slate-300">Assigned Rarity Tier</label>
                    <select
                      value={manualRarity}
                      onChange={(e) => setManualRarity(e.target.value as RarityTier)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white font-sans focus:outline-none focus:border-emerald-500 font-bold"
                    >
                      {RARITY_ORDER.map((r) => (
                        <option key={r} value={r}>
                          {r === 'EX' ? '👑 EX Tier' : r}
                        </option>
                      ))}
                    </select>
                  </div>

                  {manualRarity === 'EX' && (
                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-xs font-mono text-purple-300 font-bold">👑 EX Tier Lore Explanation</label>
                      <textarea
                        rows={2}
                        value={manualExReason}
                        onChange={(e) => setManualExReason(e.target.value)}
                        placeholder="Explain why this card is in the EX Tier..."
                        className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-purple-700 text-sm text-white font-sans focus:outline-none focus:border-purple-400 resize-none"
                      />
                    </div>
                  )}

                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-xs font-mono text-slate-300">Cover Artwork URL</label>
                    <input
                      type="text"
                      value={manualCoverUrl}
                      onChange={(e) => setManualCoverUrl(e.target.value)}
                      placeholder="https://assets.ppy.sh/beatmaps/.../covers/cover.jpg"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-xs font-mono text-slate-300">Audio Preview URL (.mp3)</label>
                    <input
                      type="text"
                      value={manualPreviewUrl}
                      onChange={(e) => setManualPreviewUrl(e.target.value)}
                      placeholder="https://b.ppy.sh/preview/....mp3"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <button
                  onClick={handleSaveCustomBeatmap}
                  disabled={actionLoading}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-black text-sm shadow-xl shadow-emerald-600/30 transition-all flex items-center justify-center space-x-2"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>➕ Register & Inject into Global Pool</span>
                </button>
              </div>

              {/* Right: Injected Custom Beatmaps List */}
              <div className="lg:col-span-6 space-y-4 p-5 sm:p-6 rounded-2xl bg-slate-900/80 border border-slate-800">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-white flex items-center space-x-2">
                    <Database className="w-4 h-4 text-emerald-400" />
                    <span>Injected Custom Beatmaps ({customBeatmaps.length})</span>
                  </h3>
                  <span className="text-xs font-mono text-emerald-300 font-bold px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-500/40">
                    Live in Gacha
                  </span>
                </div>

                {customBeatmaps.length === 0 ? (
                  <div className="p-8 rounded-xl bg-slate-950/60 border border-slate-800 text-center space-y-2">
                    <Database className="w-8 h-8 text-slate-600 mx-auto" />
                    <p className="text-sm font-bold text-slate-300">No Custom Beatmaps Injected Yet</p>
                    <p className="text-xs text-slate-500 font-mono">
                      Use the registration form on the left to add any custom beatmaps to the live summoning pool!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[620px] overflow-y-auto pr-1">
                    {customBeatmaps.map((map) => (
                      <div
                        key={map.id}
                        className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-emerald-800/80 transition-all space-y-2"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center space-x-3 min-w-0">
                            {map.covers?.cover && (
                              <img
                                src={map.covers.cover}
                                alt=""
                                className="w-12 h-12 rounded-lg object-cover border border-slate-800 flex-shrink-0"
                              />
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center space-x-1.5">
                                <h4 className="text-sm font-bold text-white truncate">{map.title}</h4>
                                <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded ${RARITY_COLORS[map.rarity] || 'text-slate-400'}`}>
                                  {map.rarity}
                                </span>
                              </div>
                              <p className="text-xs text-slate-400 truncate">
                                {map.artist} [{map.version}] • {map.stars}★ • Mapper: {map.creator}
                              </p>
                              <span className="text-[10px] font-mono text-slate-500">
                                ID #{map.id} · Set #{map.beatmapsetId} · {map.status}
                              </span>
                            </div>
                          </div>

                          <button
                            onClick={() => handleDeleteCustomBeatmap(map.id, map.title)}
                            disabled={actionLoading}
                            className="p-1.5 rounded-lg bg-red-950 hover:bg-red-900 text-red-300 border border-red-800/60 transition-colors flex-shrink-0"
                            title="Remove from Pool"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {map.exReason && (
                          <div className="p-2 rounded-lg bg-purple-950/40 border border-purple-900/60 text-xs text-slate-200 font-sans italic">
                            "{map.exReason}"
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 3. BOUNTIES & BOSS RAIDS TAB ───────────────────── */}
      {activeTab === 'bounties' && (
        <div className="space-y-6 animate-fade-in">
          {/* Sub-Tab Navigation */}
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
            <button
              onClick={() => setBountiesSubTab('boss_songs')}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                bountiesSubTab === 'boss_songs'
                  ? 'bg-red-950/90 text-red-200 border border-red-500/60 shadow-lg shadow-red-950/50'
                  : 'bg-slate-900/60 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Flame className="w-4 h-4 text-red-400" />
              <span>👑 Boss Raid Song Creator</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-red-900/60 text-red-300">
                {bossList.length} Active
              </span>
            </button>

            <button
              onClick={() => setBountiesSubTab('bounty_packs')}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                bountiesSubTab === 'bounty_packs'
                  ? 'bg-amber-950/90 text-amber-200 border border-amber-500/60 shadow-lg shadow-amber-950/50'
                  : 'bg-slate-900/60 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Package className="w-4 h-4 text-amber-400" />
              <span>📦 Bounty Pack Builder</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-amber-900/60 text-amber-300">
                {packsList.length} Active
              </span>
            </button>
          </div>

          {/* ── SUB-TAB 1: BOSS RAID CREATOR ────────────────── */}
          {bountiesSubTab === 'boss_songs' && (
            <div className="space-y-6">
              {/* Creator Form */}
              <div className="p-6 rounded-2xl bg-slate-900/80 border border-red-900/60 shadow-xl space-y-5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center space-x-2 text-sm font-bold text-red-300">
                    <Flame className="w-4 h-4 text-red-500 animate-pulse" />
                    <span>Configure & Publish Boss Raid Song</span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    Rewards default to +300 ⚡ & +300 Pts
                  </span>
                </div>

                {/* Autofill input */}
                <div className="space-y-2">
                  <label className="block text-xs font-mono text-slate-300 font-bold">
                    1. osu! Beatmap ID or URL (osu.ppy.sh or hinamizawa.ai)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. 555797, or https://osu.ppy.sh/beatmapsets/158023#osu/555797"
                      value={bossUrlInput}
                      onChange={(e) => setBossUrlInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleFetchBossMeta()}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white font-mono focus:outline-none focus:border-red-500"
                    />
                    <button
                      onClick={handleFetchBossMeta}
                      disabled={isFetchingBossMeta || !bossUrlInput.trim()}
                      className="px-5 py-2.5 rounded-xl bg-red-700 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold font-mono transition-all flex items-center space-x-2 shadow-lg shadow-red-950/40"
                    >
                      {isFetchingBossMeta ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Fetching...</span>
                        </>
                      ) : (
                        <>
                          <Zap className="w-4 h-4" />
                          <span>Autofill Map</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Fetched Beatmap Preview Banner */}
                {bossFetchedMeta && (
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-red-950/80 via-slate-950 to-slate-950 border border-red-500/60 flex items-center space-x-4 animate-scale-up">
                    <img
                      src={bossFetchedMeta.coverUrl}
                      alt={bossFetchedMeta.title}
                      className="w-16 h-16 rounded-xl object-cover border border-red-500/40 flex-shrink-0"
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-0.5 rounded-md bg-red-950 text-red-300 border border-red-700/50 text-[10px] font-mono font-bold">
                          ★ {bossFetchedMeta.stars.toFixed(2)}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {bossFetchedMeta.bpm} BPM · {Math.floor(bossFetchedMeta.length / 60)}m {bossFetchedMeta.length % 60}s
                        </span>
                      </div>
                      <h4 className="text-base font-bold text-white truncate font-display">
                        {bossFetchedMeta.title}
                      </h4>
                      <p className="text-xs text-slate-300 truncate font-mono">
                        {bossFetchedMeta.artist} [{bossFetchedMeta.version}] · Mapped by {bossFetchedMeta.creator}
                      </p>
                    </div>
                  </div>
                )}

                {/* Boss Lore / Story input */}
                <div className="space-y-2">
                  <label className="block text-xs font-mono text-amber-300 font-bold flex items-center space-x-1">
                    <Crown className="w-3.5 h-3.5" />
                    <span>2. Boss Lore & Challenge Story ("Why this song?")</span>
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Tell players why this song is a Boss Bounty! e.g., 'The infamous 240 BPM stamina trial from 2015. Can you pass the final deathstream?'"
                    value={bossLoreReason}
                    onChange={(e) => setBossLoreReason(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white font-sans focus:outline-none focus:border-red-500 leading-relaxed"
                  />
                </div>

                {/* Custom Objective & Requirements */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="space-y-1 md:col-span-2">
                    <label className="block text-[11px] font-mono text-slate-400">Custom Objective Display Text</label>
                    <input
                      type="text"
                      placeholder="e.g. Pass on osu! with any grade"
                      value={bossObjective}
                      onChange={(e) => setBossObjective(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white font-mono focus:outline-none focus:border-red-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-mono text-slate-400">Minimum Rank</label>
                    <select
                      value={bossMinRank}
                      onChange={(e) => setBossMinRank(e.target.value as BountyRankRequirement)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white font-mono focus:outline-none focus:border-red-500"
                    >
                      <option value="Pass">Pass (Any Grade D/C/B/A/S)</option>
                      <option value="A">Grade A or higher</option>
                      <option value="S">Grade S or higher</option>
                      <option value="SS">Grade SS (100% Acc)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-mono text-slate-400">Required Mods</label>
                    <select
                      value={bossReqMods}
                      onChange={(e) => setBossReqMods(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white font-mono focus:outline-none focus:border-red-500"
                    >
                      <option value="None">None (Any mod or Nomod)</option>
                      <option value="HD">Hidden (HD)</option>
                      <option value="HR">HardRock (HR)</option>
                      <option value="DT">DoubleTime (DT)</option>
                      <option value="FL">Flashlight (FL)</option>
                    </select>
                  </div>
                </div>

                {/* Rewards & Gacha Pool Checkbox */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-800">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-mono text-slate-400">Reward Stamina (⚡)</label>
                    <input
                      type="number"
                      value={bossRewardStamina}
                      onChange={(e) => setBossRewardStamina(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-mono text-slate-400">Reward Points (🎯)</label>
                    <input
                      type="number"
                      value={bossRewardPoints}
                      onChange={(e) => setBossRewardPoints(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-mono text-slate-400">Card Pool Rarity (If Added)</label>
                    <select
                      value={bossPoolRarity}
                      onChange={(e) => setBossPoolRarity(e.target.value as RarityTier)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white font-mono"
                    >
                      {RARITY_ORDER.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Auto Add Checkbox */}
                <label className="flex items-center space-x-2.5 text-xs text-slate-300 font-mono cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={bossAddToPoolIfMissing}
                    onChange={(e) => setBossAddToPoolIfMissing(e.target.checked)}
                    className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-red-600 focus:ring-0"
                  />
                  <span>Automatically register beatmap into Gacha Card Pool if not already present</span>
                </label>

                {/* Submit button */}
                <button
                  onClick={handlePublishBossBounty}
                  disabled={actionLoading || !bossFetchedMeta || !bossLoreReason.trim()}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-black font-display transition-all flex items-center justify-center space-x-2 shadow-xl shadow-red-950/60"
                >
                  <Flame className="w-4 h-4" />
                  <span>🔥 Publish Boss Raid Challenge (+{bossRewardStamina}⚡ / +{bossRewardPoints} Pts)</span>
                </button>
              </div>

              {/* Active Boss Bounties List */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2 text-xs font-mono font-bold text-slate-300 uppercase">
                  <Crown className="w-4 h-4 text-amber-400" />
                  <span>Active Boss Bounties ({bossList.length})</span>
                </div>

                {bossList.length === 0 ? (
                  <div className="p-8 text-center rounded-2xl bg-slate-900/40 border border-slate-800 text-xs text-slate-500 font-mono">
                    No boss raid songs published yet. Use the form above to deploy one!
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {bossList.map((boss) => (
                      <div
                        key={boss.id}
                        className="p-4 rounded-2xl bg-slate-900/80 border border-red-500/50 flex flex-col justify-between space-y-3"
                      >
                        <div className="flex items-start space-x-3.5">
                          <img
                            src={boss.beatmap.covers.card || boss.beatmap.covers.cover}
                            alt="Boss"
                            className="w-16 h-16 rounded-xl object-cover border border-red-500/40 flex-shrink-0"
                          />
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-black bg-red-950 border border-red-500 text-red-300">
                                👑 RAID BOSS
                              </span>
                              <span className="text-xs font-mono text-amber-400 font-bold">
                                ★ {boss.beatmap.stars.toFixed(2)}
                              </span>
                            </div>
                            <h4 className="text-sm font-bold text-white truncate">{boss.beatmap.title}</h4>
                            <p className="text-xs text-slate-400 truncate font-mono">
                              {boss.beatmap.artist} [{boss.beatmap.version}]
                            </p>
                          </div>
                        </div>

                        {boss.bossReason && (
                          <div className="p-2.5 rounded-xl bg-red-950/60 border border-red-900/40 text-xs text-amber-200 font-sans italic">
                            "{boss.bossReason}"
                          </div>
                        )}

                        <div className="p-2 rounded-lg bg-slate-950 text-xs font-mono text-slate-300 flex items-center justify-between">
                          <span>Objective: {boss.description}</span>
                          <span className="text-amber-400 font-bold">+{boss.rewardStamina}⚡ / +{boss.rewardPoints} Pts</span>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                          <span className="text-[10px] font-mono text-slate-500">
                            Created: {new Date(boss.createdAt).toLocaleDateString()}
                          </span>
                          <button
                            onClick={() => handleDeleteBossBounty(boss.id, boss.beatmap.title)}
                            disabled={actionLoading}
                            className="p-1.5 rounded-lg bg-red-950 hover:bg-red-900 text-red-300 border border-red-800/60 transition-colors flex items-center space-x-1 text-xs font-mono"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Remove Boss</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── SUB-TAB 2: BOUNTY PACK BUILDER ──────────────── */}
          {bountiesSubTab === 'bounty_packs' && (
            <div className="space-y-6">
              {/* Pack Builder Card */}
              <div className="p-6 rounded-2xl bg-slate-900/80 border border-amber-900/60 shadow-xl space-y-5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center space-x-2 text-sm font-bold text-amber-300">
                    <Package className="w-4 h-4 text-amber-400" />
                    <span>Create Curated Bounty Playlist Pack</span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    Players get a huge completion bonus when finishing all maps
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="space-y-1 md:col-span-2">
                    <label className="block text-xs font-mono text-slate-300 font-bold">Pack Title</label>
                    <input
                      type="text"
                      placeholder="e.g. DragonForce Speed Demon Collection"
                      value={packTitle}
                      onChange={(e) => setPackTitle(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white font-mono focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-mono text-slate-300 font-bold">Theme Color</label>
                    <select
                      value={packThemeColor}
                      onChange={(e) => setPackThemeColor(e.target.value as any)}
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white font-mono"
                    >
                      <option value="amber">Amber Gold</option>
                      <option value="red">Crimson Red</option>
                      <option value="purple">Cosmic Purple</option>
                      <option value="emerald">Emerald Green</option>
                      <option value="cyan">Cyber Cyan</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-mono text-slate-300 font-bold">Pack Description / Theme Lore</label>
                  <input
                    type="text"
                    placeholder="e.g. Pass all 3 iconic DragonForce maps with Grade A or higher to earn the Dragon Slayer title!"
                    value={packDescription}
                    onChange={(e) => setPackDescription(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white font-sans focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-mono text-slate-400">Bonus Stamina (⚡)</label>
                    <input
                      type="number"
                      value={packBonusStamina}
                      onChange={(e) => setPackBonusStamina(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-mono text-slate-400">Bonus Points (🎯)</label>
                    <input
                      type="number"
                      value={packBonusPoints}
                      onChange={(e) => setPackBonusPoints(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-mono text-slate-400">Badge Title (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Dragon Slayer"
                      value={packBadgeTitle}
                      onChange={(e) => setPackBadgeTitle(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white font-mono"
                    />
                  </div>
                </div>

                {/* Add Beatmaps to Pack Draft */}
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
                  <div className="flex items-center space-x-2 text-xs font-mono font-bold text-amber-300">
                    <PlusCircle className="w-4 h-4" />
                    <span>Add Beatmaps to this Playlist ({packDraftBounties.length} added)</span>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Enter Beatmap ID or link (e.g. 846105)"
                      value={packMapInput}
                      onChange={(e) => setPackMapInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleFetchPackMapMeta()}
                      className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                    />
                    <button
                      onClick={handleFetchPackMapMeta}
                      disabled={isFetchingPackMap || !packMapInput.trim()}
                      className="px-4 py-2 rounded-xl bg-amber-700 hover:bg-amber-600 disabled:opacity-40 text-white text-xs font-mono font-bold transition-colors"
                    >
                      {isFetchingPackMap ? 'Fetching...' : 'Fetch Map'}
                    </button>
                  </div>

                  {packMapMeta && (
                    <div className="p-4 rounded-xl bg-slate-900 border border-amber-500/40 space-y-3 animate-fade-in">
                      <div className="flex items-center space-x-3 min-w-0">
                        <img
                          src={packMapMeta.coverUrl}
                          alt="Cover"
                          className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate">{packMapMeta.title}</p>
                          <p className="text-[10px] text-slate-400 font-mono">
                            {packMapMeta.artist} [{packMapMeta.version}] · ★ {packMapMeta.stars.toFixed(2)}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                        <div className="space-y-1 sm:col-span-2">
                          <label className="block text-[10px] font-mono text-slate-400">Map Objective</label>
                          <input
                            type="text"
                            placeholder="e.g. Pass with Grade A or higher"
                            value={packMapObjective}
                            onChange={(e) => setPackMapObjective(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white font-mono"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[10px] font-mono text-slate-400">Min Rank</label>
                          <select
                            value={packMapMinRank}
                            onChange={(e) => setPackMapMinRank(e.target.value as BountyRankRequirement)}
                            className="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white font-mono"
                          >
                            <option value="Pass">Pass</option>
                            <option value="A">Grade A</option>
                            <option value="S">Grade S</option>
                            <option value="SS">Grade SS</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[10px] font-mono text-slate-400">Required Mods</label>
                          <select
                            value={packMapReqMods}
                            onChange={(e) => setPackMapReqMods(e.target.value)}
                            className="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white font-mono"
                          >
                            <option value="None">None</option>
                            <option value="HD">HD</option>
                            <option value="HR">HR</option>
                            <option value="DT">DT</option>
                            <option value="FL">FL</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center space-x-2">
                          <div className="flex items-center space-x-1">
                            <span className="text-[10px] font-mono text-slate-400">⚡</span>
                            <input
                              type="number"
                              value={packMapStamina}
                              onChange={(e) => setPackMapStamina(e.target.value)}
                              className="w-16 px-2 py-1 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white font-mono"
                            />
                          </div>
                          <div className="flex items-center space-x-1">
                            <span className="text-[10px] font-mono text-slate-400">🎯 Pts</span>
                            <input
                              type="number"
                              value={packMapPoints}
                              onChange={(e) => setPackMapPoints(e.target.value)}
                              className="w-16 px-2 py-1 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white font-mono"
                            />
                          </div>
                        </div>

                        <button
                          onClick={handleAddMapToPackDraft}
                          className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-bold transition-colors"
                        >
                          + Add Map to Pack Draft
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Draft playlist list */}
                  {packDraftBounties.length > 0 && (
                    <div className="space-y-2 pt-2">
                      <span className="text-[10px] font-mono text-slate-400 block uppercase">Draft Playlist:</span>
                      {packDraftBounties.map((db, i) => (
                        <div
                          key={db.id || i}
                          className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs font-mono"
                        >
                          <div className="flex items-center space-x-2 min-w-0">
                            <span className="font-bold text-amber-400">#{i + 1}</span>
                            <span className="text-white font-bold truncate">{db.beatmap.title}</span>
                            <span className="text-slate-400 text-[10px]">[{db.beatmap.version}]</span>
                            <span className="text-amber-400 font-bold">★{db.beatmap.stars.toFixed(2)}</span>
                          </div>
                          <div className="flex items-center space-x-3">
                            <span className="text-emerald-400 font-bold">+{db.rewardStamina}⚡ / +{db.rewardPoints} Pts</span>
                            <button
                              onClick={() => handleRemoveMapFromPackDraft(i)}
                              className="text-red-400 hover:text-red-300"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Create Pack button */}
                <button
                  onClick={handleCreateBountyPack}
                  disabled={actionLoading || !packTitle.trim() || packDraftBounties.length < 2}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-600 to-emerald-600 hover:from-amber-500 hover:to-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-black font-display transition-all flex items-center justify-center space-x-2 shadow-xl shadow-amber-950/60"
                >
                  <Package className="w-4 h-4" />
                  <span>📦 Create & Publish Bounty Pack ({packDraftBounties.length} Maps)</span>
                </button>
              </div>

              {/* Published Bounty Packs List */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2 text-xs font-mono font-bold text-slate-300 uppercase">
                  <Package className="w-4 h-4 text-amber-400" />
                  <span>Active Bounty Packs ({packsList.length})</span>
                </div>

                {packsList.length === 0 ? (
                  <div className="p-8 text-center rounded-2xl bg-slate-900/40 border border-slate-800 text-xs text-slate-500 font-mono">
                    No bounty packs created yet. Build a thematic pack above!
                  </div>
                ) : (
                  <div className="space-y-4">
                    {packsList.map((pack) => (
                      <div
                        key={pack.id}
                        className="p-5 rounded-2xl bg-slate-900/80 border border-amber-500/40 space-y-3"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                          <div>
                            <div className="flex items-center space-x-2">
                              <h4 className="text-base font-black text-white font-display">{pack.title}</h4>
                              {pack.badgeTitle && (
                                <span className="px-2 py-0.5 rounded-full bg-purple-950 border border-purple-500/50 text-purple-300 font-mono text-[10px] font-bold">
                                  Title: {pack.badgeTitle}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-400">{pack.description}</p>
                          </div>

                          <div className="flex items-center space-x-3">
                            <span className="text-xs font-mono font-bold text-amber-400">
                              Bonus: +{pack.bonusRewardStamina}⚡ / +{pack.bonusRewardPoints} Pts
                            </span>
                            <button
                              onClick={() => handleDeleteBountyPack(pack.id, pack.title)}
                              className="p-2 rounded-lg bg-red-950 hover:bg-red-900 text-red-300 border border-red-800/60 transition-colors"
                              title="Delete Pack"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Playlist maps preview */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                          {pack.bounties.map((pb, i) => (
                            <div key={pb.id || i} className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center space-x-2 text-xs font-mono">
                              <img src={pb.beatmap.covers.card || pb.beatmap.covers.cover} alt="Cover" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="font-bold text-white truncate">{pb.beatmap.title}</p>
                                <p className="text-[10px] text-amber-400">★{pb.beatmap.stars.toFixed(2)} · +{pb.rewardStamina}⚡</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 4. ANNOUNCEMENTS TAB ─────────────────────── */}
      {activeTab === 'announcements' && (
        <div className="space-y-6">
          {/* Active Announcement Preview */}
          {activeAnnData && activeAnnData.active ? (
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-cyan-500/50 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">
                    <Bell className="w-5 h-5 animate-bounce" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-500 text-cyan-300">
                      ● LIVE POPUP ACTIVE
                    </span>
                    <h3 className="text-lg font-black text-white font-display mt-0.5">
                      {activeAnnData.title}
                    </h3>
                  </div>
                </div>

                <button
                  onClick={handleDeactivateAnnouncement}
                  disabled={actionLoading}
                  className="px-3.5 py-1.5 rounded-xl bg-red-950/80 hover:bg-red-900 border border-red-800 text-red-300 font-bold text-xs transition-colors self-start sm:self-auto"
                >
                  Deactivate Popup
                </button>
              </div>

              <p className="text-xs sm:text-sm text-slate-300 whitespace-pre-line font-sans">
                {activeAnnData.message}
              </p>

              {activeAnnData.bonusStamina && (
                <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-amber-950/60 border border-amber-500/40 text-amber-300 text-xs font-mono">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>Includes +{activeAnnData.bonusStamina} Free Bonus Stamina Gift</span>
                </div>
              )}
            </div>
          ) : (
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Bell className="w-6 h-6 text-slate-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-300">No Announcement Currently Active</h3>
                  <p className="text-xs text-slate-500 font-mono">Compose an announcement below to show an instant popup notification to all visitors!</p>
                </div>
              </div>
            </div>
          )}

          {/* Announcement Composer */}
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-5">
            <h2 className="font-bold text-white text-lg flex items-center space-x-2">
              <Bell className="w-5 h-5 text-cyan-400" />
              <span>Compose Global Announcement</span>
            </h2>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-mono text-slate-300">Announcement Title</label>
                  <input
                    type="text"
                    value={annTitle}
                    onChange={(e) => setAnnTitle(e.target.value)}
                    placeholder="e.g. New Beatmaps Added & Maintenance Notice"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white font-sans focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-mono text-slate-300">Category</label>
                  <select
                    value={annType}
                    onChange={(e) => setAnnType(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white font-sans focus:outline-none focus:border-cyan-500"
                  >
                    <option value="event">🎉 Special Event</option>
                    <option value="giveaway">🎁 Giveaway / Free Gift</option>
                    <option value="update">⚡ Update Note</option>
                    <option value="info">📢 General Notice</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-mono text-slate-300">Notification Message</label>
                <textarea
                  rows={4}
                  value={annMessage}
                  onChange={(e) => setAnnMessage(e.target.value)}
                  placeholder="Write message details..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white font-sans focus:outline-none focus:border-cyan-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-mono text-slate-300">Attached Bonus Stamina Gift</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      min="0"
                      value={annBonusStamina}
                      onChange={(e) => setAnnBonusStamina(Number(e.target.value))}
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white font-mono focus:outline-none"
                    />
                    <span className="text-xs text-slate-400 font-mono">⚡ bonus</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-mono text-slate-300">Expiration Duration</label>
                  <select
                    value={annDurationHours}
                    onChange={(e) => setAnnDurationHours(Number(e.target.value))}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white font-sans focus:outline-none"
                  >
                    <option value={24}>24 Hours</option>
                    <option value={48}>48 Hours (2 Days)</option>
                    <option value={168}>7 Days (1 Week)</option>
                    <option value={0}>No Expiration</option>
                  </select>
                </div>
              </div>

              <button
                onClick={handlePublishAnnouncement}
                disabled={actionLoading}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-600 via-blue-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white font-black text-sm shadow-xl shadow-cyan-600/30 transition-all flex items-center justify-center space-x-2"
              >
                <Send className="w-4 h-4" />
                <span>📢 Broadcast Global Announcement to All Players</span>
              </button>
            </div>
          </div>

          {/* ── Mini Floating Side Broadcast Composer ──────────────── */}
          <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/40 border border-cyan-800/60 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-white text-base flex items-center space-x-2">
                  <Bell className="w-4 h-4 text-cyan-400" />
                  <span>Floating Side Notification (Mini Broadcast)</span>
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  Displays a stylish non-intrusive floating toast in the corner of all players' screens.
                </p>
              </div>

              {activeMiniBroadcast && activeMiniBroadcast.active && (
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-500 font-bold">
                    ● SIDE TOAST ACTIVE
                  </span>
                  <button
                    onClick={handleDeactivateMiniBroadcast}
                    disabled={actionLoading}
                    className="px-2.5 py-1 rounded-lg bg-red-950 hover:bg-red-900 text-red-300 text-xs font-bold transition-colors"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-mono text-slate-300">Badge Label</label>
                  <input
                    type="text"
                    value={miniBadge}
                    onChange={(e) => setMiniBadge(e.target.value)}
                    placeholder="e.g. ADMIN NOTE, QUICK TIP, NOTICE"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-mono text-slate-300">Toast Style</label>
                  <select
                    value={miniType}
                    onChange={(e) => setMiniType(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white font-sans focus:outline-none focus:border-cyan-500"
                  >
                    <option value="info">🔵 Cyan (Info / Notice)</option>
                    <option value="success">🟢 Emerald (Success / Gift)</option>
                    <option value="event">🟣 Purple (Event / Special)</option>
                    <option value="warning">🟡 Amber (Warning / Alert)</option>
                    <option value="tip">✨ Sparkle (Tip / Guide)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-mono text-slate-300">Optional Action Link URL</label>
                  <input
                    type="text"
                    value={miniLinkUrl}
                    onChange={(e) => setMiniLinkUrl(e.target.value)}
                    placeholder="e.g. https://discord.gg/..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-mono text-slate-300">Link Button Label</label>
                  <input
                    type="text"
                    value={miniLinkText}
                    onChange={(e) => setMiniLinkText(e.target.value)}
                    placeholder="e.g. Learn More, Check It Out"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white font-sans focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-mono text-slate-300">Side Toast Message</label>
                <textarea
                  rows={2}
                  value={miniMsg}
                  onChange={(e) => setMiniMsg(e.target.value)}
                  placeholder="e.g. Rhythm Math Quiz has been updated with a 5 per hour cap! Enjoy bonus stamina."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white font-sans focus:outline-none focus:border-cyan-500 resize-none"
                />
              </div>

              <button
                onClick={handlePublishMiniBroadcast}
                disabled={actionLoading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-black text-xs sm:text-sm shadow-xl shadow-cyan-600/20 transition-all flex items-center justify-center space-x-2"
              >
                <Send className="w-4 h-4" />
                <span>🚀 Send Floating Side Notification to All Users</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 4. USERS TAB ──────────────────────────── */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          {!selectedUserId ? (
            <div className="p-8 rounded-2xl bg-slate-900/80 border border-slate-800 text-center space-y-4">
              <Users className="w-12 h-12 text-slate-600 mx-auto"/>
              <div>
                <h3 className="text-lg font-bold text-white">Select a User to Manage</h3>
                <p className="text-slate-400 text-xs sm:text-sm mt-1">
                  Click <strong>"Manage"</strong> on any user in the Overview tab, or search directly by osu! ID below.
                </p>
              </div>
              <div className="flex items-center space-x-2 max-w-xs mx-auto">
                <input
                  type="number"
                  placeholder="Enter osu! User ID"
                  className="flex-1 px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs sm:text-sm font-mono focus:outline-none focus:border-pink-500/60"
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      const v = parseInt((e.target as HTMLInputElement).value, 10);
                      if (v) selectUser(v, String(v));
                    }
                  }}
                />
                <button
                  onClick={() => {
                    const el = document.querySelector('input[type=number]') as HTMLInputElement;
                    const v = parseInt(el?.value, 10);
                    if (v) selectUser(v, String(v));
                  }}
                  className="px-4 py-2 rounded-xl bg-pink-700 hover:bg-pink-600 text-white text-xs sm:text-sm font-semibold"
                >
                  Load
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* User Header */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-900/90 border border-slate-800">
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => { setSelectedUserId(null); setUserColl([]); }}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300"
                  >
                    <X className="w-4 h-4"/>
                  </button>
                  <div>
                    <p className="font-bold text-white text-base sm:text-lg">{selectedUsername}</p>
                    <p className="text-xs font-mono text-slate-400">osu! Account ID: {selectedUserId}</p>
                  </div>
                </div>
                <a
                  href={`https://osu.ppy.sh/users/${selectedUserId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-pink-950/60 hover:bg-pink-900/60 border border-pink-800/60 text-pink-300 text-xs font-semibold"
                >
                  View osu! Profile
                </a>
              </div>

              {/* Action Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Adjust Pulls */}
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                  <h3 className="font-bold text-white flex items-center space-x-2">
                    <TrendingUp className="w-4 h-4 text-pink-400"/>
                    <span>Adjust Total Pulls</span>
                  </h3>
                  <div className="flex rounded-xl overflow-hidden border border-slate-700">
                    <button
                      onClick={() => setPullsMode('add')}
                      className={`flex-1 py-1 text-xs font-semibold ${pullsMode === 'add' ? 'bg-pink-700 text-white' : 'bg-slate-800 text-slate-400'}`}
                    >
                      Add Delta (+)
                    </button>
                    <button
                      onClick={() => setPullsMode('set')}
                      className={`flex-1 py-1 text-xs font-semibold ${pullsMode === 'set' ? 'bg-pink-700 text-white' : 'bg-slate-800 text-slate-400'}`}
                    >
                      Set Exact
                    </button>
                  </div>
                  <input
                    type="number"
                    placeholder={pullsMode === 'add' ? 'Amount to add (e.g. 50)' : 'Exact total pulls'}
                    value={pullsInput}
                    onChange={e => setPullsInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-sm font-mono focus:outline-none focus:border-pink-500/60"
                  />
                  <button
                    onClick={() => handleSetPulls(selectedUserId)}
                    disabled={actionLoading || !pullsInput}
                    className="w-full py-2 rounded-xl bg-pink-700 hover:bg-pink-600 disabled:opacity-50 text-white text-xs sm:text-sm font-semibold transition-colors"
                  >
                    {actionLoading ? 'Saving…' : 'Apply Pulls'}
                  </button>
                </div>

                {/* Force Stamina & Bonus Pulls */}
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                  <h3 className="font-bold text-white flex items-center space-x-2">
                    <Zap className="w-4 h-4 text-amber-400"/>
                    <span>Stamina & Bonus Pulls</span>
                  </h3>
                  <div className="text-[11px] font-mono text-slate-400 space-y-0.5">
                    <p>Self: <span className="text-amber-300 font-bold">{energy.current}/{energy.max}</span> (Main) + <span className="text-sky-300 font-bold">{energy.reserve || 0}</span> (Rsv) + <span className="text-purple-300 font-bold">{energy.bonus || 0}</span> (Bonus)</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-mono text-slate-400">Bonus Pulls Amount (+X)</label>
                    <input
                      type="number"
                      min="1"
                      max="9999"
                      placeholder="Bonus Pulls (e.g. 100)"
                      value={energyInput}
                      onChange={e => setEnergyInput(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-sm font-mono focus:outline-none focus:border-amber-500/60"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleEnergyOverride(selectedUserId)}
                      disabled={actionLoading || !energyInput}
                      className="py-2 px-2 rounded-xl bg-gradient-to-r from-amber-700 to-orange-600 hover:from-amber-600 hover:to-orange-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md flex items-center justify-center space-x-1"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>{selectedUserId === user?.osuId ? 'Add Bonus Pulls' : 'Queue Bonus'}</span>
                    </button>
                    <button
                      onClick={async () => {
                        if (selectedUserId === user?.osuId) {
                          await adminRefillEnergy(50);
                          showMsg('⚡ Instantly refilled Main Stamina (50/50) & added bonus stamina!');
                        } else {
                          await supabase.from('user_energy_overrides').upsert({
                            osu_id: selectedUserId,
                            energy_amount: 100,
                          });
                          showMsg(`⚡ Queued +100 Stamina gift for ${selectedUsername}`);
                        }
                      }}
                      disabled={actionLoading}
                      className="py-2 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 text-xs font-semibold transition-all flex items-center justify-center space-x-1"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                      <span>Full Refill (+100)</span>
                    </button>
                  </div>
                </div>

                {/* Revoke Sessions */}
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                  <h3 className="font-bold text-white flex items-center space-x-2">
                    <Trash2 className="w-4 h-4 text-red-400"/>
                    <span>Session Security</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Force logs this user out across all devices. Their collections in Supabase are safely kept.
                  </p>
                  <button
                    onClick={() => handleRevokeSession(selectedUserId)}
                    disabled={actionLoading || selectedUserId === user?.osuId}
                    className="w-full py-2 rounded-xl bg-red-800 hover:bg-red-700 disabled:opacity-40 text-white text-xs sm:text-sm font-semibold"
                  >
                    Revoke All Sessions
                  </button>
                </div>
              </div>

              {/* Add Card to User */}
              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                <h3 className="font-bold text-white flex items-center space-x-2">
                  <PlusCircle className="w-4 h-4 text-emerald-400"/>
                  <span>Add Specific Beatmap Card</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="sm:col-span-2 relative">
                    <input
                      type="text"
                      placeholder="Search title, artist, or song…"
                      value={addCardSearch}
                      onChange={e => { setAddCardSearch(e.target.value); setAddCardId(''); }}
                      className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs sm:text-sm font-mono focus:outline-none focus:border-emerald-500/60"
                    />
                    {poolMatches.length > 0 && (
                      <div className="absolute z-20 top-full left-0 right-0 mt-1 rounded-xl bg-slate-800 border border-slate-700 overflow-hidden shadow-xl max-h-48 overflow-y-auto">
                        {poolMatches.map(m => (
                          <button
                            key={m.id}
                            onClick={() => {
                              setAddCardId(String(m.id));
                              setAddCardSearch(`${m.artist} — ${m.title} [#${m.id}]`);
                              setAddCardRarity(m.rarity);
                            }}
                            className="w-full flex items-center space-x-2 px-3 py-2 hover:bg-slate-700 text-left"
                          >
                            <span className={`text-[10px] font-mono font-bold ${RARITY_COLORS[m.rarity]||'text-slate-400'}`}>{m.rarity}</span>
                            <span className="text-xs sm:text-sm text-slate-200 truncate">{m.artist} — {m.title}</span>
                            <span className="text-[10px] text-slate-500 font-mono flex-shrink-0">#{m.id}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <input
                    type="number"
                    placeholder="Beatmap ID"
                    value={addCardId}
                    onChange={e => setAddCardId(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs sm:text-sm font-mono focus:outline-none focus:border-emerald-500/60"
                  />
                  <input
                    type="number"
                    min="1"
                    placeholder="Copies"
                    value={addCardCopies}
                    onChange={e => setAddCardCopies(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs sm:text-sm font-mono focus:outline-none focus:border-emerald-500/60"
                  />
                </div>
                <div className="flex items-center space-x-3">
                  <select
                    value={addCardRarity}
                    onChange={e => setAddCardRarity(e.target.value as RarityTier)}
                    className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs sm:text-sm font-mono focus:outline-none"
                  >
                    {RARITY_ORDER.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <button
                    onClick={() => handleAddCard(selectedUserId)}
                    disabled={actionLoading || (!addCardId && !addCardSearch)}
                    className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs sm:text-sm font-semibold"
                  >
                    <PlusCircle className="w-4 h-4"/>
                    <span>Add Card</span>
                  </button>
                </div>
              </div>

              {/* Secret Next-Pull Injector (Destiny Drop) */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950/60 via-slate-900 to-indigo-950/60 border border-purple-800/60 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-white flex items-center space-x-2">
                    <Target className="w-4 h-4 text-purple-400" />
                    <span>Secret Next-Pull Injector ("Destiny Drop")</span>
                  </h3>
                  <span className="text-[10px] font-mono text-purple-300 px-2 py-0.5 rounded-full bg-purple-950 border border-purple-500/40">
                    Undetectable · Pity Preserved
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-mono">
                  Inject any beatmap into <strong className="text-white">{selectedUsername}</strong>'s next summon (Single or 10x). Pity count will be authentically preserved with zero clues shown to the player.
                </p>

                {injections[String(selectedUserId)] && !injections[String(selectedUserId)].consumed ? (
                  <div className="p-3.5 rounded-xl bg-purple-950/80 border border-purple-500/80 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <span className="text-[10px] font-mono text-emerald-400 font-bold block">
                        ● ACTIVE INJECTION QUEUED
                      </span>
                      <p className="text-sm font-bold text-white truncate">
                        {poolMap.get(injections[String(selectedUserId)].beatmapId)?.title || `Beatmap #${injections[String(selectedUserId)].beatmapId}`}
                      </p>
                      <p className="text-xs text-slate-400 truncate">
                        {poolMap.get(injections[String(selectedUserId)].beatmapId)?.artist} • {poolMap.get(injections[String(selectedUserId)].beatmapId)?.rarity}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRemovePullInjection(selectedUserId)}
                      disabled={actionLoading}
                      className="px-3 py-1.5 rounded-xl bg-red-950 hover:bg-red-900 text-red-300 border border-red-800/60 text-xs font-mono font-bold flex-shrink-0"
                    >
                      Cancel Injection
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search beatmap from 38,696 pool to inject..."
                        value={injectSearch}
                        onChange={(e) => {
                          setInjectSearch(e.target.value);
                          setSelectedInjectBeatmap(null);
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs sm:text-sm font-mono focus:outline-none focus:border-purple-500"
                      />
                      {injectSearch.trim() && !selectedInjectBeatmap && (
                        <div className="absolute z-30 top-full left-0 right-0 mt-1 rounded-xl bg-slate-900 border border-slate-700 overflow-hidden shadow-2xl max-h-48 overflow-y-auto">
                          {pool
                            .filter(
                              (m) =>
                                m.title.toLowerCase().includes(injectSearch.toLowerCase()) ||
                                m.artist.toLowerCase().includes(injectSearch.toLowerCase()) ||
                                String(m.id).includes(injectSearch)
                            )
                            .slice(0, 15)
                            .map((m) => (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => {
                                  setSelectedInjectBeatmap(m);
                                  setInjectSearch(`${m.artist} — ${m.title} [${m.version}] (${m.rarity})`);
                                }}
                                className="w-full p-2.5 hover:bg-slate-800 text-left border-b border-slate-800/60 flex items-center justify-between text-xs font-mono"
                              >
                                <span className="text-white truncate mr-2">
                                  {m.artist} - {m.title} [{m.version}]
                                </span>
                                <span className={`text-[10px] font-bold ${RARITY_COLORS[m.rarity]}`}>
                                  {m.rarity}
                                </span>
                              </button>
                            ))}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => handleSetPullInjection(selectedUserId)}
                      disabled={actionLoading || !selectedInjectBeatmap}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-700 to-indigo-600 hover:from-purple-600 hover:to-indigo-500 disabled:opacity-50 text-white text-xs sm:text-sm font-bold shadow-md shadow-purple-900/30 flex items-center justify-center space-x-1.5"
                    >
                      <Target className="w-4 h-4" />
                      <span>Inject into {selectedUsername}'s Next Summon 🎯</span>
                    </button>
                  </div>
                )}
              </div>

              {/* User Collection Table with Search & Pagination */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h3 className="font-bold text-white flex items-center space-x-2">
                    <Database className="w-4 h-4 text-cyan-400" />
                    <span>
                      Collection ({userColl.length} cards
                      {filteredUserColl.length !== userColl.length ? ` · ${filteredUserColl.length} filtered` : ''})
                    </span>
                  </h3>

                  <div className="flex items-center space-x-2">
                    {/* Search Bar */}
                    <div className="relative flex-1 sm:w-48">
                      <input
                        type="text"
                        value={userCollSearch}
                        onChange={(e) => {
                          setUserCollSearch(e.target.value);
                          setUserCollPage(1);
                        }}
                        placeholder="Filter cards..."
                        className="w-full px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-cyan-500"
                      />
                    </div>

                    {/* Rarity Filter */}
                    <select
                      value={userCollRarity}
                      onChange={(e) => {
                        setUserCollRarity(e.target.value);
                        setUserCollPage(1);
                      }}
                      className="px-2 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                    >
                      <option value="All">All Tiers</option>
                      {RARITY_ORDER.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={() => fetchUserColl(selectedUserId)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700"
                      title="Refresh Collection"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-slate-400 ${userCollLoading ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden divide-y divide-slate-800/60">
                  {userCollLoading && (
                    <div className="flex justify-center p-8">
                      <RefreshCw className="w-6 h-6 text-pink-400 animate-spin" />
                    </div>
                  )}

                  {!userCollLoading &&
                    paginatedUserColl.map((c) => {
                      const isEditing = editingCard?.beatmapId === c.beatmapId;
                      return (
                        <div
                          key={c.beatmapId}
                          className="flex items-center space-x-3 px-4 py-2.5 hover:bg-slate-800/30 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2">
                              <span
                                className={`text-[10px] font-mono font-bold flex-shrink-0 ${
                                  RARITY_COLORS[c.rarity] || 'text-slate-400'
                                }`}
                              >
                                {c.rarity}
                              </span>
                              <span className="text-xs sm:text-sm text-slate-200 truncate font-semibold">
                                {c.artist} — {c.title}
                              </span>
                            </div>
                            <div className="text-[10px] font-mono text-slate-500">
                              ID {c.beatmapId} · ★{c.stars.toFixed(2)} · {c.version} · {c.isFavorite ? '★ fav · ' : ''}
                              {formatUserDate(c.lastPulledAt)}
                            </div>
                          </div>
                          {isEditing ? (
                            <div className="flex items-center space-x-1">
                              <input
                                type="number"
                                min="0"
                                value={editingCard.copies}
                                onChange={(e) =>
                                  setEditingCard({ ...editingCard, copies: parseInt(e.target.value) || 0 })
                                }
                                className="w-16 px-2 py-1 rounded-lg bg-slate-700 border border-slate-600 text-white text-xs font-mono"
                              />
                              <button
                                onClick={() => handleEditCard(selectedUserId, c.beatmapId, editingCard.copies)}
                                className="p-1.5 rounded-lg bg-emerald-700 text-white"
                              >
                                <Save className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => setEditingCard(null)}
                                className="p-1.5 rounded-lg bg-slate-700 text-slate-300"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center space-x-2">
                              <span className="text-xs sm:text-sm font-bold text-white font-mono">×{c.copies}</span>
                              <button
                                onClick={() => setEditingCard({ beatmapId: c.beatmapId, copies: c.copies })}
                                className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteCard(selectedUserId, c.beatmapId)}
                                className="p-1.5 rounded-lg hover:bg-red-900/50 text-slate-500 hover:text-red-400"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}

                  {!userCollLoading && paginatedUserColl.length === 0 && (
                    <div className="py-8 text-center text-slate-500 font-mono text-sm">
                      {userColl.length === 0 ? 'No cards in collection' : 'No matching cards found'}
                    </div>
                  )}

                  {/* Pagination Footer */}
                  {!userCollLoading && totalUserCollPages > 1 && (
                    <div className="p-3 bg-slate-950/60 flex items-center justify-between text-xs font-mono text-slate-400 border-t border-slate-800/60">
                      <span>
                        Page {userCollPage} of {totalUserCollPages} ({filteredUserColl.length} cards)
                      </span>
                      <div className="flex items-center space-x-1.5">
                        <button
                          disabled={userCollPage <= 1}
                          onClick={() => setUserCollPage((p) => Math.max(1, p - 1))}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-white"
                        >
                          Prev
                        </button>
                        <button
                          disabled={userCollPage >= totalUserCollPages}
                          onClick={() => setUserCollPage((p) => Math.min(totalUserCollPages, p + 1))}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-white"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TRANSACTIONS & GIFTS TAB ────────────────── */}
      {activeTab === 'transactions' && (
        <div className="space-y-6 animate-fade-in">
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center space-x-2 font-display">
                  <ArrowLeftRight className="w-5 h-5 text-emerald-400" />
                  <span>Player Transactions & Gifts Audit</span>
                </h2>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  Live ledger of all card and stamina transfers between players with 1-click revocation.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={fetchTransactionsData}
                  disabled={txLoading}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-mono text-slate-300 flex items-center space-x-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${txLoading ? 'animate-spin' : ''}`} />
                  <span>Refresh Ledger</span>
                </button>
              </div>
            </div>

            {/* Filters & Search */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                  {[
                    { id: 'all', label: `All (${transactions.length + trades.length})` },
                    { id: 'gifts', label: `🎁 Gifts (${transactions.length})` },
                    { id: 'trades', label: `🤝 Trades (${trades.length})` },
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setTxTypeFilter(t.id as any)}
                      className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                        txTypeFilter === t.id
                          ? 'bg-purple-700 text-white shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                  {[
                    { id: 'all', label: 'All Status' },
                    { id: 'pending', label: 'Pending' },
                    { id: 'claimed', label: 'Claimed / Accepted' },
                    { id: 'revoked', label: 'Revoked' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setTxFilter(f.id as any)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                        txFilter === f.id
                          ? 'bg-emerald-700 text-white shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={txSearch}
                  onChange={(e) => setTxSearch(e.target.value)}
                  placeholder="Search sender, recipient, song..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Combined Ledger List */}
            {transactions.length === 0 && trades.length === 0 ? (
              <div className="p-8 text-center bg-slate-950/60 rounded-xl border border-slate-800 space-y-2">
                <ArrowLeftRight className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-sm font-bold text-slate-300">No Player Transactions or Trades Recorded</p>
                <p className="text-xs text-slate-500 font-mono">Gifts and player trades will be logged here in real time.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* 1. Gifts */}
                {(txTypeFilter === 'all' || txTypeFilter === 'gifts') &&
                  transactions
                    .filter((t) => {
                      if (txFilter !== 'all') {
                        if (txFilter === 'claimed' && t.status !== 'claimed') return false;
                        if (txFilter === 'pending' && t.status !== 'pending') return false;
                        if (txFilter === 'revoked' && t.status !== 'revoked') return false;
                      }
                      if (!txSearch.trim()) return true;
                      const q = txSearch.toLowerCase();
                      return (
                        t.senderUsername.toLowerCase().includes(q) ||
                        t.recipientUsername.toLowerCase().includes(q) ||
                        (t.cardData && t.cardData.title.toLowerCase().includes(q)) ||
                        String(t.senderId).includes(q) ||
                        String(t.recipientId).includes(q)
                      );
                    })
                    .map((t) => {
                      const timeStr = formatUserDateTime(t.createdAt);
                      const isCard = t.type === 'card' && t.cardData;

                      return (
                        <div
                          key={t.id}
                          className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="flex items-start space-x-3 min-w-0">
                            {isCard && t.cardData?.coverUrl ? (
                              <img
                                src={t.cardData.coverUrl}
                                alt=""
                                className="w-12 h-12 rounded-lg object-cover border border-slate-800 flex-shrink-0"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-lg bg-amber-950/60 border border-amber-800/60 flex items-center justify-center flex-shrink-0">
                                <Zap className="w-5 h-5 text-amber-400" />
                              </div>
                            )}

                            <div className="min-w-0 space-y-0.5">
                              <div className="flex items-center space-x-2 text-xs font-mono">
                                <span className="px-1 py-0.2 rounded bg-pink-950 text-pink-300 font-bold text-[9px]">GIFT</span>
                                <strong className="text-pink-300">{t.senderUsername}</strong>
                                <span className="text-slate-500">➔</span>
                                <strong className="text-cyan-300">{t.recipientUsername}</strong>
                                <span className="text-[10px] text-slate-500">• {timeStr}</span>
                              </div>

                              <p className="text-sm font-bold text-white truncate">
                                {isCard
                                  ? `${t.cardData?.title} [${t.cardData?.version}] (${t.cardData?.rarity})`
                                  : `+${t.staminaAmount || 25} Bonus Stamina / Pulls`}
                              </p>

                              {t.message && (
                                <p className="text-xs text-slate-400 font-sans italic">
                                  "{t.message}"
                                </p>
                              )}

                              <div className="flex items-center space-x-2 text-[10px] font-mono">
                                <span className="text-slate-500">ID: {t.id}</span>
                                <span>•</span>
                                <span
                                  className={`px-1.5 py-0.2 rounded font-bold uppercase ${
                                    t.status === 'claimed'
                                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/50'
                                      : t.status === 'revoked'
                                      ? 'bg-red-950 text-red-300 border border-red-500/50'
                                      : 'bg-amber-950 text-amber-300 border border-amber-500/50'
                                  }`}
                                >
                                  {t.status}
                                </span>
                              </div>
                            </div>
                          </div>

                          {t.status !== 'revoked' && (
                            <button
                              onClick={() => handleRevokeTransaction(t)}
                              disabled={actionLoading}
                              className="px-3 py-1.5 rounded-xl bg-red-950/80 hover:bg-red-900 border border-red-800/80 text-red-300 text-xs font-mono font-bold transition-all flex items-center justify-center space-x-1.5 flex-shrink-0 self-end sm:self-center shadow-md"
                            >
                              <Undo2 className="w-3.5 h-3.5" />
                              <span>Revoke Gift</span>
                            </button>
                          )}
                        </div>
                      );
                    })}

                {/* 2. Trades */}
                {(txTypeFilter === 'all' || txTypeFilter === 'trades') &&
                  trades
                    .filter((tr) => {
                      if (txFilter !== 'all') {
                        if (txFilter === 'claimed' && tr.status !== 'accepted') return false;
                        if (txFilter === 'pending' && tr.status !== 'pending') return false;
                        if (txFilter === 'revoked' && tr.status !== 'revoked') return false;
                      }
                      if (!txSearch.trim()) return true;
                      const q = txSearch.toLowerCase();
                      return (
                        tr.senderUsername.toLowerCase().includes(q) ||
                        tr.recipientUsername.toLowerCase().includes(q) ||
                        tr.offeredCards.some((c) => c.title.toLowerCase().includes(q)) ||
                        tr.requestedCards.some((c) => c.title.toLowerCase().includes(q)) ||
                        String(tr.senderId).includes(q) ||
                        String(tr.recipientId).includes(q)
                      );
                    })
                    .map((tr) => {
                      const timeStr = formatUserDateTime(tr.createdAt);

                      return (
                        <div
                          key={tr.id}
                          className="p-4 rounded-xl bg-slate-950 border border-indigo-900/60 hover:border-indigo-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="flex items-start space-x-3 min-w-0">
                            <div className="w-12 h-12 rounded-lg bg-indigo-950 border border-indigo-700 flex items-center justify-center flex-shrink-0 text-indigo-400 font-bold">
                              <ArrowLeftRight className="w-6 h-6" />
                            </div>

                            <div className="min-w-0 space-y-1">
                              <div className="flex items-center space-x-2 text-xs font-mono">
                                <span className="px-1 py-0.2 rounded bg-indigo-950 text-indigo-300 font-bold text-[9px]">TRADE</span>
                                <strong className="text-indigo-300">{tr.senderUsername}</strong>
                                <span className="text-slate-500">⇄</span>
                                <strong className="text-cyan-300">{tr.recipientUsername}</strong>
                                <span className="text-[10px] text-slate-500">• {timeStr}</span>
                              </div>

                              <div className="text-xs font-mono space-y-0.5">
                                <p className="text-slate-300">
                                  <strong className="text-emerald-400">Offered:</strong> {tr.offeredCards.map((c) => c.title).join(', ')}
                                  {tr.offeredStamina ? ` (+${tr.offeredStamina}⚡)` : ''}
                                </p>
                                <p className="text-slate-300">
                                  <strong className="text-pink-400">Requested:</strong> {tr.requestedCards.map((c) => c.title).join(', ')}
                                </p>
                              </div>

                              {tr.message && (
                                <p className="text-xs text-slate-400 font-sans italic">
                                  "{tr.message}"
                                </p>
                              )}

                              <div className="flex items-center space-x-2 text-[10px] font-mono">
                                <span className="text-slate-500">ID: {tr.id}</span>
                                <span>•</span>
                                <span
                                  className={`px-1.5 py-0.2 rounded font-bold uppercase ${
                                    tr.status === 'accepted'
                                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/50'
                                      : tr.status === 'revoked'
                                      ? 'bg-red-950 text-red-300 border border-red-500/50'
                                      : 'bg-amber-950 text-amber-300 border border-amber-500/50'
                                  }`}
                                >
                                  {tr.status}
                                </span>
                              </div>
                            </div>
                          </div>

                          {tr.status === 'accepted' && (
                            <button
                              onClick={() => handleRevokeTrade(tr)}
                              disabled={actionLoading}
                              className="px-3 py-1.5 rounded-xl bg-red-950/80 hover:bg-red-900 border border-red-800/80 text-red-300 text-xs font-mono font-bold transition-all flex items-center justify-center space-x-1.5 flex-shrink-0 self-end sm:self-center shadow-md"
                            >
                              <Undo2 className="w-3.5 h-3.5" />
                              <span>Revoke Trade</span>
                            </button>
                          )}
                        </div>
                      );
                    })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 3. MASS REWARDS TAB ─────────────────────── */}
      {activeTab === 'rewards' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                  <Gift className="w-5 h-5 text-amber-400" />
                  <span>Mass Reward Dispatcher</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Broadcast gifts, stamina refills, or promotional beatmaps to all registered players simultaneously.
                </p>
              </div>
            </div>

            {/* Select Reward Type */}
            <div className="grid grid-cols-3 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
              <button
                onClick={() => setRewardType('stamina')}
                className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                  rewardType === 'stamina' ? 'bg-amber-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                ⚡ Stamina Refill
              </button>
              <button
                onClick={() => setRewardType('pulls')}
                className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                  rewardType === 'pulls' ? 'bg-pink-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                ✨ Free Pulls
              </button>
              <button
                onClick={() => setRewardType('card')}
                className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                  rewardType === 'card' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                🎴 Promotional Card
              </button>
            </div>

            {/* Stamina / Pulls Amount */}
            {(rewardType === 'stamina' || rewardType === 'pulls') && (
              <div className="space-y-2">
                <label className="text-xs text-slate-300 font-mono">
                  {rewardType === 'stamina' ? 'Stamina Energy Override (Amount to give)' : 'Pulls to Add (+Count)'}
                </label>
                <input
                  type="number"
                  min="1"
                  max="9999"
                  value={rewardAmount}
                  onChange={e => setRewardAmount(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-sm font-mono focus:outline-none focus:border-amber-500"
                />
              </div>
            )}

            {/* Card Gift Details */}
            {rewardType === 'card' && (
              <div className="space-y-3">
                <div className="relative">
                  <label className="text-xs text-slate-300 font-mono block mb-1">Search Beatmap to Gift</label>
                  <input
                    type="text"
                    placeholder="Search song title or mapper…"
                    value={rewardCardSearch}
                    onChange={e => { setRewardCardSearch(e.target.value); setRewardCardId(''); }}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-sm font-mono focus:outline-none focus:border-purple-500"
                  />
                  {rewardPoolMatches.length > 0 && (
                    <div className="absolute z-20 top-full left-0 right-0 mt-1 rounded-xl bg-slate-800 border border-slate-700 overflow-hidden shadow-xl max-h-48 overflow-y-auto">
                      {rewardPoolMatches.map(m => (
                        <button
                          key={m.id}
                          onClick={() => {
                            setRewardCardId(String(m.id));
                            setRewardCardSearch(`${m.artist} — ${m.title} [#${m.id}]`);
                            setRewardCardRarity(m.rarity);
                          }}
                          className="w-full flex items-center space-x-2 px-3 py-2 hover:bg-slate-700 text-left"
                        >
                          <span className={`text-[10px] font-mono font-bold ${RARITY_COLORS[m.rarity]||'text-slate-400'}`}>{m.rarity}</span>
                          <span className="text-xs text-slate-200 truncate">{m.artist} — {m.title}</span>
                          <span className="text-[10px] text-slate-500 font-mono flex-shrink-0">#{m.id}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 font-mono block mb-1">Copies</label>
                    <input
                      type="number"
                      min="1"
                      value={rewardCardCopies}
                      onChange={e => setRewardCardCopies(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-sm font-mono focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 font-mono block mb-1">Rarity Tier</label>
                    <select
                      value={rewardCardRarity}
                      onChange={e => setRewardCardRarity(e.target.value as RarityTier)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-sm font-mono focus:outline-none"
                    >
                      {RARITY_ORDER.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={handleDispatchMassReward}
              disabled={actionLoading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-600 to-pink-600 hover:from-amber-500 hover:to-pink-500 text-white font-bold text-sm shadow-lg shadow-pink-600/30 transition-all disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              <Gift className="w-4 h-4" />
              <span>{actionLoading ? 'Broadcasting...' : 'Broadcast Mass Reward to All Users'}</span>
            </button>
          </div>
        </div>
      )}

      {/* ── 4. DB INSPECTOR TAB ────────────────────── */}
      {activeTab === 'inspector' && (
        <div className="space-y-5">
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              {['users', 'user_collection', 'user_history', 'admin_config', 'user_energy_overrides', 'user_sessions'].map(t => (
                <button
                  key={t}
                  onClick={() => setSelectedTable(t)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono font-semibold transition-all flex-shrink-0 ${
                    selectedTable === t
                      ? 'bg-cyan-700 text-white shadow-md'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <button
              onClick={() => fetchTableData(selectedTable, tableOffset)}
              disabled={tableLoading}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${tableLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Table Viewer */}
          <div className="rounded-2xl bg-slate-900/90 border border-slate-800 overflow-hidden">
            <div className="p-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400">
              <span>
                Table: <strong className="text-cyan-400">{selectedTable}</strong> • Total Records: <strong>{tableData?.total ?? 0}</strong>
              </span>
              <div className="flex items-center space-x-2">
                <button
                  disabled={tableOffset === 0 || tableLoading}
                  onClick={() => fetchTableData(selectedTable, Math.max(0, tableOffset - 50))}
                  className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40"
                >
                  ◀ Prev
                </button>
                <span>Offset: {tableOffset}</span>
                <button
                  disabled={!tableData || tableOffset + 50 >= tableData.total || tableLoading}
                  onClick={() => fetchTableData(selectedTable, tableOffset + 50)}
                  className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40"
                >
                  Next ▶
                </button>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[500px]">
              {tableLoading ? (
                <div className="flex justify-center p-12">
                  <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
                </div>
              ) : tableData?.rows && tableData.rows.length > 0 ? (
                <table className="w-full text-left text-xs font-mono divide-y divide-slate-800">
                  <thead className="bg-slate-950/80 text-slate-400 sticky top-0">
                    <tr>
                      {Object.keys(tableData.rows[0]).map(k => (
                        <th key={k} className="px-3.5 py-2.5 font-bold uppercase tracking-wider">{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {tableData.rows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/40">
                        {Object.values(row).map((val, cIdx) => (
                          <td key={cIdx} className="px-3.5 py-2 whitespace-nowrap max-w-xs truncate">
                            {typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="py-12 text-center text-slate-500 font-mono text-xs">
                  No records in table {selectedTable}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 5. CONFIG TAB ─────────────────────────── */}
      {activeTab === 'config' && (
        <div className="space-y-6">
          {/* Maintenance Mode Card */}
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-white text-lg flex items-center space-x-2">
                <Wrench className="w-5 h-5 text-amber-400" />
                <span>Site Maintenance Status</span>
              </h2>
              <span className="px-3 py-1 rounded-full bg-amber-950/80 border border-amber-500/60 text-amber-300 font-mono font-bold text-xs">
                MAINTENANCE ACTIVE
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              The public site is currently <strong>locked in maintenance mode</strong>. All non-admin visitors visiting <code className="text-pink-300 bg-slate-800 px-1.5 py-0.5 rounded">gacha.vivlos.dev</code> will see the dedicated Maintenance Page. As the verified admin (<strong className="text-white">RyoYamada</strong>), you retain full access to test, pull, and manage the system.
            </p>
            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs font-mono text-slate-400 space-y-1">
              <div><span className="text-slate-500">Config file:</span> <code className="text-pink-300">src/config/maintenance.ts</code></div>
              <div><span className="text-slate-500">Status:</span> <code className="text-amber-400 font-bold">MAINTENANCE_MODE = true</code></div>
              <div><span className="text-slate-500">Visitor view:</span> Displays maintenance notice with cloud backup guarantee.</div>
            </div>
          </div>

          {/* Rates Config */}
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-white text-lg flex items-center space-x-2">
                <BarChart3 className="w-5 h-5 text-pink-400"/>
                <span>Gacha Drop Rates</span>
              </h2>
              <button onClick={resetRates} className="text-xs text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700">
                Reset to Defaults
              </button>
            </div>
            <p className={`text-xs font-mono ${Math.abs(ratesTotal-1.0)<0.001?'text-emerald-400':'text-red-400 font-bold'}`}>
              Total: {(ratesTotal*100).toFixed(4)}% {Math.abs(ratesTotal-1.0)<0.001?'✓ Valid':'✗ Must equal 100.00%'}
            </p>
            <div className="space-y-2">
              {RARITY_ORDER.map(tier=>(
                <div key={tier} className="flex items-center space-x-3">
                  <span className={`text-xs font-bold font-mono w-20 flex-shrink-0 ${RARITY_COLORS[tier]||'text-slate-400'}`}>{tier}</span>
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    max="1"
                    value={configRates[tier]??0}
                    onChange={e=>setConfigRates(prev=>({...prev,[tier]:parseFloat(e.target.value)||0}))}
                    className="flex-1 px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-sm font-mono focus:outline-none focus:border-pink-500/60"
                  />
                  <span className="text-xs text-slate-400 w-14 text-right font-mono">{((configRates[tier]??0)*100).toFixed(4)}%</span>
                  <div className="w-24 h-2 rounded-full bg-slate-700 overflow-hidden flex-shrink-0">
                    <div className="h-full bg-pink-500/60 rounded-full" style={{width:`${Math.min(100,(configRates[tier]??0)*100/0.35)}%`}}/>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={handleSaveRates}
              disabled={actionLoading||Math.abs(ratesTotal-1.0)>=0.001}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-pink-700 hover:bg-pink-600 disabled:opacity-50 text-white text-xs sm:text-sm font-semibold"
            >
              <Save className="w-4 h-4"/>
              <span>Save Rates</span>
            </button>
          </div>

          {/* Stamina Config */}
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
            <h2 className="font-bold text-white text-lg flex items-center space-x-2">
              <Zap className="w-5 h-5 text-amber-400"/>
              <span>Stamina Engine Config</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs text-slate-400 font-mono">Max Pull Stamina Cap</label>
                <input
                  type="number"
                  min="1"
                  max="9999"
                  value={configStamina.max}
                  onChange={e=>setConfigStamina(prev=>({...prev,max:parseInt(e.target.value)||50}))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-sm font-mono focus:outline-none focus:border-amber-500/60"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-400 font-mono">Regeneration Speed (seconds per pull)</label>
                <input
                  type="number"
                  min="1"
                  max="3600"
                  value={configStamina.regenSeconds}
                  onChange={e=>setConfigStamina(prev=>({...prev,regenSeconds:parseInt(e.target.value)||15}))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-sm font-mono focus:outline-none focus:border-amber-500/60"
                />
              </div>
            </div>
            <button
              onClick={handleSaveStamina}
              disabled={actionLoading}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-white text-xs sm:text-sm font-semibold"
            >
              <Save className="w-4 h-4"/>
              <span>Save Stamina Settings</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPage;
