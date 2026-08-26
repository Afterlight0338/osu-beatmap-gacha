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
  Zap, PlusCircle, Edit3, Sliders, BarChart3, Save, X, Wrench,
} from 'lucide-react';

const RARITY_ORDER: RarityTier[] = ['GOAT','Divine','Celestial','Mythic','Legendary','Epic','Rare','Uncommon+','Uncommon','Common'];
const RARITY_COLORS: Record<string, string> = {
  GOAT:'text-yellow-300', Divine:'text-purple-300', Celestial:'text-cyan-300',
  Mythic:'text-pink-300', Legendary:'text-orange-300', Epic:'text-violet-300',
  Rare:'text-blue-300', 'Uncommon+':'text-teal-300', Uncommon:'text-green-300', Common:'text-slate-400',
};

interface AdminStats {
  totalUsers: number; totalSessions: number; totalCollectionRecords: number; totalHistoryRecords: number;
  topUsers: { osuId: number; username: string; avatarUrl: string|null; globalRank: number|null; totalPulls: number; uniqueCards: number; lastLogin: string }[];
  recentLogins: { osuId: number; username: string; avatarUrl: string|null; lastLogin: string; totalPulls: number }[];
}
interface UserCollCard { beatmapId: number; copies: number; firstPulledAt: number; lastPulledAt: number; isFavorite: boolean }

type AdminTab = 'overview' | 'users' | 'config';

const AdminPage: React.FC = () => {
  const { user, token } = useAuth();
  const { pool, energy, adminRefillEnergy } = useGacha();

  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [expandedUser, setExpandedUser] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionMsg, setActionMsg] = useState<{text:string;ok:boolean}|null>(null);
  const [actionLoading, setActionLoading] = useState(false);

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

  // Config state
  const [configRates, setConfigRates] = useState<RarityRates>({...DEFAULT_RARITY_RATES});
  const [configStamina, setConfigStamina] = useState<{max:number;regenSeconds:number}>({max:50,regenSeconds:15});
  // configLoading state removed
  const [ratesTotal, setRatesTotal] = useState(1.0);

  if (!isAdmin(user?.username)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 text-center">
        <ShieldAlert className="w-16 h-16 text-red-500" />
        <h2 className="text-2xl font-black text-red-400">Access Denied</h2>
        <p className="text-slate-400 font-mono text-sm">Restricted area.</p>
      </div>
    );
  }

  // ─── API helper ──────────────────────────────────────────────
  const api = useCallback(async (method:string, path:string, body?:unknown) => {
    const res = await fetch(`${WORKER_API_URL}${path}`, {
      method, headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token}` },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const data = await res.json() as { success:boolean; error?:string; [k:string]:unknown };
    if (!data.success) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }, [token]);

  const showMsg = (text:string, ok=true) => { setActionMsg({text,ok}); setTimeout(()=>setActionMsg(null),4000); };

  // ─── Overview ────────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    setStatsLoading(true); setStatsError(null);
    try { const d = await api('GET','/admin/stats'); setStats(d.stats as AdminStats); }
    catch(e) { setStatsError(e instanceof Error ? e.message : 'Failed'); }
    finally { setStatsLoading(false); }
  }, [api]);

  useEffect(() => { if (activeTab === 'overview') fetchStats(); }, [activeTab]);

  // ─── User management ─────────────────────────────────────────
  const fetchUserColl = useCallback(async (osuId:number) => {
    setUserCollLoading(true);
    try {
      const d = await api('GET',`/admin/user/${osuId}/collection`);
      setUserColl(d.collection as UserCollCard[]);
      setSelectedUsername(d.username as string || String(osuId));
    } catch(e) { showMsg(e instanceof Error ? e.message : 'Failed to load collection', false); }
    finally { setUserCollLoading(false); }
  }, [api]);

  const handleSetPulls = async (osuId:number) => {
    if (!pullsInput) return;
    setActionLoading(true);
    try {
      const body = pullsMode === 'set' ? {pulls: Number(pullsInput)} : {delta: Number(pullsInput)};
      const d = await api('POST',`/admin/user/${osuId}/set-pulls`, body);
      showMsg(`✓ ${selectedUsername}'s pulls set to ${(d as any).totalPulls}`);
      fetchStats();
    } catch(e) { showMsg(e instanceof Error ? e.message : 'Failed', false); }
    finally { setActionLoading(false); setPullsInput(''); }
  };

  const handleEnergyOverride = async (osuId:number) => {
    const amount = Number(energyInput);
    if (!amount || amount < 1) return;
    setActionLoading(true);
    try {
      // If it's self, apply locally immediately too
      if (osuId === user?.osuId) await adminRefillEnergy(amount);
      await api('POST',`/admin/user/${osuId}/energy-override`, {amount});
      showMsg(`⚡ Energy override of ${amount} queued for ${selectedUsername}`);
    } catch(e) { showMsg(e instanceof Error ? e.message : 'Failed', false); }
    finally { setActionLoading(false); }
  };

  const handleAddCard = async (osuId:number) => {
    const bid = Number(addCardId || addCardSearch);
    if (!bid) return;
    setActionLoading(true);
    try {
      await api('POST',`/admin/user/${osuId}/collection/add`, {beatmapId:bid, copies:Number(addCardCopies)||1, rarity:addCardRarity});
      showMsg(`✓ Added beatmap #${bid} ×${addCardCopies} to ${selectedUsername}`);
      fetchUserColl(osuId);
      setAddCardId(''); setAddCardSearch(''); setAddCardCopies('1');
    } catch(e) { showMsg(e instanceof Error ? e.message : 'Failed', false); }
    finally { setActionLoading(false); }
  };

  const handleEditCard = async (osuId:number, beatmapId:number, copies:number) => {
    setActionLoading(true);
    try {
      await api('PUT',`/admin/user/${osuId}/collection/${beatmapId}`, {copies});
      showMsg(`✓ Updated copies for beatmap #${beatmapId}`);
      fetchUserColl(osuId); setEditingCard(null);
    } catch(e) { showMsg(e instanceof Error ? e.message : 'Failed', false); }
    finally { setActionLoading(false); }
  };

  const handleDeleteCard = async (osuId:number, beatmapId:number) => {
    if (!confirm(`Remove beatmap #${beatmapId} from ${selectedUsername}?`)) return;
    setActionLoading(true);
    try {
      await api('DELETE',`/admin/user/${osuId}/collection/${beatmapId}`, {});
      showMsg(`✓ Removed beatmap #${beatmapId}`);
      fetchUserColl(osuId);
    } catch(e) { showMsg(e instanceof Error ? e.message : 'Failed', false); }
    finally { setActionLoading(false); }
  };

  const handleRevokeSession = async (osuId:number) => {
    setActionLoading(true);
    try {
      await api('POST',`/admin/user/${osuId}/revoke-sessions`, {});
      showMsg(`✓ Sessions revoked for user ${osuId}`); fetchStats();
    } catch(e) { showMsg(e instanceof Error ? e.message : 'Failed', false); }
    finally { setActionLoading(false); }
  };

  const selectUser = (osuId:number, username:string) => {
    setSelectedUserId(osuId); setSelectedUsername(username);
    setActiveTab('users'); fetchUserColl(osuId);
  };

  // ─── Config ───────────────────────────────────────────────────
  const fetchConfig = useCallback(async () => {
    setActionLoading(true);
    try {
      const d = await api('GET','/admin/config');
      const cfg = d.config as Record<string,unknown>;
      if (cfg.rates) setConfigRates(cfg.rates as RarityRates);
      if (cfg.stamina) setConfigStamina(cfg.stamina as {max:number;regenSeconds:number});
    } catch {} finally { setActionLoading(false); }
  }, [api]);

  useEffect(() => { if (activeTab === 'config') fetchConfig(); }, [activeTab]);

  useEffect(() => {
    const sum = RARITY_ORDER.reduce((a,t) => a + (configRates[t]||0), 0);
    setRatesTotal(Math.round(sum*10000)/10000);
  }, [configRates]);

  const handleSaveRates = async () => {
    if (Math.abs(ratesTotal - 1.0) > 0.001) { showMsg('Rates must sum to exactly 1.0 (100%)', false); return; }
    setActionLoading(true);
    try { await api('PUT','/admin/config/rates', configRates); showMsg('✓ Rates saved — effective on next page load'); }
    catch(e) { showMsg(e instanceof Error ? e.message : 'Failed', false); }
    finally { setActionLoading(false); }
  };

  const handleSaveStamina = async () => {
    setActionLoading(true);
    try { await api('PUT','/admin/config/stamina', configStamina); showMsg('✓ Stamina config saved — effective on next sync'); }
    catch(e) { showMsg(e instanceof Error ? e.message : 'Failed', false); }
    finally { setActionLoading(false); }
  };

  const resetRates = () => setConfigRates({...DEFAULT_RARITY_RATES});

  // Pool beatmap search for card add
  const poolMatches = addCardSearch.length >= 2
    ? pool.filter(m => m.title.toLowerCase().includes(addCardSearch.toLowerCase()) || m.artist.toLowerCase().includes(addCardSearch.toLowerCase()) || String(m.id).startsWith(addCardSearch)).slice(0,8)
    : [];

  const filteredTopUsers = stats?.topUsers.filter(u => u.username.toLowerCase().includes(searchQuery.toLowerCase())) ?? [];

  // ─── Render ──────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-red-950/60 border border-red-800/60">
            <Crown className="w-6 h-6 text-red-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Admin Panel</h1>
            <p className="text-xs text-slate-400 font-mono">Logged in as <span className="text-red-400 font-bold">{user?.username}</span></p>
          </div>
        </div>
      </div>

      {/* Action message */}
      {actionMsg && (
        <div className={`p-3 rounded-2xl border text-sm font-mono flex items-center space-x-2 ${
          actionMsg.ok ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300' : 'bg-red-950/40 border-red-800/60 text-red-300'
        }`}>
          {actionMsg.ok ? <Activity className="w-4 h-4 flex-shrink-0"/> : <AlertTriangle className="w-4 h-4 flex-shrink-0"/>}
          <span>{actionMsg.text}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center space-x-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800 w-fit">
        {([
          ['overview','Overview',<BarChart3 className="w-3.5 h-3.5"/>],
          ['users','Users',<Users className="w-3.5 h-3.5"/>],
          ['config','Config',<Sliders className="w-3.5 h-3.5"/>],
        ] as [AdminTab, string, React.ReactNode][]).map(([id, label, icon]) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === id ? 'bg-red-700 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            {icon}<span>{label}</span>
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ─────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="flex justify-end">
            <button onClick={fetchStats} disabled={statsLoading}
              className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-sm font-semibold">
              <RefreshCw className={`w-4 h-4 ${statsLoading ? 'animate-spin text-pink-400' : 'text-slate-400'}`}/>
              <span>Refresh</span>
            </button>
          </div>

          {statsError && <div className="p-4 rounded-2xl bg-red-950/40 border border-red-800/60 text-red-300 text-sm">{statsError}</div>}

          {stats && <>
            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {label:'Total Users', val:stats.totalUsers, icon:<Users className="w-5 h-5 text-pink-300"/>, bg:'bg-pink-950/60'},
                {label:'Active Sessions', val:stats.totalSessions, icon:<Activity className="w-5 h-5 text-emerald-300"/>, bg:'bg-emerald-950/60'},
                {label:'Collection Records', val:stats.totalCollectionRecords, icon:<Database className="w-5 h-5 text-cyan-300"/>, bg:'bg-cyan-950/60'},
                {label:'Pull History Entries', val:stats.totalHistoryRecords, icon:<TrendingUp className="w-5 h-5 text-purple-300"/>, bg:'bg-purple-950/60'},
              ].map(c=>(
                <div key={c.label} className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center space-x-4">
                  <div className={`p-3 rounded-xl ${c.bg}`}>{c.icon}</div>
                  <div>
                    <p className="text-2xl font-black text-white font-mono">{c.val.toLocaleString()}</p>
                    <p className="text-xs text-slate-400">{c.label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Leaderboard */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white flex items-center space-x-2"><Star className="w-5 h-5 text-amber-400"/><span>Top Users</span></h2>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none"/>
                  <input type="text" placeholder="Search…" value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}
                    className="pl-8 pr-4 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-xs font-mono placeholder-slate-600 focus:outline-none focus:border-pink-500/60"/>
                </div>
              </div>
              <div className="space-y-2">
                {filteredTopUsers.map((u,i)=>(
                  <div key={u.osuId} className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden">
                    <button onClick={()=>setExpandedUser(expandedUser===u.osuId?null:u.osuId)}
                      className="w-full flex items-center space-x-3 p-3 hover:bg-slate-800/60 transition-colors text-left">
                      <div className={`w-7 h-7 flex-shrink-0 rounded-full flex items-center justify-center text-xs font-black ${i===0?'bg-amber-500 text-amber-950':i===1?'bg-slate-300 text-slate-900':i===2?'bg-amber-700 text-amber-100':'bg-slate-800 text-slate-400'}`}>{i+1}</div>
                      <div className="w-8 h-8 rounded-lg overflow-hidden bg-pink-950/60 border border-pink-900/40 flex-shrink-0">
                        {u.avatarUrl?<img src={u.avatarUrl} alt="" className="w-full h-full object-cover"/>:<Users className="w-4 h-4 text-pink-400 m-2"/>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-white truncate">{u.username}</span>
                          {u.globalRank&&<span className="text-[10px] font-mono text-slate-400 px-1.5 py-0.5 rounded bg-slate-800 flex-shrink-0">#{u.globalRank.toLocaleString()}</span>}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400">
                          <span className="text-pink-300 font-bold">{u.totalPulls.toLocaleString()} pulls</span>
                          <span className="mx-1">·</span>{u.uniqueCards} cards<span className="mx-1">·</span>ID {u.osuId}
                        </div>
                      </div>
                      {expandedUser===u.osuId?<ChevronUp className="w-4 h-4 text-slate-500"/>:<ChevronDown className="w-4 h-4 text-slate-500"/>}
                    </button>
                    {expandedUser===u.osuId&&(
                      <div className="px-4 pb-4 border-t border-slate-800/60 pt-3 flex flex-wrap gap-2 items-center">
                        <span className="text-xs font-mono text-slate-500 flex-1">Last login: {new Date(u.lastLogin).toLocaleString()}</span>
                        <button onClick={()=>selectUser(u.osuId, u.username)}
                          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-blue-950/60 hover:bg-blue-900/60 border border-blue-800/60 text-blue-300 text-xs font-semibold">
                          <Edit3 className="w-3.5 h-3.5"/><span>Manage</span>
                        </button>
                        <a href={`https://osu.ppy.sh/users/${u.osuId}`} target="_blank" rel="noreferrer"
                          className="px-3 py-1.5 rounded-lg bg-pink-950/60 hover:bg-pink-900/60 border border-pink-800/60 text-pink-300 text-xs font-semibold">osu! Profile</a>
                        <button onClick={()=>handleRevokeSession(u.osuId)}
                          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-red-950/60 hover:bg-red-900/60 border border-red-800/60 text-red-300 text-xs font-semibold">
                          <Trash2 className="w-3.5 h-3.5"/><span>Revoke Sessions</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Recent logins */}
            <div className="space-y-3">
              <h2 className="text-lg font-bold text-white flex items-center space-x-2"><Clock className="w-5 h-5 text-cyan-400"/><span>Recent Logins</span></h2>
              <div className="rounded-2xl bg-slate-900/80 border border-slate-800 divide-y divide-slate-800/60">
                {stats.recentLogins.map(u=>(
                  <div key={u.osuId} className="flex items-center space-x-3 p-3 hover:bg-slate-800/30 transition-colors">
                    <div className="w-8 h-8 rounded-lg overflow-hidden bg-pink-950/60 border border-pink-900/40 flex-shrink-0">
                      {u.avatarUrl?<img src={u.avatarUrl} alt="" className="w-full h-full object-cover"/>:<Users className="w-4 h-4 text-pink-400 m-2"/>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <button onClick={()=>selectUser(u.osuId,u.username)} className="text-sm font-semibold text-slate-200 hover:text-pink-300 truncate">{u.username}</button>
                      <div className="text-[10px] font-mono text-slate-500">{new Date(u.lastLogin).toLocaleString()} · {u.totalPulls.toLocaleString()} pulls</div>
                    </div>
                    <span className="text-[10px] font-mono text-slate-600">ID {u.osuId}</span>
                  </div>
                ))}
              </div>
            </div>
          </>}
          {statsLoading&&!stats&&<div className="flex justify-center py-20"><RefreshCw className="w-8 h-8 text-pink-400 animate-spin"/></div>}
        </div>
      )}

      {/* ── USERS TAB ─────────────────────────────── */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          {/* User selector */}
          {!selectedUserId ? (
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 text-center space-y-3">
              <Users className="w-10 h-10 text-slate-600 mx-auto"/>
              <p className="text-slate-400 text-sm">Click <strong>"Manage"</strong> on a user in the Overview tab, or enter an osu! user ID below.</p>
              <div className="flex items-center space-x-2 max-w-xs mx-auto">
                <input type="number" placeholder="osu! User ID"
                  className="flex-1 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-sm font-mono focus:outline-none focus:border-pink-500/60"
                  onKeyDown={e=>{ if(e.key==='Enter'){ const v=parseInt((e.target as HTMLInputElement).value,10); if(v) selectUser(v, String(v)); }}}/>
                <button onClick={()=>{const el=document.querySelector('input[type=number]') as HTMLInputElement; const v=parseInt(el?.value,10); if(v) selectUser(v,String(v));}}
                  className="px-4 py-2 rounded-xl bg-pink-700 hover:bg-pink-600 text-white text-sm font-semibold">Go</button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* User header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <button onClick={()=>{setSelectedUserId(null);setUserColl([]);}}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300">
                    <X className="w-4 h-4"/>
                  </button>
                  <div>
                    <p className="font-bold text-white text-lg">{selectedUsername}</p>
                    <p className="text-xs font-mono text-slate-400">osu! ID: {selectedUserId}</p>
                  </div>
                </div>
                <a href={`https://osu.ppy.sh/users/${selectedUserId}`} target="_blank" rel="noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-pink-950/60 hover:bg-pink-900/60 border border-pink-800/60 text-pink-300 text-xs font-semibold">
                  View osu! Profile
                </a>
              </div>

              {/* Action panels */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Adjust Pulls */}
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                  <h3 className="font-bold text-white flex items-center space-x-2"><TrendingUp className="w-4 h-4 text-pink-400"/><span>Adjust Pulls</span></h3>
                  <div className="flex rounded-xl overflow-hidden border border-slate-700">
                    <button onClick={()=>setPullsMode('add')} className={`flex-1 py-1 text-xs font-semibold ${pullsMode==='add'?'bg-pink-700 text-white':'bg-slate-800 text-slate-400'}`}>Add</button>
                    <button onClick={()=>setPullsMode('set')} className={`flex-1 py-1 text-xs font-semibold ${pullsMode==='set'?'bg-pink-700 text-white':'bg-slate-800 text-slate-400'}`}>Set</button>
                  </div>
                  <input type="number" placeholder={pullsMode==='add'?'Delta (e.g. 100)':'Absolute total'} value={pullsInput} onChange={e=>setPullsInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-sm font-mono focus:outline-none focus:border-pink-500/60"/>
                  <button onClick={()=>handleSetPulls(selectedUserId)} disabled={actionLoading||!pullsInput}
                    className="w-full py-2 rounded-xl bg-pink-700 hover:bg-pink-600 disabled:opacity-50 text-white text-sm font-semibold transition-colors">
                    {actionLoading?'Saving…':'Apply'}
                  </button>
                </div>

                {/* Force Stamina */}
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                  <h3 className="font-bold text-white flex items-center space-x-2"><Zap className="w-4 h-4 text-amber-400"/><span>Force Stamina</span></h3>
                  <p className="text-xs text-slate-400 font-mono">Current (self): <span className="text-amber-300 font-bold">{energy.current}/{energy.max}</span></p>
                  <input type="number" min="1" max="9999" placeholder="Amount (e.g. 50)" value={energyInput} onChange={e=>setEnergyInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-sm font-mono focus:outline-none focus:border-amber-500/60"/>
                  <button onClick={()=>handleEnergyOverride(selectedUserId)} disabled={actionLoading}
                    className="w-full py-2 rounded-xl bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-white text-sm font-semibold">
                    {selectedUserId===user?.osuId?'Refill Self Instantly':'Queue Energy Override'}
                  </button>
                  {selectedUserId!==user?.osuId&&<p className="text-[10px] text-slate-500">User will receive this on their next sync.</p>}
                </div>

                {/* Revoke Sessions */}
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                  <h3 className="font-bold text-white flex items-center space-x-2"><Trash2 className="w-4 h-4 text-red-400"/><span>Sessions</span></h3>
                  <p className="text-xs text-slate-400">Force-log the user out of all devices. Their data in D1 is preserved.</p>
                  <button onClick={()=>handleRevokeSession(selectedUserId)} disabled={actionLoading||selectedUserId===user?.osuId}
                    className="w-full py-2 rounded-xl bg-red-800 hover:bg-red-700 disabled:opacity-40 text-white text-sm font-semibold">
                    Revoke All Sessions
                  </button>
                  {selectedUserId===user?.osuId&&<p className="text-[10px] text-slate-500">Cannot revoke your own sessions.</p>}
                </div>
              </div>

              {/* Add Card */}
              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                <h3 className="font-bold text-white flex items-center space-x-2"><PlusCircle className="w-4 h-4 text-emerald-400"/><span>Add Specific Card</span></h3>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="sm:col-span-2 relative">
                    <input type="text" placeholder="Search beatmap title…" value={addCardSearch} onChange={e=>{setAddCardSearch(e.target.value);setAddCardId('');}}
                      className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-sm font-mono focus:outline-none focus:border-emerald-500/60"/>
                    {poolMatches.length>0&&(
                      <div className="absolute z-20 top-full left-0 right-0 mt-1 rounded-xl bg-slate-800 border border-slate-700 overflow-hidden shadow-xl max-h-48 overflow-y-auto">
                        {poolMatches.map(m=>(
                          <button key={m.id} onClick={()=>{setAddCardId(String(m.id));setAddCardSearch(`${m.artist} — ${m.title} [#${m.id}]`);setAddCardRarity(m.rarity);}}
                            className="w-full flex items-center space-x-2 px-3 py-2 hover:bg-slate-700 text-left">
                            <span className={`text-[10px] font-mono font-bold ${RARITY_COLORS[m.rarity]||'text-slate-400'}`}>{m.rarity}</span>
                            <span className="text-sm text-slate-200 truncate">{m.artist} — {m.title}</span>
                            <span className="text-[10px] text-slate-500 font-mono flex-shrink-0">#{m.id}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <input type="number" placeholder="Beatmap ID" value={addCardId} onChange={e=>setAddCardId(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-sm font-mono focus:outline-none focus:border-emerald-500/60"/>
                  <input type="number" min="1" placeholder="Copies" value={addCardCopies} onChange={e=>setAddCardCopies(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-sm font-mono focus:outline-none focus:border-emerald-500/60"/>
                </div>
                <div className="flex items-center space-x-3">
                  <select value={addCardRarity} onChange={e=>setAddCardRarity(e.target.value as RarityTier)}
                    className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-sm font-mono focus:outline-none">
                    {RARITY_ORDER.map(r=><option key={r} value={r}>{r}</option>)}
                  </select>
                  <button onClick={()=>handleAddCard(selectedUserId)} disabled={actionLoading||(!addCardId&&!addCardSearch)}
                    className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-semibold">
                    <PlusCircle className="w-4 h-4"/><span>Add Card</span>
                  </button>
                </div>
              </div>

              {/* User Collection */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-white flex items-center space-x-2"><Database className="w-4 h-4 text-cyan-400"/><span>Collection ({userColl.length} cards)</span></h3>
                  <button onClick={()=>fetchUserColl(selectedUserId)} className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700">
                    <RefreshCw className={`w-3.5 h-3.5 text-slate-400 ${userCollLoading?'animate-spin':''}`}/>
                  </button>
                </div>
                <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden max-h-96 overflow-y-auto divide-y divide-slate-800/60">
                  {userCollLoading&&<div className="flex justify-center p-8"><RefreshCw className="w-6 h-6 text-pink-400 animate-spin"/></div>}
                  {!userCollLoading&&userColl.map(c=>{
                    const map = pool.find(m=>m.id===c.beatmapId);
                    const isEditing = editingCard?.beatmapId===c.beatmapId;
                    return (
                      <div key={c.beatmapId} className="flex items-center space-x-3 px-4 py-2.5 hover:bg-slate-800/30">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            {map&&<span className={`text-[10px] font-mono font-bold flex-shrink-0 ${RARITY_COLORS[map.rarity]||'text-slate-400'}`}>{map.rarity}</span>}
                            <span className="text-sm text-slate-200 truncate">{map ? `${map.artist} — ${map.title}` : `Beatmap #${c.beatmapId}`}</span>
                          </div>
                          <div className="text-[10px] font-mono text-slate-500">ID {c.beatmapId} · {c.isFavorite?'★ fav · ':''}{new Date(c.lastPulledAt).toLocaleDateString()}</div>
                        </div>
                        {isEditing ? (
                          <div className="flex items-center space-x-1">
                            <input type="number" min="0" value={editingCard.copies} onChange={e=>setEditingCard({...editingCard,copies:parseInt(e.target.value)||0})}
                              className="w-16 px-2 py-1 rounded-lg bg-slate-700 border border-slate-600 text-white text-xs font-mono"/>
                            <button onClick={()=>handleEditCard(selectedUserId,c.beatmapId,editingCard.copies)} className="p-1.5 rounded-lg bg-emerald-700 text-white"><Save className="w-3 h-3"/></button>
                            <button onClick={()=>setEditingCard(null)} className="p-1.5 rounded-lg bg-slate-700 text-slate-300"><X className="w-3 h-3"/></button>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-bold text-white font-mono">×{c.copies}</span>
                            <button onClick={()=>setEditingCard({beatmapId:c.beatmapId,copies:c.copies})} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white"><Edit3 className="w-3.5 h-3.5"/></button>
                            <button onClick={()=>handleDeleteCard(selectedUserId,c.beatmapId)} className="p-1.5 rounded-lg hover:bg-red-900/50 text-slate-500 hover:text-red-400"><Trash2 className="w-3.5 h-3.5"/></button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {!userCollLoading&&userColl.length===0&&<div className="py-8 text-center text-slate-500 font-mono text-sm">No cards in collection</div>}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── CONFIG TAB ────────────────────────────── */}
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

          {/* Rates */}
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-white text-lg flex items-center space-x-2"><BarChart3 className="w-5 h-5 text-pink-400"/><span>Gacha Rates</span></h2>
              <button onClick={resetRates} className="text-xs text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700">Reset to Defaults</button>
            </div>
            <p className={`text-xs font-mono ${Math.abs(ratesTotal-1.0)<0.001?'text-emerald-400':'text-red-400 font-bold'}`}>
              Total: {(ratesTotal*100).toFixed(4)}% {Math.abs(ratesTotal-1.0)<0.001?'✓ Valid':'✗ Must equal 100.00%'}
            </p>
            <div className="space-y-2">
              {RARITY_ORDER.map(tier=>(
                <div key={tier} className="flex items-center space-x-3">
                  <span className={`text-xs font-bold font-mono w-20 flex-shrink-0 ${RARITY_COLORS[tier]||'text-slate-400'}`}>{tier}</span>
                  <input type="number" step="0.0001" min="0" max="1" value={configRates[tier]??0}
                    onChange={e=>setConfigRates(prev=>({...prev,[tier]:parseFloat(e.target.value)||0}))}
                    className="flex-1 px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-sm font-mono focus:outline-none focus:border-pink-500/60"/>
                  <span className="text-xs text-slate-400 w-14 text-right font-mono">{((configRates[tier]??0)*100).toFixed(4)}%</span>
                  <div className="w-24 h-2 rounded-full bg-slate-700 overflow-hidden flex-shrink-0">
                    <div className="h-full bg-pink-500/60 rounded-full" style={{width:`${Math.min(100,(configRates[tier]??0)*100/0.35)}%`}}/>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={handleSaveRates} disabled={actionLoading||Math.abs(ratesTotal-1.0)>=0.001}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-pink-700 hover:bg-pink-600 disabled:opacity-50 text-white text-sm font-semibold">
              <Save className="w-4 h-4"/><span>Save Rates</span>
            </button>
          </div>

          {/* Stamina */}
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
            <h2 className="font-bold text-white text-lg flex items-center space-x-2"><Zap className="w-5 h-5 text-amber-400"/><span>Stamina Config</span></h2>
            <p className="text-xs text-slate-400">Note: Stamina max is enforced client-side. Changes take effect after users refresh their page or sync.</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs text-slate-400 font-mono">Max Stamina</label>
                <input type="number" min="1" max="9999" value={configStamina.max}
                  onChange={e=>setConfigStamina(prev=>({...prev,max:parseInt(e.target.value)||50}))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-sm font-mono focus:outline-none focus:border-amber-500/60"/>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-400 font-mono">Regen Interval (seconds/pull)</label>
                <input type="number" min="1" max="3600" value={configStamina.regenSeconds}
                  onChange={e=>setConfigStamina(prev=>({...prev,regenSeconds:parseInt(e.target.value)||15}))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-sm font-mono focus:outline-none focus:border-amber-500/60"/>
              </div>
            </div>
            <button onClick={handleSaveStamina} disabled={actionLoading}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-white text-sm font-semibold">
              <Save className="w-4 h-4"/><span>Save Stamina Config</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPage;
