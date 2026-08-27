import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  'https://hkrdlnwhnwapvxztsuls.supabase.co',
  'sb_publishable_gOpmxgqn5sxV98-LiN1kZQ_tOCZAysI'
);

async function checkSakura() {
  const { data: users } = await sb.from('users').select('osu_id, username');
  const userMap = new Map(users?.map((u) => [u.osu_id, u.username]) || []);

  // 1. Check user_collection for 2281045
  const { data: coll } = await sb
    .from('user_collection')
    .select('*')
    .eq('beatmap_id', 2281045);

  console.log('--- ALL USERS WITH SAKURA NO UTA (#2281045) IN COLLECTION ---');
  for (const c of coll || []) {
    const uname = userMap.get(c.osu_id) || 'Unknown';
    console.log(
      `User: ${uname} (${c.osu_id}) -> Copies: ${c.copies} | First: ${new Date(c.first_pulled_at).toISOString()} | Last: ${new Date(c.last_pulled_at).toISOString()}`
    );
  }

  // 2. Check user_history for 2281045
  const { data: hist } = await sb
    .from('user_history')
    .select('*')
    .eq('beatmap_id', 2281045)
    .order('pulled_at', { ascending: true });

  console.log('\n--- ALL HISTORY PULL RECORDS FOR SAKURA NO UTA (#2281045) ---');
  console.log('Total history pull events:', hist?.length);
  for (const h of hist || []) {
    const uname = userMap.get(h.osu_id) || 'Unknown';
    console.log(
      `ID: ${h.id} | User: ${uname} (${h.osu_id}) | Rarity: ${h.rarity} | Time: ${new Date(h.pulled_at).toISOString()}`
    );
  }

  // 3. Also check if there are other EX cards or custom beatmaps with 44 copies
  const { data: allCollUser } = await sb
    .from('user_collection')
    .select('*')
    .eq('osu_id', 21417624)
    .gte('copies', 5)
    .order('copies', { ascending: false });

  console.log('\n--- KOSEKI1 (#21417624) CARDS WITH HIGH COPIES (>= 5) ---');
  console.log('Total cards with >= 5 copies:', allCollUser?.length);
  for (const c of allCollUser || []) {
    console.log(`Beatmap #${c.beatmap_id} -> Copies: ${c.copies} | First: ${new Date(c.first_pulled_at).toISOString()}`);
  }
}

checkSakura().catch(console.error);
