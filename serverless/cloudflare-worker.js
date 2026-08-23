/**
 * Cloudflare Worker for osu! Beatmap Gacha (Option A)
 * 
 * Free serverless backend providing:
 * 1. Secure osu! OAuth 2.0 token exchange (keeping client_secret safe)
 * 2. Cloud collection save & cross-device synchronization via Cloudflare KV
 * 
 * Deployment:
 * 1. Create a free account on https://dash.cloudflare.com/
 * 2. Workers & Pages -> Create Application -> Worker
 * 3. Paste this code into Worker editor
 * 4. Add KV Namespace binding named "GACHA_SAVES"
 * 5. Add Environment Variables:
 *    - OSU_CLIENT_ID = "64407"
 *    - OSU_CLIENT_SECRET = "iB3705wFfBMOmDMySfVftLC9pULUYtd9aOYcWIDI"
 *    - FRONTEND_URL = "https://afterlight0338.github.io/osu-beatmap-gacha"
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '*';

    // CORS preflight headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // 1. OAuth Code Exchange
    if (url.pathname === '/api/oauth/callback' && request.method === 'GET') {
      const code = url.searchParams.get('code');
      if (!code) {
        return new Response(JSON.stringify({ error: 'Missing code' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      try {
        const redirectUri = env.FRONTEND_URL || 'https://afterlight0338.github.io/osu-beatmap-gacha/';
        
        // Exchange code with osu! API v2
        const tokenRes = await fetch('https://osu.ppy.sh/oauth/token', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            client_id: parseInt(env.OSU_CLIENT_ID || '64407', 10),
            client_secret: env.OSU_CLIENT_SECRET,
            code,
            grant_type: 'authorization_code',
            redirect_uri: redirectUri,
          }),
        });

        if (!tokenRes.ok) {
          const errText = await tokenRes.text();
          return new Response(JSON.stringify({ error: 'OAuth exchange failed', details: errText }), {
            status: tokenRes.status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const tokenData = await tokenRes.json();

        // Fetch user profile
        const userRes = await fetch('https://osu.ppy.sh/api/v2/me/osu', {
          headers: {
            'Authorization': `Bearer ${tokenData.access_token}`,
            'Accept': 'application/json',
          },
        });

        const userData = await userRes.json();

        const profile = {
          id: userData.id,
          username: userData.username,
          avatarUrl: userData.avatar_url,
          countryCode: userData.country_code,
          globalRank: userData.statistics?.global_rank || null,
          pp: userData.statistics?.pp || null,
          coverUrl: userData.cover_url,
        };

        return new Response(
          JSON.stringify({
            token: tokenData.access_token,
            user: profile,
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // 2. Cloud Save Upload
    if (url.pathname === '/api/save' && request.method === 'POST') {
      try {
        const body = await request.json();
        if (!body || !body.userId) {
          return new Response(JSON.stringify({ error: 'Invalid payload' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (env.GACHA_SAVES) {
          await env.GACHA_SAVES.put(`save_${body.userId}`, JSON.stringify(body));
        }

        return new Response(JSON.stringify({ success: true, savedAt: Date.now() }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // 3. Cloud Save Download
    if (url.pathname === '/api/save' && request.method === 'GET') {
      const userId = url.searchParams.get('userId');
      if (!userId) {
        return new Response(JSON.stringify({ error: 'Missing userId' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      let saveData = null;
      if (env.GACHA_SAVES) {
        const raw = await env.GACHA_SAVES.get(`save_${userId}`);
        if (raw) saveData = JSON.parse(raw);
      }

      return new Response(JSON.stringify(saveData || { collection: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ service: 'osu! Beatmap Gacha Cloud API', status: 'online' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  },
};
