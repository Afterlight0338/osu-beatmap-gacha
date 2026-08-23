import { Banner } from '../types/gacha';
import { Beatmap } from '../types/beatmap';

export const BANNERS: Banner[] = [
  {
    id: 'standard',
    name: 'All-Stars Beatmap Pool',
    subtitle: 'Standard Banner • Top 10,000 Ranked & Loved',
    description: 'Pull any beatmap from the global osu! all-time top 10,000 popularity pool.',
    badge: 'Standard Pool',
    themeColor: '#ff66aa',
    featuredMapIds: [129891, 417244, 252002, 1007525], // Freedom Dive, The Big Black, Blue Zenith, Highscore
    bgImage: 'https://assets.ppy.sh/beatmaps/39804/covers/cover.jpg',
  },
  {
    id: 'stream',
    name: 'Stamina & Stream Legends',
    subtitle: 'Featured Rate-Up • Deathstreams & High BPM',
    description: 'Special spotlight on iconic stream and finger-control anthems.',
    badge: 'Featured Pool',
    themeColor: '#00d2ff',
    featuredMapIds: [129891, 252002, 180138, 774965], // Freedom Dive, Blue Zenith, Everything will freeze, Tengaku
    bgImage: 'https://assets.ppy.sh/beatmaps/65994/covers/cover.jpg',
  },
  {
    id: 'farm',
    name: 'Speed & PP Highlights',
    subtitle: 'Featured Rate-Up • Jump Maps & Farm Hits',
    description: 'Increased chance of discovering legendary jump maps, TV sizes, and tournament classics.',
    badge: 'Spotlight',
    themeColor: '#f59e0b',
    featuredMapIds: [1754777, 1007525, 417244, 2469341], // Harumachi Clover, Highscore, The Big Black, Black Catcher
    bgImage: 'https://assets.ppy.sh/beatmaps/842412/covers/cover.jpg',
  },
];

/**
 * Filter pool maps for a specific banner.
 */
export function filterMapsForBanner(maps: Beatmap[], bannerId: string): Beatmap[] {
  if (bannerId === 'stream') {
    // Maps with BPM >= 190 or stream heavy titles
    const filtered = maps.filter(
      (m) => m.bpm >= 190 || m.title.toLowerCase().includes('stream') || m.version.toLowerCase().includes('four dimensions') || m.version.toLowerCase().includes('infinity')
    );
    return filtered.length > 50 ? filtered : maps;
  }
  if (bannerId === 'farm') {
    // Shorter maps (<= 140s) or fast jumps
    const filtered = maps.filter((m) => m.length <= 150 || m.version.toLowerCase().includes('extra') || m.version.toLowerCase().includes('insane'));
    return filtered.length > 50 ? filtered : maps;
  }
  return maps;
}
