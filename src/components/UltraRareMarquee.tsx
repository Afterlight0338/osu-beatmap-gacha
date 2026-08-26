import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Beatmap, RarityTier } from '../types/beatmap';
import { Sparkles, Crown, Gem, Zap, ChevronUp, ChevronDown } from 'lucide-react';
import { sfx } from '../audio/sfx';

export interface UltraRareDropEvent {
  id: string;
  username: string;
  osuId: number;
  avatarUrl?: string;
  beatmap: {
    id: number;
    beatmapsetId: number;
    title: string;
    artist: string;
    version: string;
    rarity: RarityTier;
    stars: number;
    coverUrl: string;
  };
  pulledAt: number;
}

interface UltraRareMarqueeProps {
  onSelectBeatmap?: (beatmap: Beatmap) => void;
}

export const UltraRareMarquee: React.FC<UltraRareMarqueeProps> = ({ onSelectBeatmap }) => {
  const [drops, setDrops] = useState<UltraRareDropEvent[]>([]);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('ultra_rare_marquee_collapsed') === 'true';
  });

  useEffect(() => {
    // 1. Initial fetch from admin_config
    const fetchRecentDrops = async () => {
      try {
        const { data } = await supabase
          .from('admin_config')
          .select('value')
          .eq('key', 'rare_drop_ticker')
          .maybeSingle();

        if (data?.value && Array.isArray(data.value)) {
          setDrops(data.value as UltraRareDropEvent[]);
        }
      } catch {}
    };

    fetchRecentDrops();

    // 2. Real-time broadcast listener
    const channel = supabase.channel('global_chat_channel');
    channel.on('broadcast', { event: 'ultra_rare_pull' }, (payload: { payload: UltraRareDropEvent }) => {
      if (payload?.payload && payload.payload.beatmap) {
        setDrops((prev) => {
          const updated = [payload.payload, ...prev.filter((d) => d.id !== payload.payload.id)].slice(0, 30);
          return updated;
        });
      }
    });

    return () => {
      // Keep channel alive if shared
    };
  }, []);

  const formatTimeAgo = (ts: number): string => {
    const elapsed = Math.max(0, Date.now() - ts);
    const secs = Math.floor(elapsed / 1000);
    if (secs < 60) return 'Just now';
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const getRarityBadge = (rarity: RarityTier) => {
    if (rarity === 'GOAT') {
      return {
        icon: Crown,
        label: 'GOAT',
        border: 'border-yellow-400/80',
        bg: 'bg-gradient-to-r from-yellow-500/30 via-amber-500/20 to-yellow-600/30',
        text: 'text-yellow-300',
        glow: 'shadow-yellow-500/30',
      };
    }
    if (rarity === 'EX') {
      return {
        icon: Gem,
        label: 'EX SPECIAL',
        border: 'border-purple-400/80',
        bg: 'bg-gradient-to-r from-purple-500/30 via-pink-500/20 to-indigo-600/30',
        text: 'text-purple-300',
        glow: 'shadow-purple-500/30',
      };
    }
    // Divine
    return {
      icon: Sparkles,
      label: 'DIVINE',
      border: 'border-pink-400/80',
      bg: 'bg-gradient-to-r from-pink-500/30 via-purple-500/20 to-cyan-500/30',
      text: 'text-pink-300',
      glow: 'shadow-pink-500/30',
    };
  };

  // Duplicate list to achieve continuous seamless loop
  const displayDrops = useMemo(() => {
    if (drops.length === 0) return [];
    if (drops.length === 1) return [...drops, ...drops, ...drops, ...drops];
    if (drops.length < 5) return [...drops, ...drops, ...drops];
    return [...drops, ...drops];
  }, [drops]);

  if (drops.length === 0) return null;

  const toggleCollapse = () => {
    sfx.playClick();
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('ultra_rare_marquee_collapsed', String(next));
      return next;
    });
  };

  return (
    <div className="w-full bg-[#0a0a12]/95 border-y border-pink-500/20 backdrop-blur-md relative z-20 select-none overflow-hidden transition-all duration-300">
      <div className="max-w-7xl mx-auto flex items-center h-9 sm:h-10 px-2 sm:px-4">
        {/* Fixed Left Header Label */}
        <div className="flex items-center space-x-1.5 pr-3 sm:pr-4 border-r border-slate-800 flex-shrink-0 z-10 bg-[#0a0a12] py-1 shadow-lg">
          <div className="w-2 h-2 rounded-full bg-pink-500 animate-ping" />
          <span className="text-[10px] sm:text-[11px] font-mono font-black tracking-wider uppercase text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-purple-300 to-amber-300 flex items-center space-x-1">
            <Zap className="w-3 h-3 text-amber-400 inline" />
            <span>LUCKY DROPS</span>
          </span>
        </div>

        {/* Marquee Content */}
        {!isCollapsed ? (
          <div className="flex-1 overflow-hidden relative mx-2">
            {/* Edge Gradients for Smooth In/Out Fade */}
            <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-[#0a0a12] to-transparent z-10 pointer-events-none" />
            <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-[#0a0a12] to-transparent z-10 pointer-events-none" />

            <div className="animate-marquee flex items-center space-x-6 sm:space-x-8 py-0.5">
              {displayDrops.map((drop, idx) => {
                const badge = getRarityBadge(drop.beatmap.rarity);
                const BadgeIcon = badge.icon;

                return (
                  <div
                    key={`${drop.id}-${idx}`}
                    onClick={() => {
                      if (onSelectBeatmap) {
                        sfx.playClick();
                        onSelectBeatmap(drop.beatmap as any);
                      }
                    }}
                    className={`flex items-center space-x-2 px-2.5 py-1 rounded-full border ${badge.border} ${badge.bg} text-xs font-mono transition-all hover:scale-105 cursor-pointer shadow-sm ${badge.glow} flex-shrink-0 group`}
                  >
                    {/* User Avatar */}
                    {drop.avatarUrl ? (
                      <img
                        src={drop.avatarUrl}
                        alt=""
                        className="w-4 h-4 sm:w-5 sm:h-5 rounded-full border border-slate-700 object-cover"
                      />
                    ) : (
                      <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-slate-800 text-[9px] font-bold text-white flex items-center justify-center">
                        {drop.username.slice(0, 1)}
                      </div>
                    )}

                    <span className="font-bold text-white group-hover:text-pink-300 transition-colors">
                      {drop.username}
                    </span>

                    <span className="text-slate-500 text-[11px]">pulled</span>

                    {/* Rarity Tag */}
                    <span
                      className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase flex items-center space-x-1 ${badge.text} bg-black/60 border ${badge.border}`}
                    >
                      <BadgeIcon className="w-2.5 h-2.5" />
                      <span>{badge.label}</span>
                    </span>

                    {/* Beatmap Cover Thumbnail */}
                    <div className="w-5 h-4 rounded overflow-hidden bg-slate-900 border border-slate-700 flex-shrink-0">
                      <img src={drop.beatmap.coverUrl} alt="" className="w-full h-full object-cover" />
                    </div>

                    <span className="text-slate-200 font-bold max-w-[140px] sm:max-w-[200px] truncate">
                      {drop.beatmap.title}
                    </span>

                    <span className="text-amber-400 font-bold text-[10px]">
                      ★{drop.beatmap.stars.toFixed(2)}
                    </span>

                    <span className="text-[10px] text-slate-500 font-normal">
                      • {formatTimeAgo(drop.pulledAt)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex-1 px-3 text-[11px] font-mono text-slate-500 italic">
            Lucky drops ticker paused. Click expand to view live ultra-rare summons.
          </div>
        )}

        {/* Right Toggle Button */}
        <button
          onClick={toggleCollapse}
          className="p-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-colors flex-shrink-0 ml-2"
          title={isCollapsed ? 'Expand Ticker' : 'Minimize Ticker'}
        >
          {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
};
