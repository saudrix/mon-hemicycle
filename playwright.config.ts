import { defineConfig, devices } from '@playwright/test';

// Parcours de bout en bout : l'application construite, servie avec le jeu de données figé
// (tests/fixtures/data), dans un navigateur au format téléphone.
const PORT = 4180;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    ...devices['Pixel 7'],
    baseURL: `http://localhost:${PORT}/`,
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    // Le service worker mettrait en cache des réponses d'un test à l'autre.
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `node scripts/build-e2e.mjs && npx vite preview --outDir dist-e2e --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
