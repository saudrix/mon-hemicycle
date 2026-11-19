import { defineConfig } from 'vitest/config';

// Tests unitaires : fonctions pures, sans navigateur. Les parcours sont dans tests/e2e (Playwright).
export default defineConfig({
  test: { include: ['tests/unit/**/*.test.ts'] },
});
