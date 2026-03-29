import type { Config } from 'tailwindcss'

export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0f172a',
          light: '#1e293b',
        },
        accent: {
          DEFAULT: '#6366f1',
          2: '#8b5cf6',
          light: 'rgba(99, 102, 241, 0.1)',
        },
        board: {
          light: '#E8EAF6',
          dark: '#5C6BC0',
          highlight: '#7986CB',
        },
        game: {
          bg: '#1e293b',
          panel: '#273549',
          text: '#e2e8f0',
        },
        xp: {
          gold: '#f59e0b',
        },
        rank: {
          copper: '#b87333',
          silver: '#94a3b8',
          gold: '#f59e0b',
          diamond: '#3b82f6',
          purple: '#8b5cf6',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'Fira Code', 'Cascadia Code', 'monospace'],
      },
      borderRadius: {
        'card': '14px',
      },
      boxShadow: {
        'accent': '0 4px 14px rgba(99, 102, 241, 0.3)',
      },
    },
  },
  plugins: [],
} satisfies Config
