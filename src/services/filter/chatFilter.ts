/**
 * Generic Anti-Evasion Chat Filter Engine
 * 
 * Features:
 * 1. Aggressive Unicode / Diacritic (NFKD) + Homoglyph + Leetspeak + Zero-width normalization.
 * 2. Trie / Multi-Pattern Matcher with Scunthorpe Whitelist protection.
 * 3. Cross-message Sliding Window & Ouija Chained Slur Construction Detection.
 * 4. Progressive Penalty & Cooldown Management.
 * 5. Permissive for standard gaming profanity (e.g. "fuck", "shit", "damn", "bitch").
 */

export interface NormalizedMessage {
  osuId: number;
  username: string;
  rawText: string;
  normalizedText: string;
  compactStream: string;
  tokens: string[];
  timestamp: number;
}

export interface FilterResult {
  allowed: boolean;
  reason?: string;
  flaggedTerm?: string;
  isOuijaChain?: boolean;
  cooldownSeconds?: number;
}

// ---------------------------------------------------------------------------
// 1. PROHIBITED TERMS & WHITELIST
// ---------------------------------------------------------------------------

// Prohibited Slurs & Hate Speech (Canonical normalized forms only)
const PROHIBITED_ROOTS = [
  // Racial Slurs
  'nigger',
  'nigga',
  'niga',
  'nigg',
  'kike',
  'chink',
  'spic',
  'gook',
  'wetback',
  'coon',
  'shemale',

  // Homophobic & Transphobic Slurs
  'faggot',
  'fag',
  'fagg',
  'tranny',
  'dyke',

  // Ableist Slurs
  'retard',
  'tard',

  // Self-Harm & Harassment Prompts
  'kys',
  'killyourself',
  'hangyourself',
  'commitsuicide',

  // Scam & Malicious
  'freeppgenerator',
  'freeosuhack',
  'gachacheatengine',
];

// Scunthorpe Safety Whitelist: Words that contain substrings of roots but are legitimate
const WHITELISTED_WORDS = new Set([
  'night', 'knight', 'nights', 'knights', 'nightmare', 'nightcore',
  'nigeria', 'nigerien', 'snicker', 'snickers', 'spicy', 'spice',
  'pass', 'passed', 'passing', 'assistant', 'assists', 'classic', 'classics',
  'grass', 'glass', 'glasses', 'bass', 'cassette', 'document', 'cocktail',
  'button', 'butter', 'title', 'subtitles', 'country', 'countries', 'county',
  'spaghetti', 'fagott', 'fagotto', 'kikyo', 'kikyou', 'asuka', 'chinko',
  'hitotsu', 'ashita', 'mashita', 'deshita', 'fukou', 'omoidase'
]);

// ---------------------------------------------------------------------------
// 2. HOMOGLYPH & LEET NORMALIZATION
// ---------------------------------------------------------------------------

const HOMOGLYPH_MAP: Record<string, string> = {
  // Cyrillic to Latin
  'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e',
  'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'i', 'к': 'k', 'л': 'l', 'м': 'm',
  'н': 'n', 'о': 'o', 'п': 'p', 'р': 'p', 'с': 'c', 'т': 't', 'у': 'y',
  'ф': 'f', 'х': 'x', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sh', 'ъ': '',
  'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya', 'і': 'i', 'ј': 'j', 'ѕ': 's',
  // Greek to Latin
  'α': 'a', 'β': 'b', 'γ': 'g', 'δ': 'd', 'ε': 'e', 'ζ': 'z', 'η': 'e',
  'θ': 'th', 'ι': 'i', 'κ': 'k', 'λ': 'l', 'μ': 'm', 'ν': 'v', 'ξ': 'x',
  'ο': 'o', 'π': 'p', 'ρ': 'p', 'σ': 's', 'ς': 's', 'τ': 't', 'υ': 'u',
  'φ': 'f', 'χ': 'x', 'ψ': 'ps', 'ω': 'o',
};

const LEET_MAP: Record<string, string> = {
  '@': 'a', '4': 'a',
  '1': 'i', '!': 'i', '|': 'i',
  '0': 'o',
  '3': 'e',
  '5': 's', '$': 's',
  '7': 't', '+': 't',
  '8': 'b',
};

/**
 * Strips zero-width chars, decomposes diacritics, maps homoglyphs, and resolves leetspeak.
 */
export function normalizeText(raw: string): {
  normalizedText: string;
  compactStream: string;
  tokens: string[];
} {
  if (!raw) return { normalizedText: '', compactStream: '', tokens: [] };

  // 1. Remove zero-width spaces, invisible formatters, and control characters
  let text = raw.replace(/[\u200B-\u200D\uFEFF\u00A0\u2060\u180E\u0000-\u001F\u007F-\u009F]/g, '');

  // 2. Unicode NFKD Decomposition (separates accents: 'ñ' -> 'n' + '~')
  text = text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  // 3. Homoglyph translation
  let homoglyphCleaned = '';
  for (const ch of text) {
    homoglyphCleaned += HOMOGLYPH_MAP[ch] || ch;
  }
  text = homoglyphCleaned;

  // 4. Leetspeak & Symbol translation
  let leetCleaned = '';
  for (const ch of text) {
    leetCleaned += LEET_MAP[ch] || ch;
  }
  text = leetCleaned;

  // Handle "|\|" -> "n" and "vv" -> "w"
  text = text.replace(/\|\/\||\\\/\\|\|\\\|/g, 'n').replace(/vv/g, 'w');

  // 5. Extract words/tokens (splitting by non-alphanumeric)
  const tokens = text
    .split(/[^a-z0-9]+/g)
    .filter((t) => t.length > 0);

  // 6. Compact stream (pure alphanumeric with runs of 3+ repeated characters collapsed to 2)
  const compactRaw = text.replace(/[^a-z0-9]/g, '');
  const compactStream = compactRaw.replace(/(.)\1{2,}/g, '$1$1');

  return {
    normalizedText: text,
    compactStream,
    tokens,
  };
}

// ---------------------------------------------------------------------------
// 3. TRIE PATTERN MATCHER
// ---------------------------------------------------------------------------

class TrieNode {
  children: Map<string, TrieNode> = new Map();
  isEnd: boolean = false;
  term: string = '';
}

export class TrieMatcher {
  private root: TrieNode = new TrieNode();

  constructor(terms: string[] = PROHIBITED_ROOTS) {
    for (const t of terms) {
      this.insert(t.toLowerCase());
    }
  }

  private insert(term: string) {
    let node = this.root;
    for (const ch of term) {
      if (!node.children.has(ch)) {
        node.children.set(ch, new TrieNode());
      }
      node = node.children.get(ch)!;
    }
    node.isEnd = true;
    node.term = term;
  }

  /**
   * Searches for prohibited terms inside a compact stream with Scunthorpe safety.
   */
  public searchProhibited(compactStream: string, fullTokens: string[] = []): string | null {
    if (!compactStream || compactStream.length < 2) return null;

    // Check tokens first for exact whitelisted matches
    const tokenSet = new Set(fullTokens.map((t) => t.toLowerCase()));

    const len = compactStream.length;
    for (let i = 0; i < len; i++) {
      let node: TrieNode | undefined = this.root;
      let matchedTerm: string | null = null;

      for (let j = i; j < len; j++) {
        const ch = compactStream[j];
        node = node.children.get(ch);
        if (!node) break;

        if (node.isEnd) {
          matchedTerm = node.term;
        }
      }

      if (matchedTerm) {
        // Scunthorpe check: is this matched term part of an innocent whitelisted token?
        let isWhitelisted = false;
        for (const token of tokenSet) {
          if (WHITELISTED_WORDS.has(token) && token.includes(matchedTerm)) {
            isWhitelisted = true;
            break;
          }
        }

        // Also check if the whole surrounding word in compactStream is a known whitelisted word
        for (const white of WHITELISTED_WORDS) {
          if (compactStream.includes(white)) {
            isWhitelisted = true;
            break;
          }
        }

        if (!isWhitelisted) {
          return matchedTerm;
        }
      }
    }

    return null;
  }
}

// ---------------------------------------------------------------------------
// 4. CROSS-MESSAGE SLIDING WINDOW & OUIJA DETECTOR
// ---------------------------------------------------------------------------

export class SlidingWindowChatFilter {
  private matcher: TrieMatcher;
  private messageWindow: NormalizedMessage[] = [];
  private userPenalties: Map<number, { count: number; lastViolation: number; cooldownUntil: number }> = new Map();
  private readonly WINDOW_TTL_MS = 45 * 1000; // 45-second sliding window
  private readonly MAX_WINDOW_SIZE = 8; // track last 8 messages

  constructor(customRoots?: string[]) {
    this.matcher = new TrieMatcher(customRoots || PROHIBITED_ROOTS);
  }

  /**
   * Cleans up expired messages from the rolling window.
   */
  private pruneWindow(now = Date.now()) {
    const cutoff = now - this.WINDOW_TTL_MS;
    this.messageWindow = this.messageWindow.filter((m) => m.timestamp >= cutoff);
    if (this.messageWindow.length > this.MAX_WINDOW_SIZE) {
      this.messageWindow = this.messageWindow.slice(-this.MAX_WINDOW_SIZE);
    }
  }

  /**
   * Check if a user is currently in a progressive penalty cooldown.
   */
  public getUserCooldown(osuId: number, now = Date.now()): number {
    const penalty = this.userPenalties.get(osuId);
    if (!penalty) return 0;
    const remainingMs = penalty.cooldownUntil - now;
    return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0;
  }

  /**
   * Registers a penalty and applies progressive timeouts.
   */
  private applyPenalty(osuId: number, now = Date.now()): number {
    const existing = this.userPenalties.get(osuId) || { count: 0, lastViolation: 0, cooldownUntil: 0 };
    // Reset penalty count if last violation was > 15 minutes ago
    const count = now - existing.lastViolation > 15 * 60 * 1000 ? 1 : existing.count + 1;

    let cooldownSeconds = 0;
    if (count === 2) cooldownSeconds = 15;
    else if (count === 3) cooldownSeconds = 60;
    else if (count >= 4) cooldownSeconds = 300; // 5 minutes

    const cooldownUntil = now + cooldownSeconds * 1000;
    this.userPenalties.set(osuId, { count, lastViolation: now, cooldownUntil });
    return cooldownSeconds;
  }

  /**
   * Evaluates an incoming message:
   * 1. Check cooldown
   * 2. Direct message inspection
   * 3. Cross-message sliding window / Ouija chain inspection
   */
  public evaluateMessage(params: {
    osuId: number;
    username: string;
    text: string;
    timestamp?: number;
  }): FilterResult {
    const now = params.timestamp || Date.now();
    this.pruneWindow(now);

    // 1. Check if user is on active cooldown
    const cooldown = this.getUserCooldown(params.osuId, now);
    if (cooldown > 0) {
      return {
        allowed: false,
        reason: `You are temporarily timed out from chat for ${cooldown} more seconds due to previous violations.`,
        cooldownSeconds: cooldown,
      };
    }

    const norm = normalizeText(params.text);
    const newMsg: NormalizedMessage = {
      osuId: params.osuId,
      username: params.username,
      rawText: params.text,
      normalizedText: norm.normalizedText,
      compactStream: norm.compactStream,
      tokens: norm.tokens,
      timestamp: now,
    };

    // 2. Direct single-message check
    const directHit = this.matcher.searchProhibited(norm.compactStream, norm.tokens);
    if (directHit) {
      const cooldownSec = this.applyPenalty(params.osuId, now);
      return {
        allowed: false,
        reason: 'Your message contains prohibited slurs or hate speech and was not sent.',
        flaggedTerm: directHit,
        isOuijaChain: false,
        cooldownSeconds: cooldownSec,
      };
    }

    // 3. Cross-Message Sliding-Window / Ouija Chain Check
    if (this.messageWindow.length > 0) {
      // Check trailing combinations of 1..5 recent messages + new message
      const recent = this.messageWindow.slice(-5);

      for (let startIndex = 0; startIndex < recent.length; startIndex++) {
        const slice = recent.slice(startIndex);
        const combinedStream = slice.map((m) => m.compactStream).join('') + norm.compactStream;
        const allTokens = [...slice.flatMap((m) => m.tokens), ...norm.tokens];

        // Only inspect cross-message chains if the combined length is short enough to represent coordinated fragments
        if (combinedStream.length <= 30) {
          const chainHit = this.matcher.searchProhibited(combinedStream, allTokens);
          if (chainHit) {
            // Confirm that the match crosses message boundaries (i.e. not purely inside an already validated prior message)
            const priorCombined = slice.map((m) => m.compactStream).join('');
            if (!priorCombined.includes(chainHit)) {
              const cooldownSec = this.applyPenalty(params.osuId, now);
              return {
                allowed: false,
                reason: 'Your message completes a prohibited term with recent messages and was not sent.',
                flaggedTerm: chainHit,
                isOuijaChain: true,
                cooldownSeconds: cooldownSec,
              };
            }
          }
        }
      }
    }

    // 4. Message passed all checks -> Commit to sliding window
    this.messageWindow.push(newMsg);
    return { allowed: true };
  }
}

// Global Singleton Engine
export const globalChatFilter = new SlidingWindowChatFilter();
