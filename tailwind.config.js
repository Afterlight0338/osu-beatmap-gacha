/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        osu: {
          pink: '#ff66ab',
          'pink-dark': '#e0428d',
          'pink-light': '#ff8fc4',
          accent: '#00d2ff',
          bg: '#0d0d15',
          'bg-card': '#161622',
          'bg-elevated': '#202030',
          'bg-secondary': '#12121c',
          border: '#2a2a40',
        },
        rarity: {
          common: '#94a3b8',      // Slate / Silver
          uncommon: '#10b981',    // Emerald Green
          rare: '#06b6d4',        // Cyan / Sapphire
          epic: '#a855f7',        // Royal Purple
          legendary: '#f59e0b',   // Radiant Gold
          mythic: '#ef4444',      // Crimson Red
          divine: '#ff007f',      // Prismatic / Rainbow Pink
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['Torus', 'Comfortaa', 'Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'pulse-glow': 'pulseGlow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 12s linear infinite',
        'float': 'float 3s ease-in-out infinite',
        'shimmer': 'shimmer 2.5s infinite',
        'divine-rainbow': 'rainbowGlow 4s linear infinite',
        'card-reveal': 'cardReveal 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { opacity: '0.6', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.05)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        rainbowGlow: {
          '0%': { filter: 'hue-rotate(0deg)' },
          '100%': { filter: 'hue-rotate(360deg)' },
        },
        cardReveal: {
          '0%': { opacity: '0', transform: 'scale(0.8) translateY(30px) rotateY(15deg)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0) rotateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
