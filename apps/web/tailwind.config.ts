import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        mahou: {
          ink: '#0f172a',
          mute: '#475569',
          line: '#e2e8f0',
          bg: '#f8fafc',
          accent: '#7c3aed',
        },
      },
    },
  },
  plugins: [],
};

export default config;
