import { RarityTier } from '../types/beatmap';

export interface FetchedBeatmapMetadata {
  id: number;
  beatmapsetId: number;
  title: string;
  artist: string;
  creator: string;
  version: string;
  stars: number;
  bpm: number;
  length: number;
  status: 'ranked' | 'approved' | 'loved' | 'graveyard' | 'qualified' | 'pending';
  playcount?: number;
  favouriteCount?: number;
  coverUrl: string;
  previewUrl: string;
  suggestedRarity?: RarityTier;
}

/**
 * Parses user input (URL from hinamizawa.ai, osu.ppy.sh, or numeric ID)
 * and fetches comprehensive beatmap metadata from multiple high-availability mirrors.
 */
export async function fetchBeatmapMetadata(input: string): Promise<FetchedBeatmapMetadata | null> {
  const trimmed = input.trim();
  if (!trimmed) return null;

  let bId: number | null = null;
  let sId: number | null = null;

  // 1. Hinamizawa.ai URL patterns
  // https://hinamizawa.ai/osu/beatmaps/2414163
  // https://hinamizawa.ai/osu/beatmapsets/1148215
  const hinamiMatchB = trimmed.match(/hinamizawa\.ai\/osu\/beatmaps\/(\d+)/i);
  const hinamiMatchS = trimmed.match(/hinamizawa\.ai\/osu\/beatmapsets\/(\d+)/i);

  // 2. osu.ppy.sh URL patterns
  // https://osu.ppy.sh/beatmapsets/1148215#osu/2414163
  // https://osu.ppy.sh/beatmaps/2414163
  // https://osu.ppy.sh/b/2414163
  // https://osu.ppy.sh/s/1148215
  const ppyMatchB = trimmed.match(/#(?:osu|taiko|fruits|mania)\/(\d+)/i) ||
                    trimmed.match(/(?:beatmaps|b)\/(\d+)/i);
  const ppyMatchS = trimmed.match(/(?:beatmapsets|s)\/(\d+)/i);

  if (hinamiMatchB) {
    bId = Number(hinamiMatchB[1]);
  } else if (hinamiMatchS) {
    sId = Number(hinamiMatchS[1]);
  } else if (ppyMatchB) {
    bId = Number(ppyMatchB[1]);
    if (ppyMatchS) sId = Number(ppyMatchS[1]);
  } else if (ppyMatchS) {
    sId = Number(ppyMatchS[1]);
  } else if (/^\d+$/.test(trimmed)) {
    // Pure number
    bId = Number(trimmed);
  }

  if (!bId && !sId) return null;

  // Try Mirror 1: catboy.best (osu! API v2 proxy)
  if (bId) {
    try {
      const res = await fetch(`https://catboy.best/api/v2/b/${bId}`);
      if (res.ok) {
        const j = await res.json();
        const s = j.set || j.beatmapset || {};
        const setId = j.beatmapset_id || s.id || bId;
        const stars = Math.round(Number(j.difficulty_rating || 0) * 100) / 100;
        
        let status: any = 'ranked';
        const st = (j.status || s.status || '').toLowerCase();
        if (st.includes('loved')) status = 'loved';
        else if (st.includes('graveyard') || st.includes('wip') || st.includes('pending')) status = 'graveyard';
        else if (st.includes('approved')) status = 'ranked';

        const coverUrl = s.covers?.cover || `https://assets.ppy.sh/beatmaps/${setId}/covers/cover.jpg`;
        const previewUrl = s.preview_url
          ? (s.preview_url.startsWith('//') ? `https:${s.preview_url}` : s.preview_url)
          : `https://b.ppy.sh/preview/${setId}.mp3`;

        const playcount = Number(j.playcount || s.play_count || 10000);
        const favouriteCount = Number(s.favourite_count || j.favourite_count || 100);

        return {
          id: j.id || bId,
          beatmapsetId: setId,
          title: s.title || j.title || `Beatmap #${bId}`,
          artist: s.artist || j.artist || 'Unknown Artist',
          creator: s.creator || j.creator || 'Unknown Mapper',
          version: j.version || 'Normal',
          stars,
          bpm: Math.round(j.bpm || s.bpm || 120),
          length: j.total_length || 180,
          status,
          playcount,
          favouriteCount,
          coverUrl,
          previewUrl,
          suggestedRarity: suggestRarityFromStars(stars),
        };
      }
    } catch {}
  }

  // Try Mirror 2: osu.direct API
  const queryId = bId || sId;
  const isSet = !bId && Boolean(sId);
  try {
    const res = await fetch(`https://osu.direct/api/${isSet ? 's/' : 'b/'}${queryId}`);
    if (res.ok) {
      const j = await res.json();
      const mapId = isSet ? (j.Beatmaps?.[0]?.BeatmapID || queryId) : (j.BeatmapID || queryId);
      const setId = j.ParentSetID || j.SetID || sId || queryId;
      const stars = Math.round(Number(j.DifficultyRating || j.Beatmaps?.[0]?.DifficultyRating || 0) * 100) / 100;

      let status: any = 'ranked';
      const rs = j.RankedStatus;
      if (rs === 4) status = 'loved';
      else if (rs === -2 || rs === -1 || rs === 0) status = 'graveyard';

      const playcount = Number(j.Playcount || j.Plays || 10000);
      const favouriteCount = Number(j.FavouriteCount || 100);

      return {
        id: Number(mapId),
        beatmapsetId: Number(setId),
        title: j.Title || `Beatmap #${mapId}`,
        artist: j.Artist || 'Unknown Artist',
        creator: j.Creator || 'Unknown Mapper',
        version: j.DiffName || j.Beatmaps?.[0]?.DiffName || 'Normal',
        stars,
        bpm: Math.round(j.BPM || 120),
        length: j.TotalLength || 180,
        status,
        playcount,
        favouriteCount,
        coverUrl: `https://assets.ppy.sh/beatmaps/${setId}/covers/cover.jpg`,
        previewUrl: `https://b.ppy.sh/preview/${setId}.mp3`,
        suggestedRarity: suggestRarityFromStars(stars),
      };
    }
  } catch {}

  // Fallback default structure if only IDs were parsed
  const fallbackSet = sId || bId || 0;
  const fallbackMap = bId || sId || 0;
  return {
    id: fallbackMap,
    beatmapsetId: fallbackSet,
    title: '',
    artist: '',
    creator: '',
    version: 'Normal',
    stars: 5.0,
    bpm: 120,
    length: 180,
    status: 'ranked',
    coverUrl: `https://assets.ppy.sh/beatmaps/${fallbackSet}/covers/cover.jpg`,
    previewUrl: `https://b.ppy.sh/preview/${fallbackSet}.mp3`,
  };
}

function suggestRarityFromStars(stars: number): RarityTier {
  if (stars >= 8.5) return 'GOAT';
  if (stars >= 7.8) return 'Divine';
  if (stars >= 7.0) return 'Celestial';
  if (stars >= 6.3) return 'Mythic';
  if (stars >= 5.5) return 'Legendary';
  if (stars >= 4.6) return 'Epic';
  if (stars >= 3.8) return 'Rare';
  if (stars >= 3.0) return 'Uncommon+';
  if (stars >= 2.2) return 'Uncommon';
  return 'Common';
}
