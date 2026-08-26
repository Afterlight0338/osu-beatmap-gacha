/**
 * Global Maintenance Mode Configuration
 * Set `MAINTENANCE_MODE = true` to put the site into maintenance.
 * When enabled, all non-admin visitors will see the Maintenance Page.
 * Admin ('RyoYamada') can bypass maintenance mode and use the app normally.
 */
export const MAINTENANCE_MODE = true;

export const MAINTENANCE_CONFIG = {
  title: 'Emergency Maintenance',
  headline: 'Database Engine Maintenance & Data Integrity Protection',
  message:
    'osu! Beatmap Gacha is currently in emergency maintenance mode while we conduct database recovery and engine optimization. Player collections and sync pipelines are temporarily paused to protect data integrity.',
  estimatedTime: 'Back online soon',
  reason: 'Database Engine Maintenance & Data Integrity Protection',
};
