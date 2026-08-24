import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { Beatmap, DatasetInfo, RarityTier } from '../types/beatmap';
import { Banner, PullResult, PullHistoryItem } from '../types/gacha';
import { CollectionRecord, CollectionStats, UserSettings, PullEnergyState } from '../types/collection';
import { loadBeatmapDataset, getBeatmapById } from '../data/loader';
import { BANNERS } from '../gacha/banners';
import { executeMultiPull } from '../gacha/rng';
import { useAuth } from './AuthContext';
import {
  getCollectionRecords,
  savePullResults,
  getPullHistory,
  getTotalPulls,
  getPityCount,
  savePityCount,
  getUserSettings,
  saveUserSettings,
  getPullEnergyState,
  savePullEnergyState,
  clearAllData,
  toggleFavorite as dbToggleFavorite,
  mergeCloudCollectionIntoDB,
  DEFAULT_SETTINGS,
  DEFAULT_ENERGY_STATE,
} from '../storage/db';
import { sfx } from '../audio/sfx';
import { previewPlayer } from '../audio/previewPlayer';
import { compareRarities } from '../gacha/rarity';

const REGEN_INTERVAL_MS = 15000; // 1 pull token every 15 seconds
const MAX_PULL_ENERGY = 50;

interface GachaContextType {
  pool: Beatmap[];
  datasetInfo: DatasetInfo | null;
  isLoading: boolean;
  poolError: string | null;
  isFallbackDataset: boolean;
  collectionRecords: CollectionRecord[];
  collectionMap: Map<number, CollectionRecord>;
  totalPulls: number;
  pityCount: number;
  history: PullHistoryItem[];
  recentPulls: PullResult[];
  settings: UserSettings;
  activeBanner: Banner;
  stats: CollectionStats;
  energy: PullEnergyState;
  countdownSeconds: number;
  timeToFullFormatted: string;
  setActiveBanner: (banner: Banner) => void;
  pull: (count: number) => Promise<PullResult[]>;
  refillEnergy: (amount: number) => Promise<void>;
  toggleFavorite: (beatmapId: number) => Promise<boolean>;
  updateSettings: (newSettings: Partial<UserSettings>) => Promise<void>;
  resetCollection: () => Promise<void>;
  refreshCollection: () => Promise<void>;
  forceCloudSync: () => Promise<void>;
}

const GachaContext = createContext<GachaContextType | null>(null);

export const GachaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, user, syncWithCloud } = useAuth();
  const [pool, setPool] = useState<Beatmap[]>([]);
  const [datasetInfo, setDatasetInfo] = useState<DatasetInfo | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [poolError, setPoolError] = useState<string | null>(null);
  const [isFallbackDataset, setIsFallbackDataset] = useState<boolean>(false);

  const [collectionRecords, setCollectionRecords] = useState<CollectionRecord[]>([]);
  const [collectionMap, setCollectionMap] = useState<Map<number, CollectionRecord>>(new Map());
  const [totalPulls, setTotalPulls] = useState<number>(0);
  const [pityCount, setPityCount] = useState<number>(0);
  const [history, setHistory] = useState<PullHistoryItem[]>([]);
  const [recentPulls, setRecentPulls] = useState<PullResult[]>([]);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [activeBanner, setActiveBanner] = useState<Banner>(BANNERS[0]);

  // Pull Energy / Stamina Time Gate State
  const [energy, setEnergy] = useState<PullEnergyState>(DEFAULT_ENERGY_STATE);
  const [countdownSeconds, setCountdownSeconds] = useState<number>(15);

  // Load beatmap pool and user data on start
  const initData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [loaderRes, savedRecords, savedHistory, savedPulls, savedPity, userConfig, savedEnergy] = await Promise.all([
        loadBeatmapDataset(),
        getCollectionRecords(),
        getPullHistory(50),
        getTotalPulls(),
        getPityCount(),
        getUserSettings(),
        getPullEnergyState(),
      ]);

      setPool(loaderRes.maps);
      setDatasetInfo(loaderRes.info);
      setIsFallbackDataset(loaderRes.isFallback);
      if (loaderRes.error) setPoolError(loaderRes.error);

      setCollectionRecords(savedRecords);
      const colMap = new Map<number, CollectionRecord>();
      savedRecords.forEach((r) => colMap.set(r.beatmapId, r));
      setCollectionMap(colMap);

      setTotalPulls(savedPulls);
      setPityCount(savedPity);

      // Hydrate history items with map data
      const hydratedHistory: PullHistoryItem[] = savedHistory
        .map((h) => {
          const map = getBeatmapById(h.beatmapId);
          if (!map) return null;
          return {
            id: h.id,
            beatmapId: h.beatmapId,
            beatmap: map,
            rarity: h.rarity,
            isNew: h.isNew,
            pulledAt: h.pulledAt,
          };
        })
        .filter(Boolean) as PullHistoryItem[];
      setHistory(hydratedHistory);

      // Calculate offline energy recovery
      const now = Date.now();
      const elapsed = Math.max(0, now - savedEnergy.lastRefillTime);
      const pullsToAdd = Math.floor(elapsed / REGEN_INTERVAL_MS);
      const newCurrent = Math.min(MAX_PULL_ENERGY, savedEnergy.current + pullsToAdd);
      const newLastRefill =
        newCurrent >= MAX_PULL_ENERGY ? now : savedEnergy.lastRefillTime + pullsToAdd * REGEN_INTERVAL_MS;

      const updatedEnergy: PullEnergyState = {
        current: newCurrent,
        max: MAX_PULL_ENERGY,
        lastRefillTime: newLastRefill,
      };
      await savePullEnergyState(updatedEnergy);
      setEnergy(updatedEnergy);

      setSettings(userConfig);
      sfx.setEnabled(userConfig.soundEnabled);
      sfx.setVolume(userConfig.sfxVolume);
      previewPlayer.setVolume(userConfig.bgmVolume);
    } catch (err: any) {
      console.error('Initialization error:', err);
      setPoolError(err.message || 'Failed to initialize database');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    initData();
  }, [initData]);

  // Real-time Energy Regeneration Timer
  useEffect(() => {
    const timer = setInterval(() => {
      setEnergy((prev) => {
        if (prev.current >= prev.max) {
          setCountdownSeconds(15);
          return prev;
        }

        const now = Date.now();
        const elapsed = Math.max(0, now - prev.lastRefillTime);
        const pullsToAdd = Math.floor(elapsed / REGEN_INTERVAL_MS);

        if (pullsToAdd > 0) {
          const nextCurrent = Math.min(prev.max, prev.current + pullsToAdd);
          const nextRefill =
            nextCurrent >= prev.max ? now : prev.lastRefillTime + pullsToAdd * REGEN_INTERVAL_MS;
          const nextState = { ...prev, current: nextCurrent, lastRefillTime: nextRefill };
          savePullEnergyState(nextState).catch(() => {});
          return nextState;
        }

        const remainingMs = REGEN_INTERVAL_MS - (elapsed % REGEN_INTERVAL_MS);
        setCountdownSeconds(Math.max(1, Math.ceil(remainingMs / 1000)));
        return prev;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const timeToFullFormatted = useMemo(() => {
    if (energy.current >= energy.max) return 'MAX';
    const missingPulls = energy.max - energy.current;
    const totalSeconds = (missingPulls - 1) * 15 + countdownSeconds;
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }, [energy, countdownSeconds]);

  const refillEnergy = useCallback(async (amount: number) => {
    setEnergy((prev) => {
      const nextCurrent = Math.min(prev.max, prev.current + amount);
      const nextState: PullEnergyState = {
        ...prev,
        current: nextCurrent,
        lastRefillTime: Date.now(),
      };
      savePullEnergyState(nextState).catch(() => {});
      return nextState;
    });
  }, []);

  const refreshCollection = useCallback(async () => {
    const [savedRecords, savedHistory, savedPulls, savedPity, savedEnergy] = await Promise.all([
      getCollectionRecords(),
      getPullHistory(50),
      getTotalPulls(),
      getPityCount(),
      getPullEnergyState(),
    ]);

    setCollectionRecords(savedRecords);
    const colMap = new Map<number, CollectionRecord>();
    savedRecords.forEach((r) => colMap.set(r.beatmapId, r));
    setCollectionMap(colMap);

    setTotalPulls(savedPulls);
    setPityCount(savedPity);
    setEnergy(savedEnergy);

    const hydratedHistory: PullHistoryItem[] = savedHistory
      .map((h) => {
        const map = getBeatmapById(h.beatmapId);
        if (!map) return null;
        return {
          id: h.id,
          beatmapId: h.beatmapId,
          beatmap: map,
          rarity: h.rarity,
          isNew: h.isNew,
          pulledAt: h.pulledAt,
        };
      })
      .filter(Boolean) as PullHistoryItem[];
    setHistory(hydratedHistory);
  }, []);

  // Force Cloud Sync function
  const forceCloudSync = useCallback(async () => {
    if (!isAuthenticated || !syncWithCloud) return;
    try {
      const records = await getCollectionRecords();
      const hist = await getPullHistory(50);
      const pulls = await getTotalPulls();
      const pity = await getPityCount();

      const syncResult = await syncWithCloud({
        collection: records.map((r) => ({
          beatmapId: r.beatmapId,
          copies: r.copies,
          firstPulledAt: r.firstPulledAt,
          lastPulledAt: r.lastPulledAt,
          isFavorite: Boolean(r.isFavorite),
        })),
        history: hist.map((h) => ({
          id: h.id,
          beatmapId: h.beatmapId,
          rarity: h.rarity,
          pulledAt: h.pulledAt,
        })),
        totalPulls: pulls,
        pityCount: pity,
      });

      if (syncResult && syncResult.mergedCollection) {
        await mergeCloudCollectionIntoDB({
          collection: syncResult.mergedCollection,
          history: syncResult.mergedHistory,
          totalPulls: syncResult.cloudTotalPulls,
          pityCount: syncResult.cloudPityCount,
        });
        await refreshCollection();
      }
    } catch (err) {
      console.warn('Force cloud sync failed:', err);
    }
  }, [isAuthenticated, syncWithCloud, refreshCollection]);

  // Initial cloud sync whenever user logs in or page loads with session
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    forceCloudSync();
  }, [isAuthenticated, user]);

  const pull = useCallback(
    async (count: number): Promise<PullResult[]> => {
      if (pool.length === 0) {
        throw new Error('Beatmap pool is not loaded yet');
      }

      if (energy.current < count) {
        throw new Error(`Not enough pull stamina! Need ${count} energy (have ${energy.current}).`);
      }

      // Immediately pause any ongoing song preview playback on summon
      previewPlayer.pause();

      const { results, finalPity } = executeMultiPull(count, pool, collectionMap, activeBanner.id, pityCount);
      setPityCount(finalPity);
      await savePityCount(finalPity);

      // Deduct energy
      const now = Date.now();
      const newEnergyState: PullEnergyState = {
        ...energy,
        current: energy.current - count,
        lastRefillTime: energy.current >= energy.max ? now : energy.lastRefillTime,
      };
      setEnergy(newEnergyState);
      await savePullEnergyState(newEnergyState);

      // Save to IndexedDB
      await savePullResults(results);

      // Update in-memory state
      const updatedMap = new Map(collectionMap);
      for (const res of results) {
        const prev = updatedMap.get(res.beatmap.id);
        updatedMap.set(res.beatmap.id, {
          beatmapId: res.beatmap.id,
          copies: res.currentCopies,
          firstPulledAt: prev ? prev.firstPulledAt : res.pulledAt,
          lastPulledAt: res.pulledAt,
          isFavorite: prev?.isFavorite || false,
        });
      }

      setCollectionMap(updatedMap);
      setCollectionRecords(Array.from(updatedMap.values()));
      const nextTotalPulls = totalPulls + results.length;
      setTotalPulls(nextTotalPulls);
      setRecentPulls(results);

      // Prepend to history
      const newHistoryItems: PullHistoryItem[] = results.map((r, idx) => ({
        id: `${r.pulledAt}-${r.beatmap.id}-${idx}`,
        beatmapId: r.beatmap.id,
        beatmap: r.beatmap,
        rarity: r.beatmap.rarity,
        isNew: r.isNew,
        pulledAt: r.pulledAt,
      }));
      setHistory((prev) => [...newHistoryItems.reverse(), ...prev].slice(0, 100));

      // Background sync to Cloudflare D1 if authenticated
      if (isAuthenticated && syncWithCloud) {
        syncWithCloud({
          collection: results.map((r) => ({
            beatmapId: r.beatmap.id,
            copies: r.currentCopies,
            firstPulledAt: r.isNew ? r.pulledAt : Date.now(),
            lastPulledAt: r.pulledAt,
            isFavorite: false,
          })),
          history: results.map((r, idx) => ({
            id: `${r.pulledAt}-${r.beatmap.id}-${idx}`,
            beatmapId: r.beatmap.id,
            rarity: r.beatmap.rarity,
            pulledAt: r.pulledAt,
          })),
          totalPulls: nextTotalPulls,
          pityCount: finalPity,
        }).catch((err) => console.warn('Background D1 pull sync error:', err));
      }

      return results;
    },
    [pool, collectionMap, activeBanner.id, energy, pityCount, totalPulls, isAuthenticated, syncWithCloud]
  );

  const toggleFavorite = useCallback(
    async (beatmapId: number): Promise<boolean> => {
      const isFav = await dbToggleFavorite(beatmapId);
      let updatedRecord: CollectionRecord | undefined;

      setCollectionMap((prev) => {
        const copy = new Map(prev);
        const item = copy.get(beatmapId);
        if (item) {
          updatedRecord = { ...item, isFavorite: isFav };
          copy.set(beatmapId, updatedRecord);
        }
        return copy;
      });
      setCollectionRecords((prev) =>
        prev.map((r) => (r.beatmapId === beatmapId ? { ...r, isFavorite: isFav } : r))
      );

      // Sync favorite toggle to Cloudflare D1
      if (isAuthenticated && syncWithCloud && updatedRecord) {
        syncWithCloud({
          collection: [
            {
              beatmapId: updatedRecord.beatmapId,
              copies: updatedRecord.copies,
              firstPulledAt: updatedRecord.firstPulledAt,
              lastPulledAt: updatedRecord.lastPulledAt,
              isFavorite: isFav,
            },
          ],
          history: [],
          totalPulls,
          pityCount,
        }).catch((err) => console.warn('Background D1 favorite sync error:', err));
      }

      return isFav;
    },
    [isAuthenticated, syncWithCloud, totalPulls, pityCount]
  );

  const updateSettings = useCallback(
    async (newSettings: Partial<UserSettings>) => {
      const merged = { ...settings, ...newSettings };
      setSettings(merged);
      sfx.setEnabled(merged.soundEnabled);
      sfx.setVolume(merged.sfxVolume);
      previewPlayer.setVolume(merged.bgmVolume);
      await saveUserSettings(merged);
    },
    [settings]
  );

  const resetCollection = useCallback(async () => {
    await clearAllData();
    setCollectionRecords([]);
    setCollectionMap(new Map());
    setTotalPulls(0);
    setPityCount(0);
    setHistory([]);
    setRecentPulls([]);
  }, []);

  // Compute stats memoized
  const stats = useMemo<CollectionStats>(() => {
    const uniqueOwned = collectionRecords.length;
    const totalCopies = collectionRecords.reduce((acc, r) => acc + r.copies, 0);
    const totalInPool = pool.length;
    const completionPercentage = totalInPool > 0 ? Math.round((uniqueOwned / totalInPool) * 1000) / 10 : 0;

    const rarityCounts: Record<RarityTier, number> = {
      Common: 0,
      Uncommon: 0,
      'Uncommon+': 0,
      Rare: 0,
      Epic: 0,
      Legendary: 0,
      Mythic: 0,
      Celestial: 0,
      Divine: 0,
      GOAT: 0,
    };

    let highestRarity: RarityTier | null = null;
    let starSum = 0;
    let mostCopiesMap: { beatmap: Beatmap; copies: number } | null = null;

    collectionRecords.forEach((record) => {
      const map = collectionMap.has(record.beatmapId) ? getBeatmapById(record.beatmapId) : undefined;
      if (map) {
        rarityCounts[map.rarity] = (rarityCounts[map.rarity] || 0) + 1;
        starSum += map.stars;

        if (!highestRarity || compareRarities(map.rarity, highestRarity) > 0) {
          highestRarity = map.rarity;
        }

        if (!mostCopiesMap || record.copies > mostCopiesMap.copies) {
          mostCopiesMap = { beatmap: map, copies: record.copies };
        }
      }
    });

    const averageStarRating = uniqueOwned > 0 ? Math.round((starSum / uniqueOwned) * 100) / 100 : 0;

    return {
      totalPulls,
      uniqueOwned,
      totalCopies,
      completionPercentage,
      rarityCounts,
      totalInPool,
      highestRarityObtained: highestRarity,
      averageStarRating,
      mostCopiesMap,
    };
  }, [collectionRecords, collectionMap, pool, totalPulls]);

  return (
    <GachaContext.Provider
      value={{
        pool,
        datasetInfo,
        isLoading,
        poolError,
        isFallbackDataset,
        collectionRecords,
        collectionMap,
        totalPulls,
        pityCount,
        history,
        recentPulls,
        settings,
        activeBanner,
        stats,
        energy,
        countdownSeconds,
        timeToFullFormatted,
        setActiveBanner,
        pull,
        refillEnergy,
        toggleFavorite,
        updateSettings,
        resetCollection,
        refreshCollection,
        forceCloudSync,
      }}
    >
      {children}
    </GachaContext.Provider>
  );
};

export function useGacha(): GachaContextType {
  const context = useContext(GachaContext);
  if (!context) {
    throw new Error('useGacha must be used within a GachaProvider');
  }
  return context;
}
