// ESLint v9 flat config — raiz do monorepo.
// Workspaces (apps/api, apps/web, packages/*, mcp-servers/*) herdam essa config via
// resolução padrão do ESLint v9 (procura subindo até achar). Pra ajustar rules
// específicas, criar `eslint.config.mjs` no workspace e estender desse aqui.
//
// Stack: TypeScript estrito + Prettier (sem conflito com formatação). React/Next
// adicionados em sub-config dentro de apps/web. Plugin do Next valida server/client
// boundaries e imagens.

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  // 1) Ignorar artefatos
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/coverage/**',
      'apps/api/prisma/migrations/**',
      // Arquivos gerados pelo Next (triple-slash references; reescritos a cada build).
      '**/next-env.d.ts',
    ],
  },

  // 2) Base JS (eslint:recommended sem o opinionated demais)
  js.configs.recommended,

  // 3) TypeScript — recomendado, sem type-aware (mais rápido, sem precisar de parserOptions.project)
  ...tseslint.configs.recommended,

  // 4) Ajustes globais pra TypeScript do monorepo
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      // Permite `_` prefix pra args/vars não usados (padrão amplamente aceito).
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      // `any` é permitido com comentário justificando (regra de CLAUDE.md).
      '@typescript-eslint/no-explicit-any': 'warn',
      // Permitir `as` sem alarme (NestJS DI / Prisma genéricos abusam).
      '@typescript-eslint/consistent-type-assertions': 'off',
      // Empty functions são comuns em mocks/decorators.
      '@typescript-eslint/no-empty-function': 'off',
    },
  },

  // 5) Scripts (CLI tools) e configs podem ser menos rigorosos.
  {
    files: ['**/scripts/**/*.ts', '**/vitest.config.ts', '**/*.config.{ts,mjs,js}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
    },
  },

  // 6) Testes — relaxar pra mocks
  {
    files: ['**/test/**/*.ts', '**/*.test.ts', '**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },

  // 7) Prettier — sempre por último; desliga regras de formatação que brigariam.
  prettier,
);
