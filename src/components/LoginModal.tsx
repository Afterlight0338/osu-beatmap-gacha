import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { X, User, Check, ExternalLink, Settings } from 'lucide-react';
import { sfx } from '../audio/sfx';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const { loginWithOsu, quickLoginWithUsername, cloudEndpoint, updateCloudEndpoint } = useAuth();
  const [usernameInput, setUsernameInput] = useState('');
  const [endpointInput, setEndpointInput] = useState(cloudEndpoint);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleQuickConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameInput.trim()) return;
    setIsSubmitting(true);
    sfx.playClick();
    await quickLoginWithUsername(usernameInput.trim());
    setIsSubmitting(false);
    onClose();
  };

  const handleSaveEndpoint = () => {
    updateCloudEndpoint(endpointInput);
    sfx.playClick();
    setShowAdvanced(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md rounded-3xl bg-[#131322] border border-slate-700 shadow-2xl p-6 space-y-6 overflow-hidden">
        {/* Ambient Top Glow */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 bg-[#ff66aa]/20 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[#ff66aa] flex items-center justify-center text-white font-black text-lg shadow-lg shadow-[#ff66aa]/40">
              o!
            </div>
            <div>
              <h2 className="text-lg font-black text-white uppercase tracking-tight font-display">
                osu! Profile & Cloud Save
              </h2>
              <p className="text-xs text-slate-400 font-mono">Sync your collection across devices</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Option 1: Official osu! OAuth Login */}
        <div className="space-y-3 relative z-10">
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
          <p className="text-[11px] text-center text-slate-500 font-sans">
            Authorizes via official osu! OAuth 2.0 to link your real avatar & save progress.
          </p>
        </div>

        {/* Divider */}
        <div className="flex items-center space-x-3 text-xs font-mono text-slate-500 relative z-10">
          <div className="flex-grow h-px bg-slate-800" />
          <span>OR INSTANT LINK</span>
          <div className="flex-grow h-px bg-slate-800" />
        </div>

        {/* Option 2: Quick Username Connect */}
        <form onSubmit={handleQuickConnect} className="space-y-3 relative z-10">
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

        {/* Advanced Cloud Endpoint Toggle */}
        <div className="pt-2 border-t border-slate-800/80 text-xs relative z-10">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors flex items-center space-x-1"
          >
            <Settings className="w-3 h-3" />
            <span>Advanced: Cloudflare / Serverless API Config</span>
          </button>

          {showAdvanced && (
            <div className="mt-3 p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2 animate-fade-in">
              <label className="text-[10px] font-mono text-slate-400">
                Custom Worker Endpoint:
              </label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={endpointInput}
                  onChange={(e) => setEndpointInput(e.target.value)}
                  className="flex-grow px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-xs font-mono focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleSaveEndpoint}
                  className="px-3 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs"
                >
                  Save
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
