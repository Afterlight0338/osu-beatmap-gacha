# 🌸 osu! Beatmap Gacha

[![Deploy to GitHub Pages](https://github.com/Afterlight0338/osu-beatmap-gacha/actions/workflows/deploy.yml/badge.svg)](https://github.com/Afterlight0338/osu-beatmap-gacha/actions/workflows/deploy.yml)
[![Update Beatmaps Dataset](https://github.com/Afterlight0338/osu-beatmap-gacha/actions/workflows/update-beatmaps.yml/badge.svg)](https://github.com/Afterlight0338/osu-beatmap-gacha/actions/workflows/update-beatmaps.yml)
[![GitHub Pages URL](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-ff66aa.svg)](https://afterlight0338.github.io/osu-beatmap-gacha/)

> A sleek, browser-based collectible card gacha game where you pull **osu! beatmaps** instead of anime characters or players.

Explore iconic osu! maps spanning over a decade of community history, discover hidden gems, listen to in-browser audio previews, and complete your personal collection — 100% client-side with zero logins or backend servers required.

---

## ✨ Features

* **Authentic Beatmap Pulls**: Discover and collect individual difficulties from the top 10,000 most played and loved osu! beatmaps.
* **Log-Normalized Rarity System**: Rarity is determined by true player desirability (playcount & favourites) rather than mere star rating.
* **Tactile Gacha Ceremony**: Immersive summoning sequence with tier-based audio chords, glowing auras, foil shaders, and confetti celebrations for high-rarity pulls.
* **3D Holographic Collectible Cards**: Cards tilt in 3D perspective with foil glare and dynamic rarity lighting.
* **In-Browser Audio Previews**: Click any card or modal to immediately listen to 30-second beatmap MP3 previews.
* **Deep Collection Management**: Filter by rarity, status, ownership (including silhouette collection dex mode), and sort by 8+ dimensions.
* **Zero Backend / Serverless**: Runs completely in your browser on **GitHub Pages**. All user data is persisted in browser **IndexedDB**.
* **Backup & Restore**: Export your collection to a `.json` backup file anytime, or import/merge backups across devices.
* **Automated Dataset Updater**: Scheduled GitHub Actions pipeline periodically refreshes the top 10,000 beatmaps directly from osu! API v2.

---

## 💎 Rarity Hierarchy & Probabilities

Rarity is calculated using a **logarithmic normalization** of both global playcount and favourite count to prevent extreme outliers from distorting the tiers:

$$\text{playScore} = \log_{10}(\text{playcount} + 1)$$
$$\text{favScore} = \log_{10}(\text{favouriteCount} + 1)$$
$$\text{popularityScore} = 0.70 \times \text{normalized}(\text{playScore}) + 0.30 \times \text{normalized}(\text{favScore})$$

### Rarity Tiers & Percentiles

| Rarity | Tier Color | Pool Percentile | Base Pull Rate | 10-Pull Guarantee Rate |
| :--- | :--- | :--- | :--- | :--- |
| **Common** | Slate Silver | Bottom 50.0% | **55.0%** | — |
| **Uncommon** | Emerald Green | 50.0% – 75.0% | **25.0%** | — |
| **Rare** | Cyan Sapphire | 75.0% – 90.0% | **12.0%** | **60.0%** |
| **Epic** | Royal Amethyst | 90.0% – 97.0% | **5.0%** | **25.0%** |
| **Legendary** | Radiant Gold | 97.0% – 99.2% | **2.0%** | **10.0%** |
| **Mythic** | Crimson Ruby | 99.2% – 99.85% | **0.8%** | **4.0%** |
| **Divine** | Rainbow Aurora | **Top 0.15%** | **0.2%** | **1.0%** |

*Every 10-pull guarantees at least one beatmap of **Rare** or higher rarity!*

---

## 📂 Project Architecture

```text
osu-beatmap-gacha/
├── .github/
│   └── workflows/
│       ├── deploy.yml             # Builds & deploys frontend to GitHub Pages
│       └── update-beatmaps.yml    # Scheduled osu! API top dataset generator
│
├── public/
│   ├── data/
│   │   ├── maps.json              # Active top beatmap pool dataset
│   │   └── dataset-info.json      # Dataset metadata, version, & counts
│   └── favicon.svg                # osu! circle logo
│
├── scripts/
│   ├── update-beatmaps.mjs        # osu! API v2 fetcher, ranker, & atomic updater
│   └── generate-demo-data.mjs     # Standalone seed/demo dataset generator
│
├── src/
│   ├── audio/
│   │   ├── sfx.ts                 # Web Audio synthesizer for gacha SFX
│   │   └── previewPlayer.ts       # Beatmap audio preview stream player
│   │
│   ├── components/
│   │   ├── Navbar.tsx             # Tab header, audio controls, & quick stats
│   │   ├── BannerView.tsx         # Banner showcase & rate-up selector
│   │   ├── GachaControls.tsx      # 1x / 10x summon buttons & rate breakdown
│   │   ├── PullRevealModal.tsx    # Immersive summon animation & flip reveal
│   │   ├── BeatmapCard.tsx        # 3D interactive collectible card
│   │   ├── RarityBadge.tsx        # Dynamic rarity badge
│   │   ├── CollectionGrid.tsx     # Paginated collection card grid
│   │   ├── CollectionFilters.tsx  # Search, rarity pills, & sorting controls
│   │   ├── BeatmapDetailModal.tsx # Full beatmap stats, links, & downloads
│   │   ├── SettingsModal.tsx      # SFX volume, JSON Export/Import, & Reset
│   │   └── PullHistoryModal.tsx   # Chronological pull log
│   │
│   ├── context/
│   │   └── GachaContext.tsx       # Global state provider & storage sync
│   │
│   ├── gacha/
│   │   ├── rarity.ts              # Rarity enum, math formulas, & configs
│   │   ├── probabilities.ts       # Configurable pull probabilities
│   │   ├── banners.ts             # Banner pools (Standard, Stream, Farm)
│   │   └── rng.ts                 # Gacha pull simulation engine
│   │
│   ├── storage/
│   │   ├── db.ts                  # IndexedDB promise client (idb)
│   │   └── exportImport.ts        # JSON backup export/import & validation
│   │
│   ├── pages/
│   │   ├── GachaPage.tsx          # Main summon page
│   │   ├── CollectionPage.tsx     # Collection dex & filters
│   │   └── StatsPage.tsx          # Analytics, completion %, & luck tracking
│   │
│   ├── types/                     # TypeScript interfaces
│   ├── App.tsx                    # Top router & layout
│   └── main.tsx                   # React root entry
│
├── vite.config.ts                 # Base path: /osu-beatmap-gacha/
├── tailwind.config.js             # Custom osu! & rarity color palette
├── package.json
└── README.md
```

---

## 🛠️ Local Development

### Prerequisites

* **Node.js**: v20 or higher
* **npm**: v9 or higher

### Installation & Run

1. Clone the repository:
   ```bash
   git clone https://github.com/Afterlight0338/osu-beatmap-gacha.git
   cd osu-beatmap-gacha
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start local development server:
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173/osu-beatmap-gacha/` in your browser.

4. Build production static bundle:
   ```bash
   npm run build
   ```

---

## 🚀 GitHub Pages Deployment

The repository includes an automated GitHub Actions deployment workflow (`.github/workflows/deploy.yml`).

### Setup Instructions

1. On GitHub, navigate to **Settings** > **Pages**.
2. Under **Build and deployment** > **Source**, select **GitHub Actions**.
3. Push any commit to the `main` branch. The action will build the Vite project and deploy it to:
   ```text
   https://Afterlight0338.github.io/osu-beatmap-gacha/
   ```

---

## 🔄 Beatmap Dataset Updater & osu! API Setup

The dataset updater script (`scripts/update-beatmaps.mjs`) connects to osu! API v2 to fetch the current global top beatmap pool, rank difficulties by log-normalized popularity, assign rarity tiers, validate the data schema, and atomically update `public/data/maps.json`.

### How to Configure Secrets

1. Go to your [osu! Account Settings](https://osu.ppy.sh/home/account/edit#new-oauth-application) and create a **New OAuth Application**.
2. Copy the **Client ID** and **Client Secret**.
3. In your GitHub repository, navigate to **Settings** > **Secrets and variables** > **Actions**.
4. Add two repository secrets:
   * `OSU_CLIENT_ID`: Your numerical osu! Client ID (e.g. `12345`)
   * `OSU_CLIENT_SECRET`: Your osu! Client Secret key string

### Automated & Manual Execution

* **Scheduled**: Runs automatically on the 1st and 15th of every month via GitHub Actions cron.
* **Manual Dispatch**: Go to the **Actions** tab on GitHub, select **Update Beatmaps Dataset**, and click **Run workflow**.
* **Local Run**:
  ```bash
  export OSU_CLIENT_ID="your_client_id"
  export OSU_CLIENT_SECRET="your_client_secret"
  npm run update-maps
  ```

*Note: If API credentials are not provided, the game automatically falls back to its bundled rich demo dataset without crashing.*

---

## 💾 Local Browser Persistence & Privacy

* All collection progress, duplicate counts, favorites, and pull histories are stored locally in the user's browser using **IndexedDB** (`osu_beatmap_gacha_db`).
* **Zero Tracking / Accounts**: No passwords, personal information, or osu! logins are requested or stored.
* **Offline Compatible**: Once the dataset is loaded, all gacha mechanics and collection features operate offline.
* **Backup Export/Import**: Users can download a `.json` backup file or restore their collection at any time in the Settings menu.

---

## ⚖️ Legal Disclaimer

This is an unofficial fan project and is **not affiliated with, endorsed by, or sponsored by osu! or ppy Pty Ltd**.

* osu! is a registered trademark of ppy Pty Ltd.
* All beatmap titles, cover artwork, audio previews, and metadata remain the property of their respective artists, mappers, and rights holders.
* This web application does not download or redistribute `.osu` beatmap package files; it serves solely as an interactive metadata and collectible card game.

---

## 📄 License

MIT License. Feel free to fork, customize, and enjoy!
