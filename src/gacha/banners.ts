import { Banner } from '../types/gacha';
import { Beatmap } from '../types/beatmap';

// Artists known for stream, stamina, finger control, metal & speedcore anthems
const STREAM_ARTISTS = [
  'xi', 'dragonforce', 'undead corporation', 'camellia', 'leaf', 'ryu*', 'tatsh',
  'imperial circus dead decadence', 'foreground eclipse', 'halozy', 'team grimoire',
  'lapix', 'ginkiha', 'usao', 't+pazolite', 'daisuke ishiwatari', 'babymetal',
  'icdd', 'neobliviscaris', 'galneryus', 'yousei teikoku', 'the quick brown fox',
  'kurokotei', 'goreshit', 'the agonist', 'lorna shore', 'demetori', 'renard',
  'venetian snares', 'sunless rise', 'archspire', 'ringo shiina', 'uta'
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
  'gravity falls', 'my love', 'kira kira days', 'koko soko', 'granat', 'dear brave'
];

// Famous jump & PP farm mappers
const FARM_MAPPERS = [
  'sotarks', 'monstrata', 'armin', 'nevo', 'reform', 'log off now', 'akitoshi',
  'doormat', 'browiec', 'natsu', 'lami', 'deviouspanda', 'smokelind', 'taeyang',
  'kagetsu', 'agatsu', 'frenz73', 'airincat', 'fieryrage', 'hyperw7', 'pika',
  'fushimi rio', 'mirash', 'nexas', 'smugi', 'seto kousuke', 'kroytz'
];

// Iconic speed / jump / DT farm songs
const FARM_SONG_KEYWORDS = [
  'harumachi', 'black rover', 'hitorigoto', 'highscore', 'make a move',
  'cbcc', 'chika', 'no title', 'kira kira days', 'silhouette', 'inferno',
  'koko soko', 'guess who is back', 'blade dance', 'kuchizuke diamond',
  'brave shine', 'snow drive', 'dear brave', 'miiro', 'granat', 'quaver',
  'padoru', 'ai no sukima', 'gravity falls', 'my love', 'super driver',
  'best friend', 'tenshi ni fureta yo', 'motto hoshii', 'doraemon',
  'wonderful wonder', 'hikari', 'daidai genome', 'kessen spirit', 'kimi no bouken'
];

export const BANNERS: Banner[] = [
  {
    id: 'standard',
    name: 'All-Stars Beatmap Pool',
    subtitle: 'Standard Banner • All Ranked Classics',
    description: 'Pull any beatmap from the global osu! 6,000+ all-time popularity pool spanning 2007–2024.',
    badge: 'Standard Pool',
    themeColor: '#ff66aa',
    featuredMapIds: [554519, 397534, 131891, 1264070], // No title, My Love, The Big Black, Everything will freeze
    bgImage: 'https://assets.ppy.sh/beatmaps/41823/covers/cover.jpg',
  },
  {
    id: 'stream',
    name: 'Stamina & Stream Legends',
    subtitle: 'Featured Rate-Up • Deathstreams & High BPM',
    description: 'Exclusive spotlight on deathstream anthems, finger control, and 185+ BPM stamina tests.',
    badge: 'Stream Focus',
    themeColor: '#00d2ff',
    featuredMapIds: [129891, 252002, 1264070, 131891], // Freedom Dive, Blue Zenith, Everything will freeze, The Big Black
    bgImage: 'https://assets.ppy.sh/beatmaps/65994/covers/cover.jpg',
  },
  {
    id: 'farm',
    name: 'Speed & PP Highlights',
    subtitle: 'Featured Rate-Up • Jump Maps & Farm Hits',
    description: 'Spotlight on high-octane jump maps, TV Size anthems, and iconic DT farm classics.',
    badge: 'Speed & Farm',
    themeColor: '#f59e0b',
    featuredMapIds: [554519, 1754777, 1007525, 114635], // No title, Harumachi Clover, Highscore, Make a Move
    bgImage: 'https://assets.ppy.sh/beatmaps/842412/covers/cover.jpg',
  },
];

/**
 * Filter pool maps for a specific banner using strict domain rules.
 */
export function filterMapsForBanner(maps: Beatmap[], bannerId: string): Beatmap[] {
  if (bannerId === 'stream') {
    const filtered = maps.filter((m) => {
      const artist = m.artist.toLowerCase();
      const title = m.title.toLowerCase();
      const version = m.version.toLowerCase();

      // Exclude obvious jump/farm maps
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
      const creator = m.creator.toLowerCase();
      const title = m.title.toLowerCase();
      const artist = m.artist.toLowerCase();

      // Check iconic farm mappers
      if (FARM_MAPPERS.some((fm) => creator.includes(fm))) {
        return true;
      }

      // Check iconic farm songs
      if (FARM_SONG_KEYWORDS.some((fs) => title.includes(fs) || artist.includes(fs))) {
        return true;
      }

      // Short TV Size / farm length with decent star rating
      if (m.length <= 135 && m.stars >= 3.0) {
        return true;
      }

      return false;
    });

    return filtered.length >= 100 ? filtered : maps;
  }

  return maps;
}
