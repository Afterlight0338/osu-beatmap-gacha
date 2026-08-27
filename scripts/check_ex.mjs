import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  'https://hkrdlnwhnwapvxztsuls.supabase.co',
  'sb_publishable_gOpmxgqn5sxV98-LiN1kZQ_tOCZAysI'
);

async function checkEX() {
  const { data: users } = await sb.from('users').select('osu_id, username');
  const userMap = new Map(users?.map((u) => [u.osu_id, u.username]) || []);

  const exMapIds = [2281045, 4876943, 2183501, 4303461, 4851768];
  const { data: allEXColl } = await sb
    .from('user_collection')
    .select('*')
    .in('beatmap_id', exMapIds);

  console.log('--- ALL EX CARD COPIES IN USER_COLLECTION ---');
  for (const c of allEXColl || []) {
    const uname = userMap.get(c.osu_id) || 'Unknown';
    console.log(`Beatmap #${c.beatmap_id} | User: ${uname} (${c.osu_id}) | Copies: ${c.copies} | First: ${new Date(c.first_pulled_at).toISOString()}`);
  }
}

checkEX().catch(console.error);
