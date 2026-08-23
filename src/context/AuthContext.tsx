import React, { createContext, useContext, useState, ReactNode } from 'react';
import { OsuUserProfile } from '../types/user';

const PROFILE_STORAGE_KEY = 'osu_gacha_player_profile';

function getStoredProfile(): OsuUserProfile | null {
  const json = localStorage.getItem(PROFILE_STORAGE_KEY);
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

interface AuthContextType {
  user: OsuUserProfile | null;
  isProfileModalOpen: boolean;
  openProfileModal: () => void;
  closeProfileModal: () => void;
  setPlayerUsername: (username: string) => void;
  clearProfile: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<OsuUserProfile | null>(() => getStoredProfile());
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);

  const openProfileModal = () => setIsProfileModalOpen(true);
  const closeProfileModal = () => setIsProfileModalOpen(false);

  const setPlayerUsername = (username: string) => {
    const clean = username.trim();
    if (!clean) return;
    const profile: OsuUserProfile = {
      username: clean,
      avatarUrl: `https://a.ppy.sh/${encodeURIComponent(clean)}`,
      linkedAt: Date.now(),
    };
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
    setUser(profile);
    closeProfileModal();
  };

  const clearProfile = () => {
    localStorage.removeItem(PROFILE_STORAGE_KEY);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isProfileModalOpen,
        openProfileModal,
        closeProfileModal,
        setPlayerUsername,
        clearProfile,
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
