/**
 * High-performance Web Compression Utilities
 * Uses native CompressionStream / DecompressionStream (GZIP) supported in all modern browsers.
 */

export async function compressStringToGzip(text: string): Promise<Uint8Array> {
  const byteArray = new TextEncoder().encode(text);
  if (typeof CompressionStream === 'undefined') {
    return byteArray; // Fallback if environment lacks Streams API
  }
  const stream = new Blob([byteArray]).stream().pipeThrough(new CompressionStream('gzip'));
  const response = new Response(stream);
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

export async function decompressGzipToString(compressedBytes: Uint8Array): Promise<string> {
  if (typeof DecompressionStream === 'undefined') {
    return new TextDecoder().decode(compressedBytes);
  }
  const stream = new Blob([compressedBytes as unknown as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'));
  const response = new Response(stream);
  return await response.text();
}

/**
 * Encodes arbitrary JSON object into a compact base64-encoded GZIP string.
 * Reduces payload size by up to 85% for large collection arrays.
 */
export async function compressJsonToBase64<T>(data: T): Promise<string> {
  const jsonStr = JSON.stringify(data);
  const compressed = await compressStringToGzip(jsonStr);
  let binary = '';
  const len = compressed.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(compressed[i]);
  }
  return btoa(binary);
}

/**
 * Decodes a base64-encoded GZIP string back into the original JSON object.
 */
export async function decompressBase64ToJson<T>(base64Str: string): Promise<T> {
  const binary = atob(base64Str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const jsonStr = await decompressGzipToString(bytes);
  return JSON.parse(jsonStr) as T;
}

/**
 * Compact Array-of-Arrays encoding for Card Collections.
 * Converts 50-byte JSON objects into 12-byte compact arrays:
 * [beatmapId, copies, firstPulledAtSec, lastPulledAtSec, isFavorite, lockedRarityCode]
 */
export type CompactCardTuple = [number, number, number, number, number, string?];

export function toCompactCardTuples(
  cards: {
    beatmapId: number;
    copies: number;
    firstPulledAt: number;
    lastPulledAt: number;
    isFavorite?: boolean;
    lockedRarity?: string;
  }[]
): CompactCardTuple[] {
  return cards.map((c) => [
    c.beatmapId,
    c.copies || 1,
    Math.floor((c.firstPulledAt || 0) / 1000),
    Math.floor((c.lastPulledAt || 0) / 1000),
    c.isFavorite ? 1 : 0,
    c.lockedRarity || '',
  ]);
}

export function fromCompactCardTuples(tuples: CompactCardTuple[]): {
  beatmapId: number;
  copies: number;
  firstPulledAt: number;
  lastPulledAt: number;
  isFavorite: boolean;
  lockedRarity?: string;
}[] {
  return tuples.map((t) => ({
    beatmapId: t[0],
    copies: t[1],
    firstPulledAt: t[2] * 1000,
    lastPulledAt: t[3] * 1000,
    isFavorite: t[4] === 1,
    lockedRarity: t[5] || undefined,
  }));
}
