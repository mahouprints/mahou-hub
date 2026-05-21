// Estende a config raiz e adiciona regras específicas do Next.js (App Router).
// Plugin oficial valida server/client boundaries, uso de Image, etc.
import nextPlugin from '@next/eslint-plugin-next';
import rootConfig from '../../eslint.config.mjs';

export default [
  ...rootConfig,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { '@next/next': nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      // Permitimos <img> em locais onde a URL é externa (Shopee, R2 etc.) e o
      // optimizer do Next não consegue otimizar. Cada uso já tem disable inline.
      '@next/next/no-img-element': 'warn',
      // Server actions / boundary react-19 — desligado até estabilizar.
      'react/no-unescaped-entities': 'off',
    },
  },
];
