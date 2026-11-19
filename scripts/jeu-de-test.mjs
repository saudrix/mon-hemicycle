// Extrait des vraies données (public/data) un petit jeu figé pour les tests de bout en bout
// (tests/fixtures/data). Les données complètes pèsent des dizaines de Mo et changent chaque
// jour : les parcours tournent sur cet extrait, cohérent et versionné.
//
// Usage : npm run data, puis node scripts/jeu-de-test.mjs
// À relancer quand le format des données change ; les tests disent alors ce qui a bougé.

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SOURCE = 'public/data';
const CIBLE = 'tests/fixtures/data';
// Département gardé en entier : ses députés, leurs fiches et les contours des circonscriptions.
const DEPARTEMENT = '09';
const DERNIERS_SCRUTINS = 150;

const lire = (f) => JSON.parse(readFileSync(join(SOURCE, f), 'utf8'));
const ecrire = (f, v) => {
  mkdirSync(join(CIBLE, f, '..'), { recursive: true });
  writeFileSync(join(CIBLE, f), JSON.stringify(v));
};

rmSync(CIBLE, { recursive: true, force: true });
mkdirSync(CIBLE, { recursive: true });

// Tels quels : petits, ou indispensables entiers (meta.json numérote les députés).
for (const f of ['meta.json', 'carte.json', 'commissions.json', 'indicateurs.json']) {
  if (existsSync(join(SOURCE, f))) cpSync(join(SOURCE, f), join(CIBLE, f));
}
cpSync(join(SOURCE, 'circonscriptions', `${DEPARTEMENT}.json`), join(CIBLE, 'circonscriptions', `${DEPARTEMENT}.json`));

// Scrutins : les plus récents, plus toutes les motions de censure.
const { dossiers, scrutins } = lire('scrutins.json');
const gardes = scrutins.filter((s, i) => i < DERNIERS_SCRUTINS || s[2] === 'MOC');
const nums = new Set(gardes.map((s) => s[0]));
const dossiersGardes = new Set(gardes.map((s) => s[9]).filter(Boolean));
ecrire('scrutins.json', {
  dossiers: Object.fromEntries(Object.entries(dossiers).filter(([id]) => dossiersGardes.has(id))),
  scrutins: gardes,
});

const morceaux = new Map();
for (const num of nums) {
  const m = Math.floor(num / 250);
  if (!morceaux.has(m)) morceaux.set(m, { source: lire(`scrutins/${m}.json`), garde: {} });
  morceaux.get(m).garde[num] = morceaux.get(m).source[num];
}
for (const [m, { garde }] of morceaux) ecrire(`scrutins/${m}.json`, garde);

const textes = lire('textes.json');
ecrire('textes.json', Object.fromEntries(Object.entries(textes).filter(([id]) => dossiersGardes.has(id))));

// Députés du département, avec leurs seuls votes sur les scrutins gardés.
const meta = lire('meta.json');
for (const d of meta.deputes.filter((d) => d.depNum === DEPARTEMENT)) {
  const activite = lire(`deputes/${d.id}.json`);
  ecrire(`deputes/${d.id}.json`, { ...activite, votes: activite.votes.filter(([num]) => nums.has(num)) });
}

// Présence : les deux derniers mois.
const { jours } = lire('presence.json');
ecrire('presence.json', { jours: jours.slice(-40) });

console.log(`Jeu de test écrit dans ${CIBLE} : ${gardes.length} scrutins, ${dossiersGardes.size} textes.`);
