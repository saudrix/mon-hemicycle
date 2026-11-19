// Lot 1 « se repérer » : retour arrière, titre de l'onglet, erreurs, liste de la carte.

import { expect, surveiller, test } from './outils';

test('retour arrière : la recherche, le regroupement et la position sont retrouvés', async ({ page }) => {
  const s = surveiller(page);
  await page.goto('./#/scrutins');
  const recherche = page.getByLabel('Rechercher un texte, un mot-clé ou un numéro de scrutin');
  await recherche.fill('amendement');
  await page.getByRole('button', { name: 'Par jour' }).click();

  // Descendre dans la liste, puis ouvrir un scrutin visible à l'écran.
  const lien = page.locator('main a[href^="#/scrutins/"]').nth(25);
  await lien.scrollIntoViewIfNeeded();
  const position = await page.evaluate(() => window.scrollY);
  expect(position).toBeGreaterThan(500);
  await lien.click();
  await expect(page).toHaveURL(/#\/scrutins\/\d+$/);
  // Un nouvel écran s'ouvre en haut.
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);

  await page.goBack();
  await expect(recherche).toHaveValue('amendement');
  await expect(page.getByRole('button', { name: 'Par jour' })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(position - 50);
  s.sansErreur();
});

test('rouvrir la liste depuis le menu : elle repart de zéro', async ({ page }) => {
  await page.goto('./#/scrutins');
  const recherche = page.getByLabel('Rechercher un texte, un mot-clé ou un numéro de scrutin');
  await recherche.fill('censure');
  await page.getByRole('link', { name: 'Carte' }).click();
  await page.getByRole('link', { name: 'Scrutins' }).click();
  await expect(recherche).toHaveValue('');
});

test('titre de l’onglet et focus suivent l’écran affiché', async ({ page }) => {
  await page.goto('./#/scrutins/9915');
  await expect(page).toHaveTitle(/· Mon Hémicycle$/);
  await page.locator('a.lien-texte').click();
  await expect(page).toHaveTitle('La relance et la décentralisation du logement · Mon Hémicycle');
  // Le lecteur d'écran repart du titre du nouvel écran.
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
});

test('serveur injoignable : message en français et bouton « Réessayer » qui recharge', async ({ page }) => {
  let coupe = true;
  await page.route('**/data/scrutins.json*', (route) => (coupe ? route.abort('internetdisconnected') : route.continue()));
  await page.goto('./#/scrutins');
  const alerte = page.getByRole('alert');
  await expect(alerte).toContainText('Impossible de joindre le serveur');

  coupe = false;
  await alerte.getByRole('button', { name: 'Réessayer' }).click();
  await expect(page.getByLabel('Rechercher un texte, un mot-clé ou un numéro de scrutin')).toBeVisible();
});

test('carte : la liste des circonscriptions, alternative au dessin', async ({ page }) => {
  const s = surveiller(page);
  await page.goto('./#/carte');
  const bouton = page.getByRole('button', { name: 'Voir la liste des circonscriptions' });
  await expect(bouton).toHaveAttribute('aria-expanded', 'false');
  await bouton.click();
  await expect(page.getByRole('button', { name: 'Masquer la liste' })).toHaveAttribute('aria-expanded', 'true');
  const liste = page.getByRole('region', { name: 'Liste des circonscriptions' });
  await expect(liste.getByText('Martine Froger')).toBeVisible();
  await liste.getByRole('link', { name: /Martine Froger/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Martine Froger' })).toBeVisible();
  s.sansErreur();
});
