/**
 * Global Maintenance Mode Configuration
 * Set `MAINTENANCE_MODE = true` to put the site into maintenance.
 * When enabled, all non-admin visitors will see the Maintenance Page.
 * Admin ('RyoYamada') can bypass maintenance mode and use the app normally.
 */
export const MAINTENANCE_MODE = true;

export const MAINTENANCE_CONFIG = {
  title: 'Under Maintenance',
  headline: 'Tuning the Beatmaps & Servicing the Gacha Engine',
  message:
    'osu! Beatmap Gacha is currently undergoing scheduled maintenance and system upgrades. Summoning and cloud syncing are temporarily paused while we optimize database operations and gacha mechanics.',
  estimatedTime: 'Back online soon',
  reason: 'Database & System Optimization',
};
