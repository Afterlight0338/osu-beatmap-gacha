import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  'https://hkrdlnwhnwapvxztsuls.supabase.co',
  'sb_publishable_gOpmxgqn5sxV98-LiN1kZQ_tOCZAysI'
);

const TARGET_OSU_ID = 21417624; // koseki1
const GLITCH_START = 1787793430000; // 2026-08-27 01:17:10 UTC
const GLITCH_END = 1787793445000;   // 2026-08-27 01:17:25 UTC

async function cleanupAndCompensate() {
  console.log('=== STEP 1: AUDITING PRE-GLITCH VS GLITCHED CARDS FOR KOSEKI1 ===');

  // 1. Fetch all history for koseki1
  let allHist = [];
  let page = 0;
  while (true) {
    const { data } = await sb
      .from('user_history')
      .select('*')
      .eq('osu_id', TARGET_OSU_ID)
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    allHist.push(...data);
    page++;
    if (data.length < 1000) break;
  }
  console.log(`Total history records found for koseki1: ${allHist.length}`);

  // Identify glitched history records
  const glitchedRecords = allHist.filter(
    (h) => h.pulled_at >= GLITCH_START && h.pulled_at <= GLITCH_END
  );
  console.log(`Glitched records in 01:17 UTC window: ${glitchedRecords.length}`);

  // Count how many copies of each beatmap were generated during the glitch
  const glitchedCopiesPerMap = new Map();
  for (const g of glitchedRecords) {
    glitchedCopiesPerMap.set(g.beatmap_id, (glitchedCopiesPerMap.get(g.beatmap_id) || 0) + 1);
  }

  // Count how many legitimate pulls of each beatmap occurred OUTSIDE the glitch window
  const legitimatePullsPerMap = new Map();
  for (const h of allHist) {
    if (h.pulled_at < GLITCH_START || h.pulled_at > GLITCH_END) {
      legitimatePullsPerMap.set(h.beatmap_id, (legitimatePullsPerMap.get(h.beatmap_id) || 0) + 1);
    }
  }

  // Fetch current user_collection records for koseki1
  let allColl = [];
  page = 0;
  while (true) {
    const { data } = await sb
      .from('user_collection')
      .select('*')
      .eq('osu_id', TARGET_OSU_ID)
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    allColl.push(...data);
    page++;
    if (data.length < 1000) break;
  }
  console.log(`Current unique collection count for koseki1: ${allColl.length}`);

  const collMap = new Map(allColl.map((c) => [c.beatmap_id, c]));

  console.log('\n=== STEP 2: PROCESSING COLLECTION ADJUSTMENTS ===');
  // For each glitched map:
  for (const [beatmapId, glitchedCount] of glitchedCopiesPerMap.entries()) {
    const collRecord = collMap.get(beatmapId);
    if (!collRecord) continue;

    const legitCount = legitimatePullsPerMap.get(beatmapId) || 0;
    const currentCopies = collRecord.copies || 1;
    const newCopies = Math.max(0, currentCopies - glitchedCount);

    if (legitCount > 0 && newCopies > 0) {
      // User legitimately had this card pre-glitch or post-glitch! Retain legitimate copies.
      console.log(
        `[RETAIN PRE-GLITCH] Beatmap #${beatmapId}: Had ${legitCount} legit pull(s). Updating copies from ${currentCopies} -> ${newCopies}`
      );
      await sb
        .from('user_collection')
        .update({ copies: newCopies })
        .eq('osu_id', TARGET_OSU_ID)
        .eq('beatmap_id', beatmapId);
    } else {
      // User ONLY got this card during the glitch. Remove from collection.
      console.log(
        `[REMOVE GLITCHED ONLY] Beatmap #${beatmapId}: 0 legit pulls. Deleting card from collection.`
      );
      await sb
        .from('user_collection')
        .delete()
        .eq('osu_id', TARGET_OSU_ID)
        .eq('beatmap_id', beatmapId);
    }
  }

  // Also handle Sakura no Uta (#2281045) and Wicked (#4876943) EX card corrections
  // 1. Sakura no Uta (#2281045)
  const sakuraColl = collMap.get(2281045);
  if (sakuraColl && sakuraColl.copies > 1) {
    console.log(`[FIX EX] Sakura no Uta (#2281045): Resetting copies from ${sakuraColl.copies} -> 1 legitimate copy.`);
    await sb
      .from('user_collection')
      .update({ copies: 1 })
      .eq('osu_id', TARGET_OSU_ID)
      .eq('beatmap_id', 2281045);
  }

  // 2. Wicked (#4876943)
  const wickedColl = collMap.get(4876943);
  if (wickedColl && wickedColl.copies > 1) {
    console.log(`[FIX EX] Wicked (#4876943): Resetting copies from ${wickedColl.copies} -> 1 legitimate copy.`);
    await sb
      .from('user_collection')
      .update({ copies: 1 })
      .eq('osu_id', TARGET_OSU_ID)
      .eq('beatmap_id', 4876943);
  }

  console.log('\n=== STEP 3: DELETING GLITCHED HISTORY ROWS ===');
  const { error: delHistErr } = await sb
    .from('user_history')
    .delete()
    .eq('osu_id', TARGET_OSU_ID)
    .gte('pulled_at', GLITCH_START)
    .lte('pulled_at', GLITCH_END);

  if (delHistErr) {
    console.error('Error deleting glitched history:', delHistErr);
  } else {
    console.log(`Successfully deleted the ${glitchedRecords.length} glitched pull rows from user_history.`);
  }

  console.log('\n=== STEP 4: COMPENSATING KOSEKI1 WITH 500 PULLS (STAMINA) ===');
  const energyKey = `user_energy_${TARGET_OSU_ID}`;
  const { data: energyData } = await sb
    .from('admin_config')
    .select('value')
    .eq('key', energyKey)
    .maybeSingle();

  const currentEnergy = energyData?.value || {
    max: 50,
    current: 0,
    reserve: 0,
    bonus: 0,
    pityCount: 0,
    totalPulls: 0,
  };

  const updatedBonus = (currentEnergy.bonus || 0) + 500;
  const updatedEnergy = {
    ...currentEnergy,
    bonus: updatedBonus,
    updatedAt: Date.now(),
  };

  const { error: energyErr } = await sb.from('admin_config').upsert({
    key: energyKey,
    value: updatedEnergy,
    updated_at: new Date().toISOString(),
  });

  if (energyErr) {
    console.error('Error updating energy compensation:', energyErr);
  } else {
    console.log(`Successfully credited +500 Pull Stamina to koseki1 (${TARGET_OSU_ID})! New Bonus Stamina: ${updatedBonus} ⚡`);
  }

  console.log('\n=== CLEANUP & COMPENSATION COMPLETED SUCCESSFULLY ===');
}

cleanupAndCompensate().catch(console.error);
