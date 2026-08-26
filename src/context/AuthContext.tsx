import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { OsuAuthUser, CloudSyncCollectionItem, CloudSyncHistoryItem, CloudSyncResponse } from '../types/auth';
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
    collection: CloudSyncCollectionItem[];
    history: CloudSyncHistoryItem[];
    totalPulls: number;
    pityCount: number;
  }) => Promise<{
    mergedCollection?: CloudSyncCollectionItem[];
    mergedHistory?: CloudSyncHistoryItem[];
    cloudTotalPulls?: number;
    cloudPityCount?: number;
    energyOverride?: number | null;
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
   * Drain pending offline mutations to Supabase and Cloudflare D1
   */
  const drainPendingQueue = useCallback(async (currentOsuId: number, authToken: string) => {
    try {
      const queue = await getPendingSyncQueue();
      if (queue.length === 0) {
        setPendingSyncCount(0);
        return;
      }

      for (const entry of queue) {
        // 1. Direct Supabase write
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

        // 2. Also push to worker
        fetch(`${WORKER_API_URL}/api/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            collection: entry.collection,
            history: entry.history,
            totalPulls: entry.totalPulls,
            pityCount: entry.pityCount,
          }),
        }).catch(() => {});

        // Delete from local queue
        await deletePendingSyncEntry(entry.id);
      }

      await refreshPendingCount();
    } catch (e) {
      console.warn('Queue drain notice:', e);
    }
  }, [refreshPendingCount]);

  /**
   * Synchronize local collection and stats with Cloudflare D1 & Supabase
   */
  const syncWithCloud = useCallback(
    async (localData?: {
      collection: CloudSyncCollectionItem[];
      history: CloudSyncHistoryItem[];
      totalPulls: number;
      pityCount: number;
    }) => {
      if (!token || !user) return null;

      setIsSyncing(true);
      try {
        // 1. Direct Supabase write (Fast, reliable, atomic)
        if (localData && user?.osuId) {
          if (localData.collection && localData.collection.length > 0) {
            for (let i = 0; i < localData.collection.length; i += 200) {
              const chunk = localData.collection.slice(i, i + 200);
              await supabase.from('user_collection').upsert(
                chunk.map((c) => ({
                  osu_id: user.osuId,
                  beatmap_id: c.beatmapId,
                  copies: c.copies,
                  first_pulled_at: c.firstPulledAt,
                  last_pulled_at: c.lastPulledAt,
                  is_favorite: c.isFavorite,
                }))
              );
            }
          }

          if (localData.history && localData.history.length > 0) {
            await supabase.from('user_history').upsert(
              localData.history.map((h) => ({
                id: h.id,
                osu_id: user.osuId,
                beatmap_id: h.beatmapId,
                rarity: h.rarity,
                pulled_at: h.pulledAt,
              }))
            );
          }

          if (typeof localData.totalPulls === 'number' || typeof localData.pityCount === 'number') {
            const uPayload: Record<string, unknown> = {};
            if (typeof localData.totalPulls === 'number') uPayload.total_pulls = localData.totalPulls;
            if (typeof localData.pityCount === 'number') uPayload.pity_count = localData.pityCount;
            await supabase.from('users').update(uPayload).eq('osu_id', user.osuId);
          }
        }

        // 2. Also push to Cloudflare Worker
        if (localData) {
          try {
            await fetch(`${WORKER_API_URL}/api/sync`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                collection: localData.collection,
                history: localData.history,
                totalPulls: localData.totalPulls,
                pityCount: localData.pityCount,
              }),
            });
          } catch (workerErr) {
            console.warn('Worker sync push notice (Supabase synced successfully):', workerErr);
          }
        }

        // 3. Drain pending queue
        if (user?.osuId) {
          await drainPendingQueue(user.osuId, token);
        }

        setLastSyncedAt(new Date());

        // 4. Fetch authoritative response from Worker if available
        try {
          const syncRes = await fetch(`${WORKER_API_URL}/api/sync`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          if (syncRes.ok) {
            const syncData: CloudSyncResponse = await syncRes.json();
            if (syncData.success) {
              return {
                mergedCollection: syncData.collection,
                mergedHistory: syncData.history,
                cloudTotalPulls: syncData.totalPulls,
                cloudPityCount: syncData.pityCount,
                energyOverride: syncData.energyOverride ?? null,
                config: syncData.config,
              };
            }
          }
        } catch {
          // Worker fetch optional if Supabase sync succeeded
        }

        return null;
      } catch (err) {
        console.warn('Cloud synchronization error — queuing locally:', err);
        if (localData) {
          await enqueuePendingSync({
            totalPulls: localData.totalPulls,
            pityCount: localData.pityCount,
            collection: localData.collection,
            history: localData.history,
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
    if (user?.osuId && token) {
      drainPendingQueue(user.osuId, token);
      const interval = setInterval(() => {
        drainPendingQueue(user.osuId, token);
      }, 15000);
      return () => clearInterval(interval);
    }
  }, [user, token, refreshPendingCount, drainPendingQueue]);

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
