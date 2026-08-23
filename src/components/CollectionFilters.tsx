import React from 'react';
import { CollectionFilters as FilterType, SortField } from '../types/collection';
import { RarityTier } from '../types/beatmap';
import { RARITY_ORDER, RARITY_CONFIGS } from '../gacha/rarity';
import { sfx } from '../audio/sfx';
import { Search, X, ArrowUpDown, Heart } from 'lucide-react';

interface CollectionFiltersProps {
  filters: FilterType;
  onChange: (newFilters: FilterType) => void;
  onReset?: () => void;
  totalFiltered: number;
}

export const CollectionFilters: React.FC<CollectionFiltersProps> = ({
  filters,
  onChange,
  onReset,
  totalFiltered,
}) => {
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...filters, search: e.target.value });
  };

  const handleRarityChange = (rarity: RarityTier | 'All') => {
    sfx.playClick();
    onChange({ ...filters, rarity });
  };

  const handleOwnershipChange = (ownership: FilterType['ownership']) => {
    sfx.playClick();
    onChange({ ...filters, ownership });
  };

  const handleSortChange = (sortField: SortField) => {
    sfx.playClick();
    if (filters.sortField === sortField) {
      // Toggle order
      onChange({ ...filters, sortOrder: filters.sortOrder === 'asc' ? 'desc' : 'asc' });
    } else {
      onChange({ ...filters, sortField, sortOrder: 'desc' });
    }
  };

  return (
    <div className="w-full space-y-4 bg-slate-900/60 p-4 md:p-5 rounded-2xl border border-slate-800 backdrop-blur-md">
      {/* Top Row: Search Input + Ownership Mode Tabs */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search Bar */}
        <div className="relative w-full md:max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={filters.search}
            onChange={handleSearchChange}
            placeholder="Search by Title, Artist, Mapper, or Difficulty..."
            className="w-full pl-10 pr-10 py-2 rounded-xl bg-slate-950/80 border border-slate-700/80 focus:border-pink-500 focus:outline-none text-slate-200 placeholder-slate-500 text-xs sm:text-sm font-sans"
          />
          {filters.search && (
            <button
              onClick={() => onChange({ ...filters, search: '' })}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Ownership Filter Pills */}
        <div className="flex items-center space-x-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800 w-full md:w-auto justify-center">
          <button
            onClick={() => handleOwnershipChange('owned')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filters.ownership === 'owned'
                ? 'bg-pink-600 text-white shadow-md shadow-pink-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Owned Only
          </button>
          <button
            onClick={() => handleOwnershipChange('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filters.ownership === 'all'
                ? 'bg-pink-600 text-white shadow-md shadow-pink-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All Pool Maps
          </button>
          <button
            onClick={() => handleOwnershipChange('favorites')}
            className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filters.ownership === 'favorites'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Heart className="w-3 h-3 fill-current text-rose-300" />
            <span>Favorites</span>
          </button>
        </div>
      </div>

      {/* Rarity Tier Filter Pills */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-mono uppercase text-slate-500 mr-1 hidden sm:inline">
          Rarity:
        </span>
        <button
          onClick={() => handleRarityChange('All')}
          className={`px-3 py-1 rounded-full text-xs font-bold font-mono transition-all border ${
            filters.rarity === 'All'
              ? 'bg-slate-200 text-slate-900 border-white'
              : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          ALL
        </button>

        {RARITY_ORDER.slice().reverse().map((tier) => {
          const config = RARITY_CONFIGS[tier];
          const isSelected = filters.rarity === tier;
          return (
            <button
              key={tier}
              onClick={() => handleRarityChange(tier)}
              className={`px-2.5 py-1 rounded-full text-xs font-bold font-mono transition-all border ${
                isSelected
                  ? 'border-white shadow-md text-white'
                  : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:border-slate-700'
              }`}
              style={{
                backgroundColor: isSelected ? config.color : undefined,
                color: isSelected ? '#ffffff' : config.color,
              }}
            >
              {config.label}
            </button>
          );
        })}
      </div>

      {/* Sorting and Advanced Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80 text-xs font-mono">
        {/* Sort Field Selector */}
        <div className="flex flex-wrap items-center gap-1.5 text-slate-400">
          <span className="flex items-center space-x-1 text-slate-500 mr-1">
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span>Sort:</span>
          </span>

          {[
            { field: 'recent' as SortField, label: 'Recently Pulled' },
            { field: 'copies' as SortField, label: 'Most Copies' },
            { field: 'rarity' as SortField, label: 'Rarity' },
            { field: 'stars' as SortField, label: 'Star Rating' },
            { field: 'playcount' as SortField, label: 'Playcount' },
            { field: 'favourites' as SortField, label: 'Favourites' },
            { field: 'title' as SortField, label: 'Title (A-Z)' },
          ].map(({ field, label }) => {
            const isSelected = filters.sortField === field;
            return (
              <button
                key={field}
                onClick={() => handleSortChange(field)}
                className={`px-2.5 py-1 rounded-lg transition-colors border ${
                  isSelected
                    ? 'bg-slate-800 text-pink-400 border-pink-500/50 font-bold'
                    : 'bg-slate-950/40 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                <span>{label}</span>
                {isSelected && (
                  <span className="ml-1 text-[10px]">
                    {filters.sortOrder === 'desc' ? '▼' : '▲'}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Count indicator & Reset */}
        <div className="flex items-center space-x-3 text-slate-400 font-mono text-xs">
          <span>
            Showing <span className="text-pink-400 font-bold">{totalFiltered}</span> maps
          </span>
          {onReset && (
            <button
              onClick={() => {
                sfx.playClick();
                onReset();
              }}
              className="text-[11px] text-slate-400 hover:text-pink-400 underline transition-colors"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
