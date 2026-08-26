import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { GachaProvider, useGacha } from './context/GachaContext';
import { Navbar } from './components/Navbar';
import { MobileBottomNav } from './components/MobileBottomNav';
import { ParticleCanvas } from './components/ParticleCanvas';
import { GachaPage } from './pages/GachaPage';
import { CollectionPage } from './pages/CollectionPage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { StatsPage } from './pages/StatsPage';
import { ChangelogPage } from './pages/ChangelogPage';
import { AboutPage } from './pages/AboutPage';
import AdminPage from './pages/AdminPage';
import { MaintenancePage } from './pages/MaintenancePage';
import { SettingsModal } from './components/SettingsModal';
import { PullHistoryModal } from './components/PullHistoryModal';
import { BeatmapDetailModal } from './components/BeatmapDetailModal';
import { MiniBroadcastToast } from './components/MiniBroadcastToast';
import { EventAura } from './components/EventAura';
import { LegalModal, LegalTabType } from './components/LegalModal';
import { StartScreenModal } from './components/StartScreenModal';
import { Beatmap } from './types/beatmap';
import { isAdmin } from './config/admin';
import { MAINTENANCE_MODE } from './config/maintenance';
import { supabase } from './lib/supabase';
import { GlobalChatDrawer } from './components/GlobalChatDrawer';
import { ClaimGiftModal } from './components/ClaimGiftModal';
import { IncomingTradeModal } from './components/IncomingTradeModal';
import { giftingService, PlayerTransaction } from './services/giftingService';
import { tradingService, PlayerTrade } from './services/tradingService';
import { Disc, AlertCircle, Wrench, Eye } from 'lucide-react';

const MainApp: React.FC = () => {
  const { isLoading, poolError, activeBanner, isFallbackDataset, collectionMap, toggleFavorite, activeEvent } = useGacha();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'gacha' | 'collection' | 'leaderboard' | 'stats' | 'changelog' | 'about' | 'admin'>('gacha');
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [selectedMapForDetail, setSelectedMapForDetail] = useState<Beatmap | null>(null);
  const [previewMaintenance, setPreviewMaintenance] = useState<boolean>(false);
  const [legalModalTab, setLegalModalTab] = useState<LegalTabType | null>(null);
  const [incomingGift, setIncomingGift] = useState<PlayerTransaction | null>(null);
  const [incomingTrade, setIncomingTrade] = useState<PlayerTrade | null>(null);
  const [allUsers, setAllUsers] = useState<{ osu_id: number; username: string; avatar_url?: string; country_code?: string }[]>([]);
  const [cloudMaintenance, setCloudMaintenance] = useState<{
    enabled: boolean;
    title?: string;
    headline?: string;
    message?: string;
    estimatedTime?: string;
  }>({ enabled: false });

  const userIsAdmin = isAdmin(user?.username);

  // Real-time Cloud Force-Refresh & Maintenance Listener
  useEffect(() => {
    const sessionStartTime = Date.now();
    let lastRefreshTimestamp = Number(sessionStorage.getItem('last_forced_refresh_ts') || sessionStartTime);

    const checkRemoteCommands = async () => {
      try {
        const { data } = await supabase
          .from('admin_config')
          .select('key, value')
          .in('key', ['force_client_refresh', 'maintenance_mode']);

        if (data) {
          for (const item of data) {
            if (item.key === 'maintenance_mode' && item.value) {
              setCloudMaintenance({
                enabled: typeof item.value.enabled === 'boolean' ? item.value.enabled : MAINTENANCE_MODE,
                title: item.value.title,
                headline: item.value.headline,
                message: item.value.message,
                estimatedTime: item.value.estimatedTime,
              });
            }
            if (item.key === 'force_client_refresh' && item.value?.timestamp) {
              const remoteTs = Number(item.value.timestamp);
              if (remoteTs > lastRefreshTimestamp) {
                sessionStorage.setItem('last_forced_refresh_ts', String(remoteTs));
                window.location.reload();
                return;
              }
            }
          }
        }
      } catch {
        // silent
      }
    };

    checkRemoteCommands();
    const interval = setInterval(checkRemoteCommands, 3000);

    const channel = supabase
      .channel('realtime_admin_commands')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'admin_config' },
        (payload: any) => {
          if (payload.new?.key === 'maintenance_mode' && payload.new.value) {
            setCloudMaintenance({
              enabled: typeof payload.new.value.enabled === 'boolean' ? payload.new.value.enabled : MAINTENANCE_MODE,
              title: payload.new.value.title,
              headline: payload.new.value.headline,
              message: payload.new.value.message,
              estimatedTime: payload.new.value.estimatedTime,
            });
          }
          if (payload.new?.key === 'force_client_refresh') {
            const remoteTs = Number(payload.new.value?.timestamp || 0);
            if (remoteTs > lastRefreshTimestamp) {
              sessionStorage.setItem('last_forced_refresh_ts', String(remoteTs));
              window.location.reload();
            }
          }
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  // If maintenance mode is active and the visitor is not the admin (or is previewing), show Maintenance Page
  const isCurrentlyInMaintenance = typeof cloudMaintenance.enabled === 'boolean' ? cloudMaintenance.enabled : MAINTENANCE_MODE;
  if (isCurrentlyInMaintenance && (!userIsAdmin || previewMaintenance)) {
    return <MaintenancePage config={cloudMaintenance} onBypass={() => setPreviewMaintenance(false)} />;
  }

  // Load users & listen for incoming gifts and trades for the authenticated player
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const { data } = await supabase.from('users').select('osu_id, username, avatar_url, country_code');
        if (data) setAllUsers(data);
      } catch {}
    };
    fetchUsers();

    if (!user?.osuId) return;
    const currentOsuId = user.osuId;

    const checkInteractions = async () => {
      try {
        const [txs, trades] = await Promise.all([
          giftingService.fetchTransactions(),
          tradingService.fetchTrades(),
        ]);
        const pendingGift = txs.find((t) => t.recipientId === currentOsuId && t.status === 'pending');
        if (pendingGift) setIncomingGift(pendingGift);

        const pendingTrade = trades.find((t) => t.recipientId === currentOsuId && t.status === 'pending');
        if (pendingTrade) setIncomingTrade(pendingTrade);
      } catch {}
    };
    checkInteractions();
    const interval = setInterval(checkInteractions, 10000);

    const channel = supabase.channel('interaction_listener_' + currentOsuId);
    channel.on('broadcast', { event: 'gift_received' }, (payload: { payload: PlayerTransaction }) => {
      if (payload?.payload && payload.payload.recipientId === currentOsuId && payload.payload.status === 'pending') {
        setIncomingGift(payload.payload);
      }
    });
    channel.on('broadcast', { event: 'trade_received' }, (payload: { payload: PlayerTrade }) => {
      if (payload?.payload && payload.payload.recipientId === currentOsuId && payload.payload.status === 'pending') {
        setIncomingTrade(payload.payload);
      }
    });
    channel.subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [user?.osuId]);

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
      <main className="flex-1 w-full px-3 sm:px-6 lg:px-8 py-4 sm:py-6 z-10 pb-24 sm:pb-8">
        {/* Live Event Atmospheric Aura & Ribbon */}
        <EventAura event={activeEvent} />

        {/* Admin Maintenance Mode Notification */}
        {MAINTENANCE_MODE && userIsAdmin && (
          <div className="max-w-7xl mx-auto mb-6 p-3 sm:p-4 rounded-2xl bg-amber-950/70 border border-amber-500/60 text-amber-200 text-xs flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg shadow-amber-950/40">
            <div className="flex items-center space-x-2.5">
              <Wrench className="w-4 h-4 text-amber-400 flex-shrink-0 animate-bounce" />
              <span>
                <strong className="text-amber-300 font-mono font-bold uppercase">Maintenance Mode is Active.</strong> Public visitors are currently viewing the maintenance page. You have bypassed it as <strong className="text-white">RyoYamada</strong>.
              </span>
            </div>
            <button
              onClick={() => setPreviewMaintenance(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-amber-900/60 hover:bg-amber-800/60 border border-amber-700/60 text-amber-300 text-xs font-semibold transition-colors flex-shrink-0"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Preview Maintenance Page</span>
            </button>
          </div>
        )}

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
        {activeTab === 'leaderboard' && <LeaderboardPage />}
        {activeTab === 'stats' && <StatsPage />}
        {activeTab === 'changelog' && (
          <ChangelogPage onSelectBeatmap={(map) => setSelectedMapForDetail(map)} />
        )}
        {activeTab === 'about' && <AboutPage />}
        {activeTab === 'admin' && <AdminPage />}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <MobileBottomNav activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Footer */}
      <footer className="w-full border-t border-slate-900 bg-[#0d0d15]/90 py-8 px-4 sm:px-6 z-10 text-center text-xs text-slate-500 space-y-3">
        <p className="font-mono">
          osu! Beatmap Gacha • Built with React, TypeScript, Vite & IndexedDB
        </p>

        {/* Legal & Policy Links */}
        <div className="flex items-center justify-center space-x-3 text-[11px] font-mono text-slate-400">
          <button
            onClick={() => setLegalModalTab('terms')}
            className="hover:text-pink-400 transition-colors underline decoration-slate-700 underline-offset-4"
          >
            Terms of Service
          </button>
          <span>•</span>
          <button
            onClick={() => setLegalModalTab('privacy')}
            className="hover:text-pink-400 transition-colors underline decoration-slate-700 underline-offset-4"
          >
            Privacy Policy
          </button>
          <span>•</span>
          <button
            onClick={() => setLegalModalTab('cookies')}
            className="hover:text-pink-400 transition-colors underline decoration-slate-700 underline-offset-4"
          >
            Cookies & Storage
          </button>
        </div>

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

      {/* Terms of Service, Privacy Policy & Cookies Modal */}
      <LegalModal
        isOpen={legalModalTab !== null}
        initialTab={legalModalTab}
        onClose={() => setLegalModalTab(null)}
      />

      {/* First-Time User Onboarding & Start Screen */}
      <StartScreenModal />

      {/* Global Realtime Chat & Player Presence Drawer */}
      <GlobalChatDrawer allUsers={allUsers} />

      {/* Incoming Gift Notification & Claim Modal */}
      <ClaimGiftModal
        gift={incomingGift}
        onClose={() => setIncomingGift(null)}
      />

      {/* Incoming Trade Proposal Notification & Review Modal */}
      <IncomingTradeModal
        trade={incomingTrade}
        onClose={() => setIncomingTrade(null)}
      />

      {/* Floating Mini Side Broadcast Notification */}
      <MiniBroadcastToast />
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
