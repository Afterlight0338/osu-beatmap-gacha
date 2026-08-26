import fs from 'fs';

const raw = fs.readFileSync('public/data/maps.json', 'utf-8');
const maps = JSON.parse(raw);
const total = maps.length;

function calculateEmpiricalPercentiles(items, getValue) {
  const sorted = [...items].sort((a, b) => getValue(a) - getValue(b));
  const n = sorted.length;
  const resultMap = new Map();
  sorted.forEach((item, idx) => {
    resultMap.set(item, (idx / Math.max(1, n - 1)) * 100);
  });
  return resultMap;
}

function computeMultiFactorPopularity(maps) {
  const enriched = maps.map((m) => {
    const p = Math.max(0, m.playcount || 0);
    const f = Math.max(0, m.favourite_count || m.favouriteCount || 0);
    const logP = Math.log10(p + 1);
    const logF = Math.log10(f + 1);
    const ratioRaw = ((f + 10) / (p + 3000)) * Math.log10(p + 10);

    const year = m.rankedDate ? new Date(m.rankedDate).getFullYear() : 2020;
    let era = 'contemporary';
    if (year <= 2011) era = 'classic';
    else if (year <= 2015) era = 'golden';
    else if (year <= 2019) era = 'modern';

    return { map: m, logP, logF, ratioRaw, year, era };
  });

  const reachPcts = calculateEmpiricalPercentiles(enriched, (i) => i.logP);
  const affectionPcts = calculateEmpiricalPercentiles(enriched, (i) => i.logF);
  const ratioPcts = calculateEmpiricalPercentiles(enriched, (i) => i.ratioRaw);

  const eraPcts = new Map();
  ['classic', 'golden', 'modern', 'contemporary'].forEach((eraName) => {
    const cohort = enriched.filter((i) => i.era === eraName);
    const cohortLogP = calculateEmpiricalPercentiles(cohort, (i) => i.logP);
    const cohortLogF = calculateEmpiricalPercentiles(cohort, (i) => i.logF);
    cohort.forEach((item) => {
      const pReach = cohortLogP.get(item) || 0;
      const pAffection = cohortLogF.get(item) || 0;
      eraPcts.set(item, pReach * 0.40 + pAffection * 0.60);
    });
  });

  const p = 3.0;
  const weights = { reach: 0.35, affection: 0.45, ratio: 0.10, era: 0.10 };

  const scored = enriched.map((item) => {
    const pReach = reachPcts.get(item) || 0;
    const pAffection = affectionPcts.get(item) || 0;
    const pRatio = ratioPcts.get(item) || 0;
    const pEra = eraPcts.get(item) || 0;

    const minkowskiInner =
      weights.reach * Math.pow(pReach, p) +
      weights.affection * Math.pow(pAffection, p) +
      weights.ratio * Math.pow(pRatio, p) +
      weights.era * Math.pow(pEra, p);

    const baseMCDA = Math.pow(minkowskiInner, 1 / p);

    let peak = 0;
    if (pAffection >= 99.9) peak += 3.0;
    else if (pAffection >= 99.5) peak += 1.5;
    if (pReach >= 99.9) peak += 2.5;
    else if (pReach >= 99.5) peak += 1.2;
    if (pEra >= 99.9) peak += 2.0;
    else if (pEra >= 99.5) peak += 1.0;
    if (pRatio >= 99.0 && item.map.playcount >= 1000000) peak += 1.5;

    const length = item.map.length || 0;
    const lenBonus = length >= 240 ? Math.min(2.0, ((length - 240) / 360) * 2.0) : 0;

    const stars = item.map.stars || 0;
    const sBonus = stars >= 6.5 && stars <= 11.0 ? Math.min(0.8, ((stars - 6.5) / 4.0) * 0.8) : 0;

    const status = item.map.status || 'ranked';
    const statusMult = status === 'ranked' || status === 'approved' ? 1.0 : status === 'loved' ? 0.985 : 0.95;

    const finalScore = Math.round((baseMCDA + peak + lenBonus + sBonus) * statusMult * 100) / 100;
    return { map: item.map, score: finalScore };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (b.map.playcount || 0) - (a.map.playcount || 0);
  });

  // Balanced 10-Tier Pyramid Config (Scaled to 38,696 Maps)
  const thresholds = [
    { tier: 'GOAT', count: 25 },
    { tier: 'Divine', count: 75 },
    { tier: 'Celestial', count: 150 },
    { tier: 'Mythic', count: 350 },
    { tier: 'Legendary', count: 800 },
    { tier: 'Epic', count: 2600 },
    { tier: 'Rare', count: 6000 },
    { tier: 'Uncommon+', count: 8000 },
    { tier: 'Uncommon', count: 9000 },
  ];

  let currentIdx = 0;
  for (const { tier, count } of thresholds) {
    const end = Math.min(currentIdx + count, scored.length);
    for (let i = currentIdx; i < end; i++) {
      scored[i].map.rarity = tier;
      scored[i].map.popularityScore = scored[i].score;
    }
    currentIdx = end;
  }
  for (let i = currentIdx; i < scored.length; i++) {
    scored[i].map.rarity = 'Common';
    scored[i].map.popularityScore = scored[i].score;
  }

  return scored.map(s => s.map);
}

console.log('⚖️ Reclassifying 38,696 beatmaps with Multi-Factor Popularity Engine...');
const classified = computeMultiFactorPopularity(maps);

const dist = {};
for (const m of classified) {
  dist[m.rarity] = (dist[m.rarity] || 0) + 1;
}

console.log('\n📊 Reclassified Rarity Distribution (Natural Pyramid):');
const ORDER = ['GOAT', 'Divine', 'Celestial', 'Mythic', 'Legendary', 'Epic', 'Rare', 'Uncommon+', 'Uncommon', 'Common'];
for (const tier of ORDER) {
  const count = dist[tier] || 0;
  const pct = ((count / total) * 100).toFixed(2);
  console.log(`  - ${tier.padEnd(12)}: ${String(count).padStart(6)} (${pct}%)`);
}

console.log('\nTop 15 GOAT Cards:');
classified.slice(0, 15).forEach((m, idx) => {
  const favs = m.favourite_count || m.favouriteCount || 0;
  console.log(`  ${idx + 1}. ${m.artist} - ${m.title} [${m.version}] (${m.stars}★) | Score: ${m.popularityScore} | Plays: ${(m.playcount || 0).toLocaleString()} | Favs: ${favs.toLocaleString()}`);
});
