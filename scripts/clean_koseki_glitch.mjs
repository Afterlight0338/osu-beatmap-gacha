import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const sb = createClient(
  'https://hkrdlnwhnwapvxztsuls.supabase.co',
  'sb_publishable_gOpmxgqn5sxV98-LiN1kZQ_tOCZAysI'
);

const TARGET_OSU_ID = 21417624; // koseki1
const GLITCH_START = new Date('2026-08-27T01:10:00Z').getTime(); // 1787793000000
const GLITCH_END = new Date('2026-08-27T01:30:00Z').getTime();   // 1787794200000

async function executeFullCleanup() {
  console.log('=== 1. AUDITING KOSEKI1 COLLECTION & HISTORY ===');

  // Fetch all user_collection records for koseki1
  let allColl = [];
  let page = 0;
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

  // Fetch all user_history records for koseki1
  let allHist = [];
  page = 0;
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
  console.log(`Current history count for koseki1: ${allHist.length}`);

  // Identify collection entries originating from the glitch window
  const glitchedCards = allColl.filter(
    (c) => c.first_pulled_at >= GLITCH_START && c.first_pulled_at <= GLITCH_END
  );
  console.log(`Collection items with first_pulled_at in glitch window: ${glitchedCards.length}`);

  // Check history entries in the glitch window
  const glitchedHistory = allHist.filter(
    (h) => h.pulled_at >= GLITCH_START && h.pulled_at <= GLITCH_END
  );
  console.log(`History items in glitch window: ${glitchedHistory.length}`);

  // Calculate legit pulls per map outside glitch window
  const legitHistoryPerMap = new Map();
  for (const h of allHist) {
    if (h.pulled_at < GLITCH_START || h.pulled_at > GLITCH_END) {
      legitHistoryPerMap.set(h.beatmap_id, (legitHistoryPerMap.get(h.beatmap_id) || 0) + 1);
    }
  }

  console.log('\n=== 2. REMOVING / DECREMENTING GLITCHED CARDS ===');
  let deletedCount = 0;
  let updatedCount = 0;

  for (const card of glitchedCards) {
    const legitCount = legitHistoryPerMap.get(card.beatmap_id) || 0;
    if (legitCount > 0) {
      console.log(`[DECREMENT] Beatmap #${card.beatmap_id}: Had ${legitCount} legit pull(s). Setting copies = ${legitCount}`);
      await sb
        .from('user_collection')
        .update({ copies: legitCount })
        .eq('osu_id', TARGET_OSU_ID)
        .eq('beatmap_id', card.beatmap_id);
      updatedCount++;
    } else {
      console.log(`[DELETE] Beatmap #${card.beatmap_id}: Purely from glitch window. Removing.`);
      await sb
        .from('user_collection')
        .delete()
        .eq('osu_id', TARGET_OSU_ID)
        .eq('beatmap_id', card.beatmap_id);
      deletedCount++;
    }
  }

  console.log(`\nDeleted ${deletedCount} cards, decremented ${updatedCount} cards.`);

  // Clean glitched history
  if (glitchedHistory.length > 0) {
    console.log(`\nDeleting ${glitchedHistory.length} glitched records from user_history...`);
    const glitchedIds = glitchedHistory.map((h) => h.id);
    // Delete in chunks of 50
    for (let i = 0; i < glitchedIds.length; i += 50) {
      const chunk = glitchedIds.slice(i, i + 50);
      await sb.from('user_history').delete().in('id', chunk);
    }
  }

  // Recalculate remaining total pulls for koseki1
  const { data: updatedColl } = await sb
    .from('user_collection')
    .select('copies')
    .eq('osu_id', TARGET_OSU_ID);

  const newTotalCopies = (updatedColl || []).reduce((acc, c) => acc + (c.copies || 1), 0);
  console.log(`\nNew total collection cards for koseki1: ${updatedColl?.length} unique (${newTotalCopies} copies)`);

  await sb
    .from('users')
    .update({ total_pulls: newTotalCopies })
    .eq('osu_id', TARGET_OSU_ID);

  console.log('✓ Successfully updated users table with legitimate total_pulls!');
}

executeFullCleanup();
