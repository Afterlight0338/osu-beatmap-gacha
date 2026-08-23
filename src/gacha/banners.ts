import { Banner } from '../types/gacha';
import { Beatmap } from '../types/beatmap';

// Artists known for stream, stamina, finger control, metal & speedcore anthems
const STREAM_ARTISTS = [
  'xi', 'dragonforce', 'undead corporation', 'camellia', 'leaf', 'ryu*', 'tatsh',
  'imperial circus dead decadence', 'foreground eclipse', 'halozy', 'team grimoire',
  'lapix', 'ginkiha', 'usao', 't+pazolite', 'daisuke ishiwatari', 'babymetal',
  'icdd', 'neobliviscaris', 'galneryus', 'yousei teikoku', 'the quick brown fox',
  'kurokotei', 'goreshit', 'the agonist', 'lorna shore', 'demetori', 'renard',
  'venetian snares', 'sunless rise', 'archspire', 'ringo shiina', 'uta', 'the oral cigarettes'
];

// Difficulties dedicated to deathstreams & finger control
const STREAM_DIFF_KEYWORDS = [
  'four dimensions', 'infinity', 'deathstream', 'stream', 'delrio', 'burst',
  'galvanize', 'fartfantasy', 'val0108', 'akali', 'grumd', 'lunatic', 'extra stream',
  'astral', 'apocalypse', 'revolution', 'chronostasis', 'visages', 'sacrifice',
  'demise', 'hell', 'cataclysm', 'annihilation'
];

// Anime pop & TV size jump titles that must NEVER be categorized as stream maps
const JUMP_FARM_EXCLUSIONS = [
  'hitorigoto', 'harumachi', 'claris', 'chika', 'padoru', 'make a move',
  'cbcc', 'blade dance', 'black rover', 'quaver', 'silhouette', 'ai no sukima',
  'gravity falls', 'my love', 'kira kira days', 'koko soko', 'granat', 'dear brave',
  'kessen spirit', 'kimi no bouken', 'doraemon', 'daidai genome', 'wonderful wonder'
];

// Famous 1-2 aim slop & modern jump farm mappers
const AIM_SLOP_MAPPERS = [
  'sotarks', 'reform', 'browiec', 'log off now', 'nevo', 'fieryrage', 'akitoshi',
  'deviouspanda', 'smokelind', 'airincat', 'agatsu', 'fushimi rio', 'hyperw7',
  'pika', 'mirash', 'nexas', 'smugi', 'frenz73', 'doormat', 'lami', 'natsu',
  'monstrata', 'armin', 'taeyang', 'kroytz', 'seto kousuke', 'ryuusei aika'
];

// Legendary aim slop songs (1-2 cross-screen jump anthems)
const AIM_SLOP_SONGS = [
  'harumachi', 'black rover', 'hitorigoto', 'highscore', 'make a move',
  'cbcc', 'chika', 'no title', 'kira kira days', 'silhouette', 'inferno',
  'koko soko', 'guess who is back', 'blade dance', 'kuchizuke diamond',
  'brave shine', 'snow drive', 'dear brave', 'miiro', 'granat', 'quaver',
  'padoru', 'ai no sukima', 'gravity falls', 'my love', 'super driver',
  'best friend', 'tenshi ni fureta yo', 'motto hoshii', 'doraemon',
  'wonderful wonder', 'hikari', 'daidai genome', 'kessen spirit', 'kimi no bouken',
  'chocobo', 'cancan', 'kanzen kankaku', 'caffe latte', 'mikan', 'teopacito'
];

export const BANNERS: Banner[] = [
  {
    id: 'standard',
    name: 'All-Stars Beatmap Pool',
    subtitle: 'Standard Banner • All Ranked Classics',
    description: 'Pull any beatmap from the global osu! 15,000+ all-time popularity and modern era pool spanning 2007–2026.',
    badge: 'Standard Pool',
    themeColor: '#ff66aa',
    featuredMapIds: [554519, 397534, 131891, 1264070],
    bgImage: 'https://assets.ppy.sh/beatmaps/41823/covers/cover.jpg',
  },
  {
    id: 'aimslop',
    name: 'Aim Slop (1-2 Jump Farm)',
    subtitle: 'Featured Rate-Up • 1-2 Jumps & TV Size Farm',
    description: 'Pure unfiltered aim slop. Fast TV sizes, cross-screen 1-2 jump patterns, and Sotarks/Reform farm anthems.',
    badge: 'Aim Slop',
    themeColor: '#ec4899', // Hot Pink / Magenta
    featuredMapIds: [1754777, 1640540, 114635, 554519],
    bgImage: 'https://assets.ppy.sh/beatmaps/842412/covers/cover.jpg',
  },
  {
    id: 'stream',
    name: 'Stamina & Stream Legends',
    subtitle: 'Featured Rate-Up • Deathstreams & High BPM',
    description: 'Exclusive spotlight on deathstream anthems, finger control, and 185+ BPM endurance tests.',
    badge: 'Stream Focus',
    themeColor: '#00d2ff',
    featuredMapIds: [129891, 252002, 1264070, 131891],
    bgImage: 'https://assets.ppy.sh/beatmaps/65994/covers/cover.jpg',
  },
  {
    id: 'farm',
    name: 'Speed & PP Highlights',
    subtitle: 'Featured Rate-Up • High BPM & Speed Bursts',
    description: 'Spotlight on high-octane speed bursts, alternate maps, and iconic double-time speed benchmarks.',
    badge: 'Speed & Tech',
    themeColor: '#f59e0b',
    featuredMapIds: [554519, 1007525, 129891, 252002],
    bgImage: 'https://assets.ppy.sh/beatmaps/1236299/covers/cover.jpg',
  },
];

/**
 * Filter pool maps for a specific banner using strict domain rules.
 */
export function filterMapsForBanner(maps: Beatmap[], bannerId: string): Beatmap[] {
  if (bannerId === 'aimslop') {
    const filtered = maps.filter((m) => {
      const creator = m.creator.toLowerCase();
      const title = m.title.toLowerCase();
      const artist = m.artist.toLowerCase();

      // Check famous aim slop mappers
      if (AIM_SLOP_MAPPERS.some((fm) => creator.includes(fm))) {
        return true;
      }

      // Check iconic aim slop songs
      if (AIM_SLOP_SONGS.some((fs) => title.includes(fs) || artist.includes(fs))) {
        return true;
      }

      // Short TV Size (<=120s) with 3.5*+ jump profile
      if (m.length <= 125 && m.stars >= 3.5) {
        return true;
      }

      return false;
    });

    return filtered.length >= 100 ? filtered : maps;
  }

  if (bannerId === 'stream') {
    const filtered = maps.filter((m) => {
      const artist = m.artist.toLowerCase();
      const title = m.title.toLowerCase();
      const version = m.version.toLowerCase();

      // Exclude obvious jump/aim slop maps
      if (JUMP_FARM_EXCLUSIONS.some((ex) => title.includes(ex) || artist.includes(ex))) {
        return false;
      }

      // Check stream artists
      if (STREAM_ARTISTS.some((sa) => artist.includes(sa) || title.includes(sa))) {
        return true;
      }

      // Check stream diff keywords
      if (STREAM_DIFF_KEYWORDS.some((kw) => version.includes(kw))) {
        return true;
      }

      // High BPM + High stars + longer length (not TV Size)
      if (m.bpm >= 185 && m.stars >= 4.5 && m.length >= 120) {
        return true;
      }

      return false;
    });

    return filtered.length >= 100 ? filtered : maps;
  }

  if (bannerId === 'farm') {
    const filtered = maps.filter((m) => {
      // High BPM speed or DT farm (BPM >= 200 or 170+ with high stars)
      if (m.bpm >= 200) return true;
      if (m.bpm >= 180 && m.stars >= 5.0) return true;
      if (m.length <= 150 && m.stars >= 4.0) return true;
      return false;
    });

    return filtered.length >= 100 ? filtered : maps;
  }

  // Standard pool: return all maps
  return maps;
}
