# zeek suruh buat

# 🌸 osu! Beatmap Gacha

[![Live Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-ff66aa?style=for-the-badge&logo=github)](https://afterlight0338.github.io/osu-beatmap-gacha/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](./LICENSE)
[![React](https://img.shields.io/badge/React-19-61dafb?style=for-the-badge&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178c6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.0-646cff?style=for-the-badge&logo=vite)](https://vitejs.dev/)

> **A polished, browser-based gacha and collectible card game where you summon iconic osu! beatmaps!**

Play now directly in your browser: **[https://afterlight0338.github.io/osu-beatmap-gacha/](https://afterlight0338.github.io/osu-beatmap-gacha/)**

---

## 🌟 Overview

**osu! Beatmap Gacha** is a modern, responsive web application hosted on **GitHub Pages**. Instead of anime characters or heroes, players summon and collect real, ranked osu! beatmaps spanning the entire history of the game (2007–2026).

* **100% Client-Side**: No backend, no accounts, and no servers required.
* **Offline-First Storage**: Your collection, duplicates, favorites, and pull history are stored locally in your browser via **IndexedDB**.
* **Real osu! Metadata**: **50,000 unique ranked & loved beatmap difficulties** with artwork, audio previews, BPM, star rating ranges, ranked dates, and mapper credits.

---

## ✨ Features

### 🎲 Authentic Gacha Summoning
* **1-Pull, 5-Pull, and 10-Pull**: 10-pulls guarantee at least one **Rare+** beatmap.
* **3D Card Flip Animation**: Interactive reveal sequences with rarity-specific audio fanfares and confetti particles.
* **Time-Gated Pull Energy**:
  * Regenerates **+1 Pull Token every 15 seconds**.
  * Accumulates up to **50 pulls** for full sessions.

---

### 🏆 10 Rarity Tiers & Strict Pyramidical Distribution

| Tier | Icon & Rarity | Suggested Pull Rate | Pool Count | Description |
| :--- | :--- | :---: | :---: | :--- |
| **10** | 🐐 **GOAT** | **0.01%** | **10** | **Top 10 most played songs in osu! history** (*No title, Harumachi Clover, Make a Move, Hitorigoto, quaver, Black Rover, Silhouette, My Love, Highscore, Everything will freeze*) |
| **9** | 👑 **Divine** | **0.09%** | **36** | Monumental community masterworks & legendary tournament anthems (*FREEDOM DiVE, Blue Zenith, The Big Black, Tengaku, Galaxy Collapse, Apparition*) |
| **8** | ✨ **Celestial** | **0.15%** | **69** | Holy grails of speed, precision, and all-time tournament showcases |
| **7** | 🔥 **Mythic** | **0.30%** | **150** | Elite 7★+ & 8★+ mechanical landmarks |
| **6** | 🔴 **Legendary** | **0.75%** | **400** | Classic 6★+ high-difficulty ranked maps |
| **5** | 🟠 **Epic** | **4.00%** | **2,000** | 5★+ Insane/Extra staples |
| **4** | 🟣 **Rare** | **12.00%** | **6,000** | 4★+ Hard/Insane standards |
| **3** | 🔵 **Uncommon+** | **25.00%** | **12,000** | 3.5★+ high Normal/Hard transitional maps |
| **2** | 🟢 **Uncommon** | **27.70%** | **14,000** | 2.5★–3.5★ Normal/Hard introductory maps |
| **1** | ⚪ **Common** | **30.00%** | **15,335** | 1★–2.5★ Easy/Normal beginnings |

*Hierarchical Pool Balance: Common (15,335) > Uncommon (14,000) > Uncommon+ (12,000) > Rare (6,000) > Epic (2,000) > Legendary (400) > Mythic (150) > Celestial (69) > Divine (36) > GOAT (10).*

---

### 🎪 4 Themed Banners
1. 🌟 **All-Stars Standard Banner**: The complete database of 50,000+ ranked & loved beatmaps.
2. 🎯 **Aim Slop (1-2 Jump Farm)**: Filtered strictly to fast TV Sizes, cross-screen 1-2 jump patterns, and famous farm mappers (*Sotarks, Reform, Browiec, Log Off Now, Nevo, fieryrage, Akitoshi, Doormat, Monstrata, Armin*).
3. ⚡ **Stamina & Stream Legends**: Filtered strictly to deathstream classics, 185+ BPM endurance tests, and legendary stream artists (*xi, DragonForce, Camellia, LeaF, UNDEAD CORPORATION, ICDD, Foreground Eclipse*).
4. 🔥 **Speed & PP Highlights**: Filtered strictly to high BPM speed bursts, alternate maps, and iconic double-time speed benchmarks.

---

### 🎓 15 PhD Pure Mathematics Qualifying Challenges
* **15 Rigorous Proof Problems**: Test your knowledge of Analytic Number Theory, Modular Forms, Monstrous Moonshine, Lie Algebras ($E_8, F_4$), Calabi–Yau Threefolds, Leech Lattices ($\Lambda_{24}$), and Riemann Surfaces.
* **Huge Summon Rewards**:
  * **Problem I**: Evaluates to `727` for **50 Pulls (⚡ Max Stamina)**.
  * **Problems II–XV**: Real unguessable PhD mathematical invariants rewarding **+100 Pulls each** (totaling up to 1,450 bonus summons!).
  * **Progress Tracker**: Automatically saves your solved problems in local storage.

---

### 🎵 Audio Previews & Direct osu! Links
* **30-Second Audio Previews**: Stream official song previews directly on beatmap cards and detail modals.
* **Direct osu! Website Navigation**: Click the external link icon on any card to view the official beatmapset on `osu.ppy.sh`.

---

### 💾 Collection Management & Local Backup
* **Filter & Sort**: Search by title, artist, mapper, star rating range, BPM, ranked date, or rarity tier.
* **Favorites System**: Mark and filter your favorite beatmaps.
* **Save Backup & Restore**: Export your complete collection to a JSON file and import it anytime to transfer progress between devices.

---

## ☁️ Cloud Sync & osu! OAuth2 Authentication (Cloudflare Workers + D1)

The application supports **1-Click Official osu! OAuth2 Login** with cloud persistence powered by **Cloudflare Workers + Cloudflare D1 (Serverless SQLite)**:

* **Zero User Configuration**: Users click **"Login with osu!"** and are automatically authenticated via official osu! OAuth2. No URLs or API keys to configure.
* **Multi-Device Synchronization**: Your beatmap collection, favorites, total pulls, and pity count are synchronized to Cloudflare D1. Logging into the same osu! account on another PC or mobile phone automatically restores your progress.
* **Offline-First Hybrid Architecture**: Local **IndexedDB** handles instant zero-latency UI updates while Cloudflare D1 serves as the authoritative cloud source of truth.
* **Security**: Client secrets are kept exclusively within Cloudflare Worker Secrets and never exposed to frontend code.

---

### 🚀 Setting Up the Cloudflare Worker & D1 Backend

To deploy your own Cloudflare Worker backend for osu! OAuth2 and D1 sync:

#### 1. Register an osu! OAuth Application
1. Go to your osu! account settings: **[osu.ppy.sh/home/account/edit#oauth](https://osu.ppy.sh/home/account/edit#oauth)**.
2. Scroll to **OAuth Application** and click **New Application**.
3. Set the **Application Name** (e.g. `osu! Beatmap Gacha`).
4. Set the **Redirect URI** to your Cloudflare Worker callback:
   ```
   https://<your-worker-name>.<your-subdomain>.workers.dev/auth/callback
   ```
5. Click **Register Application** and copy your **Client ID** and **Client Secret**.

#### 2. Create the Cloudflare D1 Database
In the project root, navigate to the `worker/` directory and run:
```bash
cd worker
npx wrangler d1 create osu-gacha-db
```
Copy the generated `database_id` UUID and paste it into `worker/wrangler.toml`:
```toml
[[d1_databases]]
binding = "DB"
database_name = "osu-gacha-db"
database_id = "<PASTE_YOUR_DATABASE_ID_HERE>"
```

#### 3. Execute the Database Schema Migration
Run the SQL schema script to initialize the D1 tables:
```bash
npx wrangler d1 execute osu-gacha-db --file=./schema.sql
```

#### 4. Configure Worker Secrets
Securely store your osu! OAuth credentials in Cloudflare Worker Secrets:
```bash
npx wrangler secret put OSU_CLIENT_ID
# Enter your osu! OAuth Client ID when prompted

npx wrangler secret put OSU_CLIENT_SECRET
# Enter your osu! OAuth Client Secret when prompted
```

#### 5. Deploy the Worker
Deploy the worker live to Cloudflare:
```bash
npx wrangler deploy
```

---

## 🛠️ Technology Stack

* **Frontend Framework**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
* **Build Tool**: [Vite 6](https://vitejs.dev/)
* **Styling**: [Tailwind CSS](https://tailwindcss.com/)
* **Backend Serverless**: [Cloudflare Workers](https://workers.cloudflare.com/) (Edge Runtime)
* **Cloud Database**: [Cloudflare D1](https://developers.cloudflare.com/d1/) (Serverless SQL)
* **Local Database**: [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) via [`idb`](https://github.com/jakearchibald/idb)
* **Authentication**: Official [osu! OAuth2 API v2](https://osu.ppy.sh/docs/index.html#authentication)
* **Hosting**: [GitHub Pages](https://pages.github.com/)

---

## 🚀 Local Development

To run the project locally on your machine:

```bash
# 1. Clone the repository
git clone https://github.com/Afterlight0338/osu-beatmap-gacha.git
cd osu-beatmap-gacha

# 2. Install dependencies
npm install

# 3. Start development server
npm run dev

# 4. Build production bundle
npm run build
```

---

## 📜 License

This project is licensed under the [MIT License](./LICENSE).

---

## ⚠️ Disclaimer

osu! Beatmap Gacha is an **unofficial fan-made project** and is not affiliated with, endorsed, or sponsored by **ppy Pty Ltd** or **osu!**. All beatmap metadata, covers, audio samples, and artwork remain the intellectual property of their respective artists, mappers, and rights holders.
