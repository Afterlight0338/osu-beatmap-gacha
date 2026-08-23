# osu! Beatmap Gacha Serverless Cloud Backend (Option A)

This is a **100% free serverless backend** for the osu! Beatmap Gacha web app.

### 🌟 Features:
1. **Official osu! OAuth 2.0 Token Exchange**: Safely holds your `OSU_CLIENT_SECRET` on Cloudflare and returns user profile data without exposing secret keys to the browser.
2. **Cloud Save & Cross-Device Sync**: Persists user gacha collections, duplicate counts, favorites, and stamina energy in Cloudflare KV (100,000 free operations/day).

---

### 🚀 2-Minute Deployment (Free forever on Cloudflare Workers):

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) and create a free account if you haven't already.
2. Navigate to **Compute (Workers & Pages)** ➔ **Create Application** ➔ **Create Worker**.
3. Name your worker (e.g. `osu-gacha-api`) and click **Deploy**.
4. Click **Edit code**, replace the default script with [`serverless/cloudflare-worker.js`](./cloudflare-worker.js), and click **Save and Deploy**.
5. **Create KV Namespace**:
   * In Cloudflare Dashboard, go to **Storage & Databases** ➔ **KV** ➔ **Create a namespace** named `GACHA_SAVES`.
   * In your Worker settings ➔ **Bindings** ➔ **Add KV namespace binding**:
     * Variable name: `GACHA_SAVES`
     * KV namespace: `GACHA_SAVES`
6. **Set Environment Variables**:
   * In your Worker settings ➔ **Variables and Secrets**:
     * `OSU_CLIENT_ID`: `64407`
     * `OSU_CLIENT_SECRET`: `iB3705wFfBMOmDMySfVftLC9pULUYtd9aOYcWIDI`
     * `FRONTEND_URL`: `https://afterlight0338.github.io/osu-beatmap-gacha/`
7. **Copy Worker URL**:
   * Your worker URL will look like `https://osu-gacha-api.<your-subdomain>.workers.dev`.
   * In your osu! Beatmap Gacha web app, click **Login / Save** ➔ **Advanced** ➔ Paste your Worker URL and click **Save**!

---

### 🎮 In the App:
* You can click **Login with osu!** for full OAuth authorization.
* Or instantly type your **osu! Username** for instant profile connection & avatar loading!
