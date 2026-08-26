import React, { useState, useMemo } from 'react';
import { Beatmap } from '../types/beatmap';
import { CollectionRecord } from '../types/collection';
import { BeatmapCard } from './BeatmapCard';
import { sfx } from '../audio/sfx';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, SearchX } from 'lucide-react';

interface CollectionGridProps {
  items: Array<{
    beatmap: Beatmap;
    record?: CollectionRecord;
    isOwned: boolean;
  }>;
  onSelectBeatmap: (beatmap: Beatmap, record?: CollectionRecord) => void;
  onToggleFavorite: (beatmapId: number) => void;
  onResetFilters: () => void;
}

export const CollectionGrid: React.FC<CollectionGridProps> = ({
  items,
  onSelectBeatmap,
  onToggleFavorite,
  onResetFilters,
}) => {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 24;

  const totalPages = Math.max(1, Math.ceil(items.length / itemsPerPage));

  // Reset to page 1 if items change and current page exceeds total
  const validPage = Math.min(currentPage, totalPages);

  const paginatedItems = useMemo(() => {
    const start = (validPage - 1) * itemsPerPage;
    return items.slice(start, start + itemsPerPage);
  }, [items, validPage, itemsPerPage]);

  const handlePageChange = (newPage: number) => {
    sfx.playClick();
    setCurrentPage(Math.max(1, Math.min(totalPages, newPage)));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center space-y-4 bg-slate-900/40 rounded-3xl border border-slate-800">
        <SearchX className="w-12 h-12 text-slate-500" />
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-slate-200">No beatmaps found</h3>
          <p className="text-xs text-slate-400 max-w-sm">
            Try adjusting your search term, rarity filter, or ownership mode.
          </p>
        </div>
        <button
          onClick={onResetFilters}
          className="px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-semibold shadow-md shadow-pink-600/30 transition-colors"
        >
          Reset All Filters
        </button>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* Cards Grid (2-columns on mobile, responsive) */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {paginatedItems.map(({ beatmap, record, isOwned }) => (
          <BeatmapCard
            key={beatmap.id}
            beatmap={beatmap}
            copies={record?.copies || 0}
            isFavorite={record?.isFavorite || false}
            isUnowned={!isOwned}
            onCardClick={() => onSelectBeatmap(beatmap, record)}
            onToggleFavorite={
              isOwned
                ? (e) => {
                    e.stopPropagation();
                    sfx.playClick();
                    onToggleFavorite(beatmap.id);
                  }
                : undefined
            }
          />
        ))}
      </div>

      {/* Pagination Bar */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center space-x-2 py-4 select-none font-mono text-xs">
          {/* First Page */}
          <button
            disabled={validPage === 1}
            onClick={() => handlePageChange(1)}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>

          {/* Prev Page */}
          <button
            disabled={validPage === 1}
            onClick={() => handlePageChange(validPage - 1)}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Page Info */}
          <div className="px-4 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-300">
            Page <span className="font-bold text-pink-400">{validPage}</span> of{' '}
            <span className="font-bold text-slate-200">{totalPages}</span>
          </div>

          {/* Next Page */}
          <button
            disabled={validPage === totalPages}
            onClick={() => handlePageChange(validPage + 1)}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Last Page */}
          <button
            disabled={validPage === totalPages}
            onClick={() => handlePageChange(totalPages)}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
