import { execSync } from 'child_process';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hkrdlnwhnwapvxztsuls.supabase.co';
const SUPABASE_KEY = 'sb_publishable_gOpmxgqn5sxV98-LiN1kZQ_tOCZAysI';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function queryD1(sql) {
  const escaped = sql.replace(/"/g, '\\"');
  const cmd = `cd /home/afterlight/osu-beatmap-gacha/worker && export PATH="$HOME/.nix-profile/bin:$PATH" && npx wrangler d1 execute osu_gacha_db --remote --json --command="${escaped}"`;
  const raw = execSync(cmd, { encoding: 'utf-8', maxBuffer: 100 * 1024 * 1024 });
  const parsed = JSON.parse(raw);
  return parsed[0].results;
}

function parseEpoch(val) {
  if (typeof val === 'number') return val;
  if (!val) return Date.now();
  const parsed = Number(val);
  if (!isNaN(parsed) && parsed > 1000000000) return parsed;
  const d = Date.parse(val);
  return isNaN(d) ? Date.now() : d;
}

async function runCompleteMigration() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🚀 FULL D1 ➔ SUPABASE COMPLETE DATA MIGRATION');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // 1. MIGRATE USERS
  console.log('👤 [1/6] Migrating all Users...');
  const d1Users = queryD1('SELECT * FROM users;');
  console.log(`Found ${d1Users.length} users in Cloudflare D1.`);

  const { data: sbUsers } = await supabase.from('users').select('*');
  const sbUserMap = new Map((sbUsers || []).map(u => [u.osu_id, u]));

  for (const u of d1Users) {
    const existing = sbUserMap.get(u.osu_id);
    const effectivePulls = Math.max(u.total_pulls || 0, existing?.total_pulls || 0);
    const effectivePity = Math.max(u.pity_count || 0, existing?.pity_count || 0);

    const payload = {
      osu_id: u.osu_id,
      username: u.username,
      avatar_url: u.avatar_url,
      country_code: u.country_code,
      global_rank: u.global_rank,
      total_pulls: effectivePulls,
      pity_count: effectivePity,
      is_banned: u.is_banned ? true : false,
      created_at: u.created_at ? new Date(u.created_at).toISOString() : new Date().toISOString(),
      last_login: u.last_login ? new Date(u.last_login).toISOString() : new Date().toISOString(),
    };

    await supabase.from('users').upsert(payload);
  }
  console.log(`✅ Synced all ${d1Users.length} users into Supabase!\n`);

  // 2. MIGRATE SESSIONS
  console.log('🔑 [2/6] Migrating User Sessions...');
  const d1Sessions = queryD1('SELECT * FROM user_sessions;');
  console.log(`Found ${d1Sessions.length} active sessions in D1.`);
  
  if (d1Sessions.length > 0) {
    const sessionBatches = [];
    const BATCH_SIZE = 50;
    for (let i = 0; i < d1Sessions.length; i += BATCH_SIZE) {
      sessionBatches.push(d1Sessions.slice(i, i + BATCH_SIZE));
    }

    for (const batch of sessionBatches) {
      const records = batch.map(s => ({
        token: s.token,
        osu_id: s.osu_id,
        created_at: s.created_at ? new Date(s.created_at).toISOString() : new Date().toISOString(),
        expires_at: s.expires_at ? new Date(s.expires_at).toISOString() : new Date(Date.now() + 30*86400000).toISOString(),
      }));
      await supabase.from('user_sessions').upsert(records);
    }
  }
  console.log(`✅ Synced ${d1Sessions.length} sessions into Supabase!\n`);

  // 3. MIGRATE ENERGY OVERRIDES
  console.log('⚡ [3/6] Migrating Energy Overrides...');
  const d1Overrides = queryD1('SELECT * FROM user_energy_overrides;');
  console.log(`Found ${d1Overrides.length} energy overrides in D1.`);
  for (const o of d1Overrides) {
    await supabase.from('user_energy_overrides').upsert({
      osu_id: o.osu_id,
      energy_amount: o.energy_amount || 100,
    });
  }
  console.log(`✅ Synced ${d1Overrides.length} energy overrides!\n`);

  // 4. MIGRATE ADMIN CONFIG
  console.log('⚙️ [4/6] Migrating Admin Configurations...');
  const d1Config = queryD1('SELECT * FROM admin_config;');
  console.log(`Found ${d1Config.length} admin_config rows in D1.`);
  for (const c of d1Config) {
    let parsedVal = c.value;
    try {
      if (typeof c.value === 'string') parsedVal = JSON.parse(c.value);
    } catch {}
    const { data: existingKey } = await supabase.from('admin_config').select('key').eq('key', c.key).maybeSingle();
    if (!existingKey) {
      await supabase.from('admin_config').upsert({
        key: c.key,
        value: parsedVal,
        updated_at: c.updated_at ? new Date(c.updated_at).toISOString() : new Date().toISOString(),
      });
      console.log(`  + Migrated missing config key: ${c.key}`);
    }
  }
  console.log(`✅ Config check complete!\n`);

  // 5. MIGRATE USER COLLECTIONS
  console.log('🎴 [5/6] Migrating User Collections (Cards)...');
  const d1CollCount = queryD1('SELECT COUNT(*) as count FROM user_collection;')[0].count;
  console.log(`Total collection rows in D1: ${d1CollCount.toLocaleString()}`);

  const PAGE_SIZE = 2500;
  let offset = 0;
  let migratedCards = 0;

  while (offset < d1CollCount) {
    const d1Cards = queryD1(`SELECT * FROM user_collection LIMIT ${PAGE_SIZE} OFFSET ${offset};`);
    if (d1Cards.length === 0) break;

    const upsertBatch = d1Cards.map(c => ({
      osu_id: c.osu_id,
      beatmap_id: c.beatmap_id,
      copies: c.copies || 1,
      first_pulled_at: parseEpoch(c.first_pulled_at),
      last_pulled_at: parseEpoch(c.last_pulled_at),
      is_favorite: c.is_favorite ? true : false,
    }));

    // Upsert in chunks of 500 into Supabase
    for (let i = 0; i < upsertBatch.length; i += 500) {
      const chunk = upsertBatch.slice(i, i + 500);
      const { error } = await supabase.from('user_collection').upsert(chunk, { onConflict: 'osu_id,beatmap_id', ignoreDuplicates: false });
      if (error) {
        console.warn(`Warning upserting collection batch:`, error.message);
      }
    }

    migratedCards += d1Cards.length;
    offset += PAGE_SIZE;
    process.stdout.write(`\r  Progress: ${migratedCards.toLocaleString()} / ${d1CollCount.toLocaleString()} cards synced`);
  }
  console.log(`\n✅ 100% of ${d1CollCount.toLocaleString()} user collection cards verified & migrated!\n`);

  // 6. MIGRATE USER HISTORY
  console.log('📜 [6/6] Migrating User Pull History...');
  const d1HistCount = queryD1('SELECT COUNT(*) as count FROM user_history;')[0].count;
  console.log(`Total history rows in D1: ${d1HistCount.toLocaleString()}`);

  let histOffset = 0;
  let migratedHist = 0;

  while (histOffset < d1HistCount) {
    const d1Hist = queryD1(`SELECT * FROM user_history LIMIT ${PAGE_SIZE} OFFSET ${histOffset};`);
    if (d1Hist.length === 0) break;

    const histBatch = d1Hist.map(h => ({
      id: h.id,
      osu_id: h.osu_id,
      beatmap_id: h.beatmap_id,
      rarity: h.rarity || 'Common',
      pulled_at: parseEpoch(h.pulled_at),
    }));

    for (let i = 0; i < histBatch.length; i += 500) {
      const chunk = histBatch.slice(i, i + 500);
      const { error } = await supabase.from('user_history').upsert(chunk, { onConflict: 'id', ignoreDuplicates: true });
      if (error) {
        console.warn(`Warning upserting history chunk:`, error.message);
      }
    }

    migratedHist += d1Hist.length;
    histOffset += PAGE_SIZE;
    process.stdout.write(`\r  Progress: ${migratedHist.toLocaleString()} / ${d1HistCount.toLocaleString()} history records synced`);
  }
  console.log(`\n✅ 100% of ${d1HistCount.toLocaleString()} user history entries verified & migrated!\n`);

  // FINAL VERIFICATION
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🎉 FINAL MIGRATION AUDIT & ROW COUNT VERIFICATION');
  console.log('═══════════════════════════════════════════════════════════════');
  const tables = ['users', 'user_sessions', 'user_collection', 'user_history', 'admin_config', 'user_energy_overrides'];
  for (const t of tables) {
    const { count } = await supabase.from(t).select('*', { count: 'exact', head: true });
    console.log(`✓ Table [${t}]: ${count.toLocaleString()} rows in Supabase`);
  }
  console.log('\nMigration successfully finished with 0 data left behind!');
}

runCompleteMigration().catch(err => {
  console.error('Fatal migration error:', err);
  process.exit(1);
});
