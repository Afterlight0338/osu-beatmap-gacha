import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { sfx } from '../audio/sfx';
import {
  X,
  Sparkles,
  Zap,
  Gift,
  Info,
  CheckCircle2,
} from 'lucide-react';

export interface AnnouncementData {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'event' | 'update' | 'giveaway';
  bonusStamina?: number;
  active: boolean;
  publishedAt: string;
  expiresAt?: string;
}

interface AnnouncementModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  onClaimBonus?: (amount: number) => void;
}

export const AnnouncementModal: React.FC<AnnouncementModalProps> = ({
  isOpen: propIsOpen,
  onClose: propOnClose,
  onClaimBonus,
}) => {
  const [announcement, setAnnouncement] = useState<AnnouncementData | null>(null);
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [isClaimed, setIsClaimed] = useState<boolean>(false);

  // Fetch active announcement from Supabase
  useEffect(() => {
    async function checkAnnouncement() {
      try {
        const { data, error } = await supabase
          .from('admin_config')
          .select('value')
          .eq('key', 'active_announcement')
          .maybeSingle();

        if (data && data.value && data.value.active && !error) {
          const ann: AnnouncementData = data.value;

          // Check expiration
          if (ann.expiresAt && new Date(ann.expiresAt).getTime() < Date.now()) {
            return;
          }

          setAnnouncement(ann);

          // Check if already dismissed
          const dismissedId = localStorage.getItem('dismissed_announcement_id');
          if (dismissedId !== ann.id || propIsOpen) {
            setIsVisible(true);
          }

          // Check if bonus claimed
          const claimedId = localStorage.getItem(`claimed_announcement_${ann.id}`);
          if (claimedId) {
            setIsClaimed(true);
          }
        }
      } catch (err) {
        console.warn('Error fetching announcement:', err);
      }
    }

    checkAnnouncement();
  }, [propIsOpen]);

  const handleDismiss = () => {
    sfx.playClick();
    if (announcement) {
      localStorage.setItem('dismissed_announcement_id', announcement.id);
    }
    setIsVisible(false);
    if (propOnClose) propOnClose();
  };

  const handleClaim = () => {
    if (!announcement || !announcement.bonusStamina || isClaimed) return;
    sfx.playRarityReveal('Legendary');
    if (onClaimBonus) {
      onClaimBonus(announcement.bonusStamina);
    }
    setIsClaimed(true);
    localStorage.setItem(`claimed_announcement_${announcement.id}`, 'true');
  };

  if (!isVisible || !announcement) return null;

  const getTypeStyles = () => {
    switch (announcement.type) {
      case 'event':
        return {
          icon: <Sparkles className="w-5 h-5 text-amber-400" />,
          badge: '🎉 Special Event',
          border: 'border-amber-500/40',
          badgeBg: 'bg-amber-950 text-amber-300 border-amber-500/40',
        };
      case 'giveaway':
        return {
          icon: <Gift className="w-5 h-5 text-pink-400" />,
          badge: '🎁 Free Gift',
          border: 'border-pink-500/40',
          badgeBg: 'bg-pink-950 text-pink-300 border-pink-500/40',
        };
      case 'update':
        return {
          icon: <Zap className="w-5 h-5 text-cyan-400" />,
          badge: '⚡ Update Note',
          border: 'border-cyan-500/40',
          badgeBg: 'bg-cyan-950 text-cyan-300 border-cyan-500/40',
        };
      default:
        return {
          icon: <Info className="w-5 h-5 text-purple-400" />,
          badge: '📢 Notice',
          border: 'border-purple-500/40',
          badgeBg: 'bg-purple-950 text-purple-300 border-purple-500/40',
        };
    }
  };

  const styles = getTypeStyles();

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div
        className={`relative w-full max-w-lg rounded-t-3xl sm:rounded-2xl bg-[#11111d] border-t sm:border ${styles.border} shadow-2xl p-6 space-y-4 animate-slide-up sm:animate-scale-up`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
              {styles.icon}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${styles.badgeBg}`}>
                  {styles.badge}
                </span>
                <span className="text-[10px] font-mono text-slate-500">
                  {new Date(announcement.publishedAt).toLocaleDateString()}
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-white tracking-wide font-display mt-0.5">
                {announcement.title}
              </h3>
            </div>
          </div>

          <button
            onClick={handleDismiss}
            className="p-1.5 rounded-full bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Message */}
        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 max-h-60 overflow-y-auto">
          <p className="text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-line font-sans">
            {announcement.message}
          </p>
        </div>

        {/* Free Bonus Stamina Reward Box if attached */}
        {announcement.bonusStamina && announcement.bonusStamina > 0 && (
          <div className="p-4 rounded-xl bg-gradient-to-r from-amber-950/50 via-slate-950 to-pink-950/50 border border-amber-500/40 flex items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                <Zap className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <p className="text-xs font-bold text-white font-mono">
                  Special Bonus Stamina Gift!
                </p>
                <p className="text-[11px] text-amber-300 font-mono">
                  +{announcement.bonusStamina} Free Pull Stamina
                </p>
              </div>
            </div>

            {isClaimed ? (
              <span className="flex items-center space-x-1 text-xs font-bold font-mono text-emerald-400 px-3 py-1.5 rounded-xl bg-emerald-950/80 border border-emerald-500/40">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Claimed!</span>
              </span>
            ) : (
              <button
                onClick={handleClaim}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/30 transition-transform active:scale-95"
              >
                Claim Now
              </button>
            )}
          </div>
        )}

        {/* Action Button */}
        <div className="pt-1">
          <button
            onClick={handleDismiss}
            className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-bold border border-slate-700 transition-colors"
          >
            Got it, thanks!
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
