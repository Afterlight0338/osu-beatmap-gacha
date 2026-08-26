import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { isAdmin } from '../config/admin';
import { MAINTENANCE_CONFIG } from '../config/maintenance';
import { sfx } from '../audio/sfx';
import { supabase } from '../lib/supabase';
import {
  Wrench,
  Disc,
  Sparkles,
  ShieldCheck,
  Clock,
  RefreshCw,
  Crown,
  ArrowRight,
  Radio,
  ExternalLink,
} from 'lucide-react';

interface MaintenancePageProps {
  config?: {
    enabled?: boolean;
    title?: string;
    headline?: string;
    message?: string;
    estimatedTime?: string;
  };
  onBypass?: () => void;
}

export const MaintenancePage: React.FC<MaintenancePageProps> = ({ config, onBypass }) => {
  const { user, isAuthenticated, loginWithOsu, logout } = useAuth();
  const [isChecking, setIsChecking] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const userIsAdmin = isAdmin(user?.username);

  const headline = config?.headline || MAINTENANCE_CONFIG.headline;
  const message = config?.message || MAINTENANCE_CONFIG.message;
  const estimatedTime = config?.estimatedTime || MAINTENANCE_CONFIG.estimatedTime;

  const handleRefreshCheck = async () => {
    sfx.playClick();
    setIsChecking(true);
    setStatusMessage(null);

    try {
      const { data } = await supabase.from('admin_config').select('value').eq('key', 'maintenance_mode').maybeSingle();
      if (data && data.value && data.value.enabled === false) {
        setStatusMessage('🟢 Maintenance complete! Refreshing game...');
        setTimeout(() => {
          window.location.reload();
        }, 1000);
        return;
      }
    } catch {
      // ignore
    }

    setTimeout(() => {
      setIsChecking(false);
      setStatusMessage('Maintenance is still ongoing. Thank you for your patience!');
      setTimeout(() => setStatusMessage(null), 4000);
    }, 1000);
  };

  const handleAdminLogin = () => {
    sfx.playClick();
    loginWithOsu();
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#0d0d15] text-slate-100 p-4 sm:p-6 relative overflow-hidden selection:bg-pink-500 selection:text-white">
      {/* Ambient background glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-pink-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-2/3 right-1/4 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main card */}
      <div className="max-w-xl w-full relative z-10 space-y-6 text-center">
        {/* Animated Brand & Icon */}
        <div className="flex flex-col items-center space-y-4">
          <div className="relative flex items-center justify-center">
            {/* Outer pulsating ring */}
            <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-pink-600/30 to-amber-500/30 border border-pink-500/40 animate-pulse flex items-center justify-center shadow-2xl shadow-pink-500/20" />
            
            {/* Spinning Disc / Gear container */}
            <div className="absolute flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-tr from-pink-600 to-pink-500 border-2 border-pink-300 shadow-lg shadow-pink-600/50">
              <Disc className="w-8 h-8 text-white animate-spin-slow" />
              <Wrench className="w-4 h-4 text-amber-300 absolute -bottom-1 -right-1 bg-slate-900 rounded-full p-0.5 border border-amber-400/80 animate-bounce" />
            </div>

            <Sparkles className="w-5 h-5 text-amber-400 absolute -top-2 -right-2 animate-pulse" />
          </div>

          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-950/60 border border-amber-500/50 text-amber-300 text-xs font-mono mb-2">
              <Radio className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span className="font-bold tracking-wide">MAINTENANCE IN PROGRESS</span>
            </div>

            <h1 className="font-display font-black text-2xl sm:text-4xl text-white tracking-tight">
              osu!<span className="text-pink-500 font-sans">gacha</span>
            </h1>
            <p className="text-sm sm:text-base font-semibold text-slate-300 mt-1">
              {headline}
            </p>
          </div>
        </div>

        {/* Informative Card */}
        <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 backdrop-blur-xl shadow-2xl space-y-5 text-left">
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed whitespace-pre-line">
            {message}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800/80">
            <div className="flex items-start space-x-3 p-3 rounded-2xl bg-slate-950/60 border border-slate-800">
              <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs space-y-0.5">
                <span className="font-bold text-slate-200">Data Safe & Intact</span>
                <p className="text-slate-400 leading-tight text-[11px]">
                  All card collections, pity counters, and pull histories are securely preserved in the cloud.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3 p-3 rounded-2xl bg-slate-950/60 border border-slate-800">
              <Clock className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs space-y-0.5">
                <span className="font-bold text-slate-200">Estimated Duration</span>
                <p className="text-slate-400 leading-tight text-[11px]">
                  {estimatedTime}
                </p>
              </div>
            </div>
          </div>

          {/* Refresh / Check button */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
            <button
              onClick={handleRefreshCheck}
              disabled={isChecking}
              className="w-full sm:w-auto flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-semibold text-xs sm:text-sm shadow-md shadow-pink-600/30 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
              <span>{isChecking ? 'Checking Server Status...' : 'Check Server Status'}</span>
            </button>

            <span className="text-[11px] font-mono text-slate-500 flex items-center space-x-1">
              <span>Domain:</span>
              <span className="text-slate-400 font-bold">gacha.vivlos.dev</span>
            </span>
          </div>

          {statusMessage && (
            <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-800/60 text-amber-300 text-xs font-mono text-center animate-fade-in">
              {statusMessage}
            </div>
          )}
        </div>

        {/* Admin Login / Bypass Section */}
        <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2 text-xs text-slate-400">
            <Crown className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>
              {isAuthenticated ? (
                <span>
                  Logged in as <strong className="text-white">{user?.username}</strong>{' '}
                  {userIsAdmin ? (
                    <span className="text-emerald-400 font-mono font-bold">(Admin Verified)</span>
                  ) : (
                    <span className="text-slate-500 font-mono">(Non-admin)</span>
                  )}
                </span>
              ) : (
                <span>Admin access requires osu! verification.</span>
              )}
            </span>
          </div>

          <div>
            {isAuthenticated ? (
              userIsAdmin ? (
                <button
                  onClick={onBypass}
                  className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/30 transition-transform hover:scale-105"
                >
                  <span>Bypass to Admin Panel</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  onClick={() => {
                    sfx.playClick();
                    logout();
                  }}
                  className="text-xs text-slate-400 hover:text-slate-200 underline"
                >
                  Switch osu! Account
                </button>
              )
            ) : (
              <button
                onClick={handleAdminLogin}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-colors"
              >
                <span>Login with osu!</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center text-[11px] font-mono text-slate-600 space-y-1">
          <p>osu! Beatmap Gacha • Scheduled Maintenance Mode</p>
          <p className="text-[10px] text-slate-700">
            Cloudflare D1 & Workers backend active. Normal service will resume shortly.
          </p>
        </div>
      </div>
    </div>
  );
};

export default MaintenancePage;
