import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { X, User, Check, Trash2 } from 'lucide-react';
import { sfx } from '../audio/sfx';

export const ProfileModal: React.FC = () => {
  const { user, isProfileModalOpen, closeProfileModal, setPlayerUsername, clearProfile } = useAuth();
  const [usernameInput, setUsernameInput] = useState(user?.username || '');

  if (!isProfileModalOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameInput.trim()) return;
    sfx.playClick();
    setPlayerUsername(usernameInput.trim());
  };

  const handleClear = () => {
    sfx.playClick();
    clearProfile();
    setUsernameInput('');
  };

  const previewAvatar = usernameInput.trim()
    ? `https://a.ppy.sh/${encodeURIComponent(usernameInput.trim())}`
    : user?.avatarUrl;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-sm my-auto rounded-3xl bg-[#131322] border border-slate-700 shadow-2xl overflow-hidden p-5 sm:p-6 space-y-5">
        {/* Ambient Top Glow */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-48 h-48 bg-[#ff66aa]/20 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#ff66aa] flex items-center justify-center text-white font-black text-sm shadow-md shadow-[#ff66aa]/30">
              o!
            </div>
            <div>
              <h2 className="text-base font-black text-white uppercase tracking-tight font-display">
                Player Profile
              </h2>
              <p className="text-[11px] text-slate-400 font-mono">Personalize your gacha account</p>
            </div>
          </div>

          <button
            onClick={closeProfileModal}
            className="p-1.5 rounded-full bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Avatar Preview */}
        <div className="flex flex-col items-center justify-center space-y-2 py-2 relative z-10">
          <div className="relative">
            <img
              src={previewAvatar || 'https://a.ppy.sh/'}
              alt="Avatar"
              className="w-16 h-16 rounded-2xl object-cover border-2 border-pink-500/60 bg-slate-950 shadow-lg shadow-pink-500/20"
              onError={(e) => {
                e.currentTarget.src = 'https://osu.ppy.sh/images/layout/avatar-guest.png';
              }}
            />
          </div>
          <p className="text-xs text-slate-300 font-bold">
            {usernameInput.trim() || user?.username || 'Guest Player'}
          </p>
        </div>

        {/* Username Input Form */}
        <form onSubmit={handleSubmit} className="space-y-3 relative z-10">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
              <User className="w-3.5 h-3.5 text-pink-400" />
              <span>osu! Username</span>
            </label>
            <input
              type="text"
              placeholder="e.g. mrekk, WhiteCat, Afterlight0338"
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-pink-500 text-slate-100 text-sm focus:outline-none transition-colors"
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={!usernameInput.trim()}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 disabled:opacity-40 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-2 shadow-md shadow-pink-600/20 transition-all select-none"
          >
            <span>Save Profile</span>
            <Check className="w-3.5 h-3.5" />
          </button>
        </form>

        {/* Clear profile button if logged in */}
        {user && (
          <div className="pt-2 border-t border-slate-800/80 flex justify-center relative z-10">
            <button
              onClick={handleClear}
              className="text-[11px] text-slate-500 hover:text-rose-400 transition-colors flex items-center space-x-1"
            >
              <Trash2 className="w-3 h-3" />
              <span>Switch to Guest (Clear Profile)</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
