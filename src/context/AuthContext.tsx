import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { OsuAuthUser, CloudSyncCollectionItem, CloudSyncHistoryItem, CloudSyncResponse } from '../types/auth';
import { WORKER_API_URL } from '../config/api';

const TOKEN_STORAGE_KEY = 'osu_gacha_session_token';

interface AuthContextType {
  user: OsuAuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isSyncing: boolean;
  lastSyncedAt: Date | null;
  authError: string | null;
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
   * Synchronize local collection and stats with Cloudflare D1
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
        // 1. If local data provided, push local state to D1 first
        if (localData) {
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
        }

        // 2. Fetch latest authoritative state from D1
        const syncRes = await fetch(`${WORKER_API_URL}/api/sync`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!syncRes.ok) {
          throw new Error(`Sync failed with HTTP ${syncRes.status}`);
        }

        const syncData: CloudSyncResponse = await syncRes.json();
        if (syncData.success) {
          setLastSyncedAt(new Date());
          return {
            mergedCollection: syncData.collection,
            mergedHistory: syncData.history,
            cloudTotalPulls: syncData.totalPulls,
            cloudPityCount: syncData.pityCount,
          };
        }
        return null;
      } catch (err) {
        console.error('Cloud synchronization error:', err);
        return null;
      } finally {
        setIsSyncing(false);
      }
    },
    [token, user]
  );

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
