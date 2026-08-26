import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { isAdmin } from '../config/admin';
import { supabase } from '../lib/supabase';
import { sfx } from '../audio/sfx';
import {
  Info,
  ShieldAlert,
  Bot,
  Sparkles,
  Heart,
  Code2,
  Edit3,
  Save,
  RotateCcw,
  CheckCircle2,
  Layers,
  Globe,
  Disc,
} from 'lucide-react';
import { formatUserDateTime } from '../utils/timeFormat';
import { DonationSection } from '../components/DonationSection';

interface AboutContent {
  disclaimerTitle: string;
  disclaimerText: string;
  aiDisclaimerText: string;
  aboutTitle: string;
  aboutText: string;
  techStackText: string;
  creditsText: string;
  lastUpdatedBy?: string;
  lastUpdatedAt?: string;
}

const DEFAULT_ABOUT_CONTENT: AboutContent = {
  disclaimerTitle: 'Important Legal & Fan-Project Disclaimer',
  disclaimerText:
    'osu! Beatmap Gacha is a free, non-commercial, open-source fan project created purely for entertainment and archival celebration of the rhythm gaming community. It is not affiliated with, endorsed by, sponsored by, or connected in any official capacity with osu! or ppy Pty Ltd.\n\nAll beatmap audio previews, artwork, cover illustrations, background illustrations, beatmapset metadata, and osu! trademarks remain the exclusive intellectual property of their respective artists, mappers, musicians, and copyright holders. No commercial monetization, microtransactions, real-money purchases, or paid advantage exists or will ever exist in this game.',
  aiDisclaimerText:
    'This project was built and architected with AI assistance. The system design, gacha mechanics, Cloudflare Edge Workers, and Supabase PostgreSQL integration were designed and crafted in collaboration with Advanced AI agents (Antigravity by Google DeepMind). All AI-assisted code has been rigorously reviewed, benchmarked, and tuned for performance, privacy, and security.',
  aboutTitle: 'About osu! Beatmap Gacha',
  aboutText:
    'osu! Beatmap Gacha reimagines over 17 years of osu! mapping history (2007 – present) into an interactive collectible card simulation. Explore a curated pool of over 50,000+ ranked beatmaps across various eras, mapped styles, and iconic tournament classics.\n\nPlayers summon cards across multiple rarity tiers (ranging from Common up to the elusive Divine and GOAT singularities), listen to audio previews, build their personal collection, track gacha statistics, and compete on the global collection leaderboard.',
  techStackText:
    '• Frontend: React 18, TypeScript, Tailwind CSS, Vite\n• Offline Storage: IndexedDB (Dexie.js-level client cache)\n• Cloud Sync & DB: Supabase PostgreSQL, Cloudflare Workers (Edge Auth & PostgREST sync)\n• Audio Engine: HTML5 Web Audio API preview player with smart lazy-buffering\n• Authentication: Official osu! OAuth2 Bearer Session Tokens',
  creditsText:
    'Special thanks to the osu! development team (ppy), the Beatconnect & Sayobot mirror networks, and the incredible osu! mapping and music community who have created hundreds of thousands of unforgettable beatmaps over nearly two decades.',
};

export const AboutPage: React.FC = () => {
  const { user } = useAuth();
  const userIsAdmin = isAdmin(user?.username);

  const [content, setContent] = useState<AboutContent>(DEFAULT_ABOUT_CONTENT);
  const [editMode, setEditMode] = useState<boolean>(false);
  const [formData, setFormData] = useState<AboutContent>(DEFAULT_ABOUT_CONTENT);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Load custom about content from Supabase
  useEffect(() => {
    async function loadContent() {
      try {
        const { data, error } = await supabase
          .from('admin_config')
          .select('value')
          .eq('key', 'about_page_content')
          .maybeSingle();

        if (data && data.value && !error) {
          const merged = { ...DEFAULT_ABOUT_CONTENT, ...data.value };
          setContent(merged);
          setFormData(merged);
        }
      } catch (err) {
        console.warn('Failed to fetch custom about content:', err);
      }
    }
    loadContent();
  }, []);

  const handleSave = async () => {
    if (!userIsAdmin) return;
    sfx.playClick();
    setIsSaving(true);
    try {
      const payload: AboutContent = {
        ...formData,
        lastUpdatedBy: user?.username || 'Admin',
        lastUpdatedAt: new Date().toISOString(),
      };

      const { error } = await supabase.from('admin_config').upsert({
        key: 'about_page_content',
        value: payload,
        updated_at: new Date().toISOString(),
      });

      if (!error) {
        setContent(payload);
        setEditMode(false);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 4000);
      } else {
        alert('Failed to save changes: ' + error.message);
      }
    } catch (err: any) {
      alert('Error saving: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefaults = () => {
    sfx.playClick();
    if (confirm('Reset content back to original project defaults?')) {
      setFormData(DEFAULT_ABOUT_CONTENT);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8 pb-16">
      {/* Page Title & Admin Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-md">
        <div className="flex items-center space-x-3">
          <div className="p-3 rounded-xl bg-pink-600/20 border border-pink-500/40 text-pink-400">
            <Info className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-wide font-display">
              About & Legal Disclaimer
            </h1>
            <p className="text-xs text-slate-400 font-mono">
              Project transparency, AI development disclosures, and community attribution
            </p>
          </div>
        </div>

        {/* Admin Edit Controls */}
        {userIsAdmin && (
          <div className="flex items-center space-x-2 w-full sm:w-auto">
            {editMode ? (
              <>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex-1 sm:flex-none flex items-center justify-center space-x-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/30 transition-colors"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
                </button>
                <button
                  onClick={handleResetDefaults}
                  className="flex items-center justify-center space-x-1 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Defaults</span>
                </button>
                <button
                  onClick={() => {
                    setFormData(content);
                    setEditMode(false);
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => {
                  sfx.playClick();
                  setEditMode(true);
                }}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md shadow-purple-600/30 transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Page Content</span>
              </button>
            )}
          </div>
        )}
      </div>

      {saveSuccess && (
        <div className="p-4 rounded-xl bg-emerald-950/70 border border-emerald-500 text-emerald-200 text-xs flex items-center space-x-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>Page content has been saved and updated in the cloud database!</span>
        </div>
      )}

      {/* ========================================================= */}
      {/* 0. SUPPORT & DONATIONS (Ko-fi & SociaBuzz)                */}
      {/* ========================================================= */}
      <DonationSection />

      {/* ========================================================= */}
      {/* 1. DISCLAIMERS SECTION                                    */}
      {/* ========================================================= */}
      <section className="space-y-4">
        <div className="flex items-center space-x-2 text-amber-400 font-mono text-xs font-bold uppercase tracking-wider">
          <ShieldAlert className="w-4 h-4" />
          <span>Disclaimers & Disclosures</span>
        </div>

        {/* Legal & Non-Affiliation Disclaimer Card */}
        <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/90 border border-amber-500/40 space-y-3 relative overflow-hidden shadow-lg shadow-amber-950/20">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-amber-400 to-orange-500" />
          
          <div className="flex items-center space-x-2.5 text-amber-300 font-bold text-base font-display">
            <ShieldAlert className="w-5 h-5 text-amber-400" />
            {editMode ? (
              <input
                type="text"
                value={formData.disclaimerTitle}
                onChange={(e) => setFormData({ ...formData, disclaimerTitle: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white font-sans"
              />
            ) : (
              <span>{content.disclaimerTitle}</span>
            )}
          </div>

          {editMode ? (
            <textarea
              rows={6}
              value={formData.disclaimerText}
              onChange={(e) => setFormData({ ...formData, disclaimerText: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-200 font-mono leading-relaxed"
            />
          ) : (
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed whitespace-pre-line font-sans">
              {content.disclaimerText}
            </p>
          )}
        </div>

        {/* AI-Assisted Development Disclosure Card */}
        <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-purple-950/40 via-slate-900/90 to-indigo-950/40 border border-purple-500/40 space-y-3 relative overflow-hidden shadow-lg shadow-purple-950/20">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-purple-400 to-indigo-500" />

          <div className="flex items-center space-x-2.5 text-purple-300 font-bold text-base font-display">
            <Bot className="w-5 h-5 text-purple-400" />
            <span>AI-Assisted Project Disclosure</span>
          </div>

          {editMode ? (
            <textarea
              rows={5}
              value={formData.aiDisclaimerText}
              onChange={(e) => setFormData({ ...formData, aiDisclaimerText: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-200 font-mono leading-relaxed"
            />
          ) : (
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed whitespace-pre-line font-sans">
              {content.aiDisclaimerText}
            </p>
          )}

          <div className="pt-2 flex flex-wrap gap-2 text-[11px] font-mono text-purple-300/80">
            <span className="px-2 py-0.5 rounded-md bg-purple-900/40 border border-purple-500/30">
              ⚡ Google DeepMind Antigravity Pair-Programming
            </span>
            <span className="px-2 py-0.5 rounded-md bg-purple-900/40 border border-purple-500/30">
              🔒 Open-Source Transparency
            </span>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* 2. ABOUT & OVERVIEW SECTION (AT BOTTOM)                   */}
      {/* ========================================================= */}
      <section className="space-y-4 pt-4 border-t border-slate-800">
        <div className="flex items-center space-x-2 text-pink-400 font-mono text-xs font-bold uppercase tracking-wider">
          <Sparkles className="w-4 h-4" />
          <span>About the Game</span>
        </div>

        {/* Main About Card */}
        <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
          <div className="flex items-center space-x-2.5 text-white font-bold text-lg font-display">
            <Disc className="w-5 h-5 text-pink-400" />
            {editMode ? (
              <input
                type="text"
                value={formData.aboutTitle}
                onChange={(e) => setFormData({ ...formData, aboutTitle: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white font-sans"
              />
            ) : (
              <span>{content.aboutTitle}</span>
            )}
          </div>

          {editMode ? (
            <textarea
              rows={6}
              value={formData.aboutText}
              onChange={(e) => setFormData({ ...formData, aboutText: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-200 font-mono leading-relaxed"
            />
          ) : (
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed whitespace-pre-line font-sans">
              {content.aboutText}
            </p>
          )}

          {/* Quick Pillars */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
              <div className="flex items-center space-x-2 text-pink-400 text-xs font-bold font-mono">
                <Layers className="w-4 h-4" />
                <span>50,000+ Ranked Pool</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Massive curated collection spanning 2007 through 2026.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
              <div className="flex items-center space-x-2 text-purple-400 text-xs font-mono font-bold">
                <Sparkles className="w-4 h-4" />
                <span>9 Rarity Tiers</span>
              </div>
              <p className="text-[11px] text-slate-400">
                From Common to the ultra-rare Divine & GOAT singularities.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
              <div className="flex items-center space-x-2 text-cyan-400 text-xs font-mono font-bold">
                <Globe className="w-4 h-4" />
                <span>Cloud & Offline</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Dual-layer persistence with Supabase PostgreSQL and local storage.
              </p>
            </div>
          </div>
        </div>

        {/* Tech Stack & Architecture Card */}
        <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
          <div className="flex items-center space-x-2 text-cyan-300 font-bold text-sm font-display">
            <Code2 className="w-4 h-4 text-cyan-400" />
            <span>Architecture & Technology</span>
          </div>

          {editMode ? (
            <textarea
              rows={6}
              value={formData.techStackText}
              onChange={(e) => setFormData({ ...formData, techStackText: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-200 font-mono leading-relaxed"
            />
          ) : (
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed whitespace-pre-line font-mono">
              {content.techStackText}
            </p>
          )}
        </div>

        {/* Community Credits Card */}
        <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
          <div className="flex items-center space-x-2 text-pink-300 font-bold text-sm font-display">
            <Heart className="w-4 h-4 text-pink-400" />
            <span>Community Credits & Appreciation</span>
          </div>

          {editMode ? (
            <textarea
              rows={4}
              value={formData.creditsText}
              onChange={(e) => setFormData({ ...formData, creditsText: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-200 font-mono leading-relaxed"
            />
          ) : (
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed whitespace-pre-line font-sans">
              {content.creditsText}
            </p>
          )}
        </div>

        {content.lastUpdatedAt && (
          <p className="text-right text-[10px] font-mono text-slate-500">
            Page content last updated by <strong className="text-slate-400">{content.lastUpdatedBy || 'Admin'}</strong> on{' '}
            {formatUserDateTime(content.lastUpdatedAt, true)}
          </p>
        )}
      </section>
    </div>
  );
};
