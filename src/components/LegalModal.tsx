import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ShieldCheck, FileText, Cookie, Scale, ExternalLink } from 'lucide-react';
import { sfx } from '../audio/sfx';

export type LegalTabType = 'terms' | 'privacy' | 'cookies';

interface LegalModalProps {
  initialTab?: LegalTabType | null;
  isOpen: boolean;
  onClose: () => void;
}

export const LegalModal: React.FC<LegalModalProps> = ({
  initialTab = 'terms',
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<LegalTabType>(initialTab || 'terms');

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    if (isOpen) {
      const original = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = original;
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTabChange = (tab: LegalTabType) => {
    sfx.playClick();
    setActiveTab(tab);
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-3xl max-h-[88vh] rounded-2xl bg-[#12121f] border border-slate-800 shadow-2xl flex flex-col overflow-hidden animate-scale-up">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-pink-500/20 text-pink-400 border border-pink-500/30">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white font-display">
                Legal & Privacy Information
              </h2>
              <p className="text-[11px] text-slate-400 font-mono">
                osu! Beatmap Gacha • Unofficial Non-Commercial Fan Project
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              sfx.playClick();
              onClose();
            }}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-4 sm:px-6 gap-2 flex-shrink-0 overflow-x-auto">
          <button
            onClick={() => handleTabChange('terms')}
            className={`flex items-center space-x-2 py-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'terms'
                ? 'border-pink-500 text-pink-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Terms of Service</span>
          </button>

          <button
            onClick={() => handleTabChange('privacy')}
            className={`flex items-center space-x-2 py-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'privacy'
                ? 'border-pink-500 text-pink-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Privacy Policy</span>
          </button>

          <button
            onClick={() => handleTabChange('cookies')}
            className={`flex items-center space-x-2 py-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'cookies'
                ? 'border-pink-500 text-pink-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cookie className="w-4 h-4" />
            <span>Cookies & Storage</span>
          </button>
        </div>

        {/* Modal Body Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 text-slate-300 text-xs sm:text-sm leading-relaxed space-y-5">
          {/* TERMS OF SERVICE */}
          {activeTab === 'terms' && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-3.5 rounded-xl bg-pink-950/30 border border-pink-500/30 text-pink-200 text-xs">
                <strong>Important Notice:</strong> osu! Beatmap Gacha is an open-source, non-commercial fan-made demonstration. It is not affiliated with, maintained, authorized, or sponsored by osu! or ppy Pty Ltd.
              </div>

              <section className="space-y-2">
                <h3 className="text-white font-bold text-sm sm:text-base">1. Acceptance of Terms</h3>
                <p>
                  By accessing and using osu! Beatmap Gacha (the "Service"), you acknowledge that you have read, understood, and agreed to be bound by these Terms of Service. If you do not agree with any part of these terms, you should discontinue using the application.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-white font-bold text-sm sm:text-base">2. Non-Commercial & Entertainment Nature</h3>
                <p>
                  This application is strictly free-to-play for entertainment and archival appreciation purposes. There are <strong>no real-money transactions, microtransactions, pay-to-win elements, or monetization</strong> of any form.
                </p>
                <p>
                  In-game stamina, bonus pulls, and virtual cards carry zero real-world monetary value and cannot be redeemed, traded, or exchanged for real currency.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-white font-bold text-sm sm:text-base">3. Intellectual Property Rights</h3>
                <p>
                  All osu! beatmap artwork, audio preview clips, beatmap metadata, difficulty definitions, and ranking data remain the sole intellectual property of their respective creators, artists, mappers, and rights holders.
                </p>
                <p>
                  Audio snippets and card banners are streamed directly from official osu! CDN sources for preview and fair identification purposes.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-white font-bold text-sm sm:text-base">4. Code & AI Attribution</h3>
                <p>
                  This project was developed with the assistance of AI pair programming agents. All original frontend application code is open-source under the MIT license.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-white font-bold text-sm sm:text-base">5. Disclaimer of Warranties</h3>
                <p>
                  The service is provided on an "as is" and "as available" basis without warranties of any kind. We do not guarantee uninterrupted availability, error-free database synchronization, or long-term permanence of game records.
                </p>
              </section>
            </div>
          )}

          {/* PRIVACY POLICY */}
          {activeTab === 'privacy' && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-3.5 rounded-xl bg-cyan-950/30 border border-cyan-500/30 text-cyan-200 text-xs">
                <strong>Privacy Summary:</strong> We do not collect passwords, real names, emails, billing details, or tracking telemetry. Your privacy is respected by design.
              </div>

              <section className="space-y-2">
                <h3 className="text-white font-bold text-sm sm:text-base">1. Information We Collect</h3>
                <p>
                  When you authenticate using osu! OAuth2, we only retrieve publicly accessible account data provided by the official osu! API:
                </p>
                <ul className="list-disc list-inside space-y-1 text-slate-400 pl-2">
                  <li><strong>osu! User ID</strong> & <strong>Username</strong></li>
                  <li><strong>Public Avatar URL</strong> & <strong>Country Code</strong></li>
                  <li><strong>Global Performance Rank</strong> (for community leaderboards)</li>
                </ul>
              </section>

              <section className="space-y-2">
                <h3 className="text-white font-bold text-sm sm:text-base">2. Gameplay & Collection Data</h3>
                <p>
                  Your virtual gacha rolls, pulled beatmap IDs, pull timestamps, and favorite markers are stored:
                </p>
                <ul className="list-disc list-inside space-y-1 text-slate-400 pl-2">
                  <li><strong>Locally on your device</strong> using browser IndexedDB and LocalStorage.</li>
                  <li><strong>In our cloud database</strong> (Supabase & Cloudflare D1) solely to allow seamless cross-device synchronization and public leaderboard rankings.</li>
                </ul>
              </section>

              <section className="space-y-2">
                <h3 className="text-white font-bold text-sm sm:text-base">3. Third-Party Sharing</h3>
                <p>
                  We do not sell, rent, or monetize your gameplay data with advertisers or commercial third parties. Data is solely used to deliver gacha gameplay functionality.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-white font-bold text-sm sm:text-base">4. Data Deletion & Reset Rights</h3>
                <p>
                  You retain full control over your local and cloud data:
                </p>
                <ul className="list-disc list-inside space-y-1 text-slate-400 pl-2">
                  <li>You can wipe all local storage data anytime via <strong>Settings ➔ Reset Local Collection</strong>.</li>
                  <li>You can log out of your osu! session anytime via the profile menu.</li>
                </ul>
              </section>
            </div>
          )}

          {/* COOKIES & STORAGE */}
          {activeTab === 'cookies' && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/30 text-amber-200 text-xs">
                <strong>Zero Tracking Cookies:</strong> This website does not use third-party advertising cookies, cross-site trackers, or marketing pixels.
              </div>

              <section className="space-y-2">
                <h3 className="text-white font-bold text-sm sm:text-base">1. Essential Local Storage Usage</h3>
                <p>
                  Instead of tracking cookies, we utilize modern browser client storage (<strong>LocalStorage</strong> and <strong>IndexedDB</strong>) for core functionality:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                    <span className="font-mono text-xs font-bold text-pink-400">IndexedDB Storage</span>
                    <p className="text-xs text-slate-400">
                      Caches 50,000+ beatmap metadata entries, your unlocked card collection records, and recent pull history for instant offline loading.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                    <span className="font-mono text-xs font-bold text-cyan-400">Session & Preferences</span>
                    <p className="text-xs text-slate-400">
                      Remembers your volume sliders, SFX mute toggle, active banner preference, rhythm math hourly cooldown, and login session token.
                    </p>
                  </div>
                </div>
              </section>

              <section className="space-y-2">
                <h3 className="text-white font-bold text-sm sm:text-base">2. How to Clear Browser Data</h3>
                <p>
                  You can clear your cached dataset, session, and collection anytime by clearing site cookies/storage in your browser settings or clicking "Reset Collection" in the in-game Settings dialog.
                </p>
              </section>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between flex-shrink-0">
          <a
            href="https://github.com/Afterlight0338/osu-beatmap-gacha"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-1.5 text-xs font-mono text-slate-400 hover:text-white transition-colors"
          >
            <span>GitHub Repository</span>
            <ExternalLink className="w-3 h-3" />
          </a>

          <button
            onClick={() => {
              sfx.playClick();
              onClose();
            }}
            className="py-2 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
