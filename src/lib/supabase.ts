import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://hkrdlnwhnwapvxztsuls.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_gOpmxgqn5sxV98-LiN1kZQ_tOCZAysI';

/**
 * Supabase client instance for client-side queries, realtime sync, and public access.
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
