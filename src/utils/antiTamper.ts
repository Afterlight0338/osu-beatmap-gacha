/**
 * Cryptographic Anti-Tamper & Pull Ledger Verification Engine
 * Uses Web Crypto API (SHA-256) for zero-dependency client-side integrity validation.
 */

const LEDGER_SALT = 'osu_gacha_anti_tamper_salt_v1';

/**
 * Generates a SHA-256 HMAC-like hash for a legitimate pull.
 */
export async function generatePullSignature(
  osuId: number | string,
  beatmapId: number,
  rarity: string,
  pulledAt: number,
  nonce: number = 0
): Promise<string> {
  const payload = `${osuId}:${beatmapId}:${rarity}:${pulledAt}:${nonce}:${LEDGER_SALT}`;
  const msgUint8 = new TextEncoder().encode(payload);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Validates whether a given pull item has a legitimate cryptographic signature.
 */
export async function verifyPullSignature(
  signature: string,
  osuId: number | string,
  beatmapId: number,
  rarity: string,
  pulledAt: number,
  nonce: number = 0
): Promise<boolean> {
  const expected = await generatePullSignature(osuId, beatmapId, rarity, pulledAt, nonce);
  return signature.toLowerCase() === expected.toLowerCase();
}

/**
 * Computes a collection checksum to detect manual DevTools IndexedDB tampering.
 */
export async function computeCollectionChecksum(
  osuId: number | string,
  cards: { beatmapId: number; copies: number; firstPulledAt: number }[]
): Promise<string> {
  // Sort cards deterministically by beatmapId
  const sorted = [...cards].sort((a, b) => a.beatmapId - b.beatmapId);
  const condensed = sorted
    .map((c) => `${c.beatmapId}_${c.copies}_${c.firstPulledAt}`)
    .join('|');
  
  const payload = `COLLECTION:${osuId}:${condensed}:${LEDGER_SALT}`;
  const msgUint8 = new TextEncoder().encode(payload);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
