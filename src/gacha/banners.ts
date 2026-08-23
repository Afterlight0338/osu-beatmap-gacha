import { Banner } from '../types/gacha';
import { Beatmap } from '../types/beatmap';
import bannerCategories from '../data/bannerMapCategories.json';

const STREAM_MAP_ID_SET = new Set<number>(bannerCategories.streamIds || []);
const FARM_MAP_ID_SET = new Set<number>(bannerCategories.farmIds || []);

// Iconic stream artists & mappers
const STREAM_KEYWORDS = [
  'xi', 'dragonforce', 'undead corporation', 'camellia', 'leaf', 'ryu*', 'tatsh',
  'imperial circus dead decadence', 'foreground eclipse', 'halozy', 'sasaki sayaka',
  'deathstream', 'stream', 'four dimensions', 'infinity', 'stamina', 'burst',
  'galvanize', 'delrio', 'akali', 'fartfantasy', 'val0108', 'nakagawa-kanon', 'ekoro'
];

// Iconic speed / jump / farm mappers & keywords
const FARM_KEYWORDS = [
  'sotarks', 'monstrata', 'armin', 'nevo', 'reform', 'log off now', 'akitoshi',
  'doormat', 'browiec', 'natsu', 'lami', 'deviouspanda', 'smokelind', 'tv size',
  'jump', 'dt', 'farm', 'harumachi', 'black rover', 'highscore', 'chika', 'hitorigoto',
  'kira kira days', 'make a move', 'cbcc', 'silhouette'
];

export const BANNERS: Banner[] = [
  {
    id: 'standard',
    name: 'All-Stars Beatmap Pool',
    subtitle: 'Standard Banner • All Ranked Classics',
    description: 'Pull any beatmap from the global osu! 5,000 all-time popularity pool spanning 2007–2024.',
    badge: 'Standard Pool',
    themeColor: '#ff66aa',
    featuredMapIds: [131891, 397534, 1264070, 554519], // The Big Black, My Love, Everything will freeze, No title
    bgImage: 'https://assets.ppy.sh/beatmaps/41823/covers/cover.jpg',
  },
  {
    id: 'stream',
    name: 'Stamina & Stream Legends',
    subtitle: 'Featured Rate-Up • Deathstreams & High BPM',
    description: 'Exclusive spotlight on deathstream anthems, finger control, and 185+ BPM stamina tests from osu!collector.',
    badge: 'Stream Focus',
    themeColor: '#00d2ff',
    featuredMapIds: [129891, 252002, 1264070, 131891], // Freedom Dive, Blue Zenith, Everything will freeze, The Big Black
    bgImage: 'https://assets.ppy.sh/beatmaps/65994/covers/cover.jpg',
  },
  {
    id: 'farm',
    name: 'Speed & PP Highlights',
    subtitle: 'Featured Rate-Up • Jump Maps & Farm Hits',
    description: 'Spotlight on high-octane jump maps, TV Size anthems, and iconic DT farm classics from osu!collector.',
    badge: 'Speed & Farm',
    themeColor: '#f59e0b',
    featuredMapIds: [1754777, 1007525, 397534, 554519], // Harumachi Clover, Highscore, My Love, No title
    bgImage: 'https://assets.ppy.sh/beatmaps/842412/covers/cover.jpg',
  },
];

/**
 * Filter pool maps for a specific banner using osu!collector data and song metrics.
 */
export function filterMapsForBanner(maps: Beatmap[], bannerId: string): Beatmap[] {
  if (bannerId === 'stream') {
    const filtered = maps.filter((m) => {
      if (STREAM_MAP_ID_SET.has(m.id)) return true;
      const text = `${m.artist} ${m.title} ${m.version} ${m.creator}`.toLowerCase();
      if (STREAM_KEYWORDS.some((kw) => text.includes(kw))) return true;
      if (m.bpm >= 190 && m.stars >= 4.0) return true;
      return false;
    });

    return filtered.length >= 100 ? filtered : maps;
  }

  if (bannerId === 'farm') {
    const filtered = maps.filter((m) => {
      if (FARM_MAP_ID_SET.has(m.id)) return true;
      const text = `${m.artist} ${m.title} ${m.version} ${m.creator}`.toLowerCase();
      if (FARM_KEYWORDS.some((kw) => text.includes(kw))) return true;
      if (m.length <= 135 && m.stars >= 3.5) return true;
      return false;
    });

    return filtered.length >= 100 ? filtered : maps;
  }

  return maps;
}
