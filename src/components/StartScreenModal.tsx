import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Disc, ShieldAlert, LogIn, Play, ChevronDown, ChevronUp, Heart } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { sfx } from '../audio/sfx';
import { KofiIcon, SociabuzzIcon } from './DonationIcons';

const HAS_SEEN_WELCOME_KEY = 'osu_gacha_has_seen_welcome_v1';

interface StartScreenModalProps {
  forceOpen?: boolean;
  onClose?: () => void;
}

export const StartScreenModal: React.FC<StartScreenModalProps> = ({
  forceOpen = false,
  onClose,
}) => {
  const { user, loginWithOsu, isAuthenticated } = useAuth();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [showDisclaimer, setShowDisclaimer] = useState<boolean>(false);

  useEffect(() => {
    if (forceOpen) {
      setIsOpen(true);
      return;
    }

    const hasSeen = localStorage.getItem(HAS_SEEN_WELCOME_KEY);
    // If not seen yet, show splash screen
    if (!hasSeen) {
      setIsOpen(true);
    }
  }, [forceOpen]);

  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleStartLocalSession = () => {
    sfx.playClick();
    localStorage.setItem(HAS_SEEN_WELCOME_KEY, 'true');
    setIsOpen(false);
    if (onClose) onClose();
  };

  const handleLogin = () => {
    sfx.playClick();
    localStorage.setItem(HAS_SEEN_WELCOME_KEY, 'true');
    loginWithOsu();
  };

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-5 bg-black/90 backdrop-blur-xl animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-xl my-auto rounded-3xl bg-[#0e0e18] border border-pink-500/30 shadow-2xl shadow-pink-950/40 flex flex-col overflow-hidden animate-scale-up">
        {/* Glowing Ambient Top Highlight */}
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500" />

        {/* Hero Banner Header */}
        <div className="pt-8 pb-4 px-6 text-center space-y-3 relative">
          <div className="relative inline-block mx-auto">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-pink-500 via-rose-500 to-purple-600 p-0.5 shadow-xl shadow-pink-500/30 flex items-center justify-center">
              <div className="w-full h-full rounded-[14px] bg-[#0c0c16] flex items-center justify-center">
                <Disc className="w-8 h-8 sm:w-10 sm:h-10 text-pink-400 animate-spin-slow" />
              </div>
            </div>
            <div className="absolute -bottom-1 -right-1 px-2 py-0.5 rounded-full bg-pink-500 text-white font-mono text-[9px] font-bold tracking-wider shadow-md">
              v6.0
            </div>
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight font-display">
              osu! Beatmap Gacha
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 font-sans max-w-md mx-auto leading-relaxed">
              17+ years of ranked osu! mapping history reimagined as an interactive rhythm card simulation.
            </p>
          </div>
        </div>

        {/* Action Pathways */}
        <div className="px-6 py-4 space-y-3.5">
          {/* Option 1: Login with osu! */}
          <button
            onClick={handleLogin}
            className="w-full group flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-bold transition-all shadow-lg shadow-pink-600/30 hover:scale-[1.01] active:scale-[0.99]"
          >
            <div className="flex items-center space-x-3.5 text-left">
              <div className="p-2.5 rounded-xl bg-white/20 text-white group-hover:scale-110 transition-transform">
                <LogIn className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm sm:text-base font-display">
                    {isAuthenticated && user ? `Continue as ${user.username}` : 'Log in with osu!'}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/25 text-white uppercase tracking-wider">
                    Recommended
                  </span>
                </div>
                <p className="text-[11px] text-pink-100/80 font-mono font-normal">
                  Automatic Supabase cloud backup, cross-device sync & leaderboard
                </p>
              </div>
            </div>
          </button>

          {/* Option 2: Start a Local Session */}
          <button
            onClick={handleStartLocalSession}
            className="w-full group flex items-center justify-between p-4 rounded-2xl bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 hover:border-slate-700 text-slate-200 hover:text-white font-bold transition-all shadow-md hover:scale-[1.01] active:scale-[0.99]"
          >
            <div className="flex items-center space-x-3.5 text-left">
              <div className="p-2.5 rounded-xl bg-slate-800 text-cyan-400 group-hover:scale-110 transition-transform">
                <Play className="w-5 h-5 fill-cyan-400/20" />
              </div>
              <div>
                <span className="text-sm sm:text-base font-display">
                  Start Local Session (Guest)
                </span>
                <p className="text-[11px] text-slate-400 font-mono font-normal">
                  Jump right in immediately. Stored locally in your browser IndexedDB
                </p>
              </div>
            </div>
          </button>

          {/* Quick Feature Highlights */}
          <div className="grid grid-cols-3 gap-2 pt-1 text-center">
            <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <span className="block font-mono text-xs font-bold text-pink-400">50,000+</span>
              <span className="text-[10px] text-slate-500">Ranked Maps</span>
            </div>
            <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <span className="block font-mono text-xs font-bold text-purple-400">10 Tiers</span>
              <span className="text-[10px] text-slate-500">Common to GOAT</span>
            </div>
            <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <span className="block font-mono text-xs font-bold text-cyan-400">0% P2W</span>
              <span className="text-[10px] text-slate-500">100% Free</span>
            </div>
          </div>

          {/* Expandable About, AI & Legal Disclaimer Accordion */}
          <div className="rounded-2xl bg-slate-950/80 border border-slate-800 overflow-hidden">
            <button
              onClick={() => {
                sfx.playClick();
                setShowDisclaimer(!showDisclaimer);
              }}
              className="w-full flex items-center justify-between p-3.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              <div className="flex items-center space-x-2 font-mono">
                <ShieldAlert className="w-4 h-4 text-cyan-400" />
                <span>AI Disclaimer, About, Legal & Fair Play</span>
              </div>
              {showDisclaimer ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>

            {showDisclaimer && (
              <div className="p-4 pt-1 text-[11px] text-slate-400 space-y-2.5 border-t border-slate-900 leading-relaxed animate-fade-in font-sans">
                <div className="p-2.5 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-cyan-200 space-y-1">
                  <p className="font-bold text-cyan-300 flex items-center space-x-1.5 font-mono text-[11px]">
                    <span>🤖</span>
                    <span>AI & Automated Systems Disclaimer</span>
                  </p>
                  <p className="text-[10.5px] leading-relaxed text-cyan-200/90 font-sans">
                    This project utilizes Artificial Intelligence and machine-learning algorithms to assist in code generation, tier calculations, popularity curve modeling, and dynamic gacha balancing. All beatmap data, gameplay concepts, music compositions, and artworks originate from human osu! community mappers, composers, and artists.
                  </p>
                </div>

                <p>
                  <strong>Unofficial Fan Project:</strong> osu! Beatmap Gacha is an open-source non-profit demonstration and is not affiliated with, endorsed, or sponsored by osu! or ppy Pty Ltd.
                </p>
                <p>
                  <strong>Zero Monetization:</strong> There are no microtransactions or real-world money elements. In-game stamina carries zero monetary value and cannot be purchased.
                </p>
                <p>
                  <strong>Creator Attribution:</strong> All beatmap artwork, audio clips, and metadata remain the property of their respective artists and mappers. Previews are streamed directly via official osu! media endpoints.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer Support Links */}
        <div className="px-6 py-3.5 border-t border-slate-900 bg-slate-950/60 flex items-center justify-between text-[11px] font-mono text-slate-400">
          <span className="flex items-center space-x-1.5 text-slate-500">
            <Heart className="w-3.5 h-3.5 text-pink-500" />
            <span>Support Developer:</span>
          </span>

          <div className="flex items-center space-x-3">
            <a
              href="https://ko-fi.com/afterlight_0338"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-1 text-[#ff5e5b] hover:underline"
            >
              <KofiIcon className="w-3.5 h-3.5" />
              <span>Ko-fi</span>
            </a>
            <span>•</span>
            <a
              href="https://sociabuzz.com/afterlight/tribe"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-1 text-[#00d285] hover:underline"
            >
              <SociabuzzIcon className="w-3.5 h-3.5" />
              <span>SociaBuzz</span>
            </a>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
