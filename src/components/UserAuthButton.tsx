import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { sfx } from '../audio/sfx';
import {
  LogIn,
  LogOut,
  Cloud,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  User,
  ShieldCheck,
  Disc,
} from 'lucide-react';

interface UserAuthButtonProps {
  onForceSync?: () => void;
  compact?: boolean;
}

export const UserAuthButton: React.FC<UserAuthButtonProps> = ({ onForceSync, compact = false }) => {
  const { user, isAuthenticated, isLoading, isSyncing, lastSyncedAt, loginWithOsu, logout, pendingSyncCount } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLoginClick = () => {
    sfx.playClick();
    loginWithOsu();
  };

  const handleLogoutClick = async () => {
    sfx.playClick();
    setIsDropdownOpen(false);
    await logout();
  };

  const handleSyncClick = () => {
    sfx.playClick();
    if (onForceSync) onForceSync();
  };

  if (isLoading) {
    return (
      <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-400 font-mono">
        <RefreshCw className="w-3.5 h-3.5 animate-spin text-pink-400" />
        <span className="hidden sm:inline">Checking...</span>
      </div>
    );
  }

  // -------------------------------------------------------------
  // Logged Out State -> "Login with osu!" Button
  // -------------------------------------------------------------
  if (!isAuthenticated || !user) {
    return (
      <button
        onClick={handleLoginClick}
        title="Sign in with your osu! account to sync your collection across all devices"
        className="group relative flex items-center space-x-2 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-pink-600 via-pink-500 to-purple-600 text-white text-xs sm:text-sm font-bold shadow-md shadow-pink-600/25 hover:shadow-pink-500/40 hover:scale-[1.03] active:scale-[0.98] transition-all select-none border border-pink-400/40"
      >
        <div className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center group-hover:rotate-45 transition-transform">
          <Disc className="w-3.5 h-3.5 text-white" />
        </div>
        <span className="font-display tracking-tight">Login with osu!</span>
        <LogIn className="w-3.5 h-3.5 text-pink-200 group-hover:translate-x-0.5 transition-transform" />
      </button>
    );
  }

  // -------------------------------------------------------------
  // Logged In State -> User Avatar & Sync Indicator Dropdown
  // -------------------------------------------------------------
  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsDropdownOpen((prev) => !prev)}
        className="flex items-center space-x-2 p-1 sm:pr-3 rounded-xl bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 hover:border-pink-500/40 transition-all select-none group"
      >
        {/* User Avatar */}
        <div className="relative w-8 h-8 rounded-lg overflow-hidden bg-pink-950/60 border border-pink-500/50 flex-shrink-0 flex items-center justify-center">
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.username} className="w-full h-full object-cover" />
          ) : (
            <User className="w-4 h-4 text-pink-300" />
          )}
          {/* Active Cloud Sync Status Dot */}
          <div
            className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border border-slate-950 ${
              isSyncing
                ? 'bg-amber-400 animate-ping'
                : pendingSyncCount > 0
                ? 'bg-orange-400'
                : 'bg-emerald-400'
            }`}
          />
        </div>

        {/* Username & Global Rank */}
        {!compact && (
          <div className="hidden sm:flex flex-col text-left">
            <div className="flex items-center space-x-1">
              <span className="text-xs font-bold text-slate-100 group-hover:text-pink-300 transition-colors truncate max-w-[100px]">
                {user.username}
              </span>
              {user.countryCode && (
                <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-slate-800 text-slate-400">
                  {user.countryCode}
                </span>
              )}
            </div>
            <div className="flex items-center space-x-1 text-[10px] font-mono text-slate-400">
              <Cloud className={`w-2.5 h-2.5 ${isSyncing ? 'text-amber-400 animate-spin' : pendingSyncCount > 0 ? 'text-orange-400' : 'text-emerald-400'}`} />
              <span>
                {isSyncing ? 'Syncing...' : pendingSyncCount > 0 ? `${pendingSyncCount} pending` : 'Cloud D1'}
              </span>
            </div>
          </div>
        )}

        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
            isDropdownOpen ? 'rotate-180 text-pink-400' : ''
          }`}
        />
      </button>

      {/* User Dropdown Menu */}
      {isDropdownOpen && (
        <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-[#131322] border border-slate-800 shadow-2xl p-3 z-50 animate-fade-in space-y-3 font-sans">
          {/* Header Profile Section */}
          <div className="flex items-center space-x-3 pb-3 border-b border-slate-800/80">
            <div className="w-11 h-11 rounded-xl overflow-hidden bg-slate-950 border border-pink-500/50 flex-shrink-0">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.username} className="w-full h-full object-cover" />
              ) : (
                <User className="w-5 h-5 text-pink-300 m-auto" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center space-x-1.5">
                <span className="text-sm font-bold text-white truncate">{user.username}</span>
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-pink-950 text-pink-300 font-bold border border-pink-500/30">
                  osu!
                </span>
              </div>
              <p className="text-[11px] font-mono text-slate-400">
                {user.globalRank ? `#${user.globalRank.toLocaleString()} Global` : `ID: ${user.osuId}`}
              </p>
            </div>
          </div>

          {/* Cloud Sync Status */}
          <div className={`p-2.5 rounded-xl border space-y-1.5 text-xs font-mono ${
            pendingSyncCount > 0
              ? 'bg-orange-950/40 border-orange-800/60'
              : 'bg-slate-950/70 border-slate-800/80'
          }`}>
            <div className="flex items-center justify-between text-slate-400 text-[11px]">
              <span className="flex items-center space-x-1">
                <ShieldCheck className={`w-3 h-3 ${pendingSyncCount > 0 ? 'text-orange-400' : 'text-emerald-400'}`} />
                <span>Cloud Sync (D1)</span>
              </span>
              <span className={
                isSyncing ? 'text-amber-400 animate-pulse' :
                pendingSyncCount > 0 ? 'text-orange-400 font-bold' :
                'text-emerald-400 font-bold'
              }>
                {isSyncing ? 'Syncing...' : pendingSyncCount > 0 ? `${pendingSyncCount} queued` : 'Connected'}
              </span>
            </div>

            {pendingSyncCount > 0 && (
              <p className="text-[10px] text-orange-300/80 leading-relaxed">
                ⚠ {pendingSyncCount} local batch{pendingSyncCount !== 1 ? 'es' : ''} stored offline.
                Will auto-sync when D1 is reachable.
              </p>
            )}

            {lastSyncedAt && (
              <p className="text-[10px] text-slate-500">
                Last synced: {lastSyncedAt.toLocaleTimeString()}
              </p>
            )}

            <button
              onClick={handleSyncClick}
              disabled={isSyncing}
              className="w-full mt-1 flex items-center justify-center space-x-1.5 py-1 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-pink-300 text-[11px] border border-slate-700/60 transition-colors"
            >
              <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin text-amber-400' : ''}`} />
              <span>{isSyncing ? 'Syncing with D1...' : 'Sync Collection Now'}</span>
            </button>
          </div>

          {/* Action Links */}
          <div className="space-y-1 text-xs">
            <a
              href={`https://osu.ppy.sh/users/${user.osuId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between px-3 py-2 rounded-xl text-slate-300 hover:bg-slate-800/80 hover:text-pink-300 transition-colors"
            >
              <span className="flex items-center space-x-2">
                <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                <span>View osu! Profile</span>
              </span>
            </a>

            <button
              onClick={handleLogoutClick}
              className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-rose-300 hover:bg-rose-950/40 hover:text-rose-200 transition-colors text-left"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-400" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
