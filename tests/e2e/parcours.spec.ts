// Les parcours principaux, sur le jeu de données figé (tests/fixtures/data).

import { test as premiereVisite } from '@playwright/test';
import { choisirCirconscription, expect, simulerGeocodage, surveiller, test } from './outils';

premiereVisite('première visite : l’accueil présente l’application puis mène à la recherche', async ({ page }) => {
  const s = surveiller(page);
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1, name: 'Les votes de l’Assemblée, en clair' })).toBeVisible();
  await page.getByRole('button', { name: 'Passer' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Qui est mon député ?' })).toBeVisible();
  s.sansErreur();
});

test('trouver son député à partir de son adresse, et le retrouver au retour', async ({ page }) => {
  const s = surveiller(page);
  await simulerGeocodage(page);
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1, name: 'Qui est mon député ?' })).toBeVisible();

  await page.getByLabel('Mon adresse').fill('1 place du Mercadal Foix');
  await page.getByRole('button', { name: '1 Place du Mercadal 09000 Foix' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Martine Froger' })).toBeVisible();

  // Le choix est gardé sur l'appareil.
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Martine Froger' })).toBeVisible();
  s.sansErreur();
});

test('liste des scrutins : chercher, ouvrir un texte puis un scrutin, revenir', async ({ page }) => {
  const s = surveiller(page);
  await page.goto('./#/scrutins');
  const recherche = page.getByLabel('Rechercher un texte, un mot-clé ou un numéro de scrutin');
  await expect(recherche).toBeVisible();

  // Par défaut, les scrutins sont rangés sous leur texte.
  await recherche.fill('logement');
  await page.getByRole('link', { name: /La relance et la décentralisation du logement/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'La relance et la décentralisation du logement' })).toBeVisible();
  await page.goBack();
  await expect(recherche).toBeVisible();

  // Rangés par jour, ils mènent directement à leur fiche.
  await recherche.fill('censure');
  await page.getByRole('button', { name: 'Par jour' }).click();
  const premier = page.locator('main a[href^="#/scrutins/"]').first();
  await expect(premier).toContainText(/censure/i);
  await premier.click();

  await expect(page).toHaveURL(/#\/scrutins\/\d+$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Vote des groupes' })).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/#\/scrutins$/);
  await expect(page.locator('main a[href^="#/scrutins/"]').first()).toBeVisible();
  s.sansErreur();
});

test('fiche d’un scrutin : résultat, portée, et lien vers le texte', async ({ page }) => {
  const s = surveiller(page);
  await page.goto('./#/scrutins/9915');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/rejet/i);
  await expect(page.getByRole('heading', { name: 'Ce que ça change' })).toBeVisible();
  await expect(page.getByText('Le texte reste inchangé sur ce point.')).toBeVisible();

  await page.locator('a.lien-texte').click();
  await expect(page).toHaveURL(/#\/textes\/DLR5L17N54608$/);
  await expect(page.getByRole('heading', { level: 1, name: 'La relance et la décentralisation du logement' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Le parcours' })).toBeVisible();
  s.sansErreur();
});

test('mon député apparaît dans la fiche d’un scrutin', async ({ page }) => {
  const s = surveiller(page);
  await choisirCirconscription(page);
  await page.goto('./#/scrutins/9915');
  await expect(page.locator('a.mon-vote')).toContainText('Froger');
  s.sansErreur();
});

test('fiche d’un député : en-tête et votes', async ({ page }) => {
  const s = surveiller(page);
  await page.goto('./#/deputes/PA822617');
  await expect(page.getByRole('heading', { level: 1, name: 'Martine Froger' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ses deux mesures' })).toBeVisible();
  await page.locator('a.ligne-vote').first().click();
  await expect(page).toHaveURL(/#\/scrutins\/\d+$/);
  s.sansErreur();
});

test('carte : la métropole et l’outre-mer sont dessinés', async ({ page }) => {
  const s = surveiller(page);
  await page.goto('./#/carte');
  await expect(page.getByRole('heading', { name: 'La métropole' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'France métropolitaine' })).toBeVisible();
  expect(await page.locator('svg.carte path').count()).toBeGreaterThan(500);
  s.sansErreur();
});

test('présence : la frise de la séance s’affiche', async ({ page }) => {
  const s = surveiller(page);
  await page.goto('./#/presence');
  await expect(page.getByRole('heading', { name: 'La séance, jour par jour' })).toBeVisible();
  s.sansErreur();
});

test('comment travaille l’Assemblée : le sommaire mène aux sections', async ({ page }) => {
  const s = surveiller(page);
  await page.goto('./#/comprendre');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect(await page.getByRole('heading', { level: 2 }).count()).toBeGreaterThan(3);
  s.sansErreur();
});

test('données indisponibles : un message clair plutôt qu’une page blanche', async ({ page }) => {
  await page.route('**/data/scrutins.json*', (route) => route.fulfill({ status: 503, body: '' }));
  await page.goto('./#/scrutins');
  await expect(page.locator('.etat.erreur')).toBeVisible();
});
