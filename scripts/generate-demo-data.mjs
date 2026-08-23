import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure public/data directory exists
const dataDir = path.resolve(__dirname, '../public/data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Curated list of iconic osu! beatmaps with real IDs and metadata
const ICONIC_MAPS = [
  // DIVINE TIER (Top 0.15% - Absolute legends)
  {
    id: 129891,
    beatmapsetId: 39804,
    artist: "xi",
    artistUnicode: "xi",
    title: "FREEDOM DiVE",
    titleUnicode: "FREEDOM DiVE",
    version: "FOUR DIMENSIONS",
    creator: "Nakagawa-Kanon",
    stars: 8.12,
    bpm: 222,
    length: 257,
    status: "ranked",
    playcount: 19850000,
    favouriteCount: 225000,
    rankedDate: "2012-10-18T10:14:00Z",
  },
  {
    id: 417244,
    beatmapsetId: 131891,
    artist: "The Quick Brown Fox",
    artistUnicode: "The Quick Brown Fox",
    title: "The Big Black",
    titleUnicode: "The Big Black",
    version: "WHO'S AFRAID OF THE BIG BLACK",
    creator: "Blue Dragon",
    stars: 7.33,
    bpm: 360,
    length: 153,
    status: "ranked",
    playcount: 24500000,
    favouriteCount: 260000,
    rankedDate: "2013-05-18T14:20:00Z",
  },
  {
    id: 252002,
    beatmapsetId: 65994,
    artist: "xi",
    artistUnicode: "xi",
    title: "Blue Zenith",
    titleUnicode: "Blue Zenith",
    version: "FOUR DIMENSIONS",
    creator: "Asphyxia",
    stars: 7.42,
    bpm: 200,
    length: 248,
    status: "ranked",
    playcount: 17200000,
    favouriteCount: 195000,
    rankedDate: "2015-08-01T12:00:00Z",
  },
  {
    id: 1754777,
    beatmapsetId: 842412,
    artist: "Hanasaka Yui (CV: M.A.O)",
    artistUnicode: "花坂結衣(CV:M・A・O)",
    title: "Harumachi Clover (Swing Arrangement) [Dictate Edit]",
    titleUnicode: "春待ちクローバー (Swing Arrangement) [Dictate Edit]",
    version: "Extra",
    creator: "Sotarks",
    stars: 6.01,
    bpm: 145,
    length: 42,
    status: "ranked",
    playcount: 28900000,
    favouriteCount: 180000,
    rankedDate: "2018-09-22T08:00:00Z",
  },
  {
    id: 1007525,
    beatmapsetId: 477140,
    artist: "Panda Eyes & Teminite",
    artistUnicode: "Panda Eyes & Teminite",
    title: "Highscore",
    titleUnicode: "Highscore",
    version: "Game Over",
    creator: "Fort",
    stars: 7.45,
    bpm: 110,
    length: 254,
    status: "ranked",
    playcount: 16800000,
    favouriteCount: 175000,
    rankedDate: "2016-08-11T16:45:00Z",
  },

  // MYTHIC TIER
  {
    id: 180138,
    beatmapsetId: 58013,
    artist: "UNDEAD CORPORATION",
    artistUnicode: "UNDEAD CORPORATION",
    title: "Everything will freeze",
    titleUnicode: "Everything will freeze",
    version: "Time Freeze",
    creator: "Ekoro",
    stars: 8.24,
    bpm: 240,
    length: 220,
    status: "ranked",
    playcount: 13500000,
    favouriteCount: 142000,
    rankedDate: "2015-06-12T18:00:00Z",
  },
  {
    id: 774965,
    beatmapsetId: 359890,
    artist: "Wagakki Band",
    artistUnicode: "和楽器バンド",
    title: "Tengaku",
    titleUnicode: "天樂",
    version: "Uncompressed Fury of a Raging Japanese God",
    creator: "Shiro",
    stars: 8.01,
    bpm: 216,
    length: 301,
    status: "ranked",
    playcount: 11800000,
    favouriteCount: 128000,
    rankedDate: "2015-11-20T10:00:00Z",
  },
  {
    id: 2049964,
    beatmapsetId: 981146,
    artist: "GALNERYUS",
    artistUnicode: "GALNERYUS",
    title: "Raise My Sword",
    titleUnicode: "Raise My Sword",
    version: "A THOUSAND SWORDS",
    creator: "Sotarks",
    stars: 7.78,
    bpm: 185,
    length: 420,
    status: "ranked",
    playcount: 12400000,
    favouriteCount: 135000,
    rankedDate: "2019-06-15T09:30:00Z",
  },
  {
    id: 1464026,
    beatmapsetId: 694086,
    artist: "KASAI HARCORES",
    artistUnicode: "KASAI HARCORES",
    title: "Cycle Hit",
    titleUnicode: "Cycle Hit",
    version: "Home Run",
    creator: "Luscent",
    stars: 6.95,
    bpm: 175,
    length: 312,
    status: "ranked",
    playcount: 14200000,
    favouriteCount: 151000,
    rankedDate: "2018-03-04T12:00:00Z",
  },
  {
    id: 1616781,
    beatmapsetId: 765778,
    artist: "Vickeblanka",
    artistUnicode: "ビッケブランカ",
    title: "Black Rover (TV Size)",
    titleUnicode: "Black Rover (TV Size)",
    version: "Extra",
    creator: "Sotarks",
    stars: 6.15,
    bpm: 175,
    length: 90,
    status: "ranked",
    playcount: 15400000,
    favouriteCount: 138000,
    rankedDate: "2018-05-12T14:00:00Z",
  },

  // LEGENDARY TIER
  {
    id: 1675841,
    beatmapsetId: 798038,
    artist: "Alstroemeria Records",
    artistUnicode: "Alstroemeria Records",
    title: "Necro Fantasia",
    titleUnicode: "Necro Fantasia",
    version: "Extra",
    creator: "Mitsu",
    stars: 6.67,
    bpm: 175,
    length: 210,
    status: "ranked",
    playcount: 8900000,
    favouriteCount: 92000,
    rankedDate: "2018-07-28T16:00:00Z",
  },
  {
    id: 847313,
    beatmapsetId: 382400,
    artist: "kors k",
    artistUnicode: "kors k",
    title: "Remote Control",
    titleUnicode: "Remote Control",
    version: "Max Control!",
    creator: "Taeyang",
    stars: 6.45,
    bpm: 165,
    length: 300,
    status: "ranked",
    playcount: 9800000,
    favouriteCount: 110000,
    rankedDate: "2016-04-10T11:00:00Z",
  },
  {
    id: 677872,
    beatmapsetId: 302756,
    artist: "NOMA",
    artistUnicode: "NOMA",
    title: "Brain Power",
    titleUnicode: "Brain Power",
    version: "Long Version",
    creator: "Skystar",
    stars: 6.82,
    bpm: 173,
    length: 248,
    status: "ranked",
    playcount: 8200000,
    favouriteCount: 88000,
    rankedDate: "2015-09-14T20:00:00Z",
  },
  {
    id: 163054,
    beatmapsetId: 41686,
    artist: "MOSAIC.WAV",
    artistUnicode: "MOSAIC.WAV",
    title: "Magical Girl Chicchi",
    titleUnicode: "Magical Girl Chicchi",
    version: "Insane",
    creator: "Val0108",
    stars: 5.89,
    bpm: 185,
    length: 190,
    status: "ranked",
    playcount: 7500000,
    favouriteCount: 79000,
    rankedDate: "2012-05-10T12:00:00Z",
  },
  {
    id: 131891,
    beatmapsetId: 37658,
    artist: "Tatsh",
    artistUnicode: "Tatsh",
    title: "IMAGE -MATERIAL- <Version 0>",
    titleUnicode: "IMAGE -MATERIAL- <Version 0>",
    version: "Scorpiour",
    creator: "Scorpiour",
    stars: 7.91,
    bpm: 260,
    length: 380,
    status: "ranked",
    playcount: 9100000,
    favouriteCount: 98000,
    rankedDate: "2013-08-01T15:00:00Z",
  },
  {
    id: 715074,
    beatmapsetId: 325158,
    artist: "Our Stolen Theory",
    artistUnicode: "Our Stolen Theory",
    title: "United (L.A.O.S Remix)",
    titleUnicode: "United (L.A.O.S Remix)",
    version: "Infinity",
    creator: "Asphyxia",
    stars: 6.22,
    bpm: 175,
    length: 320,
    status: "ranked",
    playcount: 8700000,
    favouriteCount: 86000,
    rankedDate: "2015-10-18T10:00:00Z",
  },

  // EPIC TIER
  {
    id: 114446,
    beatmapsetId: 33816,
    artist: "LeaF",
    artistUnicode: "LeaF",
    title: "Calamity Fortune",
    titleUnicode: "Calamity Fortune",
    version: "Extra",
    creator: "Flower",
    stars: 6.45,
    bpm: 200,
    length: 160,
    status: "ranked",
    playcount: 4800000,
    favouriteCount: 52000,
    rankedDate: "2012-09-02T14:00:00Z",
  },
  {
    id: 139634,
    beatmapsetId: 41823,
    artist: "DM Ashura",
    artistUnicode: "DM Ashura",
    title: "deltaMAX",
    titleUnicode: "deltaMAX",
    version: "Insane",
    creator: "Blue Dragon",
    stars: 5.76,
    bpm: 110,
    length: 125,
    status: "ranked",
    playcount: 3900000,
    favouriteCount: 43000,
    rankedDate: "2012-07-20T18:00:00Z",
  },
  {
    id: 1262832,
    beatmapsetId: 593705,
    artist: "HoneyWorks",
    artistUnicode: "HoneyWorks",
    title: "Daaiスキ. (feat. Hanon)",
    titleUnicode: "大嫌いなはずだった。",
    version: "Expert",
    creator: "Sotarks",
    stars: 5.88,
    bpm: 170,
    length: 90,
    status: "ranked",
    playcount: 4200000,
    favouriteCount: 46000,
    rankedDate: "2017-06-18T12:00:00Z",
  },
  {
    id: 1547462,
    beatmapsetId: 737890,
    artist: "ReoNa",
    artistUnicode: "ReoNa",
    title: "SWEET HURT",
    titleUnicode: "SWEET HURT",
    version: "Insane",
    creator: "Affection",
    stars: 5.45,
    bpm: 160,
    length: 89,
    status: "ranked",
    playcount: 3800000,
    favouriteCount: 41000,
    rankedDate: "2018-09-01T10:00:00Z",
  },
  {
    id: 1819230,
    beatmapsetId: 869400,
    artist: "Kenshi Yonezu",
    artistUnicode: "米津玄師",
    title: "Lemon",
    titleUnicode: "Lemon",
    version: "Insane",
    creator: "pkk",
    stars: 5.12,
    bpm: 87,
    length: 250,
    status: "ranked",
    playcount: 5100000,
    favouriteCount: 56000,
    rankedDate: "2018-12-10T16:00:00Z",
  },

  // RARE TIER
  {
    id: 925756,
    beatmapsetId: 423527,
    artist: "FLOWxGRANRODEO",
    artistUnicode: "FLOW×GRANRODEO",
    title: "7 -seven- (TV Size)",
    titleUnicode: "7 -seven- (TV Size)",
    version: "Expert",
    creator: "Monstrata",
    stars: 5.62,
    bpm: 175,
    length: 90,
    status: "ranked",
    playcount: 2400000,
    favouriteCount: 26000,
    rankedDate: "2016-04-18T11:00:00Z",
  },
  {
    id: 1481156,
    beatmapsetId: 704112,
    artist: "LiSA",
    artistUnicode: "LiSA",
    title: "ADAMAS (TV Size)",
    titleUnicode: "ADAMAS (TV Size)",
    version: "Extra",
    creator: "Sotarks",
    stars: 6.08,
    bpm: 197,
    length: 90,
    status: "ranked",
    playcount: 2800000,
    favouriteCount: 31000,
    rankedDate: "2018-11-04T12:00:00Z",
  },
  {
    id: 791282,
    beatmapsetId: 367600,
    artist: "nano",
    artistUnicode: "ナノ",
    title: "Bull's Eye (TV Size)",
    titleUnicode: "Bull's Eye (TV Size)",
    version: "Insane",
    creator: "FirstDark",
    stars: 5.34,
    bpm: 180,
    length: 90,
    status: "ranked",
    playcount: 2100000,
    favouriteCount: 22000,
    rankedDate: "2016-01-20T15:00:00Z",
  },
  {
    id: 1241370,
    beatmapsetId: 585002,
    artist: "Linked Horizon",
    artistUnicode: "Linked Horizon",
    title: "Shinzou wo Sasageyo! [TV Size]",
    titleUnicode: "心臓を捧げよ！ [TV Size]",
    version: "Insane",
    creator: "Monstrata",
    stars: 5.25,
    bpm: 160,
    length: 90,
    status: "ranked",
    playcount: 2600000,
    favouriteCount: 28000,
    rankedDate: "2017-05-15T16:00:00Z",
  },

  // UNCOMMON TIER
  {
    id: 1357222,
    beatmapsetId: 642231,
    artist: "HyuN",
    artistUnicode: "HyuN",
    title: "Tokyo's Starlight",
    titleUnicode: "Tokyo's Starlight",
    version: "Hard",
    creator: "Mir",
    stars: 3.85,
    bpm: 140,
    length: 185,
    status: "ranked",
    playcount: 850000,
    favouriteCount: 9500,
    rankedDate: "2017-10-05T12:00:00Z",
  },
  {
    id: 104229,
    beatmapsetId: 30121,
    artist: "IOSYS",
    artistUnicode: "IOSYS",
    title: "Cirno's Perfect Math Class",
    titleUnicode: "チルノのパーフェクトさんすう教室",
    version: "Normal",
    creator: "DJPop",
    stars: 2.75,
    bpm: 175,
    length: 120,
    status: "ranked",
    playcount: 980000,
    favouriteCount: 11000,
    rankedDate: "2011-08-10T14:00:00Z",
  },
  {
    id: 985141,
    beatmapsetId: 462100,
    artist: "CHiCO with HoneyWorks",
    artistUnicode: "CHiCO with HoneyWorks",
    title: "Wolf",
    titleUnicode: "ウルフ",
    version: "Hard",
    creator: "Lami",
    stars: 3.42,
    bpm: 185,
    length: 220,
    status: "ranked",
    playcount: 720000,
    favouriteCount: 8200,
    rankedDate: "2016-07-15T18:00:00Z",
  },

  // COMMON TIER
  {
    id: 315,
    beatmapsetId: 16,
    artist: "Kenji Ninuma",
    artistUnicode: "新沼謙治",
    title: "DISCO PRINCE",
    titleUnicode: "DISCO PRINCE",
    version: "Normal",
    creator: "peppy",
    stars: 2.15,
    bpm: 120,
    length: 95,
    status: "ranked",
    playcount: 320000,
    favouriteCount: 3400,
    rankedDate: "2007-10-06T00:00:00Z",
  },
  {
    id: 12345,
    beatmapsetId: 2841,
    artist: "Ni-Sokkususu",
    artistUnicode: "にーそっくすす",
    title: "Blade Dance",
    titleUnicode: "ブレイドダンス",
    version: "Easy",
    creator: "Bear",
    stars: 1.65,
    bpm: 140,
    length: 90,
    status: "ranked",
    playcount: 210000,
    favouriteCount: 2100,
    rankedDate: "2010-03-12T10:00:00Z",
  },
  {
    id: 45012,
    beatmapsetId: 11200,
    artist: "Tamura Yukari",
    artistUnicode: "田村ゆかり",
    title: "Monochrome",
    titleUnicode: "モノクローム",
    version: "Easy",
    creator: "Gabi",
    stars: 1.45,
    bpm: 115,
    length: 110,
    status: "ranked",
    playcount: 150000,
    favouriteCount: 1200,
    rankedDate: "2009-12-05T12:00:00Z",
  }
];

// Function to generate additional pool items to simulate a rich dataset
const ARTISTS = [
  "Camellia", "t+pazolite", "Kobaryo", "USAO", "P*Light", "DJ Noriken", "lapix", "Laur",
  "YOASOBI", "ZUTOMAYO", "Eve", "Kenshi Yonezu", "Aimyon", "Ado", "King Gnu", "Minami",
  "Myth & Roid", "ClariS", "fripSide", "GARNiDELiA", "ReoNa", "SawanoHiroyuki[nZk]", "LiSA",
  "DragonForce", "Imperial Circus Dead Decadence", "Ne Obliviscaris", "UNDEAD CORPORATION",
  "S3RL", "Nanahira", "Kitsune^2", "Renard", "Helblinde", "The Prodigy", "Pendulum", "Feint"
];

const SONG_TITLES = [
  ["GHOST", "ゴースト"], ["CRYING CLOUD", "クライイングクラウド"], ["Attack on Titan", "紅蓮の弓矢"],
  ["KABAN", "鞄"], ["Night Flight", "夜間飛行"], ["Over the Top", "限界突破"],
  ["Solar Storm", "太陽嵐"], ["Chrono Diver", "クロノダイバー"], ["Absolute Zero", "絶対零度"],
  ["Starlight Express", "星光特急"], ["Ignition", "発火点"], ["Dreaming", "夢見る少女"],
  ["Quantum Leap", "量子飛躍"], ["Vortex", "渦潮"], ["Metropolis", "大都市"],
  ["Cyberdimension", "サイバー次元"], ["Superluminal", "超光速"], ["Infinity Ring", "無限の輪"]
];

const DIFFICULTY_NAMES = [
  "Easy", "Normal", "Hard", "Insane", "Extra", "Expert", "Extreme", "Master", "Infinity",
  "Collab Insane", "Another", "Hyper", "Overdose", "Lunatic", "Phantasm", "Chaos", "Gravity"
];

const MAPPERS = [
  "Sotarks", "Monstrata", "Taeyang", "Nevo", "Kroytz", "Mir", "SnowNiNo_", "ASecretBox",
  "pkk", "reform", "Log Off Now", "Feryquitous", "handsome", "Alheak", "FrenZ3R", "Doormat"
];

const REAL_BEATMAPSET_IDS = [
  39804, 131891, 65994, 842412, 477140, 58013, 359890, 981146, 694086, 765778,
  798038, 382400, 302756, 41686, 37658, 325158, 33816, 41823, 593705, 737890,
  869400, 423527, 704112, 367600, 585002, 642231, 30121, 462100, 814144, 924376,
  1011011, 1124483, 1074500, 729885, 935234, 990666, 894883, 965252, 727411, 517474,
  552174, 439811, 286202, 218738, 158023, 1614054, 994348, 1157143, 864537, 751771,
  682288, 881999, 907000, 1040000, 1100000, 1200000, 1250000, 1300000, 1400000, 1500000
];

function generateSynthesizedPool(baseCount = 1500) {
  const maps = [...ICONIC_MAPS];
  let currentId = 3000000;

  for (let i = 0; i < baseCount; i++) {
    const artist = ARTISTS[i % ARTISTS.length];
    const [title, titleUnicode] = SONG_TITLES[i % SONG_TITLES.length];
    const diffName = DIFFICULTY_NAMES[i % DIFFICULTY_NAMES.length];
    const mapper = MAPPERS[i % MAPPERS.length];
    const realSetId = REAL_BEATMAPSET_IDS[i % REAL_BEATMAPSET_IDS.length];

    currentId++;

    // Generate realistic log-distributed playcounts
    // Ranging from 50,000 up to 25,000,000
    const power = Math.random() * 2.8 + 4.6; // 10^4.6 (~40k) to 10^7.4 (~25M)
    const playcount = Math.floor(Math.pow(10, power));
    const favouriteRatio = 0.008 + Math.random() * 0.015;
    const favouriteCount = Math.floor(playcount * favouriteRatio);

    const stars = Math.round((1.2 + Math.random() * 7.5) * 100) / 100;
    const bpm = [120, 128, 140, 150, 160, 175, 180, 185, 190, 200, 210, 222, 240][i % 13];
    const length = 40 + Math.floor(Math.random() * 260);

    maps.push({
      id: currentId,
      beatmapsetId: realSetId,
      artist,
      artistUnicode: artist,
      title: `${title} (feat. ${artist})`,
      titleUnicode,
      version: diffName,
      creator: mapper,
      stars,
      bpm,
      length,
      status: "ranked",
      playcount,
      favouriteCount,
      rankedDate: new Date(2014 + (i % 11), (i % 12), 1 + (i % 28)).toISOString(),
    });
  }

  return maps;
}

// Process and calculate popularity and rarities
function processDataset(rawMaps) {
  // Sort descending by playcount and favorites
  const scored = rawMaps.map(m => {
    const playScore = Math.log10(Math.max(1, m.playcount));
    const favScore = Math.log10(Math.max(1, m.favouriteCount));
    return {
      ...m,
      rawPlayLog: playScore,
      rawFavLog: favScore
    };
  });

  const minPlayLog = Math.min(...scored.map(s => s.rawPlayLog));
  const maxPlayLog = Math.max(...scored.map(s => s.rawPlayLog));
  const minFavLog = Math.min(...scored.map(s => s.rawFavLog));
  const maxFavLog = Math.max(...scored.map(s => s.rawFavLog));

  // Compute 0 - 100 popularity score
  const withScores = scored.map(m => {
    const normPlay = (m.rawPlayLog - minPlayLog) / (maxPlayLog - minPlayLog);
    const normFav = (m.rawFavLog - minFavLog) / (maxFavLog - minFavLog);
    const popScore = Math.round((0.70 * normPlay + 0.30 * normFav) * 10000) / 100;

    return {
      ...m,
      popularityScore: popScore
    };
  });

  // Sort descending by popularityScore
  withScores.sort((a, b) => b.popularityScore - a.popularityScore);

  const total = withScores.length;
  const processedMaps = withScores.map((m, index) => {
    // Percentile: 1.0 is top (most popular), 0.0 is bottom
    const percentile = (total - index) / total;

    let rarity = 'Common';
    if (percentile >= 0.9970) rarity = 'Divine';     // Top 0.3%
    else if (percentile >= 0.9900) rarity = 'Mythic'; // Top 1%
    else if (percentile >= 0.9650) rarity = 'Legendary';
    else if (percentile >= 0.8800) rarity = 'Epic';
    else if (percentile >= 0.7200) rarity = 'Rare';
    else if (percentile >= 0.4500) rarity = 'Uncommon';
    else rarity = 'Common';

    return {
      id: m.id,
      beatmapsetId: m.beatmapsetId,
      artist: m.artist,
      artistUnicode: m.artistUnicode || m.artist,
      title: m.title,
      titleUnicode: m.titleUnicode || m.title,
      version: m.version,
      creator: m.creator,
      stars: m.stars,
      bpm: m.bpm,
      length: m.length,
      status: m.status,
      playcount: m.playcount,
      favouriteCount: m.favouriteCount,
      rankedDate: m.rankedDate,
      covers: {
        cover: `https://assets.ppy.sh/beatmaps/${m.beatmapsetId}/covers/cover.jpg`,
        card: `https://assets.ppy.sh/beatmaps/${m.beatmapsetId}/covers/card.jpg`,
        list: `https://assets.ppy.sh/beatmaps/${m.beatmapsetId}/covers/list.jpg`,
        slimcover: `https://assets.ppy.sh/beatmaps/${m.beatmapsetId}/covers/slimcover.jpg`
      },
      previewUrl: `https://b.ppy.sh/preview/${m.beatmapsetId}.mp3`,
      rarity,
      popularityScore: m.popularityScore,
      mode: 0
    };
  });

  return processedMaps;
}

// Generate the initial dataset
console.log('Generating seed / demo dataset for osu! Beatmap Gacha...');
const allMaps = generateSynthesizedPool(1200);
const processed = processDataset(allMaps);

const rarityCounts = {
  Common: 0,
  Uncommon: 0,
  Rare: 0,
  Epic: 0,
  Legendary: 0,
  Mythic: 0,
  Divine: 0
};

processed.forEach(m => {
  rarityCounts[m.rarity] = (rarityCounts[m.rarity] || 0) + 1;
});

const datasetInfo = {
  version: "1.0.0",
  lastUpdated: new Date().toISOString(),
  totalMaps: processed.length,
  rarityCounts,
  source: "Curated osu! Top Pool & Seed Generator"
};

fs.writeFileSync(path.join(dataDir, 'maps.json'), JSON.stringify(processed));
fs.writeFileSync(path.join(dataDir, 'dataset-info.json'), JSON.stringify(datasetInfo, null, 2));

// Also generate a compact bundled fallback seedData.ts
const seedMaps = processed.slice(0, 100);
const seedTsContent = `// Auto-generated fallback seed dataset
import { Beatmap, DatasetInfo } from '../types/beatmap';

export const SEED_DATASET_INFO: DatasetInfo = ${JSON.stringify(datasetInfo, null, 2)};

export const SEED_BEATMAPS: Beatmap[] = ${JSON.stringify(seedMaps, null, 2)};
`;

fs.writeFileSync(path.resolve(__dirname, '../src/data/seedData.ts'), seedTsContent);
console.log('Generated src/data/seedData.ts fallback.');

console.log(`Generated ${processed.length} beatmaps.`);
console.log('Rarity distribution:', rarityCounts);
console.log('Saved to public/data/maps.json and public/data/dataset-info.json');
