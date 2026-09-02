/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "../../packages/ui/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: '#16233B',
        paper: '#F6F5F1',
        slate: '#5B6B79',
        brass: '#B9812E',
        ledger: '#D8D3C7',
        deepInk: '#0E1826',
        semantic: {
          green: '#2E7D5B',
          amber: '#C68A2E',
          red: '#B3432E',
          blue: '#3A6EA5',
        },
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      }
    },
  },
  plugins: [],
}