import React from 'react';
import { useAuth } from '../context/AuthContext';
import { User } from 'lucide-react';
import { sfx } from '../audio/sfx';

export const UserProfileBadge: React.FC = () => {
  const { user, openProfileModal } = useAuth();

  const handleClick = () => {
    sfx.playClick();
    openProfileModal();
  };

  if (!user) {
    return (
      <button
        onClick={handleClick}
        className="flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-full bg-[#ff66aa]/15 hover:bg-[#ff66aa]/25 text-[#ff66aa] hover:text-pink-200 border border-[#ff66aa]/40 hover:border-[#ff66aa]/70 transition-all duration-200 text-xs font-bold font-mono shadow-sm hover:scale-105 select-none flex-shrink-0"
      >
        <User className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Set Player</span>
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      title={`Player: ${user.username} (Click to change)`}
      className="flex items-center space-x-1.5 sm:space-x-2 p-1 pr-2.5 sm:pr-3 rounded-full bg-slate-900/90 border border-slate-700/80 hover:border-pink-500/60 transition-all select-none group flex-shrink-0 hover:scale-105"
    >
      {/* osu! Avatar */}
      <img
        src={user.avatarUrl}
        alt={user.username}
        className="w-6 h-6 sm:w-7 sm:h-7 rounded-full object-cover border border-pink-500/50 bg-slate-950 flex-shrink-0"
        onError={(e) => {
          e.currentTarget.src = 'https://osu.ppy.sh/images/layout/avatar-guest.png';
        }}
      />

      <span className="hidden sm:inline text-xs font-bold text-slate-200 group-hover:text-pink-300 transition-colors truncate max-w-[80px]">
        {user.username}
      </span>
    </button>
  );
};
