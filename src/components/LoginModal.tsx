import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { X, User, Check, ExternalLink, Settings, AlertTriangle } from 'lucide-react';
import { sfx } from '../audio/sfx';

export const LoginModal: React.FC = () => {
  const {
    isLoginModalOpen,
    closeLoginModal,
    loginWithOsu,
    quickLoginWithUsername,
    cloudEndpoint,
    updateCloudEndpoint,
    oauthError,
  } = useAuth();

  const [usernameInput, setUsernameInput] = useState('');
  const [endpointInput, setEndpointInput] = useState(cloudEndpoint);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavedMessage, setIsSavedMessage] = useState(false);

  if (!isLoginModalOpen) return null;

  const handleQuickConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameInput.trim()) return;
    setIsSubmitting(true);
    sfx.playClick();
    await quickLoginWithUsername(usernameInput.trim());
    setIsSubmitting(false);
    closeLoginModal();
  };

  const handleSaveEndpoint = () => {
    updateCloudEndpoint(endpointInput);
    sfx.playClick();
    setIsSavedMessage(true);
    setTimeout(() => setIsSavedMessage(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md my-auto max-h-[92vh] flex flex-col rounded-3xl bg-[#131322] border border-slate-700 shadow-2xl overflow-hidden">
        {/* Ambient Top Glow */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 bg-[#ff66aa]/20 rounded-full blur-3xl pointer-events-none" />

        {/* Scrollable Content Container */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto custom-scrollbar relative z-10">
          {/* Modal Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-2xl bg-[#ff66aa] flex items-center justify-center text-white font-black text-lg shadow-lg shadow-[#ff66aa]/40 flex-shrink-0">
                o!
              </div>
              <div>
                <h2 className="text-lg font-black text-white uppercase tracking-tight font-display">
                  osu! Profile & Cloud Save
                </h2>
                <p className="text-xs text-slate-400 font-mono">Sync collection across devices</p>
              </div>
            </div>

            <button
              onClick={closeLoginModal}
              className="p-2 rounded-full bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* OAuth Error Alert if any */}
          {oauthError && (
            <div className="p-3 rounded-2xl bg-rose-950/60 border border-rose-500/50 text-rose-200 text-xs space-y-1">
              <div className="flex items-center space-x-1.5 font-bold text-rose-300">
                <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                <span>OAuth Connection Notice</span>
              </div>
              <p className="leading-relaxed">{oauthError}</p>
            </div>
          )}

          {/* Primary Option: Official osu! OAuth Login */}
          <div className="space-y-2">
            <button
              onClick={() => {
                sfx.playClick();
                loginWithOsu();
              }}
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-[#ff66aa] to-[#ff4081] hover:from-[#ff529a] hover:to-[#f50057] text-white font-black text-sm uppercase tracking-wider flex items-center justify-center space-x-2 shadow-lg shadow-pink-600/30 transition-all hover:scale-[1.02] select-none"
            >
              <span>Login with osu! Account</span>
              <ExternalLink className="w-4 h-4" />
            </button>
            <p className="text-[11px] text-center text-slate-400 font-sans">
              Redirects to official osu.ppy.sh OAuth to authorize and load your avatar & cloud save.
            </p>
          </div>

          {/* Divider */}
          <div className="flex items-center space-x-3 text-xs font-mono text-slate-500">
            <div className="flex-grow h-px bg-slate-800" />
            <span>OR INSTANT LINK</span>
            <div className="flex-grow h-px bg-slate-800" />
          </div>

          {/* Secondary Option: Quick Username Connect */}
          <form onSubmit={handleQuickConnect} className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
                <User className="w-3.5 h-3.5 text-cyan-400" />
                <span>Link by osu! Username</span>
              </label>
              <input
                type="text"
                placeholder="e.g. mrekk, WhiteCat, Afterlight0338"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-pink-500 text-slate-100 text-sm focus:outline-none transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={!usernameInput.trim() || isSubmitting}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-2 transition-all select-none"
            >
              <span>Connect Profile & Sync</span>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            </button>
          </form>

          {/* Advanced Cloudflare Worker Settings */}
          <div className="pt-2 border-t border-slate-800/80 text-xs">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-[11px] text-slate-400 hover:text-slate-200 transition-colors flex items-center space-x-1"
            >
              <Settings className="w-3 h-3" />
              <span>{showAdvanced ? 'Hide Worker Settings' : 'Advanced: Cloudflare Worker API URL'}</span>
            </button>

            {showAdvanced && (
              <div className="mt-3 p-3 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2 animate-fade-in">
                <label className="text-[10px] font-mono text-slate-400 block">
                  Cloudflare Worker Endpoint:
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    placeholder="https://your-worker.workers.dev"
                    value={endpointInput}
                    onChange={(e) => setEndpointInput(e.target.value)}
                    className="flex-grow px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-xs font-mono focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleSaveEndpoint}
                    className="px-3 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs flex-shrink-0"
                  >
                    Save
                  </button>
                </div>
                {isSavedMessage && (
                  <p className="text-[10px] text-emerald-400 font-mono">
                    ✓ Worker URL updated successfully!
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
