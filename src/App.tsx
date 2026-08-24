import React, { useState } from 'react';
import { AuthProvider } from './context/AuthContext';
import { GachaProvider, useGacha } from './context/GachaContext';
import { Navbar } from './components/Navbar';
import { ParticleCanvas } from './components/ParticleCanvas';
import { GachaPage } from './pages/GachaPage';
import { CollectionPage } from './pages/CollectionPage';
import { StatsPage } from './pages/StatsPage';
import { ChangelogPage } from './pages/ChangelogPage';
import { SettingsModal } from './components/SettingsModal';
import { PullHistoryModal } from './components/PullHistoryModal';
import { BeatmapDetailModal } from './components/BeatmapDetailModal';
import { Beatmap } from './types/beatmap';
import { Disc, AlertCircle } from 'lucide-react';

const MainApp: React.FC = () => {
  const { isLoading, poolError, activeBanner, isFallbackDataset, collectionMap, toggleFavorite } = useGacha();
  const [activeTab, setActiveTab] = useState<'gacha' | 'collection' | 'stats' | 'changelog'>('gacha');
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [selectedMapForDetail, setSelectedMapForDetail] = useState<Beatmap | null>(null);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0d0d15] text-slate-100 p-4 space-y-4">
        <div className="relative flex items-center justify-center">
          <div className="w-16 h-16 rounded-full border-4 border-pink-500/30 border-t-pink-500 animate-spin" />
          <Disc className="w-8 h-8 text-pink-500 absolute animate-pulse" />
        </div>
        <div className="text-center space-y-1">
          <h2 className="font-display font-black text-xl text-white">osu! Beatmap Gacha</h2>
          <p className="text-xs font-mono text-slate-400">Loading beatmap dataset from IndexedDB & JSON...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#0d0d15] text-slate-100 relative selection:bg-pink-500 selection:text-white">
      {/* Background Particle Layer */}
      <ParticleCanvas themeColor={activeBanner.themeColor} />

      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenHistory={() => setIsHistoryOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-6 z-10">
        {/* Warning notification if running fallback dataset */}
        {poolError && isFallbackDataset && (
          <div className="max-w-4xl mx-auto mb-6 p-3 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>
              Running bundled fallback demo dataset ({poolError}). All gacha mechanics and collection features are fully active!
            </span>
          </div>
        )}

        {/* Tab Pages */}
        {activeTab === 'gacha' && <GachaPage />}
        {activeTab === 'collection' && <CollectionPage />}
        {activeTab === 'stats' && <StatsPage />}
        {activeTab === 'changelog' && (
          <ChangelogPage onSelectBeatmap={(map) => setSelectedMapForDetail(map)} />
        )}
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-900 bg-[#0d0d15]/90 py-8 px-4 sm:px-6 z-10 text-center text-xs text-slate-500 space-y-2">
        <p className="font-mono">
          osu! Beatmap Gacha • Built with React, TypeScript, Vite & IndexedDB
        </p>
        <p className="max-w-2xl mx-auto text-[11px] text-slate-600 leading-relaxed">
          osu! Beatmap Gacha is an unofficial fan project and is not affiliated with, endorsed, or sponsored by osu! or ppy Pty Ltd.
          All beatmap artwork, audio previews, and metadata remain the property of their respective artists, mappers, and rights holders.
        </p>
      </footer>

      {/* Global Modals */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      <PullHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        onSelectBeatmap={(map) => setSelectedMapForDetail(map)}
      />

      <BeatmapDetailModal
        beatmap={selectedMapForDetail}
        record={selectedMapForDetail ? collectionMap.get(selectedMapForDetail.id) : undefined}
        isOpen={selectedMapForDetail !== null}
        onClose={() => setSelectedMapForDetail(null)}
        onToggleFavorite={toggleFavorite}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <GachaProvider>
        <MainApp />
      </GachaProvider>
    </AuthProvider>
  );
};

export default App;
