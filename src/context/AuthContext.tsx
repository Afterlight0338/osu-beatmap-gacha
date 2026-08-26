import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { OsuAuthUser, CloudSyncCollectionItem, CloudSyncHistoryItem } from '../types/auth';
import { PullEnergyState } from '../types/collection';
import { WORKER_API_URL } from '../config/api';
import { supabase } from '../lib/supabase';
import {
  enqueuePendingSync,
  getPendingSyncQueue,
  deletePendingSyncEntry,
  getPendingSyncCount,
} from '../storage/db';

const TOKEN_STORAGE_KEY = 'osu_gacha_session_token';

interface AuthContextType {
  user: OsuAuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isSyncing: boolean;
  lastSyncedAt: Date | null;
  authError: string | null;
  /** How many local mutations are still waiting to be pushed to D1 */
  pendingSyncCount: number;
  loginWithOsu: () => void;
  logout: () => Promise<void>;
  syncWithCloud: (localCollection?: {
    collection?: CloudSyncCollectionItem[];
    history?: CloudSyncHistoryItem[];
    totalPulls?: number;
    pityCount?: number;
    energy?: PullEnergyState;
  }) => Promise<{
    mergedCollection?: CloudSyncCollectionItem[];
    mergedHistory?: CloudSyncHistoryItem[];
    cloudTotalPulls?: number;
    cloudPityCount?: number;
    energyOverride?: number | null;
    cloudEnergy?: PullEnergyState;
    config?: Record<string, unknown>;
  } | null>;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<OsuAuthUser | null>(null);
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);

  // Refresh the pending count from IDB
  const refreshPendingCount = useCallback(async () => {
    const count = await getPendingSyncCount();
    setPendingSyncCount(count);
  }, []);

  /**
   * Fetch current user profile using the active session token
   */
  const fetchUserProfile = useCallback(async (authToken: string): Promise<OsuAuthUser | null> => {
    try {
      const res = await fetch(`${WORKER_API_URL}/api/me`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (!res.ok) {
        if (res.status === 401) {
          // Token expired or invalid
          localStorage.removeItem(TOKEN_STORAGE_KEY);
          setToken(null);
          setUser(null);
        }
        return null;
      }

      const data = await res.json();
      if (data.success && data.user) {
        setUser(data.user);
        return data.user;
      }
      return null;
    } catch (err) {
      console.warn('Could not connect to Cloudflare Worker auth endpoint:', err);
      return null;
    }
  }, []);

  /**
   * Check for OAuth callback token in URL on initial page mount
   */
  useEffect(() => {
    const handleUrlCallback = async () => {
      setIsLoading(true);

      const urlParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));

      const urlToken = urlParams.get('token') || hashParams.get('token');
      const urlError = urlParams.get('auth_error') || hashParams.get('auth_error');

      if (urlError) {
        setAuthError(decodeURIComponent(urlError));
      }

      if (urlToken) {
        // Save extracted token from osu! OAuth callback
        localStorage.setItem(TOKEN_STORAGE_KEY, urlToken);
        setToken(urlToken);

        // Remove token from browser address bar cleanly without page refresh
        const cleanUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);

        await fetchUserProfile(urlToken);
      } else if (token) {
        // Verify existing stored token
        await fetchUserProfile(token);
      }

      setIsLoading(false);
    };

    handleUrlCallback();
  }, [fetchUserProfile, token]);

  /**
   * Redirect user to osu! OAuth2 login endpoint on the Cloudflare Worker
   */
  const loginWithOsu = useCallback(() => {
    setAuthError(null);
    // Build return redirect URL back to the current site origin + path
    const returnUrl = window.location.origin + window.location.pathname;
    const loginUrl = `${WORKER_API_URL}/auth/login?redirect_uri=${encodeURIComponent(returnUrl)}`;
    window.location.href = loginUrl;
  }, []);

  /**
   * Logout user, invalidate token, and clear state
   */
  const logout = useCallback(async () => {
    if (token) {
      try {
        await fetch(`${WORKER_API_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      } catch (err) {
        console.warn('Logout network error:', err);
      }
    }

    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
    setUser(null);
    setLastSyncedAt(null);
  }, [token]);

  /**
   * Drain pending offline mutations directly to Supabase
   */
  const drainPendingQueue = useCallback(async (currentOsuId: number) => {
    try {
      const queue = await getPendingSyncQueue();
      if (queue.length === 0) {
        setPendingSyncCount(0);
        return;
      }

      for (const entry of queue) {
        // Direct Supabase collection upsert in 200-item chunks
        if (entry.collection && entry.collection.length > 0) {
          for (let i = 0; i < entry.collection.length; i += 200) {
            const chunk = entry.collection.slice(i, i + 200);
            await supabase.from('user_collection').upsert(
              chunk.map((c) => ({
                osu_id: currentOsuId,
                beatmap_id: c.beatmapId,
                copies: c.copies,
                first_pulled_at: c.firstPulledAt,
                last_pulled_at: c.lastPulledAt,
                is_favorite: c.isFavorite,
              }))
            );
          }
        }

        if (entry.history && entry.history.length > 0) {
          await supabase.from('user_history').upsert(
            entry.history.map((h) => ({
              id: h.id,
              osu_id: currentOsuId,
              beatmap_id: h.beatmapId,
              rarity: h.rarity,
              pulled_at: h.pulledAt,
            }))
          );
        }

        if (typeof entry.totalPulls === 'number' || typeof entry.pityCount === 'number') {
          const uPayload: Record<string, unknown> = {};
          if (typeof entry.totalPulls === 'number') uPayload.total_pulls = entry.totalPulls;
          if (typeof entry.pityCount === 'number') uPayload.pity_count = entry.pityCount;
          await supabase.from('users').update(uPayload).eq('osu_id', currentOsuId);
        }

        // Delete processed item from local IndexedDB queue
        await deletePendingSyncEntry(entry.id);
      }

      await refreshPendingCount();
    } catch (e) {
      console.warn('Queue drain notice:', e);
    }
  }, [refreshPendingCount]);

  /**
   * Synchronize local collection and stats 100% directly with Supabase Cloud
   */
  const syncWithCloud = useCallback(
    async (localData?: {
      collection?: CloudSyncCollectionItem[];
      history?: CloudSyncHistoryItem[];
      totalPulls?: number;
      pityCount?: number;
      energy?: PullEnergyState;
    }) => {
      if (!token || !user || !user.osuId) return null;

      setIsSyncing(true);
      try {
        // 1. Direct Supabase write (Fast, reliable, atomic)
        if (localData) {
          if (localData.collection && localData.collection.length > 0) {
            for (let i = 0; i < localData.collection.length; i += 200) {
              const chunk = localData.collection.slice(i, i + 200);
              const { error: colErr } = await supabase.from('user_collection').upsert(
                chunk.map((c) => ({
                  osu_id: user.osuId,
                  beatmap_id: c.beatmapId,
                  copies: c.copies,
                  first_pulled_at: c.firstPulledAt,
                  last_pulled_at: c.lastPulledAt,
                  is_favorite: c.isFavorite,
                }))
              );
              if (colErr) console.warn('Supabase collection batch upsert notice:', colErr);
            }
          }

          if (localData.history && localData.history.length > 0) {
            const { error: histErr } = await supabase.from('user_history').upsert(
              localData.history.map((h) => ({
                id: h.id,
                osu_id: user.osuId,
                beatmap_id: h.beatmapId,
                rarity: h.rarity,
                pulled_at: h.pulledAt,
              }))
            );
            if (histErr) console.warn('Supabase history upsert notice:', histErr);
          }

          // Guard: Only update total_pulls if > 0 (prevents overwriting real pulls with 0 on fresh mount)
          if (typeof localData.totalPulls === 'number' && localData.totalPulls > 0) {
            const uPayload: Record<string, unknown> = {
              total_pulls: localData.totalPulls,
            };
            if (typeof localData.pityCount === 'number') uPayload.pity_count = localData.pityCount;
            await supabase.from('users').update(uPayload).eq('osu_id', user.osuId);
          }

          // Save authoritative energy state to cloud
          if (localData.energy) {
            await supabase.from('admin_config').upsert({
              key: `user_energy_${user.osuId}`,
              value: {
                ...localData.energy,
                totalPulls: localData.totalPulls,
                pityCount: localData.pityCount,
                updatedAt: Date.now(),
              },
              updated_at: new Date().toISOString(),
            });
          }
        }

        // 2. Drain any queued local offline mutations
        await drainPendingQueue(user.osuId);

        setLastSyncedAt(new Date());

        // 3. Fetch full collection using parallel auto-pagination (bypasses PostgREST 1000 row limit)
        const pageSize = 1000;
        const countQuery = await supabase
          .from('user_collection')
          .select('*', { count: 'exact', head: true })
          .eq('osu_id', user.osuId);

        const totalCardsCount = countQuery.count || 0;
        const totalPages = Math.max(1, Math.ceil(totalCardsCount / pageSize));
        const pagePromises = [];

        for (let page = 0; page < totalPages; page++) {
          pagePromises.push(
            supabase
              .from('user_collection')
              .select('beatmap_id, copies, first_pulled_at, last_pulled_at, is_favorite')
              .eq('osu_id', user.osuId)
              .range(page * pageSize, (page + 1) * pageSize - 1)
          );
        }

        const [pageResults, userRes, histRes, overrideRes, configRes] = await Promise.all([
          Promise.all(pagePromises),
          supabase
            .from('users')
            .select('total_pulls, pity_count')
            .eq('osu_id', user.osuId)
            .maybeSingle(),
          supabase
            .from('user_history')
            .select('id, beatmap_id, rarity, pulled_at')
            .eq('osu_id', user.osuId)
            .order('pulled_at', { ascending: false })
            .limit(50),
          supabase
            .from('user_energy_overrides')
            .select('energy_amount')
            .eq('osu_id', user.osuId)
            .maybeSingle(),
          supabase
            .from('admin_config')
            .select('key, value'),
        ]);

        const allCards: CloudSyncCollectionItem[] = [];
        for (const pRes of pageResults) {
          if (pRes.data) {
            for (const c of pRes.data) {
              allCards.push({
                beatmapId: c.beatmap_id,
                copies: c.copies,
                firstPulledAt: c.first_pulled_at,
                lastPulledAt: c.last_pulled_at,
                isFavorite: c.is_favorite,
              });
            }
          }
        }

        // Consume energy override if set by admin
        let energyOverrideVal: number | null = null;
        if (overrideRes.data && typeof overrideRes.data.energy_amount === 'number') {
          energyOverrideVal = overrideRes.data.energy_amount;
          await supabase.from('user_energy_overrides').delete().eq('osu_id', user.osuId);
        }

        const configMap: Record<string, unknown> = {};
        if (configRes.data) {
          for (const item of configRes.data) {
            configMap[item.key] = item.value;
          }
        }

        const energyKey = `user_energy_${user.osuId}`;
        let cloudEnergy: PullEnergyState | undefined;
        if (configMap[energyKey] && typeof (configMap[energyKey] as any)?.current === 'number') {
          cloudEnergy = configMap[energyKey] as PullEnergyState;
        }

        return {
          mergedCollection: allCards,
          mergedHistory: (histRes.data || []).map((h: any) => ({
            id: h.id,
            beatmapId: h.beatmap_id,
            rarity: h.rarity,
            pulledAt: h.pulled_at,
          })),
          cloudTotalPulls: userRes.data?.total_pulls,
          cloudPityCount: userRes.data?.pity_count,
          energyOverride: energyOverrideVal,
          cloudEnergy,
          config: configMap,
        };
      } catch (err) {
        console.warn('Supabase cloud synchronization notice — queuing locally:', err);
        if (localData && (localData.collection?.length || localData.history?.length || localData.totalPulls)) {
          await enqueuePendingSync({
            totalPulls: localData.totalPulls || 0,
            pityCount: localData.pityCount || 0,
            collection: localData.collection || [],
            history: localData.history || [],
          }).catch(() => {});
        }
        await refreshPendingCount();
        return null;
      } finally {
        setIsSyncing(false);
      }
    },
    [token, user, refreshPendingCount, drainPendingQueue]
  );

  // Auto-drain pending syncs on startup and periodically
  useEffect(() => {
    refreshPendingCount();
    if (user?.osuId) {
      drainPendingQueue(user.osuId);
      const interval = setInterval(() => {
        drainPendingQueue(user.osuId);
      }, 15000);
      return () => clearInterval(interval);
    }
  }, [user?.osuId, refreshPendingCount, drainPendingQueue]);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: Boolean(user && token),
        isLoading,
        isSyncing,
        lastSyncedAt,
        authError,
        pendingSyncCount,
        loginWithOsu,
        logout,
        syncWithCloud,
        clearAuthError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
