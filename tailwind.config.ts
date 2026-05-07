import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        navy:  '#050d1a',
        navy2: '#081120',
        navy3: '#0d1a2e',
        gold:  '#e8a020',
        gold2: '#f5c55a',
        green: '#00d4a0',
      },
      fontFamily: {
        sans:  ['var(--font-inter)', 'Inter', 'sans-serif'],
        space: ['var(--font-space)', 'Space Grotesk', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
