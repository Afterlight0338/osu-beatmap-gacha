import { CloudSaveData, OsuUserProfile } from '../types/user';
import { getDB } from '../storage/db';
import { CollectionRecord } from '../types/collection';

const CLOUD_ENDPOINT_KEY = 'osu_gacha_cloud_endpoint';
const AUTH_TOKEN_KEY = 'osu_gacha_auth_token';
const USER_PROFILE_KEY = 'osu_gacha_user_profile';

// Default worker or configurable backend
export function getCloudEndpoint(): string {
  return localStorage.getItem(CLOUD_ENDPOINT_KEY) || 'https://osu-gacha-api.workers.dev';
}

export function setCloudEndpoint(url: string) {
  localStorage.setItem(CLOUD_ENDPOINT_KEY, url.trim().replace(/\/+$/, ''));
}

export function getStoredToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setStoredToken(token: string | null) {
  if (token) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  }
}

export function getStoredProfile(): OsuUserProfile | null {
  const json = localStorage.getItem(USER_PROFILE_KEY);
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function setStoredProfile(profile: OsuUserProfile | null) {
  if (profile) {
    localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile));
  } else {
    localStorage.removeItem(USER_PROFILE_KEY);
  }
}

/**
 * Uploads local progress to the cloud.
 */
export async function uploadProgressToCloud(user: OsuUserProfile): Promise<boolean> {
  const token = getStoredToken();
  const endpoint = getCloudEndpoint();
  if (!user || !user.id) return false;

  try {
    const db = await getDB();
    const collection: CollectionRecord[] = await db.getAll('collection');
    const history: any[] = await db.getAll('history');
    const energyData = localStorage.getItem('osu_gacha_energy');
    const energy = energyData ? JSON.parse(energyData) : { current: 50, max: 50, lastRefillTime: Date.now() };

    const payload: CloudSaveData = {
      userId: user.id,
      username: user.username,
      version: '1.0.0',
      lastSyncedAt: Date.now(),
      collection: collection.map((c) => ({
        beatmapId: c.beatmapId,
        copies: c.copies,
        firstPulledAt: c.firstPulledAt,
        lastPulledAt: c.lastPulledAt,
        isFavorite: !!c.isFavorite,
      })),
      history: history.map((h) => ({
        id: h.id,
        beatmapId: h.beatmapId,
        rarity: h.rarity,
        isNew: h.isNew,
        pulledAt: h.pulledAt,
      })),
      energy,
      stats: {
        totalPulls: history.length,
      },
    };

    // Store in localStorage as cloud cache backup
    localStorage.setItem(`osu_cloud_save_${user.id}`, JSON.stringify(payload));

    if (!token) {
      // Offline local synced
      return true;
    }

    const res = await fetch(`${endpoint}/api/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    return res.ok;
  } catch (err) {
    console.warn('Cloud sync background upload warning:', err);
    return false;
  }
}

/**
 * Downloads progress from the cloud and merges with local IndexedDB.
 */
export async function downloadProgressFromCloud(user: OsuUserProfile): Promise<CloudSaveData | null> {
  const token = getStoredToken();
  const endpoint = getCloudEndpoint();
  if (!user || !user.id) return null;

  try {
    if (token) {
      const res = await fetch(`${endpoint}/api/save?userId=${user.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const data: CloudSaveData = await res.json();
        if (data && Array.isArray(data.collection)) {
          return data;
        }
      }
    }

    // Fallback to local cached cloud save
    const cached = localStorage.getItem(`osu_cloud_save_${user.id}`);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (err) {
    console.warn('Cloud sync download warning:', err);
  }

  return null;
}
