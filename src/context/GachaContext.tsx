import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { Beatmap, DatasetInfo, RarityTier } from '../types/beatmap';
import { Banner, PullResult, PullHistoryItem } from '../types/gacha';
import { CollectionRecord, CollectionStats, UserSettings } from '../types/collection';
import { loadBeatmapDataset, getBeatmapById } from '../data/loader';
import { BANNERS } from '../gacha/banners';
import { executeMultiPull } from '../gacha/rng';
import {
  getCollectionRecords,
  savePullResults,
  getPullHistory,
  getTotalPulls,
  getUserSettings,
  saveUserSettings,
  clearAllData,
  toggleFavorite as dbToggleFavorite,
  DEFAULT_SETTINGS,
} from '../storage/db';
import { sfx } from '../audio/sfx';
import { previewPlayer } from '../audio/previewPlayer';
import { compareRarities } from '../gacha/rarity';

interface GachaContextType {
  pool: Beatmap[];
  datasetInfo: DatasetInfo | null;
  isLoading: boolean;
  poolError: string | null;
  isFallbackDataset: boolean;
  collectionRecords: CollectionRecord[];
  collectionMap: Map<number, CollectionRecord>;
  totalPulls: number;
  history: PullHistoryItem[];
  recentPulls: PullResult[];
  settings: UserSettings;
  activeBanner: Banner;
  stats: CollectionStats;
  setActiveBanner: (banner: Banner) => void;
  pull: (count: number) => Promise<PullResult[]>;
  toggleFavorite: (beatmapId: number) => Promise<boolean>;
  updateSettings: (newSettings: Partial<UserSettings>) => Promise<void>;
  resetCollection: () => Promise<void>;
  refreshCollection: () => Promise<void>;
}

const GachaContext = createContext<GachaContextType | null>(null);

export const GachaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [pool, setPool] = useState<Beatmap[]>([]);
  const [datasetInfo, setDatasetInfo] = useState<DatasetInfo | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [poolError, setPoolError] = useState<string | null>(null);
  const [isFallbackDataset, setIsFallbackDataset] = useState<boolean>(false);

  const [collectionRecords, setCollectionRecords] = useState<CollectionRecord[]>([]);
  const [collectionMap, setCollectionMap] = useState<Map<number, CollectionRecord>>(new Map());
  const [totalPulls, setTotalPulls] = useState<number>(0);
  const [history, setHistory] = useState<PullHistoryItem[]>([]);
  const [recentPulls, setRecentPulls] = useState<PullResult[]>([]);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [activeBanner, setActiveBanner] = useState<Banner>(BANNERS[0]);

  // Load beatmap pool and user data on start
  const initData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [loaderRes, savedRecords, savedHistory, savedPulls, userConfig] = await Promise.all([
        loadBeatmapDataset(),
        getCollectionRecords(),
        getPullHistory(50),
        getTotalPulls(),
        getUserSettings(),
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

  const refreshCollection = useCallback(async () => {
    const [savedRecords, savedHistory, savedPulls] = await Promise.all([
      getCollectionRecords(),
      getPullHistory(50),
      getTotalPulls(),
    ]);

    setCollectionRecords(savedRecords);
    const colMap = new Map<number, CollectionRecord>();
    savedRecords.forEach((r) => colMap.set(r.beatmapId, r));
    setCollectionMap(colMap);

    setTotalPulls(savedPulls);

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

  const pull = useCallback(
    async (count: number): Promise<PullResult[]> => {
      if (pool.length === 0) {
        throw new Error('Beatmap pool is not loaded yet');
      }

      const results = executeMultiPull(count, pool, collectionMap, activeBanner.id);

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
      setTotalPulls((p) => p + results.length);
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

      return results;
    },
    [pool, collectionMap, activeBanner.id]
  );

  const toggleFavorite = useCallback(async (beatmapId: number): Promise<boolean> => {
    const isFav = await dbToggleFavorite(beatmapId);
    setCollectionMap((prev) => {
      const copy = new Map(prev);
      const item = copy.get(beatmapId);
      if (item) {
        copy.set(beatmapId, { ...item, isFavorite: isFav });
      }
      return copy;
    });
    setCollectionRecords((prev) =>
      prev.map((r) => (r.beatmapId === beatmapId ? { ...r, isFavorite: isFav } : r))
    );
    return isFav;
  }, []);

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
      Rare: 0,
      Epic: 0,
      Legendary: 0,
      Mythic: 0,
      Divine: 0,
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
        history,
        recentPulls,
        settings,
        activeBanner,
        stats,
        setActiveBanner,
        pull,
        toggleFavorite,
        updateSettings,
        resetCollection,
        refreshCollection,
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
