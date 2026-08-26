#!/usr/bin/env node
/**
 * scripts/migrate-d1-to-supabase.mjs
 * Migrates all users, sessions, collections, and history from Cloudflare D1 to Supabase.
 */

import { execSync } from 'child_process';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hkrdlnwhnwapvxztsuls.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_gOpmxgqn5sxV98-LiN1kZQ_tOCZAysI';

console.log('🚀 Starting D1 -> Supabase Data Migration...');
console.log(`Target: ${SUPABASE_URL}`);

// Read D1 tables via wrangler CLI
function queryD1(sql) {
  try {
    const cmd = `cd worker && npx wrangler d1 execute osu-gacha-db --remote --json --command="${sql.replace(/"/g, '\\"')}"`;
    const res = execSync(cmd, { encoding: 'utf-8' });
    const parsed = JSON.parse(res);
    return parsed[0]?.results || [];
  } catch (err) {
    console.error('Failed to query D1:', err.message);
    return [];
  }
}

async function postToSupabase(table, records) {
  if (!records || records.length === 0) return;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates',
    },
    body: JSON.stringify(records),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`Failed to upsert to ${table}:`, errText);
  } else {
    console.log(`✓ Migrated ${records.length} records to Supabase "${table}"`);
  }
}

async function run() {
  console.log('Fetching users from D1...');
  const users = queryD1('SELECT * FROM users');
  console.log(`Found ${users.length} users.`);
  await postToSupabase('users', users);

  console.log('Fetching user_collection from D1...');
  const collections = queryD1('SELECT * FROM user_collection');
  console.log(`Found ${collections.length} collection records.`);
  await postToSupabase('user_collection', collections);

  console.log('Fetching user_history from D1...');
  const history = queryD1('SELECT * FROM user_history');
  console.log(`Found ${history.length} history records.`);
  await postToSupabase('user_history', history);

  console.log('Fetching admin_config from D1...');
  const config = queryD1('SELECT * FROM admin_config');
  console.log(`Found ${config.length} config records.`);
  await postToSupabase('admin_config', config);

  console.log('✨ Data migration check complete!');
}

run();
