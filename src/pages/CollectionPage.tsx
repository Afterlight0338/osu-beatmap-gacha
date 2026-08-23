import React, { useState, useMemo } from 'react';
import { useGacha } from '../context/GachaContext';
import { CollectionFilters } from '../components/CollectionFilters';
import { CollectionGrid } from '../components/CollectionGrid';
import { BeatmapDetailModal } from '../components/BeatmapDetailModal';
import { CollectionFilters as FilterType, CollectionRecord } from '../types/collection';
import { Beatmap } from '../types/beatmap';
import { compareRarities } from '../gacha/rarity';

const DEFAULT_FILTERS: FilterType = {
  search: '',
  rarity: 'All',
  status: 'All',
  minStars: 0,
  maxStars: 10,
  ownership: 'owned',
  sortField: 'recent',
  sortOrder: 'desc',
};

export const CollectionPage: React.FC = () => {
  const { pool, collectionMap, toggleFavorite } = useGacha();
  const [filters, setFilters] = useState<FilterType>(DEFAULT_FILTERS);
  const [selectedMapForDetail, setSelectedMapForDetail] = useState<{
    beatmap: Beatmap;
    record?: CollectionRecord;
  } | null>(null);

  // Filter and sort items
  const processedItems = useMemo(() => {
    let baseList: Array<{ beatmap: Beatmap; record?: CollectionRecord; isOwned: boolean }> = [];

    if (filters.ownership === 'owned') {
      baseList = pool
        .filter((map) => collectionMap.has(map.id))
        .map((beatmap) => ({
          beatmap,
          record: collectionMap.get(beatmap.id),
          isOwned: true,
        }));
    } else if (filters.ownership === 'favorites') {
      baseList = pool
        .filter((map) => collectionMap.get(map.id)?.isFavorite)
        .map((beatmap) => ({
          beatmap,
          record: collectionMap.get(beatmap.id),
          isOwned: true,
        }));
    } else if (filters.ownership === 'unowned') {
      baseList = pool
        .filter((map) => !collectionMap.has(map.id))
        .map((beatmap) => ({
          beatmap,
          record: undefined,
          isOwned: false,
        }));
    } else {
      // 'all'
      baseList = pool.map((beatmap) => {
        const record = collectionMap.get(beatmap.id);
        return {
          beatmap,
          record,
          isOwned: !!record,
        };
      });
    }

    // Apply Search Filter
    if (filters.search.trim()) {
      const q = filters.search.trim().toLowerCase();
      baseList = baseList.filter(({ beatmap }) => {
        return (
          beatmap.title.toLowerCase().includes(q) ||
          beatmap.titleUnicode?.toLowerCase().includes(q) ||
          beatmap.artist.toLowerCase().includes(q) ||
          beatmap.artistUnicode?.toLowerCase().includes(q) ||
          beatmap.creator.toLowerCase().includes(q) ||
          beatmap.version.toLowerCase().includes(q) ||
          beatmap.id.toString().includes(q)
        );
      });
    }

    // Apply Rarity Filter
    if (filters.rarity !== 'All') {
      baseList = baseList.filter(({ beatmap }) => beatmap.rarity === filters.rarity);
    }

    // Apply Status Filter
    if (filters.status !== 'All') {
      baseList = baseList.filter(({ beatmap }) => beatmap.status === filters.status);
    }

    // Apply Star Rating Filter
    if (filters.minStars > 0 || filters.maxStars < 10) {
      baseList = baseList.filter(
        ({ beatmap }) => beatmap.stars >= filters.minStars && beatmap.stars <= filters.maxStars
      );
    }

    // Apply Sorting
    baseList.sort((a, b) => {
      let cmp = 0;
      switch (filters.sortField) {
        case 'recent':
          const timeA = a.record?.lastPulledAt || 0;
          const timeB = b.record?.lastPulledAt || 0;
          cmp = timeA - timeB;
          break;
        case 'copies':
          const copiesA = a.record?.copies || 0;
          const copiesB = b.record?.copies || 0;
          cmp = copiesA - copiesB;
          break;
        case 'rarity':
          cmp = compareRarities(a.beatmap.rarity, b.beatmap.rarity);
          break;
        case 'stars':
          cmp = a.beatmap.stars - b.beatmap.stars;
          break;
        case 'playcount':
          cmp = a.beatmap.playcount - b.beatmap.playcount;
          break;
        case 'favourites':
          cmp = a.beatmap.favouriteCount - b.beatmap.favouriteCount;
          break;
        case 'title':
          cmp = a.beatmap.title.localeCompare(b.beatmap.title);
          break;
        case 'artist':
          cmp = a.beatmap.artist.localeCompare(b.beatmap.artist);
          break;
        case 'bpm':
          cmp = a.beatmap.bpm - b.beatmap.bpm;
          break;
        case 'length':
          cmp = a.beatmap.length - b.beatmap.length;
          break;
        default:
          cmp = 0;
      }

      return filters.sortOrder === 'desc' ? -cmp : cmp;
    });

    return baseList;
  }, [pool, collectionMap, filters]);

  const handleSelectBeatmap = (beatmap: Beatmap, record?: CollectionRecord) => {
    setSelectedMapForDetail({ beatmap, record });
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-12">
      {/* Filters Bar */}
      <CollectionFilters
        filters={filters}
        onChange={setFilters}
        onReset={() => setFilters(DEFAULT_FILTERS)}
        totalFiltered={processedItems.length}
      />

      {/* Grid of Cards */}
      <CollectionGrid
        items={processedItems}
        onSelectBeatmap={handleSelectBeatmap}
        onToggleFavorite={toggleFavorite}
        onResetFilters={() => setFilters(DEFAULT_FILTERS)}
      />

      {/* Detail Modal */}
      <BeatmapDetailModal
        beatmap={selectedMapForDetail?.beatmap || null}
        record={selectedMapForDetail?.record}
        isOpen={selectedMapForDetail !== null}
        onClose={() => setSelectedMapForDetail(null)}
        onToggleFavorite={toggleFavorite}
      />
    </div>
  );
};
