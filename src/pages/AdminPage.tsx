import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useGacha } from '../context/GachaContext';
import { isAdmin } from '../config/admin';
import { WORKER_API_URL } from '../config/api';
import { DEFAULT_RARITY_RATES } from '../gacha/probabilities';
import { RarityTier } from '../types/beatmap';
import { RarityRates } from '../types/gacha';
import {
  ShieldAlert, Users, Database, RefreshCw, Trash2, Activity, TrendingUp,
  Star, Clock, AlertTriangle, ChevronDown, ChevronUp, Search, Crown,
  Zap, PlusCircle, Edit3, Sliders, BarChart3, Save, X, Wrench, Gift, Table,
  CheckCircle2, Bell, Sparkles, Send,
} from 'lucide-react';
import { formatUserDateTime, formatUserDate } from '../utils/timeFormat';
import { supabase } from '../lib/supabase';

const RARITY_ORDER: RarityTier[] = ['EX','GOAT','Divine','Celestial','Mythic','Legendary','Epic','Rare','Uncommon+','Uncommon','Common'];
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

type AdminTab = 'overview' | 'events' | 'cards' | 'announcements' | 'users' | 'rewards' | 'inspector' | 'config';

const AdminPage: React.FC = () => {
  const { user, token } = useAuth();
  const { pool, energy, adminRefillEnergy, cardOverrides, setCardTierOverride, removeCardTierOverride } = useGacha();

  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [expandedUser, setExpandedUser] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionMsg, setActionMsg] = useState<{text:string;ok:boolean}|null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Manual Card Tier & EX Assignment state
  const [cardAssignSearch, setCardAssignSearch] = useState('');
  const [selectedAssignCardId, setSelectedAssignCardId] = useState<number | null>(null);
  const [assignTier, setAssignTier] = useState<RarityTier>('EX');
  const [assignExReason, setAssignExReason] = useState('');

  // User management state
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedUsername, setSelectedUsername] = useState<string>('');
  const [userColl, setUserColl] = useState<UserCollCard[]>([]);
  const [userCollLoading, setUserCollLoading] = useState(false);
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

  // Config state
  const [configRates, setConfigRates] = useState<RarityRates>({...DEFAULT_RARITY_RATES});
  const [configStamina, setConfigStamina] = useState<{max:number;regenSeconds:number}>({max:50,regenSeconds:15});
  const [ratesTotal, setRatesTotal] = useState(1.0);

  if (!isAdmin(user?.username)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 text-center">
        <ShieldAlert className="w-16 h-16 text-red-500" />
        <h2 className="text-2xl font-black text-red-400">Access Denied</h2>
        <p className="text-slate-400 font-mono text-sm">Restricted to administrator RyoYamada.</p>
      </div>
    );
  }

  // ─── API Helper ──────────────────────────────────────────────
  const api = useCallback(async (method:string, path:string, body?:unknown) => {
    const res = await fetch(`${WORKER_API_URL}${path}`, {
      method,
      headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token}` },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const data = await res.json() as { success:boolean; error?:string; [k:string]:unknown };
    if (!data.success) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }, [token]);

  const showMsg = (text:string, ok=true) => {
    setActionMsg({text,ok});
    setTimeout(()=>setActionMsg(null), 5000);
  };

  // ─── Overview Stats ─────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError(null);
    try {
      const d = await api('GET','/admin/stats');
      setStats(d.stats as AdminStats);
    } catch(e) {
      setStatsError(e instanceof Error ? e.message : 'Failed to load stats');
    } finally {
      setStatsLoading(false);
    }
  }, [api]);

  useEffect(() => {
    if (activeTab === 'overview') fetchStats();
  }, [activeTab, fetchStats]);

  // ─── User Management ─────────────────────────────────────────
  const fetchUserColl = useCallback(async (osuId:number) => {
    setUserCollLoading(true);
    try {
      const d = await api('GET',`/admin/user/${osuId}/collection`);
      setUserColl(d.collection as UserCollCard[]);
      setSelectedUsername(d.username as string || String(osuId));
    } catch(e) {
      showMsg(e instanceof Error ? e.message : 'Failed to load collection', false);
    } finally {
      setUserCollLoading(false);
    }
  }, [api]);

  const handleSetPulls = async (osuId:number) => {
    if (!pullsInput) return;
    setActionLoading(true);
    try {
      const body = pullsMode === 'set' ? {pulls: Number(pullsInput)} : {delta: Number(pullsInput)};
      const d = await api('POST',`/admin/user/${osuId}/set-pulls`, body);
      showMsg(`✓ ${selectedUsername}'s total pulls updated to ${(d as any).totalPulls}`);
      fetchStats();
    } catch(e) {
      showMsg(e instanceof Error ? e.message : 'Failed', false);
    } finally {
      setActionLoading(false);
      setPullsInput('');
    }
  };

  const handleEnergyOverride = async (osuId:number) => {
    const amount = Number(energyInput);
    if (!amount || amount < 1) return;
    setActionLoading(true);
    try {
      if (osuId === user?.osuId) await adminRefillEnergy(amount);
      await api('POST',`/admin/user/${osuId}/energy-override`, {amount});
      showMsg(`⚡ Energy override of ${amount} queued for ${selectedUsername}`);
    } catch(e) {
      showMsg(e instanceof Error ? e.message : 'Failed', false);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddCard = async (osuId:number) => {
    const bid = Number(addCardId || addCardSearch);
    if (!bid) return;
    setActionLoading(true);
    try {
      await api('POST',`/admin/user/${osuId}/collection/add`, {
        beatmapId: bid,
        copies: Number(addCardCopies) || 1,
        rarity: addCardRarity,
      });
      showMsg(`✓ Added beatmap #${bid} (×${addCardCopies}) to ${selectedUsername}`);
      fetchUserColl(osuId);
      setAddCardId('');
      setAddCardSearch('');
      setAddCardCopies('1');
    } catch(e) {
      showMsg(e instanceof Error ? e.message : 'Failed', false);
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditCard = async (osuId:number, beatmapId:number, copies:number) => {
    setActionLoading(true);
    try {
      await api('PUT',`/admin/user/${osuId}/collection/${beatmapId}`, {copies});
      showMsg(`✓ Updated copies for beatmap #${beatmapId}`);
      fetchUserColl(osuId);
      setEditingCard(null);
    } catch(e) {
      showMsg(e instanceof Error ? e.message : 'Failed', false);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteCard = async (osuId:number, beatmapId:number) => {
    if (!confirm(`Remove beatmap #${beatmapId} from ${selectedUsername}?`)) return;
    setActionLoading(true);
    try {
      await api('DELETE',`/admin/user/${osuId}/collection/${beatmapId}`, {});
      showMsg(`✓ Removed beatmap #${beatmapId}`);
      fetchUserColl(osuId);
    } catch(e) {
      showMsg(e instanceof Error ? e.message : 'Failed', false);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevokeSession = async (osuId:number) => {
    setActionLoading(true);
    try {
      await api('POST',`/admin/user/${osuId}/revoke-sessions`, {});
      showMsg(`✓ All active sessions revoked for user ${osuId}`);
      fetchStats();
    } catch(e) {
      showMsg(e instanceof Error ? e.message : 'Failed', false);
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
    if (!confirm(`Confirm mass distribution of ${rewardType} to ALL users?`)) return;
    setActionLoading(true);
    try {
      let body: Record<string, unknown> = { type: rewardType };
      if (rewardType === 'stamina' || rewardType === 'pulls') {
        body.amount = Number(rewardAmount);
      } else if (rewardType === 'card') {
        const bid = Number(rewardCardId || rewardCardSearch);
        if (!bid) throw new Error('Please select a valid beatmap ID');
        body.beatmapId = bid;
        body.copies = Number(rewardCardCopies) || 1;
        body.rarity = rewardCardRarity;
      }

      const res = await api('POST', '/admin/mass-reward', body);
      showMsg(`🎉 ${(res as any).message || 'Mass reward distributed successfully!'}`);
      if (rewardType === 'stamina' && user?.osuId) {
        await adminRefillEnergy(Number(rewardAmount));
      }
      fetchStats();
    } catch (e) {
      showMsg(e instanceof Error ? e.message : 'Mass reward dispatch failed', false);
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Database Inspector ─────────────────────────────────────
  const fetchTableData = useCallback(async (table: string, offset = 0) => {
    setTableLoading(true);
    try {
      const res = await api('GET', `/admin/table?name=${table}&limit=50&offset=${offset}`);
      setTableData(res as any);
      setTableOffset(offset);
    } catch (e) {
      showMsg(e instanceof Error ? e.message : 'Failed to load table data', false);
    } finally {
      setTableLoading(false);
    }
  }, [api]);

  useEffect(() => {
    if (activeTab === 'inspector') {
      fetchTableData(selectedTable, 0);
    }
  }, [activeTab, selectedTable, fetchTableData]);

  // ─── Config & Rates ─────────────────────────────────────────
  const fetchConfig = useCallback(async () => {
    setActionLoading(true);
    try {
      const d = await api('GET','/admin/config');
      const cfg = d.config as Record<string,unknown>;
      if (cfg.rates) setConfigRates(cfg.rates as RarityRates);
      if (cfg.stamina) setConfigStamina(cfg.stamina as {max:number;regenSeconds:number});
    } catch {} finally {
      setActionLoading(false);
    }
  }, [api]);

  useEffect(() => {
    if (activeTab === 'config') fetchConfig();
  }, [activeTab, fetchConfig]);

  useEffect(() => {
    const sum = RARITY_ORDER.reduce((a,t) => a + (configRates[t]||0), 0);
    setRatesTotal(Math.round(sum*10000)/10000);
  }, [configRates]);

  const handleSaveRates = async () => {
    if (Math.abs(ratesTotal - 1.0) > 0.001) {
      showMsg('Rates must sum to exactly 1.0 (100%)', false);
      return;
    }
    setActionLoading(true);
    try {
      await api('PUT','/admin/config/rates', configRates);
      showMsg('✓ Rates saved — will apply across the app');
    } catch(e) {
      showMsg(e instanceof Error ? e.message : 'Failed', false);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveStamina = async () => {
    setActionLoading(true);
    try {
      await api('PUT','/admin/config/stamina', configStamina);
      showMsg('✓ Stamina config saved to cloud');
    } catch(e) {
      showMsg(e instanceof Error ? e.message : 'Failed', false);
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
      const [evRes, annRes] = await Promise.all([
        supabase.from('admin_config').select('value').eq('key', 'active_event_preset').maybeSingle(),
        supabase.from('admin_config').select('value').eq('key', 'active_announcement').maybeSingle(),
      ]);
      if (evRes.data && evRes.data.value && evRes.data.value.active) {
        setActiveEventData(evRes.data.value);
      }
      if (annRes.data && annRes.data.value && annRes.data.value.active) {
        setActiveAnnData(annRes.data.value);
      }
    } catch (e) {
      console.warn('Error loading admin events/announcements:', e);
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
          ['announcements','Announcements',<Bell className="w-4 h-4 text-cyan-400"/>],
          ['users','Users',<Users className="w-4 h-4"/>],
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

      {/* ── CARD TIERS & EX ASSIGNMENT TAB ───────────────────────── */}
      {activeTab === 'cards' && (
        <div className="space-y-6 animate-fade-in">
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
                    const card = pool.find((m) => m.id === selectedAssignCardId);
                    if (!card) return <p className="text-xs text-slate-400">Card #{selectedAssignCardId} not found.</p>;

                    return (
                      <>
                        <div className="flex items-start justify-between gap-3 border-b border-purple-900/60 pb-3">
                          <div>
                            <span className="text-[10px] font-mono text-purple-300 uppercase">Selected Card #{card.id}</span>
                            <h4 className="text-base font-bold text-white">{card.title}</h4>
                            <p className="text-xs text-slate-300 font-mono">
                              {card.artist} • Mapped by {card.creator} • {card.stars}★
                            </p>
                          </div>
                          <span className={`text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 ${RARITY_COLORS[card.rarity]}`}>
                            Current: {card.rarity}
                          </span>
                        </div>

                        {/* Target Tier Selection */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-mono text-slate-300">Assign Target Rarity Tier</label>
                          <select
                            value={assignTier}
                            onChange={(e) => setAssignTier(e.target.value as RarityTier)}
                            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white font-mono focus:outline-none focus:border-purple-500"
                          >
                            {RARITY_ORDER.map((tier) => (
                              <option key={tier} value={tier}>
                                {tier === 'EX' ? '💎 EX Tier (Special Handpick)' : tier === 'GOAT' ? '🐐 GOAT Tier' : tier}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* EX Lore / Reason Field */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-mono text-slate-300 flex items-center space-x-1">
                              <span>Lore / Assignment Reason</span>
                              {assignTier === 'EX' && <span className="text-rose-400 font-bold">* (Required for EX)</span>}
                            </label>
                          </div>
                          <textarea
                            rows={3}
                            value={assignExReason}
                            onChange={(e) => setAssignExReason(e.target.value)}
                            placeholder={
                              assignTier === 'EX'
                                ? "Explain why this beatmap is an EX tier handpick (e.g. Historic landmark map, first 8* FC in osu! history by Cookiezi)..."
                                : "Optional note or reason for this manual tier assignment..."
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
                    const card = pool.find((m) => m.id === bid);

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
        </div>
      )}

      {/* ── 3. ANNOUNCEMENTS TAB ─────────────────────── */}
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

                {/* Force Stamina */}
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                  <h3 className="font-bold text-white flex items-center space-x-2">
                    <Zap className="w-4 h-4 text-amber-400"/>
                    <span>Force Stamina</span>
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    Self stamina: <span className="text-amber-300 font-bold">{energy.current}/{energy.max}</span>
                  </p>
                  <input
                    type="number"
                    min="1"
                    max="9999"
                    placeholder="Energy amount (e.g. 50)"
                    value={energyInput}
                    onChange={e => setEnergyInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-sm font-mono focus:outline-none focus:border-amber-500/60"
                  />
                  <button
                    onClick={() => handleEnergyOverride(selectedUserId)}
                    disabled={actionLoading}
                    className="w-full py-2 rounded-xl bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-white text-xs sm:text-sm font-semibold"
                  >
                    {selectedUserId === user?.osuId ? 'Refill Self Instantly' : 'Queue Energy Override'}
                  </button>
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

              {/* User Collection Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-white flex items-center space-x-2">
                    <Database className="w-4 h-4 text-cyan-400"/>
                    <span>Collection ({userColl.length} cards)</span>
                  </h3>
                  <button
                    onClick={() => fetchUserColl(selectedUserId)}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-slate-400 ${userCollLoading ? 'animate-spin' : ''}`}/>
                  </button>
                </div>
                <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden max-h-96 overflow-y-auto divide-y divide-slate-800/60">
                  {userCollLoading && (
                    <div className="flex justify-center p-8">
                      <RefreshCw className="w-6 h-6 text-pink-400 animate-spin"/>
                    </div>
                  )}
                  {!userCollLoading && userColl.map(c => {
                    const map = pool.find(m => m.id === c.beatmapId);
                    const isEditing = editingCard?.beatmapId === c.beatmapId;
                    return (
                      <div key={c.beatmapId} className="flex items-center space-x-3 px-4 py-2.5 hover:bg-slate-800/30">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            {map && (
                              <span className={`text-[10px] font-mono font-bold flex-shrink-0 ${RARITY_COLORS[map.rarity]||'text-slate-400'}`}>
                                {map.rarity}
                              </span>
                            )}
                            <span className="text-xs sm:text-sm text-slate-200 truncate font-semibold">
                              {map ? `${map.artist} — ${map.title}` : `Beatmap #${c.beatmapId}`}
                            </span>
                          </div>
                          <div className="text-[10px] font-mono text-slate-500">
                            ID {c.beatmapId} · {c.isFavorite ? '★ fav · ' : ''}{formatUserDate(c.lastPulledAt)}
                          </div>
                        </div>
                        {isEditing ? (
                          <div className="flex items-center space-x-1">
                            <input
                              type="number"
                              min="0"
                              value={editingCard.copies}
                              onChange={e => setEditingCard({...editingCard, copies: parseInt(e.target.value)||0})}
                              className="w-16 px-2 py-1 rounded-lg bg-slate-700 border border-slate-600 text-white text-xs font-mono"
                            />
                            <button
                              onClick={() => handleEditCard(selectedUserId, c.beatmapId, editingCard.copies)}
                              className="p-1.5 rounded-lg bg-emerald-700 text-white"
                            >
                              <Save className="w-3 h-3"/>
                            </button>
                            <button
                              onClick={() => setEditingCard(null)}
                              className="p-1.5 rounded-lg bg-slate-700 text-slate-300"
                            >
                              <X className="w-3 h-3"/>
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2">
                            <span className="text-xs sm:text-sm font-bold text-white font-mono">×{c.copies}</span>
                            <button
                              onClick={() => setEditingCard({beatmapId: c.beatmapId, copies: c.copies})}
                              className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white"
                            >
                              <Edit3 className="w-3.5 h-3.5"/>
                            </button>
                            <button
                              onClick={() => handleDeleteCard(selectedUserId, c.beatmapId)}
                              className="p-1.5 rounded-lg hover:bg-red-900/50 text-slate-500 hover:text-red-400"
                            >
                              <Trash2 className="w-3.5 h-3.5"/>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {!userCollLoading && userColl.length === 0 && (
                    <div className="py-8 text-center text-slate-500 font-mono text-sm">No cards in collection</div>
                  )}
                </div>
              </div>
            </div>
          )}
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
