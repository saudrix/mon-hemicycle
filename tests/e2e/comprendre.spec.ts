// Lot 2 « comprendre » : la fiche d'un scrutin se lit de haut en bas, et la page
// « Comment travaille l'Assemblée » donne les chiffres de la législature.

import { expect, surveiller, test } from './outils';

test('fiche d’un scrutin : le résultat expliqué, puis toute la salle avec les absents', async ({ page }) => {
  const s = surveiller(page);
  await page.goto('./#/scrutins/9915');
  await expect(page.getByText('Rejeté parce qu’il y a plus de voix contre (67) que pour (28). Les 2 abstentions ne comptent pas.')).toBeVisible();

  // Ce que ça change vient avant le détail de la salle.
  const titres = await page.getByRole('heading', { level: 2 }).allInnerTexts();
  expect(titres.indexOf('Ce que ça change')).toBeLessThan(titres.indexOf('Toute la salle'));

  // La légende reprend le décompte officiel, et compte les absents.
  const salle = page.locator('section.bloc-salle');
  await expect(salle.locator('.t-c')).toHaveText(/67 contre/);
  await expect(salle.locator('.t-n')).toHaveText(/2 non-votants/);
  const absents = await salle.locator('.t-vide').innerText();
  expect(Number(absents.match(/\d+/)![0])).toBeGreaterThan(400);
  s.sansErreur();
});

test('fiche d’un texte : les étapes en clair et le lien vers le chemin d’une loi', async ({ page }) => {
  const s = surveiller(page);
  await page.goto('./#/textes/DLR5L17N54608');
  await expect(page.getByRole('heading', { name: 'Le parcours' })).toBeVisible();
  await expect(page.getByText('Adopté', { exact: true }).first()).toBeVisible();
  await page.getByRole('link', { name: /Le chemin d’une loi, étape par étape/ }).click();
  await expect(page).toHaveURL(/#\/comprendre\/loi$/);
  s.sansErreur();
});

test('comment travaille l’Assemblée : chaque section commence par l’essentiel et ses chiffres', async ({ page }) => {
  const s = surveiller(page);
  await page.goto('./#/comprendre');
  expect(await page.locator('.en-bref').count()).toBeGreaterThan(3);
  await expect(page.locator('.chiffres-cles').first()).toContainText('lois promulguées');
  await expect(page.getByText('150', { exact: true })).toBeVisible();
  s.sansErreur();
});
