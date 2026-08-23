import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Cloud, CheckCircle2, RefreshCw, LogOut, User } from 'lucide-react';

export const UserProfileBadge: React.FC = () => {
  const { user, isLoggedIn, syncStatus, logout, syncNow, openLoginModal } = useAuth();
  const [showDropdown, setShowDropdown] = useState<boolean>(false);

  if (!isLoggedIn || !user) {
    return (
      <button
        onClick={openLoginModal}
        className="flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-full bg-[#ff66aa]/20 hover:bg-[#ff66aa]/30 text-[#ff66aa] hover:text-pink-200 border border-[#ff66aa]/50 hover:border-[#ff66aa]/80 transition-all duration-200 text-xs font-bold font-mono shadow-sm hover:scale-105 select-none flex-shrink-0"
      >
        <User className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Login</span>
      </button>
    );
  }

  return (
    <div className="relative flex-shrink-0">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center space-x-1.5 sm:space-x-2 p-1 pr-2 sm:pr-3 rounded-full bg-slate-900/90 border border-slate-700/80 hover:border-pink-500/60 transition-all select-none group"
      >
        {/* osu! Avatar */}
        <img
          src={user.avatarUrl}
          alt={user.username}
          className="w-6 h-6 sm:w-7 sm:h-7 rounded-full object-cover border border-pink-500/50 bg-slate-950 flex-shrink-0"
          onError={(e) => {
            e.currentTarget.src = `https://a.ppy.sh/${user.id}`;
          }}
        />

        <div className="hidden sm:flex flex-col items-start text-left">
          <span className="text-xs font-bold text-slate-200 group-hover:text-pink-300 transition-colors truncate max-w-[80px]">
            {user.username}
          </span>
        </div>

        {/* Cloud Sync Icon */}
        <div className="pl-0.5 text-slate-400">
          {syncStatus === 'syncing' ? (
            <RefreshCw className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
          ) : syncStatus === 'synced' ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <Cloud className="w-3.5 h-3.5 text-slate-400" />
          )}
        </div>
      </button>

      {/* User Dropdown Menu */}
      {showDropdown && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowDropdown(false)}
          />
          <div className="absolute right-0 mt-2 w-56 p-3 rounded-2xl bg-[#141422] border border-slate-700 shadow-2xl z-50 space-y-3 animate-fade-in text-xs">
            {/* Header info */}
            <div className="flex items-center space-x-2.5 pb-2.5 border-b border-slate-800">
              <img
                src={user.avatarUrl}
                alt={user.username}
                className="w-10 h-10 rounded-xl object-cover border border-pink-500/60"
              />
              <div className="min-w-0">
                <p className="font-bold text-slate-100 truncate text-sm">{user.username}</p>
                <p className="text-[10px] font-mono text-pink-400">osu! Linked Player</p>
              </div>
            </div>

            {/* Cloud Sync Action */}
            <button
              onClick={async () => {
                await syncNow();
                setShowDropdown(false);
              }}
              className="w-full flex items-center justify-between p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
            >
              <div className="flex items-center space-x-2">
                <Cloud className="w-3.5 h-3.5 text-cyan-400" />
                <span>Sync to Cloud</span>
              </div>
              <span className="text-[10px] font-mono text-emerald-400">
                {syncStatus === 'synced' ? 'Synced' : 'Sync'}
              </span>
            </button>

            {/* Logout Action */}
            <button
              onClick={() => {
                logout();
                setShowDropdown(false);
              }}
              className="w-full flex items-center space-x-2 p-2 rounded-xl text-rose-400 hover:bg-rose-950/40 transition-colors font-semibold"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log out</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
};
