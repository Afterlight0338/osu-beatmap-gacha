/**
 * Admin access control.
 * Only the exact osu! username listed here will see the Admin tab.
 * The server ALSO enforces this independently — the frontend gating
 * is a UX convenience only, not a security boundary.
 */
export const ADMIN_USERNAME = 'RyoYamada';

export function isAdmin(username: string | undefined | null): boolean {
  return username === ADMIN_USERNAME;
}
