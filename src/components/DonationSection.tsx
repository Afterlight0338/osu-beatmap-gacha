import React from 'react';
import { Heart, ExternalLink, ShieldCheck, Coffee } from 'lucide-react';
import { KofiIcon, SociabuzzIcon } from './DonationIcons';

export const DonationSection: React.FC = () => {
  return (
    <section className="space-y-4">
      <div className="flex items-center space-x-2 text-pink-400 font-mono text-xs font-bold uppercase tracking-wider">
        <Heart className="w-4 h-4 text-pink-500 fill-pink-500/20" />
        <span>Support the Project</span>
      </div>

      <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-slate-900/95 via-slate-900/80 to-[#1b1226]/90 border border-pink-500/30 space-y-5 relative overflow-hidden shadow-xl shadow-pink-950/20">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-pink-500 via-rose-500 to-amber-500" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-pink-500/10 text-pink-400 border border-pink-500/20">
              <Coffee className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white font-display flex items-center gap-2">
                <span>Support Developer & Server Hosting</span>
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Keep osu! Beatmap Gacha fast, ad-free, and online 24/7
              </p>
            </div>
          </div>
        </div>

        {/* Explicit Anti-Pay-to-Win Disclaimer Box */}
        <div className="p-3.5 rounded-xl bg-slate-950/70 border border-amber-500/30 text-amber-200 text-xs flex items-start space-x-3">
          <ShieldCheck className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-amber-300">
              ⚠️ Strict Non-Commercial & Fair-Play Notice:
            </p>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Donations are <strong>100% voluntary</strong> and help cover monthly Cloudflare edge workers, Supabase PostgreSQL database hosting, and domain costs.
              Donating will <strong>NOT alter pull chances, bypass RNG rates, grant paid advantages, or provide premium perks</strong>. Every player enjoys identical gacha rates by design.
            </p>
          </div>
        </div>

        {/* Donation Provider Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
          {/* Ko-fi Card */}
          <a
            href="https://ko-fi.com/afterlight_0338"
            target="_blank"
            rel="noopener noreferrer"
            className="group relative flex items-center justify-between p-4 rounded-xl bg-[#131322] hover:bg-[#1a1a2e] border border-[#ff5e5b]/40 hover:border-[#ff5e5b] transition-all duration-200 shadow-md hover:shadow-lg hover:shadow-[#ff5e5b]/20"
          >
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-xl bg-[#ff5e5b]/15 text-[#ff5e5b] border border-[#ff5e5b]/30 group-hover:scale-105 transition-transform">
                <KofiIcon className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center space-x-1.5">
                  <span className="font-bold text-white text-sm font-display group-hover:text-[#ff7b79] transition-colors">
                    Ko-fi
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#ff5e5b]/20 text-[#ff8e8c]">
                    Global
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-mono">
                  ko-fi.com/afterlight_0338
                </p>
              </div>
            </div>

            <div className="p-2 rounded-lg bg-slate-900 group-hover:bg-[#ff5e5b] text-slate-400 group-hover:text-white transition-colors">
              <ExternalLink className="w-4 h-4" />
            </div>
          </a>

          {/* SociaBuzz Card */}
          <a
            href="https://sociabuzz.com/afterlight/tribe"
            target="_blank"
            rel="noopener noreferrer"
            className="group relative flex items-center justify-between p-4 rounded-xl bg-[#131322] hover:bg-[#1a1a2e] border border-[#00d285]/40 hover:border-[#00d285] transition-all duration-200 shadow-md hover:shadow-lg hover:shadow-[#00d285]/20"
          >
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-xl bg-[#00d285]/15 text-[#00d285] border border-[#00d285]/30 group-hover:scale-105 transition-transform">
                <SociabuzzIcon className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center space-x-1.5">
                  <span className="font-bold text-white text-sm font-display group-hover:text-[#33e0a1] transition-colors">
                    SociaBuzz Tribe
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#00d285]/20 text-[#33e0a1]">
                    MY / ID / SEA
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-mono">
                  sociabuzz.com/afterlight/tribe
                </p>
              </div>
            </div>

            <div className="p-2 rounded-lg bg-slate-900 group-hover:bg-[#00d285] text-slate-400 group-hover:text-white transition-colors">
              <ExternalLink className="w-4 h-4" />
            </div>
          </a>
        </div>
      </div>
    </section>
  );
};
