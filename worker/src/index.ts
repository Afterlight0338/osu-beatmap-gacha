/**
 * Cloudflare Worker: osu! OAuth2 Authentication & D1 Cloud Database Sync
 * For osu! Beatmap Gacha
 */

export interface Env {
  DB: D1Database;
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

const DEFAULT_FRONTEND_URL = 'https://afterlight0338.github.io/osu-beatmap-gacha';

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
  const session = await env.DB.prepare(
    `SELECT token, osu_id, expires_at FROM user_sessions WHERE token = ? AND datetime(expires_at) > datetime('now')`
  )
    .bind(token)
    .first<UserSessionRow>();

  if (!session) return null;

  // Lookup user info in D1
  const user = await env.DB.prepare(
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
        await env.DB.prepare(
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

        // Generate high-entropy 64-character session token
        const sessionToken = `${crypto.randomUUID().replace(/-/g, '')}${crypto.randomUUID().replace(/-/g, '')}`;

        // Store session in D1 (30 days validity)
        await env.DB.prepare(
          `INSERT INTO user_sessions (token, osu_id, expires_at)
           VALUES (?, ?, datetime('now', '+30 days'))`
        )
          .bind(sessionToken, osuUser.id)
          .run();

        // Redirect back to frontend with session token
        const finalRedirect = new URL(targetRedirect);
        finalRedirect.searchParams.set('token', sessionToken);
        finalRedirect.hash = `token=${sessionToken}`;

        return Response.redirect(finalRedirect.toString(), 302);
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
        const countRes = await env.DB.prepare(
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
          await env.DB.prepare(`DELETE FROM user_sessions WHERE token = ?`).bind(token).run();
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
        const collectionRows = await env.DB.prepare(
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
        const historyRows = await env.DB.prepare(
          `SELECT id, beatmap_id as beatmapId, rarity, pulled_at as pulledAt
           FROM user_history WHERE osu_id = ? ORDER BY pulled_at DESC LIMIT 50`
        )
          .bind(auth.osuId)
          .all<{ id: string; beatmapId: number; rarity: string; pulledAt: number }>();

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
            env.DB.prepare(
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
              env.DB.prepare(
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
              env.DB.prepare(
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
            await env.DB.batch(chunk);
          }
        }

        // Return updated stats
        const countRes = await env.DB.prepare(
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

      // 404 Not Found
      return errorResponse('Endpoint not found', 404, request, env);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('Worker runtime error:', errorMsg);
      return errorResponse(`Internal Worker Error: ${errorMsg}`, 500, request, env);
    }
  },
};
