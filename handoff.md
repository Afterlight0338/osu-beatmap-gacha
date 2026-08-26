# Project Handoff & Architecture Reference: osu! Beatmap Gacha

**Date**: August 27, 2026  
**Repository Path**: `/home/afterlight/osu-beatmap-gacha`  
**Git Remote**: `https://github.com/Afterlight0338/osu-beatmap-gacha.git`  
**Main Branch**: `main` | **Deployment Branch**: `gh-pages`  
**Live Production URL**: [https://gacha.vivlos.dev/](https://gacha.vivlos.dev/)  

---

## 1. Core Architecture & Stack

* **Frontend**: React 18 (SPA), TypeScript, Vite 6, Tailwind CSS, Lucide React, Canvas Confetti.
* **Backend / Database / Realtime**: **Supabase** (`https://hkrdlnwhnwapvxztsuls.supabase.co`)
  * **Direct Client-to-Supabase Architecture**: The web client communicates directly with Supabase for data queries, table persistence (`admin_config`), and Realtime channels.
  * **No Cloudflare Worker in active client path**: The `/worker` directory was an exploratory prototype; the live frontend does **NOT** use or depend on a Cloudflare Worker.
* **Realtime Broadcast Channels**:
  * `global_chat_channel`: Instant chat broadcast (`new_message`, `message_deleted`, `chat_cleared`).
  * `global_presence_channel`: Online player presence state.
  * `realtime_admin_commands`: Live maintenance mode alerts and remote client command listening.

---

## 2. Key Systems & Implementation Details

### A. Global Chat & Anti-Evasion Filter (`src/services/filter/chatFilter.ts`, `src/services/chatService.ts`)
1. **Philosophy**:
   * **Casual Profanity Allowed**: Words like `fuck`, `shit`, `damn`, `bitch`, `crap`, `ass`, `dick` are **100% permitted and never censored/masked**.
   * **Strict Slur & Hate Speech Interception**: Racial slurs, homophobic/transphobic slurs, ableist slurs, self-harm prompts (`kys`), and scam links are **strictly rejected before broadcast**.
2. **Multi-Layer Normalizer**:
   * Strips zero-width characters (`\u200B`, `\u200C`, `\uFEFF`, non-printable bytes).
   * Unicode NFKD decomposition (separates diacritics and accents).
   * Comprehensive Cyrillic (`а, е, о, р, с, у, х, і`) and Greek homoglyph mapping.
   * Leetspeak & symbol translation (`@/4` $\to$ `a`, `1/!` $\to$ `i`, `0` $\to$ `o`, `3` $\to$ `e`, `5/$` $\to$ `s`, `7/+` $\to$ `t`, `|\|` $\to$ `n`, `vv` $\to$ `w`).
   * Character run compression (collapses 3+ identical letter repeats down to 2).
3. **Trie Pattern Matcher with Scunthorpe Whitelist**:
   * $O(N)$ prefix-tree pattern lookup against prohibited canonical roots.
   * Safe whitelist preventing false positives on words like `knight`, `night`, `Nigeria`, `classic`, `pass / passed`, `assistant`, `document`, `spicy`, and Japanese romanji.
4. **Sliding-Window "Ouija" / Chain Detector**:
   * Tracks a rolling 45-second cache of trailing message tokens.
   * Intercepts collaborative letter-by-letter spelling (`"N"` $\to$ `"i"` $\to$ `"g"` $\to$ `"ga"`) or prefix-suffix pairs (`"N"` $\to$ `"igga"` / `"igger"`).
   * Innocent single-letter messages (`"k"`, `"L"`, `"W"`, `"F"`) in normal conversation are **not** punished on their own.
5. **Progressive Penalties**:
   * 1st block: Warning toast.
   * 2nd block within 15 min: 15s timeout.
   * 3rd block: 60s timeout.
   * 4th+ block: 5m timeout.
6. **Accurate Unread Badge Count**:
   * Fixed phantom badge numbers by tracking `lastReadTimestampRef` strictly on genuinely new messages created while the drawer is closed.

---

### B. Bounty Hunter System (`src/components/BountiesModal.tsx`, `src/services/bountyService.ts`, `src/services/scoreService.ts`)
* **10-Bounty Active Board**: Randomly rolled beatmap challenges.
* **Difficulty-Scaled Stamina Rewards**:
  * Beginner (★1.50–★3.99): `+25 ⚡`
  * Intermediate (★4.00–★5.29): `+50 ⚡`
  * Advanced (★5.30–★6.49): `+80 ⚡`
  * Expert (★6.50–★7.99): `+120 ⚡`
  * Master (★8.00+): `+200 ⚡`
* **Score Link Verification & Anti-Exploit**:
  * Verifies score via web scraper API with timestamp comparison (score must be set *after* the bounty was accepted).
  * Completions sync to Supabase `admin_config` (`key: 'bounties_cleared_by_user'`).

---

### C. Global Leaderboard (`src/pages/LeaderboardPage.tsx`, `src/components/UserProfileModal.tsx`)
* **Ranking Tabs**: `[ 🎲 Most Pulls ]`, `[ 💎 Rare Cards ]`, and `[ 🎯 Bounties ]`.
* **1-Hour Cache Strategy**: Rankings are cached in `sessionStorage` for 1 hour to eliminate repetitive queries.
* **Manual Refresh**: Players can click `🔄 Refresh` to bust the cache and pull live database rankings immediately.
* **User Profile Modal**: Displays player stats, rarest card, collection tabs, and `Bounties: X 🎯` metric.

---

### D. Audio & SFX (`src/audio/sfx.ts`, `src/audio/previewPlayer.ts`)
* **SFX Volume**: Lowered master volume to `0.35` with smooth sine/triangle synthesis waves.
* **Song Previews**: Lowered master volume to `0.20` with a smooth 350ms volume fade-in on play to prevent loud audio blasts.
* **Unified Player**: All preview buttons across the app route through `previewPlayer`.

---

### E. Gacha Banner Pooling (`src/gacha/banners.ts`, `src/components/BannerView.tsx`)
* **Current State**: Simplified to a single primary banner: **All-Stars Beatmap Pool** (`standard`).
* **Sub-banners**: Aim Slop, Stream Focus, and Speed/PP sub-banners are temporarily disabled until future pooling mechanics are established.
* **Banner Selector**: Automatically hidden when only 1 banner is active.

---

## 3. Critical Rules & Guardrails for Future Development

1. **NEVER Trigger Global Refresh Without Explicit User Instruction**:
   * Do **NOT** set or update `force_client_refresh` in Supabase `admin_config` unless the user specifically and explicitly requests a site-wide refresh.
2. **React Hook Ordering (Error #310 Prevention)**:
   * Never place early returns (e.g. `if (!isOpen) return null;`) above any hooks (`useMemo`, `useState`, `useEffect`, `useRef`). All hooks must execute unconditionally.
3. **No Worker Hallucinations**:
   * The client connects directly to Supabase. Do not assume or route active user traffic through Cloudflare Workers.

---

## 4. Build & Deployment Workflow

### Build & Typecheck
```bash
export PATH="$HOME/.nix-profile/bin:$PATH" && npm run build
```

### Commit to Main & Deploy to GitHub Pages
```bash
git add -A && git commit -m "commit message" && git push origin main && cd dist && git config user.name "Afterlight0338" && git config user.email "afterlight0338@users.noreply.github.com" && git add -A && git commit -m "deploy description" && git push -f https://github.com/Afterlight0338/osu-beatmap-gacha.git gh-pages
```
