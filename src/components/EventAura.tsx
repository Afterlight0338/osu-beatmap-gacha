import React, { useState, useEffect } from 'react';
import { ActiveEventState } from '../context/GachaContext';
import { Sparkles, Zap, Clock, Gift, Flame } from 'lucide-react';

interface EventAuraProps {
  event: ActiveEventState | null;
}

export const EventAura: React.FC<EventAuraProps> = ({ event }) => {
  const [timeLeft, setTimeLeft] = useState<string>('');

  useEffect(() => {
    if (!event || !event.active) return;

    const updateTime = () => {
      if (!event.expiresAt) {
        setTimeLeft('Ongoing');
        return;
      }
      const ms = new Date(event.expiresAt).getTime() - Date.now();
      if (ms <= 0) {
        setTimeLeft('Ending soon');
        return;
      }
      const h = Math.floor(ms / (1000 * 60 * 60));
      const m = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((ms % (1000 * 60)) / 1000);
      if (h > 0) {
        setTimeLeft(`${h}h ${m}m`);
      } else {
        setTimeLeft(`${m}m ${s}s`);
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [event]);

  if (!event || !event.active) return null;

  return (
    <>
      {/* 1. Subtle, Non-Intrusive Ambient Perimeter Edge Glow */}
      <div className="pointer-events-none fixed inset-0 z-30 transition-opacity duration-1000">
        {/* Soft amber/gold border aura */}
        <div className="absolute inset-0 shadow-[inset_0_0_90px_rgba(245,158,11,0.06),inset_0_0_30px_rgba(168,85,247,0.05)] border border-amber-500/20 pointer-events-none" />
      </div>

      {/* 2. Top Event Ribbon Banner (Clean, elegant, non-intrusive) */}
      <div className="max-w-7xl mx-auto px-2 sm:px-0 mb-4 animate-fade-in">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-950/40 via-purple-950/30 to-amber-950/40 border border-amber-500/40 backdrop-blur-md p-3 sm:p-3.5 shadow-lg shadow-amber-950/20">
          {/* Subtle top shimmer line */}
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className="p-1.5 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-300 flex-shrink-0">
                <Flame className="w-4 h-4 text-amber-400 animate-pulse" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center space-x-2 flex-wrap">
                  <span className="text-[10px] font-mono font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-bold shadow-sm">
                    ✦ LIVE EVENT
                  </span>
                  <h3 className="text-xs sm:text-sm font-bold text-white font-display truncate">
                    {event.name}
                  </h3>
                </div>
                <p className="text-[11px] text-slate-300 font-sans truncate mt-0.5">
                  {event.description}
                </p>
              </div>
            </div>

            {/* Event Perks & Countdown */}
            <div className="flex items-center space-x-2 flex-wrap gap-y-1 flex-shrink-0 self-start sm:self-center">
              {event.fastRecharge && (
                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg bg-amber-950/80 border border-amber-500/50 text-amber-300 text-[11px] font-mono font-bold">
                  <Zap className="w-3 h-3 text-amber-400 animate-pulse" />
                  <span>5s Turbo Stamina</span>
                </span>
              )}

              {event.rateMultiplier > 1 && (
                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg bg-purple-950/80 border border-purple-400/50 text-purple-200 text-[11px] font-mono font-bold">
                  <Sparkles className="w-3 h-3 text-purple-300" />
                  <span>{event.rateMultiplier}x Drop Rates</span>
                </span>
              )}

              {event.bonusDropRate && (
                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg bg-pink-950/80 border border-pink-400/50 text-pink-200 text-[11px] font-mono font-bold">
                  <Gift className="w-3 h-3 text-pink-300" />
                  <span>Bonus Drops</span>
                </span>
              )}

              {timeLeft && (
                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 text-[11px] font-mono">
                  <Clock className="w-3 h-3 text-cyan-400" />
                  <span>{timeLeft}</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
