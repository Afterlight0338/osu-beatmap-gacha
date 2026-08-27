import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const sb = createClient(
  'https://hkrdlnwhnwapvxztsuls.supabase.co',
  'sb_publishable_gOpmxgqn5sxV98-LiN1kZQ_tOCZAysI'
);

async function runAudit() {
  console.log('--- Starting Targeted High-Rarity & Seed Fallback Audit ---');

  // Load seedData IDs
  const seedContent = fs.readFileSync('./src/data/seedData.ts', 'utf-8');
  const seedIds = new Set();
  for (const match of seedContent.matchAll(/"id":\s*(\d+)/g)) {
    seedIds.add(Number(match[1]));
  }

  // Load maps.json
  const mapsJson = JSON.parse(fs.readFileSync('./public/data/maps.json', 'utf-8'));
  const mapsMap = new Map(mapsJson.map((m) => [m.id, m]));

  // Get all registered users
  const { data: users, error: uErr } = await sb.from('users').select('osu_id, username, total_pulls');
  if (uErr) throw uErr;

  console.log(`Auditing ${users.length} registered players...`);

  const affectedUsersSummary = {};
  const allSuspiciousClusters = [];

  for (const u of users) {
    // Fetch all high-tier pulls (GOAT, Divine, EX, Celestial) for this user
    const { data: topPulls, error: pErr } = await sb
      .from('user_history')
      .select('*')
      .eq('osu_id', u.osu_id)
      .in('rarity', ['GOAT', 'Divine', 'EX', 'Celestial'])
      .order('pulled_at', { ascending: true });

    if (pErr || !topPulls || topPulls.length === 0) continue;

    // Cluster pulls by timestamp (within 3 seconds)
    const clusters = [];
    let current = [];

    for (const p of topPulls) {
      if (current.length === 0) {
        current.push(p);
      } else {
        const prev = current[current.length - 1];
        if (Math.abs(p.pulled_at - prev.pulled_at) <= 3000) {
          current.push(p);
        } else {
          clusters.push(current);
          current = [p];
        }
      }
    }
    if (current.length > 0) {
      clusters.push(current);
    }

    // Check for glitch signature: 2 or more Divine/GOAT/EX in a single 10-pull
    for (const cluster of clusters) {
      if (cluster.length >= 2) {
        const seedMatches = cluster.filter((c) => seedIds.has(c.beatmap_id));
        const divineCount = cluster.filter((c) => c.rarity === 'Divine').length;
        const goatCount = cluster.filter((c) => c.rarity === 'GOAT').length;
        const exCount = cluster.filter((c) => c.rarity === 'EX').length;

        const sessionInfo = {
          osuId: u.osu_id,
          username: u.username,
          timestamp: cluster[0].pulled_at,
          dateStr: new Date(cluster[0].pulled_at).toISOString(),
          highTierCount: cluster.length,
          divineCount,
          goatCount,
          exCount,
          seedMapCount: seedMatches.length,
          cards: cluster.map((c) => ({
            id: c.id,
            beatmapId: c.beatmap_id,
            title: mapsMap.get(c.beatmap_id)?.title || 'Beatmap #' + c.beatmap_id,
            rarity: c.rarity,
            isSeedMap: seedIds.has(c.beatmap_id),
          })),
        };

        allSuspiciousClusters.push(sessionInfo);

        if (!affectedUsersSummary[u.osu_id]) {
          affectedUsersSummary[u.osu_id] = {
            username: u.username,
            totalGlitchedPulls: 0,
            sessionsCount: 0,
            divineTotal: 0,
            goatTotal: 0,
            exTotal: 0,
            cardIds: [],
            beatmapIds: [],
          };
        }

        affectedUsersSummary[u.osu_id].sessionsCount++;
        affectedUsersSummary[u.osu_id].totalGlitchedPulls += cluster.length;
        affectedUsersSummary[u.osu_id].divineTotal += divineCount;
        affectedUsersSummary[u.osu_id].goatTotal += goatCount;
        affectedUsersSummary[u.osu_id].exTotal += exCount;
        affectedUsersSummary[u.osu_id].cardIds.push(...cluster.map((c) => c.id));
        affectedUsersSummary[u.osu_id].beatmapIds.push(...cluster.map((c) => c.beatmap_id));
      }
    }
  }

  console.log('\n======================================================');
  console.log('AUDIT RESULTS: SEED FALLBACK GLITCH SESSIONS DETECTED');
  console.log('======================================================');

  const affectedOsuIds = Object.keys(affectedUsersSummary);
  if (affectedOsuIds.length === 0) {
    console.log('No glitched sessions found! All high rarity pulls appear normal.');
    return;
  }

  for (const [osuId, summary] of Object.entries(affectedUsersSummary)) {
    console.log(`\n👤 User: ${summary.username} (osu! ID: ${osuId})`);
    console.log(`   • Glitched Multi-Pull Batches: ${summary.sessionsCount}`);
    console.log(`   • Total Illegitimate Cards: ${summary.totalGlitchedPulls}`);
    console.log(`   • Divine: ${summary.divineTotal} | GOAT: ${summary.goatTotal} | EX: ${summary.exTotal}`);
  }

  console.log('\n--- DETAILED SESSIONS BREAKDOWN ---');
  for (const s of allSuspiciousClusters) {
    console.log(`\n[${s.dateStr}] User: ${s.username} (${s.osuId}) - ${s.highTierCount} Top-Tier Cards in 1 Pull:`);
    s.cards.forEach((c) => {
      console.log(`   - [${c.rarity}] #${c.beatmapId}: ${c.title} (SeedMap: ${c.isSeedMap})`);
    });
  }

  fs.writeFileSync('./scripts/audit_results.json', JSON.stringify({ affectedUsersSummary, allSuspiciousClusters }, null, 2));
  console.log('\nAudit complete! Full JSON saved to scripts/audit_results.json');
}

runAudit().catch(console.error);
