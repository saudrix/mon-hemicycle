// Contrôle les fichiers produits par build-data.mjs avant leur mise en ligne.
//
// Le déploiement du matin publie sans relecture : si l'open data arrive vide, tronqué ou
// dans un format qui a changé, ce contrôle échoue, le déploiement s'arrête, et le site
// garde les données de la veille.
//
// Usage : node scripts/verifier-donnees.mjs [dossier] [--jeu-reduit]
//   --jeu-reduit : jeu de données des tests (tests/fixtures/data), seuils de volume ignorés.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const DOSSIER = args.find((a) => !a.startsWith('--')) ?? 'public/data';
const reduit = args.includes('--jeu-reduit');

const erreurs = [];
const verifier = (ok, message) => {
  if (!ok) erreurs.push(message);
};
/** Seuil de volume, ignoré pour le jeu réduit des tests. */
const auMoins = (n, min, quoi) => verifier(reduit || n >= min, `${quoi} : ${n}, au moins ${min} attendus`);

function lire(fichier) {
  const chemin = join(DOSSIER, fichier);
  if (!existsSync(chemin)) {
    erreurs.push(`${fichier} manquant`);
    return null;
  }
  try {
    return JSON.parse(readFileSync(chemin, 'utf8'));
  } catch (e) {
    erreurs.push(`${fichier} illisible : ${e.message}`);
    return null;
  }
}

const estDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

// ---------- Députés ----------

const meta = lire('meta.json');
if (meta) {
  verifier(!Number.isNaN(Date.parse(meta.genereLe)), 'meta.json : date de génération absente');
  verifier(estDate(meta.dernierScrutin), 'meta.json : date du dernier scrutin absente');
  const deputes = Array.isArray(meta.deputes) ? meta.deputes : [];
  const actifs = deputes.filter((d) => d.actif);
  auMoins(deputes.length, 577, 'Députés de la législature');
  // 577 sièges ; quelques-uns peuvent être vacants entre un départ et une élection partielle.
  verifier(actifs.length <= 577, `Députés en mandat : ${actifs.length}, plus que les 577 sièges`);
  auMoins(actifs.length, 560, 'Députés en mandat');
  auMoins(Object.keys(meta.groupes ?? {}).length, 5, 'Groupes politiques');
  for (const d of deputes) {
    if (!d.id || !d.nom || !Array.isArray(d.periodes) || !d.periodes.length) {
      erreurs.push(`meta.json : député incomplet ${JSON.stringify(d).slice(0, 80)}`);
      break;
    }
  }
  const sieges = new Set(actifs.filter((d) => d.depNum && d.circo).map((d) => `${d.depNum}-${d.circo}`));
  verifier(sieges.size === actifs.filter((d) => d.depNum && d.circo).length, 'Deux députés en mandat sur la même circonscription');
  for (const d of reduit ? [] : deputes) {
    if (!existsSync(join(DOSSIER, 'deputes', `${d.id}.json`))) {
      erreurs.push(`deputes/${d.id}.json manquant`);
      break;
    }
  }
}

// ---------- Scrutins ----------

const index = lire('scrutins.json');
if (index && meta) {
  const scrutins = Array.isArray(index.scrutins) ? index.scrutins : [];
  auMoins(scrutins.length, 1000, 'Scrutins');
  const nums = new Set();
  let anomalie = null;
  for (const s of scrutins) {
    const [num, date, type, adopte, titre, pour, contre, abs] = s;
    if (!Number.isInteger(num) || !estDate(date) || !type || (adopte !== 0 && adopte !== 1) || !titre) anomalie ??= `scrutin mal formé ${JSON.stringify(s).slice(0, 80)}`;
    else if (pour + contre + abs > 577) anomalie ??= `scrutin ${num} : plus de 577 votants`;
    else if (nums.has(num)) anomalie ??= `scrutin ${num} en double`;
    nums.add(num);
  }
  if (anomalie) erreurs.push(`scrutins.json : ${anomalie}`);
  verifier(scrutins.some((s) => s[1] === meta.dernierScrutin), 'Le dernier scrutin annoncé par meta.json est absent de la liste');
  // Hors suspension estivale, l'Assemblée vote chaque semaine : des données vieilles de
  // plusieurs mois signalent un open data qui ne se met plus à jour.
  const age = (Date.now() - Date.parse(meta.dernierScrutin)) / 86_400_000;
  verifier(reduit || age < 120, `Dernier scrutin vieux de ${Math.round(age)} jours`);
  // Chaque scrutin de la liste doit avoir son détail (votes nominatifs).
  const morceaux = new Map();
  for (const num of reduit ? [] : nums) {
    const m = Math.floor(num / 250);
    if (!morceaux.has(m)) morceaux.set(m, lire(`scrutins/${m}.json`) ?? {});
    if (!morceaux.get(m)[num]) {
      erreurs.push(`Détail du scrutin ${num} absent de scrutins/${m}.json`);
      break;
    }
  }
}

// ---------- Textes, présence, carte ----------

const textes = lire('textes.json');
if (textes) auMoins(Object.keys(textes).length, 100, 'Textes de loi');

const presence = lire('presence.json');
if (presence) auMoins(presence.jours?.length ?? 0, 100, 'Jours de présence');

const carte = lire('carte.json');
if (carte) {
  const circos = Object.values(carte).reduce((n, zone) => n + (zone.circos?.length ?? 0), 0);
  auMoins(circos, 577, 'Circonscriptions dessinées sur la carte');
}

const commissions = lire('commissions.json');
if (commissions) auMoins(Object.keys(commissions).length, 50, 'Commissions et organes');

const dossierCircos = join(DOSSIER, 'circonscriptions');
auMoins(existsSync(dossierCircos) ? readdirSync(dossierCircos).length : 0, 100, 'Départements (contours des circonscriptions)');

// ---------- Bilan ----------

if (erreurs.length) {
  console.error(`✗ Données refusées (${DOSSIER}) :`);
  for (const e of erreurs) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`✓ Données vérifiées (${DOSSIER})`);
