/**
 * Cloudflare Worker: osu! OAuth2 Authentication & D1 Cloud Database Sync
 * For osu! Beatmap Gacha
 */

export interface Env {
  osu_gacha_db: D1Database;
  OSU_CLIENT_ID: string;
  OSU_CLIENT_SECRET: string;
  FRONTEND_URL?: string;
  WORKER_URL?: string;
}

interface OsuUserResponse {
  id: number;
  username: string;
  avatar_url: string;
  country_code: string;
  statistics?: {
    global_rank?: number;
    pp?: number;
  };
}

interface UserSessionRow {
  token: string;
  osu_id: number;
  expires_at: string;
}

interface UserRow {
  osu_id: number;
  username: string;
  avatar_url: string | null;
  country_code: string | null;
  global_rank: number | null;
  created_at: string;
  last_login: string;
  total_pulls: number;
  pity_count: number;
}

const DEFAULT_FRONTEND_URL = 'https://gacha.vivlos.dev';

/**
 * Standard CORS Response Headers
 */
function corsHeaders(request: Request, env: Env): Headers {
  const origin = request.headers.get('Origin') || '*';
  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  headers.set('Access-Control-Max-Age', '86400');
  return headers;
}

function jsonResponse(data: unknown, status = 200, request: Request, env: Env): Response {
  const headers = corsHeaders(request, env);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(data), { status, headers });
}

function errorResponse(message: string, status = 400, request: Request, env: Env): Response {
  return jsonResponse({ success: false, error: message }, status, request, env);
}

/**
 * Executes a REST query against Supabase PostgREST
 */
async function supabaseFetch(env: Env, endpoint: string, options: RequestInit = {}): Promise<Response> {
  const baseUrl = env.SUPABASE_URL || 'https://hkrdlnwhnwapvxztsuls.supabase.co';
  const apiKey = env.SUPABASE_ANON_KEY || 'sb_publishable_gOpmxgqn5sxV98-LiN1kZQ_tOCZAysI';
  const headers = new Headers(options.headers || {});
  headers.set('apikey', apiKey);
  headers.set('Authorization', `Bearer ${apiKey}`);
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  return fetch(`${baseUrl}/rest/v1/${endpoint}`, { ...options, headers });
}

/**
 * Authenticates the request using the Bearer token in the Authorization header.
 */
async function authenticateUser(request: Request, env: Env): Promise<{ osuId: number; user: UserRow } | null> {
  const authHeader = request.headers.get('Authorization');
  let token: string | null = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else {
    // Fallback: check query parameter
    const url = new URL(request.url);
    token = url.searchParams.get('token');
  }

  if (!token) return null;

  // Lookup active session in D1
  const session = await env.osu_gacha_db.prepare(
    `SELECT token, osu_id, expires_at FROM user_sessions WHERE token = ? AND datetime(expires_at) > datetime('now')`
  )
    .bind(token)
    .first<UserSessionRow>();

  if (!session) return null;

  // Lookup user info in D1
  const user = await env.osu_gacha_db.prepare(
    `SELECT osu_id, username, avatar_url, country_code, global_rank, created_at, last_login, total_pulls, pity_count FROM users WHERE osu_id = ?`
  )
    .bind(session.osu_id)
    .first<UserRow>();

  if (!user) return null;

  return { osuId: session.osu_id, user };
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle CORS preflight OPTIONS request
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(request, env),
      });
    }

    try {
      // ---------------------------------------------------------
      // 1. Health & Root Information
      // ---------------------------------------------------------
      if (path === '/' || path === '/health') {
        return jsonResponse(
          {
            service: 'osu! Beatmap Gacha Auth & D1 Sync Worker',
            status: 'operational',
            version: '1.0.0',
            endpoints: [
              'GET /auth/login?redirect_uri=...',
              'GET /auth/callback?code=...',
              'GET /api/me',
              'POST /auth/logout',
              'GET /api/sync',
              'POST /api/sync',
            ],
          },
          200,
          request,
          env
        );
      }

      // ---------------------------------------------------------
      // 2. GET /auth/login -> Redirect to osu! OAuth2
      // ---------------------------------------------------------
      if (path === '/auth/login') {
        if (!env.OSU_CLIENT_ID) {
          return errorResponse('Worker configuration error: OSU_CLIENT_ID is not configured.', 500, request, env);
        }

        const frontendRedirect = url.searchParams.get('redirect_uri') || env.FRONTEND_URL || DEFAULT_FRONTEND_URL;

        // Callback endpoint hosted on this worker
        const callbackUrl = new URL('/auth/callback', url.origin).toString();

        // Encode state with a secure random nonce and target return URL
        const statePayload = {
          nonce: crypto.randomUUID(),
          redirect: frontendRedirect,
        };
        const state = btoa(JSON.stringify(statePayload));

        const osuAuthUrl = new URL('https://osu.ppy.sh/oauth/authorize');
        osuAuthUrl.searchParams.set('client_id', env.OSU_CLIENT_ID);
        osuAuthUrl.searchParams.set('redirect_uri', callbackUrl);
        osuAuthUrl.searchParams.set('response_type', 'code');
        osuAuthUrl.searchParams.set('scope', 'identify');
        osuAuthUrl.searchParams.set('state', state);

        return Response.redirect(osuAuthUrl.toString(), 302);
      }

      // ---------------------------------------------------------
      // 3. GET /auth/callback -> Handle osu! Code & Exchange Token
      // ---------------------------------------------------------
      if (path === '/auth/callback') {
        const code = url.searchParams.get('code');
        const stateParam = url.searchParams.get('state');

        let targetRedirect = env.FRONTEND_URL || DEFAULT_FRONTEND_URL;
        if (stateParam) {
          try {
            const decoded = JSON.parse(atob(stateParam));
            if (decoded.redirect) targetRedirect = decoded.redirect;
          } catch {
            // Keep default redirect if state decode fails
          }
        }

        if (!code) {
          const redirectErr = new URL(targetRedirect);
          redirectErr.searchParams.set('auth_error', 'Missing authorization code from osu!');
          return Response.redirect(redirectErr.toString(), 302);
        }

        const callbackUrl = new URL('/auth/callback', url.origin).toString();

        // Exchange authorization code for osu! access token
        const tokenRes = await fetch('https://osu.ppy.sh/oauth/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            client_id: env.OSU_CLIENT_ID,
            client_secret: env.OSU_CLIENT_SECRET,
            code: code,
            grant_type: 'authorization_code',
            redirect_uri: callbackUrl,
          }),
        });

        if (!tokenRes.ok) {
          const errBody = await tokenRes.text();
          console.error('osu! OAuth Token exchange error:', errBody);
          const redirectErr = new URL(targetRedirect);
          redirectErr.searchParams.set('auth_error', 'Failed to exchange authorization code with osu! server');
          return Response.redirect(redirectErr.toString(), 302);
        }

        const tokenData = (await tokenRes.json()) as { access_token: string; token_type: string; expires_in: number };

        // Fetch user profile from osu! API v2
        const meRes = await fetch('https://osu.ppy.sh/api/v2/me', {
          headers: {
            Authorization: `Bearer ${tokenData.access_token}`,
            Accept: 'application/json',
          },
        });

        if (!meRes.ok) {
          const redirectErr = new URL(targetRedirect);
          redirectErr.searchParams.set('auth_error', 'Failed to fetch user profile from osu! API');
          return Response.redirect(redirectErr.toString(), 302);
        }

        const osuUser = (await meRes.json()) as OsuUserResponse;

        // Upsert user in Cloudflare D1
        await env.osu_gacha_db.prepare(
          `INSERT INTO users (osu_id, username, avatar_url, country_code, global_rank, last_login)
           VALUES (?, ?, ?, ?, ?, datetime('now'))
           ON CONFLICT(osu_id) DO UPDATE SET
             username = excluded.username,
             avatar_url = excluded.avatar_url,
             country_code = excluded.country_code,
             global_rank = excluded.global_rank,
             last_login = datetime('now')`
        )
          .bind(
            osuUser.id,
            osuUser.username,
            osuUser.avatar_url || null,
            osuUser.country_code || null,
            osuUser.statistics?.global_rank || null
          )
          .run();

        // Upsert user in Supabase
        supabaseFetch(env, 'users', {
          method: 'POST',
          headers: { 'Prefer': 'resolution=merge-duplicates' },
          body: JSON.stringify([{
            osu_id: osuUser.id,
            username: osuUser.username,
            avatar_url: osuUser.avatar_url || null,
            country_code: osuUser.country_code || null,
            global_rank: osuUser.statistics?.global_rank || null,
            last_login: new Date().toISOString(),
          }]),
        }).catch(err => console.warn('Supabase user upsert error:', err));

        // Generate high-entropy 64-character session token
        const sessionToken = `${crypto.randomUUID().replace(/-/g, '')}${crypto.randomUUID().replace(/-/g, '')}`;
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

        // Store session in D1 (30 days validity)
        await env.osu_gacha_db.prepare(
          `INSERT INTO user_sessions (token, osu_id, expires_at)
           VALUES (?, ?, datetime('now', '+30 days'))`
        )
          .bind(sessionToken, osuUser.id)
          .run();

        // Store session in Supabase
        supabaseFetch(env, 'user_sessions', {
          method: 'POST',
          headers: { 'Prefer': 'resolution=merge-duplicates' },
          body: JSON.stringify([{
            token: sessionToken,
            osu_id: osuUser.id,
            expires_at: expiresAt,
          }]),
        }).catch(err => console.warn('Supabase session insert error:', err));

        // Redirect back to frontend with session token
        const finalRedirect = new URL(targetRedirect);
        finalRedirect.searchParams.set('token', sessionToken);
        finalRedirect.hash = `token=${sessionToken}`;

        return Response.redirect(finalRedirect.toString(), 302);
      }

      // ---------------------------------------------------------
      // 3.5 GET /api/score -> Fetch and Parse osu! Score Details
      // ---------------------------------------------------------
      if (path.startsWith('/api/score')) {
        const scoreId = url.searchParams.get('id') || path.replace('/api/score/', '').replace('/api/score', '').trim();
        if (!scoreId) {
          return errorResponse('Score ID or score URL is required.', 400, request, env);
        }

        try {
          const osuRes = await fetch(`https://osu.ppy.sh/scores/${scoreId}`, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
          });

          if (!osuRes.ok) {
            return errorResponse(`Could not find score #${scoreId} on osu! (HTTP ${osuRes.status})`, osuRes.status === 404 ? 404 : 502, request, env);
          }

          const html = await osuRes.text();
          const match = html.match(/<script id="json-show" type="application\/json">\s*(\{[\s\S]*?\})\s*<\/script>/);
          if (!match || !match[1]) {
            return errorResponse('Failed to extract score JSON payload from osu! website.', 502, request, env);
          }

          const data = JSON.parse(match[1]);
          const score = {
            id: data.id,
            userId: data.user_id,
            username: data.user?.username || '',
            avatarUrl: data.user?.avatar_url || '',
            beatmapId: data.beatmap_id,
            beatmapTitle: data.beatmapset?.title || '',
            beatmapArtist: data.beatmapset?.artist || '',
            beatmapVersion: data.beatmap?.version || '',
            stars: data.beatmap?.difficulty_rating || 0,
            rank: data.rank,
            passed: !!data.passed,
            accuracy: Math.round((data.accuracy || 0) * 10000) / 100,
            maxCombo: data.max_combo || 0,
            totalScore: data.total_score || 0,
            pp: data.pp || 0,
            mods: (data.mods || []).map((m: any) => (typeof m === 'string' ? m : m.acronym || '')).filter(Boolean),
            statistics: data.statistics || {},
            endedAt: data.ended_at ? new Date(data.ended_at).getTime() : Date.now(),
            startedAt: data.started_at ? new Date(data.started_at).getTime() : null,
          };

          return jsonResponse({ success: true, score }, 200, request, env);
        } catch (e: any) {
          return errorResponse(`Failed to process score: ${e.message}`, 500, request, env);
        }
      }

      // ---------------------------------------------------------
      // 4. GET /api/me -> Fetch Current Authenticated User Profile
      // ---------------------------------------------------------
      if (path === '/api/me' && request.method === 'GET') {
        const auth = await authenticateUser(request, env);
        if (!auth) {
          return errorResponse('Unauthorized: Invalid or expired session token.', 401, request, env);
        }

        // Fetch collection stats count
        const countRes = await env.osu_gacha_db.prepare(
          `SELECT COUNT(*) as unique_cards, COALESCE(SUM(copies), 0) as total_copies FROM user_collection WHERE osu_id = ?`
        )
          .bind(auth.osuId)
          .first<{ unique_cards: number; total_copies: number }>();

        return jsonResponse(
          {
            success: true,
            user: {
              osuId: auth.user.osu_id,
              username: auth.user.username,
              avatarUrl: auth.user.avatar_url,
              countryCode: auth.user.country_code,
              globalRank: auth.user.global_rank,
              createdAt: auth.user.created_at,
              lastLogin: auth.user.last_login,
              totalPulls: auth.user.total_pulls,
              pityCount: auth.user.pity_count,
              uniqueCards: countRes?.unique_cards || 0,
              totalCopies: countRes?.total_copies || 0,
            },
          },
          200,
          request,
          env
        );
      }

      // ---------------------------------------------------------
      // 5. POST /auth/logout -> Invalidate Current Session
      // ---------------------------------------------------------
      if (path === '/auth/logout' && request.method === 'POST') {
        const authHeader = request.headers.get('Authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.substring(7).trim();
          await env.osu_gacha_db.prepare(`DELETE FROM user_sessions WHERE token = ?`).bind(token).run();
        }
        return jsonResponse({ success: true, message: 'Logged out successfully.' }, 200, request, env);
      }

      // ---------------------------------------------------------
      // 6. GET /api/sync -> Pull Full Cloud Collection from D1
      // ---------------------------------------------------------
      if (path === '/api/sync' && request.method === 'GET') {
        const auth = await authenticateUser(request, env);
        if (!auth) {
          return errorResponse('Unauthorized: Session expired or invalid.', 401, request, env);
        }

        // Fetch collection rows
        const collectionRows = await env.osu_gacha_db.prepare(
          `SELECT beatmap_id as beatmapId, copies, first_pulled_at as firstPulledAt, last_pulled_at as lastPulledAt, is_favorite as isFavorite
           FROM user_collection WHERE osu_id = ?`
        )
          .bind(auth.osuId)
          .all<{
            beatmapId: number;
            copies: number;
            firstPulledAt: number;
            lastPulledAt: number;
            isFavorite: number;
          }>();

        // Fetch pull history (most recent 50 pulls)
        const historyRows = await env.osu_gacha_db.prepare(
          `SELECT id, beatmap_id as beatmapId, rarity, pulled_at as pulledAt
           FROM user_history WHERE osu_id = ? ORDER BY pulled_at DESC LIMIT 50`
        )
          .bind(auth.osuId)
          .all<{ id: string; beatmapId: number; rarity: string; pulledAt: number }>();

        // Check for pending energy override (set by admin) and consume it
        const energyOverride = await env.osu_gacha_db
          .prepare(`SELECT energy_amount FROM user_energy_overrides WHERE osu_id = ?`)
          .bind(auth.osuId)
          .first<{ energy_amount: number }>();
        if (energyOverride) {
          await env.osu_gacha_db
            .prepare(`DELETE FROM user_energy_overrides WHERE osu_id = ?`)
            .bind(auth.osuId)
            .run();
        }

        // Fetch global config (rates, stamina max)
        const configRows = await env.osu_gacha_db
          .prepare(`SELECT key, value FROM admin_config`)
          .all<{ key: string; value: string }>();
        const config: Record<string, unknown> = {};
        for (const row of configRows.results) {
          try { config[row.key] = JSON.parse(row.value); } catch { config[row.key] = row.value; }
        }

        return jsonResponse(
          {
            success: true,
            totalPulls: auth.user.total_pulls,
            pityCount: auth.user.pity_count,
            collection: collectionRows.results.map((c) => ({
              beatmapId: c.beatmapId,
              copies: c.copies,
              firstPulledAt: c.firstPulledAt,
              lastPulledAt: c.lastPulledAt,
              isFavorite: Boolean(c.isFavorite),
            })),
            history: historyRows.results,
            // Admin override signals (null if no pending override)
            energyOverride: energyOverride ? energyOverride.energy_amount : null,
            config,
          },
          200,
          request,
          env
        );
      }

      // ---------------------------------------------------------
      // 7. POST /api/sync -> Push Local Changes to D1 Cloud
      // ---------------------------------------------------------
      if (path === '/api/sync' && request.method === 'POST') {
        const auth = await authenticateUser(request, env);
        if (!auth) {
          return errorResponse('Unauthorized: Session expired or invalid.', 401, request, env);
        }

        interface SyncPayload {
          totalPulls?: number;
          pityCount?: number;
          collection?: {
            beatmapId: number;
            copies: number;
            firstPulledAt: number;
            lastPulledAt: number;
            isFavorite?: boolean;
          }[];
          history?: {
            id: string;
            beatmapId: number;
            rarity: string;
            pulledAt: number;
          }[];
        }

        const payload = (await request.json()) as SyncPayload;
        const statements: D1PreparedStatement[] = [];

        // 1. Update user total pulls and pity count
        if (typeof payload.totalPulls === 'number' || typeof payload.pityCount === 'number') {
          statements.push(
            env.osu_gacha_db.prepare(
              `UPDATE users SET
                 total_pulls = MAX(total_pulls, ?),
                 pity_count = COALESCE(?, pity_count)
               WHERE osu_id = ?`
            ).bind(payload.totalPulls ?? auth.user.total_pulls, payload.pityCount ?? auth.user.pity_count, auth.osuId)
          );
        }

        // 2. Batch upsert collection records
        if (payload.collection && Array.isArray(payload.collection)) {
          for (const item of payload.collection) {
            statements.push(
              env.osu_gacha_db.prepare(
                `INSERT INTO user_collection (osu_id, beatmap_id, copies, first_pulled_at, last_pulled_at, is_favorite)
                 VALUES (?, ?, ?, ?, ?, ?)
                 ON CONFLICT(osu_id, beatmap_id) DO UPDATE SET
                   copies = MAX(copies, excluded.copies),
                   first_pulled_at = MIN(first_pulled_at, excluded.first_pulled_at),
                   last_pulled_at = MAX(last_pulled_at, excluded.last_pulled_at),
                   is_favorite = excluded.is_favorite`
              ).bind(
                auth.osuId,
                item.beatmapId,
                item.copies || 1,
                item.firstPulledAt || Date.now(),
                item.lastPulledAt || Date.now(),
                item.isFavorite ? 1 : 0
              )
            );
          }
        }

        // 3. Batch insert recent history entries
        if (payload.history && Array.isArray(payload.history)) {
          for (const h of payload.history) {
            statements.push(
              env.osu_gacha_db.prepare(
                `INSERT OR IGNORE INTO user_history (id, osu_id, beatmap_id, rarity, pulled_at)
                 VALUES (?, ?, ?, ?, ?)`
              ).bind(h.id || crypto.randomUUID(), auth.osuId, h.beatmapId, h.rarity || 'Common', h.pulledAt || Date.now())
            );
          }
        }

        // Execute batch in atomic transaction chunks (Cloudflare D1 limits batches to 100 statements)
        if (statements.length > 0) {
          const CHUNK_SIZE = 80;
          for (let i = 0; i < statements.length; i += CHUNK_SIZE) {
            const chunk = statements.slice(i, i + CHUNK_SIZE);
            await env.osu_gacha_db.batch(chunk);
          }
        }

        // Concurrently sync to Supabase
        if (payload.collection && payload.collection.length > 0) {
          const supabaseCollection = payload.collection.map(c => ({
            osu_id: auth.osuId,
            beatmap_id: c.beatmapId,
            copies: c.copies || 1,
            first_pulled_at: c.firstPulledAt || Date.now(),
            last_pulled_at: c.lastPulledAt || Date.now(),
            is_favorite: Boolean(c.isFavorite),
          }));
          supabaseFetch(env, 'user_collection', {
            method: 'POST',
            headers: { 'Prefer': 'resolution=merge-duplicates' },
            body: JSON.stringify(supabaseCollection),
          }).catch(err => console.warn('Supabase collection sync error:', err));
        }

        if (payload.history && payload.history.length > 0) {
          const supabaseHistory = payload.history.map(h => ({
            id: h.id || `${Date.now()}-${h.beatmapId}`,
            osu_id: auth.osuId,
            beatmap_id: h.beatmapId,
            rarity: h.rarity || 'Common',
            pulled_at: h.pulledAt || Date.now(),
          }));
          supabaseFetch(env, 'user_history', {
            method: 'POST',
            headers: { 'Prefer': 'resolution=merge-duplicates' },
            body: JSON.stringify(supabaseHistory),
          }).catch(err => console.warn('Supabase history sync error:', err));
        }

        if (typeof payload.totalPulls === 'number' || typeof payload.pityCount === 'number') {
          const updateData: Record<string, unknown> = {};
          if (typeof payload.totalPulls === 'number' && payload.totalPulls > 0) updateData.total_pulls = payload.totalPulls;
          if (typeof payload.pityCount === 'number') updateData.pity_count = payload.pityCount;
          if (Object.keys(updateData).length > 0) {
            supabaseFetch(env, `users?osu_id=eq.${auth.osuId}`, {
              method: 'PATCH',
              body: JSON.stringify(updateData),
            }).catch(err => console.warn('Supabase user stats update error:', err));
          }
        }

        // Return updated stats
        const countRes = await env.osu_gacha_db.prepare(
          `SELECT COUNT(*) as unique_cards, COALESCE(SUM(copies), 0) as total_copies FROM user_collection WHERE osu_id = ?`
        )
          .bind(auth.osuId)
          .first<{ unique_cards: number; total_copies: number }>();

        return jsonResponse(
          {
            success: true,
            synced: true,
            uniqueCards: countRes?.unique_cards || 0,
            totalCopies: countRes?.total_copies || 0,
            timestamp: Date.now(),
          },
          200,
          request,
          env
        );
      }

      // ---------------------------------------------------------
      // 8. GET /admin/stats  —  Admin: global platform statistics
      //    Restricted: only the user with username 'RyoYamada' may call this.
      // ---------------------------------------------------------
      if (path === '/admin/stats' && request.method === 'GET') {
        const auth = await authenticateUser(request, env);
        if (!auth) {
          return errorResponse('Unauthorized', 401, request, env);
        }
        if (auth.user.username !== 'RyoYamada') {
          return errorResponse('Forbidden: Admin access only.', 403, request, env);
        }

        const totalUsers = await env.osu_gacha_db
          .prepare(`SELECT COUNT(*) as n FROM users`)
          .first<{ n: number }>();

        const totalSessions = await env.osu_gacha_db
          .prepare(`SELECT COUNT(*) as n FROM user_sessions WHERE datetime(expires_at) > datetime('now')`)
          .first<{ n: number }>();

        const totalCollection = await env.osu_gacha_db
          .prepare(`SELECT COUNT(*) as n FROM user_collection`)
          .first<{ n: number }>();

        const totalHistory = await env.osu_gacha_db
          .prepare(`SELECT COUNT(*) as n FROM user_history`)
          .first<{ n: number }>();

        const topUsers = await env.osu_gacha_db
          .prepare(
            `SELECT u.osu_id as osuId, u.username, u.avatar_url as avatarUrl, u.global_rank as globalRank,
                    u.total_pulls as totalPulls, u.last_login as lastLogin,
                    COUNT(c.beatmap_id) as uniqueCards
             FROM users u
             LEFT JOIN user_collection c ON c.osu_id = u.osu_id
             GROUP BY u.osu_id
             ORDER BY u.total_pulls DESC
             LIMIT 20`
          )
          .all<{
            osuId: number;
            username: string;
            avatarUrl: string | null;
            globalRank: number | null;
            totalPulls: number;
            lastLogin: string;
            uniqueCards: number;
          }>();

        const recentLogins = await env.osu_gacha_db
          .prepare(
            `SELECT osu_id as osuId, username, avatar_url as avatarUrl, last_login as lastLogin, total_pulls as totalPulls
             FROM users
             ORDER BY datetime(last_login) DESC
             LIMIT 15`
          )
          .all<{
            osuId: number;
            username: string;
            avatarUrl: string | null;
            lastLogin: string;
            totalPulls: number;
          }>();

        return jsonResponse(
          {
            success: true,
            stats: {
              totalUsers: totalUsers?.n ?? 0,
              totalSessions: totalSessions?.n ?? 0,
              totalCollectionRecords: totalCollection?.n ?? 0,
              totalHistoryRecords: totalHistory?.n ?? 0,
              topUsers: topUsers.results,
              recentLogins: recentLogins.results,
            },
          },
          200,
          request,
          env
        );
      }

      // ---------------------------------------------------------
      // 9. POST /admin/user/:id/revoke-sessions  —  Admin: force-logout a user
      //    Restricted: only the user with username 'RyoYamada' may call this.
      // ---------------------------------------------------------
      const revokeMatch = path.match(/^\/admin\/user\/(\d+)\/revoke-sessions$/);
      if (revokeMatch && request.method === 'POST') {
        const auth = await authenticateUser(request, env);
        if (!auth) {
          return errorResponse('Unauthorized', 401, request, env);
        }
        if (auth.user.username !== 'RyoYamada') {
          return errorResponse('Forbidden: Admin access only.', 403, request, env);
        }

        const targetOsuId = parseInt(revokeMatch[1], 10);

        // Prevent self-revoke
        if (targetOsuId === auth.osuId) {
          return errorResponse('Cannot revoke your own sessions.', 400, request, env);
        }

        await env.osu_gacha_db
          .prepare(`DELETE FROM user_sessions WHERE osu_id = ?`)
          .bind(targetOsuId)
          .run();

        return jsonResponse(
          { success: true, message: `All sessions for user ${targetOsuId} have been revoked.` },
          200,
          request,
          env
        );
      }

      // ---------------------------------------------------------
      // Admin helper: authenticate and verify RyoYamada
      // ---------------------------------------------------------
      const requireAdmin = async () => {
        const auth = await authenticateUser(request, env);
        if (!auth) return { auth: null, forbidden: errorResponse('Unauthorized', 401, request, env) };
        if (auth.user.username !== 'RyoYamada') return { auth: null, forbidden: errorResponse('Forbidden: Admin access only.', 403, request, env) };
        return { auth, forbidden: null };
      };

      // ---------------------------------------------------------
      // 10. POST /admin/user/:id/set-pulls  —  Adjust total pulls
      // ---------------------------------------------------------
      const setPullsMatch = path.match(/^\/admin\/user\/(\d+)\/set-pulls$/);
      if (setPullsMatch && request.method === 'POST') {
        const { auth, forbidden } = await requireAdmin();
        if (!auth) return forbidden!;
        const targetOsuId = parseInt(setPullsMatch[1], 10);
        const body = await request.json() as { pulls?: number; delta?: number };
        let newPulls: number;
        if (typeof body.pulls === 'number') {
          newPulls = Math.max(0, body.pulls);
          await env.osu_gacha_db.prepare(`UPDATE users SET total_pulls = ? WHERE osu_id = ?`).bind(newPulls, targetOsuId).run();
        } else if (typeof body.delta === 'number') {
          const current = await env.osu_gacha_db.prepare(`SELECT total_pulls FROM users WHERE osu_id = ?`).bind(targetOsuId).first<{ total_pulls: number }>();
          newPulls = Math.max(0, (current?.total_pulls ?? 0) + body.delta);
          await env.osu_gacha_db.prepare(`UPDATE users SET total_pulls = ? WHERE osu_id = ?`).bind(newPulls, targetOsuId).run();
        } else {
          return errorResponse('Provide `pulls` (absolute) or `delta` (relative)', 400, request, env);
        }
        return jsonResponse({ success: true, osuId: targetOsuId, totalPulls: newPulls }, 200, request, env);
      }

      // ---------------------------------------------------------
      // 11. GET /admin/user/:id/collection  —  View user cards
      // ---------------------------------------------------------
      const viewCollMatch = path.match(/^\/admin\/user\/(\d+)\/collection$/);
      if (viewCollMatch && request.method === 'GET') {
        const { auth, forbidden } = await requireAdmin();
        if (!auth) return forbidden!;
        const targetOsuId = parseInt(viewCollMatch[1], 10);
        const rows = await env.osu_gacha_db.prepare(
          `SELECT beatmap_id as beatmapId, copies, first_pulled_at as firstPulledAt, last_pulled_at as lastPulledAt, is_favorite as isFavorite
           FROM user_collection WHERE osu_id = ? ORDER BY last_pulled_at DESC`
        ).bind(targetOsuId).all<{ beatmapId: number; copies: number; firstPulledAt: number; lastPulledAt: number; isFavorite: number }>();
        const userInfo = await env.osu_gacha_db.prepare(`SELECT username FROM users WHERE osu_id = ?`).bind(targetOsuId).first<{ username: string }>();
        return jsonResponse({
          success: true, username: userInfo?.username,
          collection: rows.results.map(c => ({ ...c, isFavorite: Boolean(c.isFavorite) }))
        }, 200, request, env);
      }

      // ---------------------------------------------------------
      // 12. POST /admin/user/:id/collection/add  —  Add card to user
      // ---------------------------------------------------------
      const addCardMatch = path.match(/^\/admin\/user\/(\d+)\/collection\/add$/);
      if (addCardMatch && request.method === 'POST') {
        const { auth, forbidden } = await requireAdmin();
        if (!auth) return forbidden!;
        const targetOsuId = parseInt(addCardMatch[1], 10);
        const body = await request.json() as { beatmapId: number; copies?: number; rarity?: string };
        if (!body.beatmapId) return errorResponse('beatmapId required', 400, request, env);
        const now = Date.now();
        const copies = Math.max(1, body.copies ?? 1);
        await env.osu_gacha_db.prepare(
          `INSERT INTO user_collection (osu_id, beatmap_id, copies, first_pulled_at, last_pulled_at, is_favorite)
           VALUES (?, ?, ?, ?, ?, 0)
           ON CONFLICT(osu_id, beatmap_id) DO UPDATE SET copies = copies + excluded.copies, last_pulled_at = excluded.last_pulled_at`
        ).bind(targetOsuId, body.beatmapId, copies, now, now).run();
        // Also log to pull history
        if (body.rarity) {
          await env.osu_gacha_db.prepare(
            `INSERT OR IGNORE INTO user_history (id, osu_id, beatmap_id, rarity, pulled_at) VALUES (?, ?, ?, ?, ?)`
          ).bind(`admin-${Date.now()}-${body.beatmapId}`, targetOsuId, body.beatmapId, body.rarity, now).run();
        }
        return jsonResponse({ success: true, message: `Added beatmap ${body.beatmapId} (×${copies}) to user ${targetOsuId}` }, 200, request, env);
      }

      // ---------------------------------------------------------
      // 13. PUT /admin/user/:id/collection/:mid  —  Edit a card
      // ---------------------------------------------------------
      const editCardMatch = path.match(/^\/admin\/user\/(\d+)\/collection\/(\d+)$/);
      if (editCardMatch && request.method === 'PUT') {
        const { auth, forbidden } = await requireAdmin();
        if (!auth) return forbidden!;
        const targetOsuId = parseInt(editCardMatch[1], 10);
        const beatmapId = parseInt(editCardMatch[2], 10);
        const body = await request.json() as { copies?: number; isFavorite?: boolean };
        const setClauses: string[] = [];
        const binds: (number | string)[] = [];
        if (typeof body.copies === 'number') { setClauses.push('copies = ?'); binds.push(Math.max(0, body.copies)); }
        if (typeof body.isFavorite === 'boolean') { setClauses.push('is_favorite = ?'); binds.push(body.isFavorite ? 1 : 0); }
        if (setClauses.length === 0) return errorResponse('Nothing to update', 400, request, env);
        binds.push(targetOsuId, beatmapId);
        await env.osu_gacha_db.prepare(`UPDATE user_collection SET ${setClauses.join(', ')} WHERE osu_id = ? AND beatmap_id = ?`).bind(...binds).run();
        return jsonResponse({ success: true, message: `Updated beatmap ${beatmapId} for user ${targetOsuId}` }, 200, request, env);
      }

      // ---------------------------------------------------------
      // 14. DELETE /admin/user/:id/collection/:mid  —  Remove card
      // ---------------------------------------------------------
      if (editCardMatch && request.method === 'DELETE') {
        const { auth, forbidden } = await requireAdmin();
        if (!auth) return forbidden!;
        const targetOsuId = parseInt(editCardMatch[1], 10);
        const beatmapId = parseInt(editCardMatch[2], 10);
        await env.osu_gacha_db.prepare(`DELETE FROM user_collection WHERE osu_id = ? AND beatmap_id = ?`).bind(targetOsuId, beatmapId).run();
        return jsonResponse({ success: true, message: `Removed beatmap ${beatmapId} from user ${targetOsuId}` }, 200, request, env);
      }

      // ---------------------------------------------------------
      // 15. POST /admin/user/:id/energy-override  —  Force stamina refill
      // ---------------------------------------------------------
      const energyMatch = path.match(/^\/admin\/user\/(\d+)\/energy-override$/);
      if (energyMatch && request.method === 'POST') {
        const { auth, forbidden } = await requireAdmin();
        if (!auth) return forbidden!;
        const targetOsuId = parseInt(energyMatch[1], 10);
        const body = await request.json() as { amount?: number };
        const amount = Math.max(1, Math.min(9999, body.amount ?? 50));
        await env.osu_gacha_db.prepare(
          `INSERT INTO user_energy_overrides (osu_id, energy_amount, set_at)
           VALUES (?, ?, datetime('now'))
           ON CONFLICT(osu_id) DO UPDATE SET energy_amount = excluded.energy_amount, set_at = excluded.set_at`
        ).bind(targetOsuId, amount).run();
        return jsonResponse({ success: true, message: `Energy override of ${amount} queued for user ${targetOsuId}. They'll receive it on next sync.` }, 200, request, env);
      }

      // ---------------------------------------------------------
      // 16. GET /admin/config  —  Get global rates & stamina config
      // ---------------------------------------------------------
      if (path === '/admin/config' && request.method === 'GET') {
        const { auth, forbidden } = await requireAdmin();
        if (!auth) return forbidden!;
        const rows = await env.osu_gacha_db.prepare(`SELECT key, value FROM admin_config`).all<{ key: string; value: string }>();
        const config: Record<string, unknown> = {};
        for (const row of rows.results) {
          try { config[row.key] = JSON.parse(row.value); } catch { config[row.key] = row.value; }
        }
        return jsonResponse({ success: true, config }, 200, request, env);
      }

      // ---------------------------------------------------------
      // 17. PUT /admin/config/:key  —  Set a config value
      // ---------------------------------------------------------
      const configMatch = path.match(/^\/admin\/config\/([a-z_]+)$/);
      if (configMatch && request.method === 'PUT') {
        const { auth, forbidden } = await requireAdmin();
        if (!auth) return forbidden!;
        const key = configMatch[1];
        const allowed = ['rates', 'stamina'];
        if (!allowed.includes(key)) return errorResponse(`Unknown config key "${key}". Allowed: ${allowed.join(', ')}`, 400, request, env);
        const body = await request.json();
        const value = JSON.stringify(body);
        await env.osu_gacha_db.prepare(
          `INSERT INTO admin_config (key, value, updated_at) VALUES (?, ?, datetime('now'))
           ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
        ).bind(key, value).run();
        return jsonResponse({ success: true, key, message: `Config "${key}" updated.` }, 200, request, env);
      }

      // ---------------------------------------------------------
      // 18. POST /admin/mass-reward  —  Distribute gifts to ALL users
      // ---------------------------------------------------------
      if (path === '/admin/mass-reward' && request.method === 'POST') {
        const { auth, forbidden } = await requireAdmin();
        if (!auth) return forbidden!;
        const body = await request.json() as {
          type: 'stamina' | 'pulls' | 'card';
          amount?: number;
          beatmapId?: number;
          copies?: number;
          rarity?: string;
        };

        if (body.type === 'pulls') {
          const delta = Math.max(1, body.amount ?? 10);
          await env.osu_gacha_db.prepare(`UPDATE users SET total_pulls = total_pulls + ?`).bind(delta).run();
          return jsonResponse({ success: true, message: `Gifted +${delta} total pulls to all registered users!` }, 200, request, env);
        }

        if (body.type === 'stamina') {
          const amount = Math.max(1, Math.min(9999, body.amount ?? 50));
          const allUsers = await env.osu_gacha_db.prepare(`SELECT osu_id FROM users`).all<{ osu_id: number }>();
          for (const u of allUsers.results) {
            await env.osu_gacha_db.prepare(
              `INSERT INTO user_energy_overrides (osu_id, energy_amount, set_at)
               VALUES (?, ?, datetime('now'))
               ON CONFLICT(osu_id) DO UPDATE SET energy_amount = excluded.energy_amount, set_at = excluded.set_at`
            ).bind(u.osu_id, amount).run();
          }
          return jsonResponse({ success: true, message: `Dispatched stamina override (${amount} energy) to ${allUsers.results.length} users!` }, 200, request, env);
        }

        if (body.type === 'card') {
          if (!body.beatmapId) return errorResponse('beatmapId required', 400, request, env);
          const copies = Math.max(1, body.copies ?? 1);
          const now = Date.now();
          const allUsers = await env.osu_gacha_db.prepare(`SELECT osu_id FROM users`).all<{ osu_id: number }>();
          for (const u of allUsers.results) {
            await env.osu_gacha_db.prepare(
              `INSERT INTO user_collection (osu_id, beatmap_id, copies, first_pulled_at, last_pulled_at, is_favorite)
               VALUES (?, ?, ?, ?, ?, 0)
               ON CONFLICT(osu_id, beatmap_id) DO UPDATE SET copies = copies + excluded.copies, last_pulled_at = excluded.last_pulled_at`
            ).bind(u.osu_id, body.beatmapId, copies, now, now).run();

            if (body.rarity) {
              await env.osu_gacha_db.prepare(
                `INSERT OR IGNORE INTO user_history (id, osu_id, beatmap_id, rarity, pulled_at) VALUES (?, ?, ?, ?, ?)`
              ).bind(`gift-${now}-${body.beatmapId}`, u.osu_id, body.beatmapId, body.rarity, now).run();
            }
          }
          return jsonResponse({ success: true, message: `Gifted beatmap #${body.beatmapId} (×${copies}) to all ${allUsers.results.length} registered users!` }, 200, request, env);
        }

        return errorResponse('Invalid reward type', 400, request, env);
      }

      // ---------------------------------------------------------
      // 19. GET /admin/table  —  Database Raw Table Inspector
      // ---------------------------------------------------------
      if (path === '/admin/table' && request.method === 'GET') {
        const { auth, forbidden } = await requireAdmin();
        if (!auth) return forbidden!;
        const tableName = url.searchParams.get('name') || 'users';
        const allowed = ['users', 'user_sessions', 'user_collection', 'user_history', 'admin_config', 'user_energy_overrides'];
        if (!allowed.includes(tableName)) return errorResponse(`Invalid table name. Allowed: ${allowed.join(', ')}`, 400, request, env);

        const limit = Math.min(100, parseInt(url.searchParams.get('limit') || '50', 10));
        const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0', 10));

        const totalCount = await env.osu_gacha_db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).first<{ count: number }>();
        const rows = await env.osu_gacha_db.prepare(`SELECT * FROM ${tableName} LIMIT ? OFFSET ?`).bind(limit, offset).all();

        return jsonResponse({
          success: true,
          table: tableName,
          total: totalCount?.count ?? 0,
          limit,
          offset,
          rows: rows.results,
        }, 200, request, env);
      }

      // 404 Not Found
      return errorResponse('Endpoint not found', 404, request, env);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('Worker runtime error:', errorMsg);
      return errorResponse(`Internal Worker Error: ${errorMsg}`, 500, request, env);
    }
  },
};
