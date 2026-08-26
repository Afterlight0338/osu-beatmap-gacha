import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { Beatmap, RarityTier, DatasetInfo } from '../types/beatmap';
import { Banner, PullResult, PullHistoryItem, RarityRates } from '../types/gacha';
import { CollectionRecord, CollectionStats, UserSettings, PullEnergyState } from '../types/collection';
import { BANNERS } from '../gacha/banners';
import { executeMultiPull } from '../gacha/rng';
import { DEFAULT_RARITY_RATES } from '../gacha/probabilities';
import { loadBeatmapDataset } from '../data/loader';
import { previewPlayer } from '../audio/previewPlayer';
import { sfx } from '../audio/sfx';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';
import {
  getCollectionRecords,
  savePullResults,
  getPullHistory,
  getTotalPulls,
  getPityCount,
  savePityCount,
  getUserSettings,
  saveUserSettings,
  DEFAULT_SETTINGS,
  DEFAULT_ENERGY_STATE,
  getPullEnergyState,
  savePullEnergyState,
  clearAllData,
  toggleFavorite as dbToggleFavorite,
} from '../storage/db';

const BASE_REGEN_INTERVAL_MS = 15000; // Standard: 1 stamina every 15 seconds
const MAX_MAIN_ENERGY = 50;
const MAX_RESERVE_ENERGY = 100;

export interface ActiveEventState {
  id: string;
  name: string;
  description: string;
  fastRecharge: boolean;
  rateMultiplier: number;
  bonusDropRate: boolean;
  active: boolean;
  startsAt: string;
  expiresAt: string;
}

export interface CardTierOverrideItem {
  tier: RarityTier;
  exReason?: string;
  assignedBy?: string;
  assignedAt?: string;
}

export type CardTierOverridesMap = Record<string, CardTierOverrideItem>;

interface GachaContextType {
  pool: Beatmap[];
  poolMap: Map<number, Beatmap>;
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
  totalEnergy: number;
  activeEvent: ActiveEventState | null;
  cardOverrides: CardTierOverridesMap;
  currentRates: RarityRates;
  countdownSeconds: number;
  timeToFullFormatted: string;
  setActiveBanner: (banner: Banner) => void;
  pull: (count: number) => Promise<PullResult[]>;
  refillEnergy: (amount: number) => Promise<void>;
  addBonusEnergy: (amount: number) => Promise<void>;
  adminRefillEnergy: (amount: number) => Promise<void>;
  setCardTierOverride: (beatmapId: number, tier: RarityTier, exReason?: string) => Promise<void>;
  removeCardTierOverride: (beatmapId: number) => Promise<void>;
  toggleFavorite: (beatmapId: number) => Promise<boolean>;
  updateSettings: (newSettings: Partial<UserSettings>) => Promise<void>;
  resetCollection: () => Promise<void>;
  refreshCollection: () => Promise<void>;
  forceCloudSync: () => Promise<void>;
}

const GachaContext = createContext<GachaContextType | null>(null);

export const GachaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, user, syncWithCloud } = useAuth();
  const [rawPool, setRawPool] = useState<Beatmap[]>([]);
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
  const [activeEvent, setActiveEvent] = useState<ActiveEventState | null>(null);
  const [cardOverrides, setCardOverrides] = useState<CardTierOverridesMap>({});

  // 3-Tier Pull Energy: Main (50), Reserve (100), Bonus (uncapped)
  const [energy, setEnergy] = useState<PullEnergyState>(DEFAULT_ENERGY_STATE);
  const [countdownSeconds, setCountdownSeconds] = useState<number>(15);

  // Apply manual card tier overrides to pool
  const pool = useMemo(() => {
    if (Object.keys(cardOverrides).length === 0) return rawPool;
    return rawPool.map((map) => {
      const override = cardOverrides[String(map.id)];
      if (override) {
        return {
          ...map,
          rarity: override.tier,
          exReason: override.exReason,
        };
      }
      return map;
    });
  }, [rawPool, cardOverrides]);

  const poolMap = useMemo(() => {
    return new Map<number, Beatmap>(pool.map((m: Beatmap) => [m.id, m]));
  }, [pool]);

  const totalEnergy = useMemo(() => {
    return (energy.current || 0) + (energy.reserve || 0) + (energy.bonus || 0);
  }, [energy]);

  const regenIntervalMs = useMemo(() => {
    return activeEvent && activeEvent.fastRecharge ? 5000 : BASE_REGEN_INTERVAL_MS;
  }, [activeEvent]);

  // Dynamically computed rates factoring event multipliers and EX tier
  const currentRates: RarityRates = useMemo(() => {
    const base = { ...DEFAULT_RARITY_RATES };
    if (!activeEvent || !activeEvent.active) return base;

    const mult = activeEvent.rateMultiplier || 1;
    if (mult <= 1) return base;

    const boostedEX = Math.min(0.05, (base.EX || 0.0004) * mult);
    const boostedGOAT = Math.min(0.01, (base.GOAT || 0.0001) * mult);
    const boostedDivine = Math.min(0.02, (base.Divine || 0.0005) * mult);
    const boostedCelestial = Math.min(0.03, (base.Celestial || 0.001) * mult);
    const boostedMythic = Math.min(0.05, (base.Mythic || 0.0025) * mult);
    const boostedLegendary = Math.min(0.10, (base.Legendary || 0.0075) * mult);

    const highTierDelta =
      (boostedEX - (base.EX || 0)) +
      (boostedGOAT - (base.GOAT || 0)) +
      (boostedDivine - (base.Divine || 0)) +
      (boostedCelestial - (base.Celestial || 0)) +
      (boostedMythic - (base.Mythic || 0)) +
      (boostedLegendary - (base.Legendary || 0));

    const lowerTotal = (base.Common || 0.3) + (base.Uncommon || 0.29);
    const scale = Math.max(0.1, (lowerTotal - highTierDelta) / lowerTotal);

    return {
      ...base,
      Common: (base.Common || 0.3) * scale,
      Uncommon: (base.Uncommon || 0.29) * scale,
      Legendary: boostedLegendary,
      Mythic: boostedMythic,
      Celestial: boostedCelestial,
      Divine: boostedDivine,
      GOAT: boostedGOAT,
      EX: boostedEX,
    };
  }, [activeEvent]);

  // Fetch active event & card overrides from Supabase
  useEffect(() => {
    async function loadCloudConfigs() {
      try {
        const [evRes, ovRes] = await Promise.all([
          supabase.from('admin_config').select('value').eq('key', 'active_event_preset').maybeSingle(),
          supabase.from('admin_config').select('value').eq('key', 'card_tier_overrides').maybeSingle(),
        ]);

        if (evRes.data && evRes.data.value && evRes.data.value.active && !evRes.error) {
          const ev: ActiveEventState = evRes.data.value;
          if (!ev.expiresAt || new Date(ev.expiresAt).getTime() > Date.now()) {
            setActiveEvent(ev);
          }
        }

        if (ovRes.data && ovRes.data.value && !ovRes.error) {
          setCardOverrides(ovRes.data.value as CardTierOverridesMap);
        }
      } catch (err) {
        console.warn('Error loading active cloud configs:', err);
      }
    }
    loadCloudConfigs();
  }, []);

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

      setRawPool(loaderRes.maps);
      setDatasetInfo(loaderRes.info);
      setIsFallbackDataset(loaderRes.isFallback);

      setCollectionRecords(savedRecords);
      const colMap = new Map<number, CollectionRecord>();
      for (const rec of savedRecords) {
        colMap.set(rec.beatmapId, rec);
      }
      setCollectionMap(colMap);
      setTotalPulls(savedPulls);
      setPityCount(savedPity);

      const mapLookup = new Map<number, Beatmap>(loaderRes.maps.map((m: Beatmap) => [m.id, m]));
      const hydratedHistory = savedHistory
        .map((h: any) => {
          const map = mapLookup.get(h.beatmapId);
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

      // Offline Multi-Tier Energy Recovery
      const now = Date.now();
      const currentInterval = 15000;
      const elapsed = Math.max(0, now - savedEnergy.lastRefillTime);
      const pullsToAdd = Math.floor(elapsed / currentInterval);

      let cur = savedEnergy.current;
      let res = savedEnergy.reserve || 0;
      let bon = savedEnergy.bonus || 0;

      // Post-Maintenance 500 Bonus Pulls Distribution (just this once)
      const maintenanceGiftKey = 'maintenance_compensation_500_pulls';
      if (!localStorage.getItem(maintenanceGiftKey)) {
        bon += 500;
        localStorage.setItem(maintenanceGiftKey, 'true');
      }

      if (pullsToAdd > 0) {
        if (cur < MAX_MAIN_ENERGY) {
          const needed = MAX_MAIN_ENERGY - cur;
          const toMain = Math.min(needed, pullsToAdd);
          cur += toMain;
          const remaining = pullsToAdd - toMain;
          if (remaining > 0) {
            res = Math.min(MAX_RESERVE_ENERGY, res + remaining);
          }
        } else {
          res = Math.min(MAX_RESERVE_ENERGY, res + pullsToAdd);
        }
      }

      const newLastRefill =
        cur >= MAX_MAIN_ENERGY && res >= MAX_RESERVE_ENERGY ? now : savedEnergy.lastRefillTime + pullsToAdd * currentInterval;

      const updatedEnergy: PullEnergyState = {
        current: cur,
        max: MAX_MAIN_ENERGY,
        reserve: res,
        reserveMax: MAX_RESERVE_ENERGY,
        bonus: bon,
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

  // Real-time Energy Regeneration Timer (Supports Main -> Reserve overflow)
  useEffect(() => {
    const timer = setInterval(() => {
      setEnergy((prev) => {
        const cur = prev.current;
        const res = prev.reserve || 0;

        if (cur >= prev.max && res >= (prev.reserveMax || 100)) {
          setCountdownSeconds(Math.round(regenIntervalMs / 1000));
          return prev;
        }

        const now = Date.now();
        const elapsed = Math.max(0, now - prev.lastRefillTime);
        const pullsToAdd = Math.floor(elapsed / regenIntervalMs);

        if (pullsToAdd > 0) {
          let nextCur = cur;
          let nextRes = res;

          if (nextCur < prev.max) {
            const needed = prev.max - nextCur;
            const toMain = Math.min(needed, pullsToAdd);
            nextCur += toMain;
            const remaining = pullsToAdd - toMain;
            if (remaining > 0) {
              nextRes = Math.min(prev.reserveMax || 100, nextRes + remaining);
            }
          } else {
            nextRes = Math.min(prev.reserveMax || 100, nextRes + pullsToAdd);
          }

          const isFull = nextCur >= prev.max && nextRes >= (prev.reserveMax || 100);
          const nextRefill = isFull ? now : prev.lastRefillTime + pullsToAdd * regenIntervalMs;

          const nextState: PullEnergyState = {
            ...prev,
            current: nextCur,
            reserve: nextRes,
            lastRefillTime: nextRefill,
          };
          savePullEnergyState(nextState).catch(() => {});
          return nextState;
        }

        const remainingMs = regenIntervalMs - (elapsed % regenIntervalMs);
        setCountdownSeconds(Math.max(1, Math.ceil(remainingMs / 1000)));
        return prev;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [regenIntervalMs]);

  const timeToFullFormatted = useMemo(() => {
    if (energy.current >= energy.max) {
      if ((energy.reserve || 0) >= (energy.reserveMax || 100)) return 'MAX';
      return `+${energy.reserve || 0} RSV`;
    }
    const missingPulls = energy.max - energy.current;
    const totalSeconds = (missingPulls - 1) * Math.round(regenIntervalMs / 1000) + countdownSeconds;
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }, [energy, countdownSeconds, regenIntervalMs]);

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

  /** Add directly to uncapped bonus stamina (from giveaways, quiz, admin) */
  const addBonusEnergy = useCallback(async (amount: number) => {
    setEnergy((prev) => {
      const nextState: PullEnergyState = {
        ...prev,
        bonus: (prev.bonus || 0) + amount,
      };
      savePullEnergyState(nextState).catch(() => {});
      return nextState;
    });
  }, []);

  /** Admin-only: set energy (large values overflow directly to bonus stamina) */
  const adminRefillEnergy = useCallback(async (amount: number) => {
    setEnergy((prev) => {
      const nextState: PullEnergyState = {
        ...prev,
        current: Math.min(prev.max, amount),
        bonus: (prev.bonus || 0) + Math.max(0, amount - prev.max),
        lastRefillTime: Date.now(),
      };
      savePullEnergyState(nextState).catch(() => {});
      return nextState;
    });
  }, []);

  /** Admin: Set manual card tier and EX reason */
  const setCardTierOverride = useCallback(
    async (beatmapId: number, tier: RarityTier, exReason?: string) => {
      const updatedOverrides: CardTierOverridesMap = {
        ...cardOverrides,
        [String(beatmapId)]: {
          tier,
          exReason: exReason?.trim() || undefined,
          assignedBy: user?.username || 'Admin',
          assignedAt: new Date().toISOString(),
        },
      };
      setCardOverrides(updatedOverrides);
      await supabase.from('admin_config').upsert({
        key: 'card_tier_overrides',
        value: updatedOverrides,
        updated_at: new Date().toISOString(),
      });
    },
    [cardOverrides, user?.username]
  );

  /** Admin: Remove manual card tier override */
  const removeCardTierOverride = useCallback(
    async (beatmapId: number) => {
      const updatedOverrides = { ...cardOverrides };
      delete updatedOverrides[String(beatmapId)];
      setCardOverrides(updatedOverrides);
      await supabase.from('admin_config').upsert({
        key: 'card_tier_overrides',
        value: updatedOverrides,
        updated_at: new Date().toISOString(),
      });
    },
    [cardOverrides]
  );

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
    for (const rec of savedRecords) {
      colMap.set(rec.beatmapId, rec);
    }
    setCollectionMap(colMap);
    setTotalPulls(savedPulls);
    setPityCount(savedPity);
    setEnergy(savedEnergy);

    const mapLookup = new Map<number, Beatmap>(rawPool.map((m: Beatmap) => [m.id, m]));
    const hydratedHistory = savedHistory
      .map((h: any) => {
        const map = mapLookup.get(h.beatmapId);
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
  }, [rawPool]);

  const forceCloudSync = useCallback(async () => {
    if (!isAuthenticated || !user) return;
    try {
      const syncResult = await syncWithCloud({
        collection: collectionRecords.map((c) => ({
          beatmapId: c.beatmapId,
          copies: c.copies,
          firstPulledAt: c.firstPulledAt,
          lastPulledAt: c.lastPulledAt,
          isFavorite: !!c.isFavorite,
        })),
        history,
        totalPulls,
        pityCount,
      });
      if (syncResult && syncResult.mergedCollection) {
        const records: CollectionRecord[] = syncResult.mergedCollection.map((c) => ({
          beatmapId: c.beatmapId,
          copies: c.copies,
          firstPulledAt: c.firstPulledAt,
          lastPulledAt: c.lastPulledAt,
          isFavorite: c.isFavorite,
        }));
        setCollectionRecords(records);
        const newMap = new Map<number, CollectionRecord>();
        for (const rec of records) {
          newMap.set(rec.beatmapId, rec);
        }
        setCollectionMap(newMap);
        if (typeof syncResult.cloudTotalPulls === 'number') {
          setTotalPulls(syncResult.cloudTotalPulls);
        }
        if (typeof syncResult.cloudPityCount === 'number') {
          setPityCount(syncResult.cloudPityCount);
        }
      }
      if (syncResult && typeof syncResult.energyOverride === 'number') {
        await adminRefillEnergy(syncResult.energyOverride);
      }
    } catch (err) {
      console.warn('Manual cloud sync failed:', err);
    }
  }, [isAuthenticated, user, syncWithCloud, collectionRecords, history, totalPulls, pityCount, adminRefillEnergy]);

  const pull = useCallback(
    async (count: number): Promise<PullResult[]> => {
      if (pool.length === 0) {
        throw new Error('Beatmap pool is not loaded yet');
      }

      const availableEnergy = (energy.current || 0) + (energy.reserve || 0) + (energy.bonus || 0);
      if (availableEnergy < count) {
        throw new Error(`Not enough pull stamina! Need ${count} energy (have ${availableEnergy}).`);
      }

      previewPlayer.pause();

      const { results, finalPity } = executeMultiPull(count, pool, collectionMap, activeBanner.id, pityCount, currentRates);
      setPityCount(finalPity);
      await savePityCount(finalPity);

      // Deduct energy in priority: Main -> Reserve -> Bonus
      let needed = count;
      let newCur = energy.current;
      let newRes = energy.reserve || 0;
      let newBon = energy.bonus || 0;

      if (newCur > 0) {
        const take = Math.min(newCur, needed);
        newCur -= take;
        needed -= take;
      }
      if (needed > 0 && newRes > 0) {
        const take = Math.min(newRes, needed);
        newRes -= take;
        needed -= take;
      }
      if (needed > 0 && newBon > 0) {
        const take = Math.min(newBon, needed);
        newBon -= take;
        needed -= take;
      }

      const now = Date.now();
      const newEnergyState: PullEnergyState = {
        ...energy,
        current: newCur,
        reserve: newRes,
        bonus: newBon,
        lastRefillTime: energy.current >= energy.max ? now : energy.lastRefillTime,
      };
      setEnergy(newEnergyState);
      await savePullEnergyState(newEnergyState);

      await savePullResults(results);

      const updatedMap = new Map(collectionMap);
      for (const res of results) {
        const prev = updatedMap.get(res.beatmap.id);
        updatedMap.set(res.beatmap.id, {
          beatmapId: res.beatmap.id,
          copies: res.currentCopies,
          firstPulledAt: prev ? prev.firstPulledAt : res.pulledAt,
          lastPulledAt: res.pulledAt,
          isFavorite: prev ? prev.isFavorite : false,
        });
      }
      setCollectionMap(updatedMap);
      setCollectionRecords(Array.from(updatedMap.values()));

      const newTotalPulls = totalPulls + count;
      setTotalPulls(newTotalPulls);

      const newHistoryItems: PullHistoryItem[] = results.map((r: PullResult, i: number) => ({
        id: `${r.pulledAt}-${i}`,
        beatmapId: r.beatmap.id,
        beatmap: r.beatmap,
        rarity: r.beatmap.rarity,
        isNew: r.isNew,
        pulledAt: r.pulledAt,
      }));
      const updatedHistory = [...newHistoryItems, ...history].slice(0, 50);
      setHistory(updatedHistory);
      setRecentPulls(results);

      if (isAuthenticated) {
        syncWithCloud({
          collection: Array.from(updatedMap.values()).map((c) => ({
            beatmapId: c.beatmapId,
            copies: c.copies,
            firstPulledAt: c.firstPulledAt,
            lastPulledAt: c.lastPulledAt,
            isFavorite: !!c.isFavorite,
          })),
          history: updatedHistory,
          totalPulls: newTotalPulls,
          pityCount: finalPity,
        }).catch((err) => console.warn('Background pull sync error:', err));
      }

      return results;
    },
    [pool, collectionMap, activeBanner.id, energy, pityCount, totalPulls, history, currentRates, isAuthenticated, syncWithCloud]
  );

  const toggleFavorite = useCallback(
    async (beatmapId: number): Promise<boolean> => {
      const rec = collectionMap.get(beatmapId);
      if (!rec) return false;

      const newStatus = await dbToggleFavorite(beatmapId);

      const updatedMap = new Map(collectionMap);
      const updatedRec = { ...rec, isFavorite: newStatus };
      updatedMap.set(beatmapId, updatedRec);
      setCollectionMap(updatedMap);
      const newRecords = Array.from(updatedMap.values());
      setCollectionRecords(newRecords);

      if (isAuthenticated) {
        syncWithCloud({
          collection: newRecords.map((c) => ({
            beatmapId: c.beatmapId,
            copies: c.copies,
            firstPulledAt: c.firstPulledAt,
            lastPulledAt: c.lastPulledAt,
            isFavorite: !!c.isFavorite,
          })),
          history,
          totalPulls,
          pityCount,
        }).catch((err) => console.warn('Background favorite sync error:', err));
      }

      return newStatus;
    },
    [collectionMap, totalPulls, pityCount, history, isAuthenticated, syncWithCloud]
  );

  const updateSettings = useCallback(async (newSettings: Partial<UserSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    await saveUserSettings(updated);
    if (newSettings.soundEnabled !== undefined) {
      sfx.setEnabled(newSettings.soundEnabled);
    }
    if (newSettings.sfxVolume !== undefined) {
      sfx.setVolume(newSettings.sfxVolume);
    }
    if (newSettings.bgmVolume !== undefined) {
      previewPlayer.setVolume(newSettings.bgmVolume);
    }
  }, [settings]);

  const resetCollection = useCallback(async () => {
    await clearAllData();
    setCollectionRecords([]);
    setCollectionMap(new Map());
    setTotalPulls(0);
    setPityCount(0);
    setHistory([]);
    setRecentPulls([]);
    const resetEnergy: PullEnergyState = {
      ...DEFAULT_ENERGY_STATE,
      lastRefillTime: Date.now(),
    };
    await savePullEnergyState(resetEnergy);
    setEnergy(resetEnergy);
  }, []);

  const stats: CollectionStats = useMemo(() => {
    let totalCopies = 0;
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
      EX: 0,
    };
    let totalStars = 0;
    let mostCopiesMap: { beatmap: Beatmap; copies: number } | null = null;
    let highestRarityObtained: RarityTier | null = null;
    const RARITY_WEIGHT: Record<RarityTier, number> = {
      EX: 11,
      GOAT: 10,
      Divine: 9,
      Celestial: 8,
      Mythic: 7,
      Legendary: 6,
      Epic: 5,
      Rare: 4,
      'Uncommon+': 3,
      Uncommon: 2,
      Common: 1,
    };

    for (const rec of collectionRecords) {
      const map = poolMap.get(rec.beatmapId);
      if (!map) continue;

      totalCopies += rec.copies;
      rarityCounts[map.rarity] = (rarityCounts[map.rarity] || 0) + 1;
      totalStars += map.stars;

      if (!mostCopiesMap || rec.copies > mostCopiesMap.copies) {
        mostCopiesMap = { beatmap: map, copies: rec.copies };
      }

      if (
        !highestRarityObtained ||
        (RARITY_WEIGHT[map.rarity] || 0) > (RARITY_WEIGHT[highestRarityObtained] || 0)
      ) {
        highestRarityObtained = map.rarity;
      }
    }

    const uniqueOwned = collectionRecords.length;
    const totalInPool = pool.length;
    const completionPercentage = totalInPool > 0 ? parseFloat(((uniqueOwned / totalInPool) * 100).toFixed(2)) : 0;
    const averageStarRating = uniqueOwned > 0 ? parseFloat((totalStars / uniqueOwned).toFixed(2)) : 0;

    return {
      totalPulls,
      uniqueOwned,
      totalCopies,
      totalInPool,
      completionPercentage,
      averageStarRating,
      rarityCounts,
      mostCopiesMap,
      highestRarityObtained,
    };
  }, [collectionRecords, totalPulls, pool.length, poolMap]);

  const value: GachaContextType = {
    pool,
    poolMap,
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
    totalEnergy,
    activeEvent,
    cardOverrides,
    currentRates,
    countdownSeconds,
    timeToFullFormatted,
    setActiveBanner,
    pull,
    refillEnergy,
    addBonusEnergy,
    adminRefillEnergy,
    setCardTierOverride,
    removeCardTierOverride,
    toggleFavorite,
    updateSettings,
    resetCollection,
    refreshCollection,
    forceCloudSync,
  };

  return <GachaContext.Provider value={value}>{children}</GachaContext.Provider>;
};

export const useGacha = (): GachaContextType => {
  const context = useContext(GachaContext);
  if (!context) {
    throw new Error('useGacha must be used within a GachaProvider');
  }
  return context;
};
