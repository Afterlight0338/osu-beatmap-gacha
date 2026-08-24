import React, { useState, useRef } from 'react';
import { useGacha } from '../context/GachaContext';
import { useAuth } from '../context/AuthContext';
import { downloadCollectionBackup, handleFileImport } from '../storage/exportImport';
import { SecretPhDModal } from './SecretPhDModal';
import { sfx } from '../audio/sfx';
import {
  X,
  Volume2,
  VolumeX,
  Zap,
  Download,
  Upload,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Database,
  Sliders,
  Atom,
  RefreshCw,
  LogOut,
  LogIn,
  ShieldCheck,
  Disc,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const {
    settings,
    updateSettings,
    resetCollection,
    refreshCollection,
    datasetInfo,
    pool,
    isFallbackDataset,
    forceCloudSync,
  } = useGacha();

  const { user, isAuthenticated, loginWithOsu, logout, isSyncing, lastSyncedAt } = useAuth();

  const [importStatus, setImportStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });

  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState<boolean>(false);
  const [isSecretOpen, setIsSecretOpen] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleExport = async () => {
    sfx.playClick();
    await downloadCollectionBackup();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const result = await handleFileImport(file, 'merge');
    if (result.success) {
      setImportStatus({ type: 'success', message: result.message });
      await refreshCollection();
    } else {
      setImportStatus({ type: 'error', message: result.message });
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleResetConfirm = async () => {
    sfx.playClick();
    await resetCollection();
    setIsResetConfirmOpen(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-lg rounded-2xl bg-[#141420] border border-slate-700 shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center space-x-2.5">
            <Sliders className="w-5 h-5 text-pink-400" />
            <h2 className="text-lg font-bold text-white font-display">Settings & Storage</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Audio Settings */}
          <div className="space-y-3">
            <h3 className="text-xs font-mono uppercase text-slate-400 font-bold tracking-wider">
              Audio Preferences
            </h3>

            {/* Sound FX Toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/80 border border-slate-800">
              <div className="flex items-center space-x-3">
                {settings.soundEnabled ? (
                  <Volume2 className="w-5 h-5 text-pink-400" />
                ) : (
                  <VolumeX className="w-5 h-5 text-slate-500" />
                )}
                <div>
                  <p className="text-sm font-semibold text-slate-200">Sound Effects</p>
                  <p className="text-xs text-slate-400">Gacha chimes, clicks, and fanfares</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.soundEnabled}
                  onChange={(e) => updateSettings({ soundEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-600"></div>
              </label>
            </div>

            {/* SFX Volume Slider */}
            {settings.soundEnabled && (
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
                <div className="flex justify-between text-xs font-mono text-slate-400">
                  <span>SFX Volume</span>
                  <span>{Math.round(settings.sfxVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={settings.sfxVolume}
                  onChange={(e) => updateSettings({ sfxVolume: parseFloat(e.target.value) })}
                  className="w-full accent-pink-500 cursor-pointer"
                />
              </div>
            )}

            {/* BGM Volume Slider */}
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
              <div className="flex justify-between text-xs font-mono text-slate-400">
                <span>Beatmap Preview Volume</span>
                <span>{Math.round(settings.bgmVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.bgmVolume}
                onChange={(e) => updateSettings({ bgmVolume: parseFloat(e.target.value) })}
                className="w-full accent-cyan-500 cursor-pointer"
              />
            </div>
          </div>

          {/* Gameplay Settings */}
          <div className="space-y-3">
            <h3 className="text-xs font-mono uppercase text-slate-400 font-bold tracking-wider">
              Gameplay & Animation
            </h3>

            {/* Fast Animations */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/80 border border-slate-800">
              <div className="flex items-center space-x-3">
                <Zap className="w-5 h-5 text-amber-400" />
                <div>
                  <p className="text-sm font-semibold text-slate-200">Fast Reveal Mode</p>
                  <p className="text-xs text-slate-400">Skip summon sequence directly to summary</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.fastAnimation}
                  onChange={(e) => updateSettings({ fastAnimation: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
              </label>
            </div>
          </div>

          {/* osu! Cloud Account & D1 Sync */}
          <div className="space-y-3">
            <h3 className="text-xs font-mono uppercase text-slate-400 font-bold tracking-wider flex items-center justify-between">
              <span>osu! Cloud Account (D1 Database)</span>
              {isAuthenticated && (
                <span className="text-[10px] text-emerald-400 font-bold flex items-center space-x-1">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Cloud Active</span>
                </span>
              )}
            </h3>

            {isAuthenticated && user ? (
              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3 font-sans">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-950 border border-pink-500/50 flex-shrink-0">
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt={user.username} className="w-full h-full object-cover" />
                    ) : (
                      <Disc className="w-6 h-6 text-pink-400 m-auto" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-bold text-white truncate">{user.username}</span>
                      {user.countryCode && (
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                          {user.countryCode}
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-mono text-slate-400">
                      {user.globalRank ? `#${user.globalRank.toLocaleString()} Global Rank` : `osu! ID: ${user.osuId}`}
                    </p>
                    {lastSyncedAt && (
                      <p className="text-[10px] font-mono text-slate-500">
                        Last cloud sync: {lastSyncedAt.toLocaleTimeString()}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex space-x-2 pt-1">
                  <button
                    onClick={() => forceCloudSync()}
                    disabled={isSyncing}
                    className="flex-1 flex items-center justify-center space-x-1.5 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-pink-300 text-xs font-semibold border border-slate-700 transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-amber-400' : 'text-cyan-400'}`} />
                    <span>{isSyncing ? 'Syncing...' : 'Sync Cloud D1'}</span>
                  </button>

                  <button
                    onClick={() => logout()}
                    className="flex items-center space-x-1.5 py-2 px-3 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 hover:text-rose-100 text-xs font-semibold border border-rose-800/60 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5 text-rose-400" />
                    <span>Logout</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2.5">
                <p className="text-xs text-slate-300 leading-relaxed font-sans">
                  Sign in with your official <strong className="text-pink-400">osu! account</strong> to automatically back up and synchronize your pulled beatmaps across your PC and mobile devices via Cloudflare D1.
                </p>
                <button
                  onClick={() => loginWithOsu()}
                  className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-pink-600 via-pink-500 to-purple-600 text-white font-bold text-xs shadow-md shadow-pink-600/30 hover:shadow-pink-500/50 hover:scale-[1.01] transition-all select-none border border-pink-400/40"
                >
                  <Disc className="w-4 h-4 text-white" />
                  <span className="font-display">Login with osu!</span>
                  <LogIn className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Local Storage & Backup */}
          <div className="space-y-3">
            <h3 className="text-xs font-mono uppercase text-slate-400 font-bold tracking-wider">
              Backup & Collection Data (IndexedDB)
            </h3>

            {importStatus.type && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center space-x-2 ${
                  importStatus.type === 'success'
                    ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500'
                    : 'bg-rose-950/80 text-rose-300 border border-rose-500'
                }`}
              >
                {importStatus.type === 'success' ? (
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                )}
                <span>{importStatus.message}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                onClick={handleExport}
                className="flex items-center justify-center space-x-2 p-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-semibold transition-colors"
              >
                <Download className="w-4 h-4 text-cyan-400" />
                <span>Export Backup (JSON)</span>
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center space-x-2 p-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-semibold transition-colors"
              >
                <Upload className="w-4 h-4 text-pink-400" />
                <span>Import Backup</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {/* Reset Collection */}
            <div className="pt-2">
              {!isResetConfirmOpen ? (
                <button
                  onClick={() => setIsResetConfirmOpen(true)}
                  className="w-full flex items-center justify-center space-x-2 p-2.5 rounded-xl bg-rose-950/30 hover:bg-rose-900/50 text-rose-300 border border-rose-900/60 text-xs font-semibold transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Reset All Progress...</span>
                </button>
              ) : (
                <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-600 space-y-3">
                  <div className="flex items-start space-x-2 text-rose-200 text-xs">
                    <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                    <span>
                      Are you sure? This will permanently delete your entire local collection, pull count, and history.
                    </span>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={handleResetConfirm}
                      className="flex-1 py-1.5 px-3 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs"
                    >
                      Yes, Reset Everything
                    </button>
                    <button
                      onClick={() => setIsResetConfirmOpen(false)}
                      className="py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Dataset Info */}
          <div className="p-3.5 rounded-xl bg-slate-900/50 border border-slate-800 space-y-1.5 text-xs text-slate-400 font-mono">
            <div className="flex items-center space-x-1.5 text-slate-300 font-semibold mb-1">
              <Database className="w-3.5 h-3.5 text-cyan-400" />
              <span>Beatmap Pool Info</span>
            </div>
            <div className="flex justify-between">
              <span>Pool Size:</span>
              <span className="text-slate-200 font-bold">{pool.length.toLocaleString()} maps</span>
            </div>
            <div className="flex justify-between">
              <span>Dataset Version:</span>
              <span className="text-slate-200">{datasetInfo?.version || '1.0.0'}</span>
            </div>
            <div className="flex justify-between">
              <span>Dataset Source:</span>
              <span className="text-slate-200">{isFallbackDataset ? 'Bundled Fallback' : datasetInfo?.source || 'Public maps.json'}</span>
            </div>
            {datasetInfo?.lastUpdated && (
              <div className="flex justify-between">
                <span>Updated:</span>
                <span className="text-slate-200">
                  {new Date(datasetInfo.lastUpdated).toLocaleDateString()}
                </span>
              </div>
            )}

            {/* Secret Easter Egg Button */}
            <div className="pt-2 border-t border-slate-800/80 flex justify-end">
              <button
                onClick={() => setIsSecretOpen(true)}
                title="Quantum Theoretical osu! Research Portal"
                className="opacity-30 hover:opacity-100 transition-opacity p-1 text-[10px] font-mono text-cyan-400 flex items-center space-x-1 hover:underline"
              >
                <Atom className="w-3 h-3 text-cyan-400" />
                <span>[π Exam Portal]</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Secret PhD Exam Modal */}
      <SecretPhDModal
        isOpen={isSecretOpen}
        onClose={() => setIsSecretOpen(false)}
      />
    </div>
  );
};
