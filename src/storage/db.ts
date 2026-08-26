import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { CollectionRecord, UserSettings, CollectionExportData, PullEnergyState } from '../types/collection';
import { PullResult } from '../types/gacha';

const DB_NAME = 'osu_beatmap_gacha_db';
const DB_VERSION = 2; // bumped to add pendingSync store

interface OsuGachaDB extends DBSchema {
  collection: {
    key: number;
    value: CollectionRecord;
    indexes: {
      'by-copies': number;
      'by-lastPulled': number;
    };
  };
  history: {
    key: string;
    value: {
      id: string;
      beatmapId: number;
      rarity: string;
      isNew: boolean;
      pulledAt: number;
    };
    indexes: {
      'by-pulledAt': number;
    };
  };
  meta: {
    key: string;
    value: any;
  };
  /**
   * Pending cloud sync queue.
   * Each entry represents a batch of mutations that failed to reach D1.
   * The queue is drained automatically on the next successful sync.
   */
  pendingSync: {
    key: string; // UUID
    value: {
      id: string;
      queuedAt: number;
      totalPulls: number;
      pityCount: number;
      collection: {
        beatmapId: number;
        copies: number;
        firstPulledAt: number;
        lastPulledAt: number;
        isFavorite: boolean;
      }[];
      history: {
        id: string;
        beatmapId: number;
        rarity: string;
        pulledAt: number;
      }[];
    };
  };
}

let dbPromise: Promise<IDBPDatabase<OsuGachaDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<OsuGachaDB>> {
  if (!dbPromise) {
    dbPromise = openDB<OsuGachaDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        // Collection Store
        if (!db.objectStoreNames.contains('collection')) {
          const colStore = db.createObjectStore('collection', { keyPath: 'beatmapId' });
          colStore.createIndex('by-copies', 'copies');
          colStore.createIndex('by-lastPulled', 'lastPulledAt');
        }

        // History Store
        if (!db.objectStoreNames.contains('history')) {
          const histStore = db.createObjectStore('history', { keyPath: 'id' });
          histStore.createIndex('by-pulledAt', 'pulledAt');
        }

        // Meta Store
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta');
        }

        // v2: Pending cloud sync queue (added for offline resilience)
        if (oldVersion < 2 && !db.objectStoreNames.contains('pendingSync')) {
          db.createObjectStore('pendingSync', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}


export const DEFAULT_SETTINGS: UserSettings = {
  soundEnabled: true,
  sfxVolume: 0.7,
  bgmVolume: 0.5,
  fastAnimation: false,
  theme: 'dark',
};

/**
 * Fetch all collection records from IndexedDB.
 */
export async function getCollectionRecords(): Promise<CollectionRecord[]> {
  const db = await getDB();
  return db.getAll('collection');
}

/**
 * Fetch a single collection record by beatmap ID.
 */
export async function getCollectionRecord(beatmapId: number): Promise<CollectionRecord | undefined> {
  const db = await getDB();
  return db.get('collection', beatmapId);
}

/**
 * Record new pull results into IndexedDB atomically.
 */
export async function savePullResults(results: PullResult[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['collection', 'history', 'meta'], 'readwrite');

  const currentTotalPulls = (await tx.objectStore('meta').get('totalPulls')) || 0;
  await tx.objectStore('meta').put(currentTotalPulls + results.length, 'totalPulls');

  for (const pull of results) {
    const existing = await tx.objectStore('collection').get(pull.beatmap.id);
    const newRecord: CollectionRecord = {
      beatmapId: pull.beatmap.id,
      copies: (existing?.copies || 0) + 1,
      firstPulledAt: existing?.firstPulledAt || pull.pulledAt,
      lastPulledAt: pull.pulledAt,
      isFavorite: existing?.isFavorite || false,
    };
    await tx.objectStore('collection').put(newRecord);

    // Save history entry
    const historyId = `${pull.pulledAt}-${pull.beatmap.id}-${Math.random().toString(36).substring(2, 7)}`;
    await tx.objectStore('history').put({
      id: historyId,
      beatmapId: pull.beatmap.id,
      rarity: pull.beatmap.rarity,
      isNew: pull.isNew,
      pulledAt: pull.pulledAt,
    });
  }

  await tx.done;
}

/**
 * Toggle favorite status of a beatmap in collection.
 */
export async function toggleFavorite(beatmapId: number): Promise<boolean> {
  const db = await getDB();
  const tx = db.transaction('collection', 'readwrite');
  const record = await tx.store.get(beatmapId);
  if (!record) return false;

  record.isFavorite = !record.isFavorite;
  await tx.store.put(record);
  await tx.done;
  return record.isFavorite;
}

/**
 * Get pull history logs.
 */
export async function getPullHistory(limit: number = 100): Promise<any[]> {
  const db = await getDB();
  const items = await db.getAllFromIndex('history', 'by-pulledAt');
  return items.reverse().slice(0, limit);
}

/**
 * Get total pulls counter.
 */
export async function getTotalPulls(): Promise<number> {
  const db = await getDB();
  const val = await db.get('meta', 'totalPulls');
  return val || 0;
}

/**
 * Get user settings.
 */
export async function getUserSettings(): Promise<UserSettings> {
  const db = await getDB();
  const val = await db.get('meta', 'settings');
  return { ...DEFAULT_SETTINGS, ...(val || {}) };
}

export const DEFAULT_ENERGY_STATE: PullEnergyState = {
  current: 50,
  max: 50,
  reserve: 0,
  reserveMax: 100,
  bonus: 0,
  lastRefillTime: Date.now(),
};

/**
 * Get pull energy state.
 */
export async function getPullEnergyState(): Promise<PullEnergyState> {
  const db = await getDB();
  const val = await db.get('meta', 'pullEnergy');
  if (!val) {
    return { ...DEFAULT_ENERGY_STATE, lastRefillTime: Date.now() };
  }
  return {
    current: typeof val.current === 'number' ? val.current : 50,
    max: typeof val.max === 'number' ? val.max : 50,
    reserve: typeof val.reserve === 'number' ? val.reserve : 0,
    reserveMax: typeof val.reserveMax === 'number' ? val.reserveMax : 100,
    bonus: typeof val.bonus === 'number' ? val.bonus : 0,
    lastRefillTime: typeof val.lastRefillTime === 'number' ? val.lastRefillTime : Date.now(),
  };
}

/**
 * Save pull energy state.
 */
export async function savePullEnergyState(state: PullEnergyState): Promise<void> {
  const db = await getDB();
  await db.put('meta', state, 'pullEnergy');
}

/**
 * Get pity pull count (pulls since last Legendary+).
 */
export async function getPityCount(): Promise<number> {
  const db = await getDB();
  const val = await db.get('meta', 'pityCount');
  return typeof val === 'number' ? val : 0;
}

/**
 * Save pity pull count.
 */
export async function savePityCount(count: number): Promise<void> {
  const db = await getDB();
  await db.put('meta', count, 'pityCount');
}

/**
 * Save user settings.
 */
export async function saveUserSettings(settings: Partial<UserSettings>): Promise<void> {
  const db = await getDB();
  const current = await getUserSettings();
  await db.put('meta', { ...current, ...settings }, 'settings');
}

/**
 * Export entire collection and history to exportable object.
 */
export async function exportAllData(): Promise<CollectionExportData> {
  const db = await getDB();
  const records = await db.getAll('collection');
  const history = await db.getAll('history');
  const totalPulls = (await db.get('meta', 'totalPulls')) || 0;
  const settings = await getUserSettings();

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    stats: {
      totalPulls,
    },
    records,
    history: history.map((h) => ({
      id: h.id,
      beatmapId: h.beatmapId,
      rarity: h.rarity as any,
      isNew: h.isNew,
      pulledAt: h.pulledAt,
    })),
    settings,
  };
}

/**
 * Import collection data from backup JSON.
 */
export async function importData(
  data: CollectionExportData,
  mode: 'merge' | 'replace' = 'merge'
): Promise<{ importedRecords: number; importedHistory: number }> {
  const db = await getDB();
  const tx = db.transaction(['collection', 'history', 'meta'], 'readwrite');

  if (mode === 'replace') {
    await tx.objectStore('collection').clear();
    await tx.objectStore('history').clear();
    await tx.objectStore('meta').clear();
  }

  // Import records
  for (const record of data.records || []) {
    if (mode === 'merge') {
      const existing = await tx.objectStore('collection').get(record.beatmapId);
      if (existing) {
        await tx.objectStore('collection').put({
          beatmapId: record.beatmapId,
          copies: existing.copies + record.copies,
          firstPulledAt: Math.min(existing.firstPulledAt, record.firstPulledAt),
          lastPulledAt: Math.max(existing.lastPulledAt, record.lastPulledAt),
          isFavorite: existing.isFavorite || record.isFavorite,
        });
      } else {
        await tx.objectStore('collection').put(record);
      }
    } else {
      await tx.objectStore('collection').put(record);
    }
  }

  // Import history
  for (const h of data.history || []) {
    await tx.objectStore('history').put(h);
  }

  // Update total pulls
  const currentTotal = (await tx.objectStore('meta').get('totalPulls')) || 0;
  const newTotal = mode === 'merge' ? currentTotal + (data.stats?.totalPulls || 0) : data.stats?.totalPulls || 0;
  await tx.objectStore('meta').put(newTotal, 'totalPulls');

  if (data.settings) {
    await tx.objectStore('meta').put(data.settings, 'settings');
  }

  await tx.done;

  return {
    importedRecords: data.records?.length || 0,
    importedHistory: data.history?.length || 0,
  };
}

/**
 * Clear all collection and history data (Reset).
 */
export async function clearAllData(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['collection', 'history', 'meta'], 'readwrite');
  await tx.objectStore('collection').clear();
  await tx.objectStore('history').clear();
  await tx.objectStore('meta').put(0, 'totalPulls');
  await tx.objectStore('meta').put(0, 'pityCount');
  await tx.done;
}

/**
 * Merges authoritative collection records and history from Cloudflare D1 into local IndexedDB.
 */
export async function mergeCloudCollectionIntoDB(cloudData: {
  collection?: {
    beatmapId: number;
    copies: number;
    firstPulledAt: number;
    lastPulledAt: number;
    isFavorite: boolean;
  }[];
  history?: {
    id: string;
    beatmapId: number;
    rarity: string;
    pulledAt: number;
  }[];
  totalPulls?: number;
  pityCount?: number;
}): Promise<{ addedCount: number; updatedCount: number }> {
  const db = await getDB();
  const tx = db.transaction(['collection', 'history', 'meta'], 'readwrite');
  let addedCount = 0;
  let updatedCount = 0;

  if (cloudData.collection && Array.isArray(cloudData.collection)) {
    for (const item of cloudData.collection) {
      const existing = await tx.objectStore('collection').get(item.beatmapId);
      if (!existing) {
        await tx.objectStore('collection').put({
          beatmapId: item.beatmapId,
          copies: item.copies || 1,
          firstPulledAt: item.firstPulledAt || Date.now(),
          lastPulledAt: item.lastPulledAt || Date.now(),
          isFavorite: Boolean(item.isFavorite),
        });
        addedCount++;
      } else {
        const merged: CollectionRecord = {
          beatmapId: item.beatmapId,
          copies: Math.max(existing.copies, item.copies),
          firstPulledAt: Math.min(existing.firstPulledAt, item.firstPulledAt),
          lastPulledAt: Math.max(existing.lastPulledAt, item.lastPulledAt),
          isFavorite: existing.isFavorite || Boolean(item.isFavorite),
        };
        await tx.objectStore('collection').put(merged);
        updatedCount++;
      }
    }
  }

  if (cloudData.history && Array.isArray(cloudData.history)) {
    for (const h of cloudData.history) {
      const existingHist = await tx.objectStore('history').get(h.id);
      if (!existingHist) {
        await tx.objectStore('history').put({
          id: h.id,
          beatmapId: h.beatmapId,
          rarity: h.rarity,
          isNew: false,
          pulledAt: h.pulledAt,
        });
      }
    }
  }

  if (typeof cloudData.totalPulls === 'number') {
    const currentTotal = (await tx.objectStore('meta').get('totalPulls')) || 0;
    await tx.objectStore('meta').put(Math.max(currentTotal, cloudData.totalPulls), 'totalPulls');
  }

  if (typeof cloudData.pityCount === 'number') {
    await tx.objectStore('meta').put(cloudData.pityCount, 'pityCount');
  }

  await tx.done;
  return { addedCount, updatedCount };
}

// ─── Pending Cloud Sync Queue ─────────────────────────────────────────────────
// When D1 is unreachable, failed sync payloads are written here.
// The queue is automatically drained the next time a sync succeeds.

type PendingSyncEntry = {
  id: string;
  queuedAt: number;
  totalPulls: number;
  pityCount: number;
  collection: {
    beatmapId: number;
    copies: number;
    firstPulledAt: number;
    lastPulledAt: number;
    isFavorite: boolean;
  }[];
  history: {
    id: string;
    beatmapId: number;
    rarity: string;
    pulledAt: number;
  }[];
};

/**
 * Enqueue a failed sync payload into the local pending-sync queue.
 */
export async function enqueuePendingSync(payload: Omit<PendingSyncEntry, 'id' | 'queuedAt'>): Promise<void> {
  const db = await getDB();
  const entry: PendingSyncEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    queuedAt: Date.now(),
    ...payload,
  };
  await db.put('pendingSync', entry);
}

/**
 * Retrieve all pending sync entries, ordered by queue time (oldest first).
 */
export async function getPendingSyncQueue(): Promise<PendingSyncEntry[]> {
  const db = await getDB();
  const all = await db.getAll('pendingSync');
  return all.sort((a, b) => a.queuedAt - b.queuedAt);
}

/**
 * Remove a successfully synced entry from the queue.
 */
export async function deletePendingSyncEntry(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('pendingSync', id);
}

/**
 * Drain the entire pending queue (call after all entries have been flushed).
 */
export async function clearPendingSyncQueue(): Promise<void> {
  const db = await getDB();
  await db.clear('pendingSync');
}

/**
 * Count how many pending (unsynced) entries are waiting.
 */
export async function getPendingSyncCount(): Promise<number> {
  const db = await getDB();
  return db.count('pendingSync');
}

