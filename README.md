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

**osu! Beatmap Gacha** is a modern, responsive web application hosted on **GitHub Pages**. Instead of anime characters or heroes, players summon and collect real, ranked osu! beatmaps spanning the history of the game.

* **100% Client-Side**: No backend, no accounts, and no servers required.
* **Offline-First Storage**: Your collection, duplicates, favorites, and pull history are stored locally in your browser via **IndexedDB**.
* **Real osu! Metadata**: 6,000+ real ranked & loved beatmaps with artwork, audio previews, BPM, star ratings, and mapper credits.

---

## ✨ Features

### 🎲 Authentic Gacha Summoning
* **1-Pull, 5-Pull, and 10-Pull**: 10-pulls guarantee at least one **Rare+** beatmap.
* **3D Card Flip Animation**: Interactive reveal sequences with rarity-specific audio fanfares and confetti particles.
* **Time-Gated Pull Energy**:
  * Regenerates **+1 Pull Token every 15 seconds**.
  * Accumulates up to **50 pulls** for full sessions.

---

### 🏆 8 Rarity Tiers & Dynamic Drop Rates

| Tier | Rarity | Drop Rate | Description |
| :--- | :--- | :--- | :--- |
| **8** | 🐐 **GOAT** | **0.05%** | **Top 10 most played songs in osu! history** (*No title, Harumachi Clover, Make a Move, Hitorigoto, quaver, Black Rover, Silhouette, My Love, Highscore, Everything will freeze*) |
| **7** | 👑 **Divine** | **0.10%** | Monumental community masterworks & legendary tournament anthems (*FREEDOM DiVE, Blue Zenith, The Big Black, Tengaku, Galaxy Collapse, Apparition*) |
| **6** | ✨ **Mythic** | **0.25%** | Elite 7★+ & 8★+ mechanical landmarks |
| **5** | 🌟 **Legendary** | **1.00%** | Classic 6★+ high-difficulty ranked maps |
| **4** | 🟣 **Epic** | **6.00%** | 5★+ Insane/Extra staples |
| **3** | 🔵 **Rare** | **18.00%** | 4★+ Hard/Insane standards |
| **2** | 🟢 **Uncommon** | **34.60%** | 3★+ Normal/Hard introductory maps |
| **1** | ⚪ **Common** | **40.00%** | 1★–2★ Easy/Normal beginnings |

---

### 🎪 3 Themed Banners
1. 🌟 **All-Stars Standard Banner**: The complete database of 6,000+ ranked & loved beatmaps.
2. ⚡ **Stamina & Stream Legends**: Filtered strictly to deathstream classics, 180+ BPM endurance tests, and legendary stream artists (*xi, DragonForce, Camellia, LeaF, UNDEAD CORPORATION, ICDD, Foreground Eclipse*).
3. 🔥 **Speed & PP Highlights**: Filtered strictly to fast TV Sizes (≤135s), jump farm maps, and acclaimed farm mappers (*Sotarks, Monstrata, Nevo, Reform, Armin, Doormat, Browiec*).

---

### 🎵 Audio Previews & Direct osu! Links
* **30-Second Audio Previews**: Stream official song previews directly on beatmap cards and detail modals.
* **Direct osu! Website Navigation**: Click the external link icon on any card to view the official beatmapset on `osu.ppy.sh`.

---

### 💾 Collection Management & Local Backup
* **Filter & Sort**: Search by title, artist, mapper, star rating, BPM, or rarity.
* **Favorites System**: Mark and filter your favorite beatmaps.
* **Local Player Profile**: Enter your osu! username to display your official avatar directly on the top navigation bar.
* **Save Backup & Restore**: Export your complete collection to a JSON file and import it anytime to transfer progress between devices.
* **727 Easter Egg**: A secret challenge hidden inside Settings!

---

## 🛠️ Technology Stack

* **Frontend Framework**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
* **Build Tool**: [Vite 6](https://vitejs.dev/)
* **Styling**: [Tailwind CSS](https://tailwindcss.com/)
* **Local Database**: [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) via [`idb`](https://github.com/jakearchibald/idb)
* **Icons & SFX**: [Lucide React](https://lucide.dev/) + Web Audio API Synthesis
* **Visual Effects**: [Canvas Confetti](https://www.npmjs.com/package/canvas-confetti)
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

## 📜 Disclaimer

**osu! Beatmap Gacha** is an unofficial fan project and is not affiliated with, endorsed, or sponsored by **osu!** or **ppy Pty Ltd**. All beatmap artwork, audio previews, and metadata remain the intellectual property of their respective artists, mappers, and rights holders.

---

## 📄 License

This project is open-source software licensed under the **[MIT License](./LICENSE)**.
