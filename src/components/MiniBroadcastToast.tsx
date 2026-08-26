import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { sfx } from '../audio/sfx';
import {
  Bell,
  X,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Zap,
} from 'lucide-react';

export interface MiniBroadcastData {
  id: string;
  badge?: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'tip' | 'event';
  linkUrl?: string;
  linkText?: string;
  active: boolean;
  publishedAt: string;
  expiresAt?: string;
}

export const MiniBroadcastToast: React.FC = () => {
  const [broadcast, setBroadcast] = useState<MiniBroadcastData | null>(null);
  const [isVisible, setIsVisible] = useState<boolean>(false);

  useEffect(() => {
    async function checkMiniBroadcast() {
      try {
        const { data, error } = await supabase
          .from('admin_config')
          .select('value')
          .eq('key', 'mini_broadcast')
          .maybeSingle();

        if (data && data.value && data.value.active && !error) {
          const b: MiniBroadcastData = data.value;

          // Check expiration
          if (b.expiresAt && new Date(b.expiresAt).getTime() < Date.now()) {
            return;
          }

          setBroadcast(b);

          // Check if already dismissed by user
          const dismissedId = localStorage.getItem('dismissed_mini_broadcast_id');
          if (dismissedId !== b.id) {
            setIsVisible(true);
          }
        }
      } catch (err) {
        console.warn('Error fetching mini broadcast:', err);
      }
    }

    checkMiniBroadcast();

    // Poll every 30 seconds for live mini broadcasts
    const interval = setInterval(checkMiniBroadcast, 30000);
    return () => clearInterval(interval);
  }, []);

  if (!broadcast || !isVisible || !broadcast.active) return null;

  const handleDismiss = () => {
    sfx.playClick();
    localStorage.setItem('dismissed_mini_broadcast_id', broadcast.id);
    setIsVisible(false);
  };

  const isTip = broadcast.type === 'tip';
  const isWarning = broadcast.type === 'warning';
  const isSuccess = broadcast.type === 'success';
  const isEvent = broadcast.type === 'event';

  return createPortal(
    <div className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-[9990] max-w-sm w-[calc(100vw-2rem)] animate-slide-up">
      <div
        className={`p-4 rounded-2xl backdrop-blur-xl border shadow-2xl transition-all duration-300 ${
          isWarning
            ? 'bg-amber-950/90 border-amber-500/80 text-amber-200 shadow-amber-950/50'
            : isSuccess
            ? 'bg-emerald-950/90 border-emerald-500/80 text-emerald-200 shadow-emerald-950/50'
            : isEvent
            ? 'bg-purple-950/90 border-purple-500/80 text-purple-200 shadow-purple-950/50'
            : 'bg-slate-900/95 border-cyan-500/70 text-slate-100 shadow-black/80'
        }`}
      >
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex items-start space-x-2.5 min-w-0">
            <div
              className={`p-2 rounded-xl flex-shrink-0 mt-0.5 ${
                isWarning
                  ? 'bg-amber-500/20 text-amber-400'
                  : isSuccess
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : isEvent
                  ? 'bg-purple-500/20 text-purple-400'
                  : 'bg-cyan-500/20 text-cyan-400'
              }`}
            >
              {isWarning ? (
                <AlertTriangle className="w-4 h-4" />
              ) : isSuccess ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : isEvent ? (
                <Zap className="w-4 h-4 animate-pulse" />
              ) : isTip ? (
                <Sparkles className="w-4 h-4" />
              ) : (
                <Bell className="w-4 h-4" />
              )}
            </div>

            <div className="space-y-1 min-w-0">
              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                <span
                  className={`text-[10px] font-mono font-black uppercase px-2 py-0.5 rounded-full border ${
                    isWarning
                      ? 'bg-amber-900/60 border-amber-500 text-amber-300'
                      : isSuccess
                      ? 'bg-emerald-900/60 border-emerald-500 text-emerald-300'
                      : isEvent
                      ? 'bg-purple-900/60 border-purple-400 text-purple-300 animate-pulse'
                      : 'bg-cyan-950 border-cyan-400 text-cyan-300'
                  }`}
                >
                  {broadcast.badge || 'Admin Note'}
                </span>
              </div>

              <p className="text-xs font-sans text-slate-200 leading-snug">
                {broadcast.message}
              </p>

              {broadcast.linkUrl && (
                <a
                  href={broadcast.linkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-1 text-[11px] font-mono text-cyan-300 hover:text-cyan-200 underline pt-0.5"
                >
                  <span>{broadcast.linkText || 'Learn More'}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>

          <button
            onClick={handleDismiss}
            className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors flex-shrink-0"
            title="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
