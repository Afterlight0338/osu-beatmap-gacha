import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { isAdmin } from '../config/admin';
import { WORKER_API_URL } from '../config/api';
import {
  ShieldAlert,
  Users,
  Database,
  RefreshCw,
  Trash2,
  Activity,
  TrendingUp,
  Star,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Search,
  Crown,
} from 'lucide-react';

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

const AdminPage: React.FC = () => {
  const { user, token } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedUser, setExpandedUser] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  // Hard block non-admins
  if (!isAdmin(user?.username)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 text-center">
        <ShieldAlert className="w-16 h-16 text-red-500" />
        <h2 className="text-2xl font-black text-red-400">Access Denied</h2>
        <p className="text-slate-400 font-mono text-sm">You don't have permission to view this page.</p>
      </div>
    );
  }

  const fetchStats = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${WORKER_API_URL}/admin/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const data = await res.json() as { success: boolean; stats: AdminStats };
      if (data.success) setStats(data.stats);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load admin stats');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleRevokeSession = async (targetOsuId: number) => {
    if (!token) return;
    setActionLoading(targetOsuId);
    setActionMsg(null);
    try {
      const res = await fetch(`${WORKER_API_URL}/admin/user/${targetOsuId}/revoke-sessions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json() as { success: boolean; message?: string; error?: string };
      setActionMsg(data.message || data.error || 'Done');
      fetchStats();
    } catch (e) {
      setActionMsg('Request failed');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredTopUsers = stats?.topUsers.filter(u =>
    u.username.toLowerCase().includes(searchQuery.toLowerCase())
  ) ?? [];

  const StatCard: React.FC<{
    label: string;
    value: number | string;
    icon: React.ReactNode;
    color: string;
  }> = ({ label, value, icon, color }) => (
    <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center space-x-4">
      <div className={`p-3 rounded-xl ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-black text-white font-mono">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
        <p className="text-xs text-slate-400">{label}</p>
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-16">
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
        <button
          onClick={fetchStats}
          disabled={isLoading}
          className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-sm font-semibold transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-pink-400' : 'text-slate-400'}`} />
          <span>{isLoading ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 rounded-2xl bg-red-950/40 border border-red-800/60 flex items-center space-x-3 text-red-300 text-sm">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Action feedback */}
      {actionMsg && (
        <div className="p-3 rounded-2xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-sm font-mono">
          ✓ {actionMsg}
        </div>
      )}

      {/* Stats Cards */}
      {stats && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Total Users"
              value={stats.totalUsers}
              icon={<Users className="w-5 h-5 text-pink-300" />}
              color="bg-pink-950/60"
            />
            <StatCard
              label="Active Sessions"
              value={stats.totalSessions}
              icon={<Activity className="w-5 h-5 text-emerald-300" />}
              color="bg-emerald-950/60"
            />
            <StatCard
              label="Collection Records"
              value={stats.totalCollectionRecords}
              icon={<Database className="w-5 h-5 text-cyan-300" />}
              color="bg-cyan-950/60"
            />
            <StatCard
              label="Pull History Entries"
              value={stats.totalHistoryRecords}
              icon={<TrendingUp className="w-5 h-5 text-purple-300" />}
              color="bg-purple-950/60"
            />
          </div>

          {/* Top Users by Pulls */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                <Star className="w-5 h-5 text-amber-400" />
                <span>Top Users by Pulls</span>
              </h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-8 pr-4 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-xs font-mono placeholder-slate-600 focus:outline-none focus:border-pink-500/60"
                />
              </div>
            </div>

            <div className="space-y-2">
              {filteredTopUsers.map((u, i) => (
                <div key={u.osuId} className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden">
                  <button
                    onClick={() => setExpandedUser(expandedUser === u.osuId ? null : u.osuId)}
                    className="w-full flex items-center space-x-4 p-4 hover:bg-slate-800/60 transition-colors text-left"
                  >
                    {/* Rank Badge */}
                    <div className={`w-7 h-7 flex-shrink-0 rounded-full flex items-center justify-center text-xs font-black ${
                      i === 0 ? 'bg-amber-500 text-amber-950' :
                      i === 1 ? 'bg-slate-300 text-slate-900' :
                      i === 2 ? 'bg-amber-700 text-amber-100' :
                      'bg-slate-800 text-slate-400'
                    }`}>
                      {i + 1}
                    </div>

                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-xl overflow-hidden bg-pink-950/60 border border-pink-900/50 flex-shrink-0">
                      {u.avatarUrl
                        ? <img src={u.avatarUrl} alt={u.username} className="w-full h-full object-cover" />
                        : <Users className="w-5 h-5 text-pink-400 m-auto mt-2" />
                      }
                    </div>

                    {/* User info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-white truncate">{u.username}</span>
                        {u.globalRank && (
                          <span className="text-[10px] font-mono text-slate-400 px-1.5 py-0.5 rounded bg-slate-800 flex-shrink-0">
                            #{u.globalRank.toLocaleString()}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-3 text-[11px] font-mono text-slate-400">
                        <span className="text-pink-300 font-bold">{u.totalPulls.toLocaleString()} pulls</span>
                        <span>·</span>
                        <span>{u.uniqueCards} unique cards</span>
                        <span>·</span>
                        <span>ID {u.osuId}</span>
                      </div>
                    </div>

                    {expandedUser === u.osuId
                      ? <ChevronUp className="w-4 h-4 text-slate-500 flex-shrink-0" />
                      : <ChevronDown className="w-4 h-4 text-slate-500 flex-shrink-0" />
                    }
                  </button>

                  {/* Expanded Actions */}
                  {expandedUser === u.osuId && (
                    <div className="px-4 pb-4 border-t border-slate-800/80 pt-3 flex items-center space-x-3">
                      <div className="flex-1 text-xs font-mono text-slate-500">
                        <span className="text-slate-400">Last login: </span>
                        {new Date(u.lastLogin).toLocaleString()}
                      </div>
                      <a
                        href={`https://osu.ppy.sh/users/${u.osuId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 rounded-lg bg-pink-950/60 hover:bg-pink-900/60 border border-pink-800/60 text-pink-300 text-xs font-semibold transition-colors"
                      >
                        View osu! Profile
                      </a>
                      <button
                        onClick={() => handleRevokeSession(u.osuId)}
                        disabled={actionLoading === u.osuId}
                        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-red-950/60 hover:bg-red-900/60 border border-red-800/60 text-red-300 text-xs font-semibold transition-colors disabled:opacity-50"
                      >
                        {actionLoading === u.osuId
                          ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          : <Trash2 className="w-3.5 h-3.5" />
                        }
                        <span>Revoke Sessions</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {filteredTopUsers.length === 0 && (
                <div className="text-center py-10 text-slate-500 font-mono text-sm">
                  No users found matching "{searchQuery}"
                </div>
              )}
            </div>
          </div>

          {/* Recent Logins */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center space-x-2">
              <Clock className="w-5 h-5 text-cyan-400" />
              <span>Recent Logins</span>
            </h2>
            <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden divide-y divide-slate-800/60">
              {stats.recentLogins.map((u) => (
                <div key={`recent-${u.osuId}`} className="flex items-center space-x-3 p-3 hover:bg-slate-800/30 transition-colors">
                  <div className="w-8 h-8 rounded-lg overflow-hidden bg-pink-950/60 border border-pink-900/40 flex-shrink-0">
                    {u.avatarUrl
                      ? <img src={u.avatarUrl} alt={u.username} className="w-full h-full object-cover" />
                      : <Users className="w-4 h-4 text-pink-400 m-auto mt-2" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold text-slate-200 truncate">{u.username}</span>
                    <div className="text-[10px] font-mono text-slate-500">
                      {new Date(u.lastLogin).toLocaleString()} · {u.totalPulls.toLocaleString()} pulls
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-slate-600">ID {u.osuId}</span>
                </div>
              ))}
              {stats.recentLogins.length === 0 && (
                <div className="text-center py-6 text-slate-500 font-mono text-sm">No recent logins</div>
              )}
            </div>
          </div>
        </>
      )}

      {isLoading && !stats && (
        <div className="flex justify-center py-20">
          <RefreshCw className="w-8 h-8 text-pink-400 animate-spin" />
        </div>
      )}
    </div>
  );
};

export default AdminPage;
