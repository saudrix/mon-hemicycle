import { test as base, expect, type Page } from '@playwright/test';

/** Comme `test`, mais l'écran d'accueil de la première visite a déjà été vu. */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() => localStorage.setItem('mon-hemicycle:accueil-vu', '2026-01-01T00:00:00.000Z'));
    await simulerPhotos(page);
    await use(page);
  },
});

// Une image PNG transparente d'un pixel.
const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

/** Les portraits officiels, servis localement : les tests ne dépendent pas du site de l'Assemblée. */
export async function simulerPhotos(page: Page) {
  await page.route('https://www2.assemblee-nationale.fr/static/tribun/**', (route) =>
    route.fulfill({ contentType: 'image/png', body: PIXEL }),
  );
}
export { expect };

/**
 * Relève les erreurs JavaScript et les réponses en erreur pendant le test : un parcours
 * qui affiche la bonne page mais lève une exception en route doit échouer aussi.
 */
export function surveiller(page: Page) {
  const erreurs: string[] = [];
  page.on('pageerror', (e) => erreurs.push(`exception : ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') erreurs.push(`console : ${m.text()}`);
  });
  page.on('response', (r) => {
    if (r.status() >= 400 && new URL(r.url()).hostname === 'localhost') erreurs.push(`HTTP ${r.status()} : ${r.url()}`);
  });
  return {
    sansErreur: () => expect(erreurs, erreurs.join('\n')).toEqual([]),
  };
}

/** Le géocodage de l'IGN, simulé : une adresse à Foix (Ariège, 1re circonscription). */
export async function simulerGeocodage(page: Page) {
  await page.route('https://data.geopf.fr/geocodage/**', (route) =>
    route.fulfill({
      json: {
        features: [
          {
            geometry: { coordinates: [1.6053, 42.9653] },
            properties: { label: '1 Place du Mercadal 09000 Foix', depcode: '09', citycode: '09122' },
          },
        ],
      },
    }),
  );
}

/** Mémorise une circonscription comme si l'utilisateur l'avait choisie. */
export async function choisirCirconscription(page: Page, depNum = '09', circo = 1) {
  await page.addInitScript(
    ([d, c]) =>
      localStorage.setItem('mon-hemicycle:circonscription', JSON.stringify({ depNum: d, circo: c, label: 'Foix' })),
    [depNum, circo] as const,
  );
}
