import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['test/**/*.test.ts'],
    // Não rodar em paralelo testes que tocam DB. Hoje só temos unit tests com mock — ok.
  },
  resolve: {
    alias: {
      // Nest decorators precisam de reflect-metadata; importado em cada test.
    },
  },
});
