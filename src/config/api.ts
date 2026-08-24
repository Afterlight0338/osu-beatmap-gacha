/**
 * Cloudflare Worker API Configuration
 * Production default points to the live Cloudflare Worker deployment.
 * Can be overridden locally via VITE_WORKER_URL.
 */
export const WORKER_API_URL =
  import.meta.env.VITE_WORKER_URL || 'https://osu-beatmap-gacha-worker.afterlight0338.workers.dev';

