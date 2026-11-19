// Construit l'application pour les tests de bout en bout, servie avec le jeu de données
// figé (tests/fixtures/data) à la place des données complètes.

import { execSync } from 'node:child_process';
import { cpSync, rmSync } from 'node:fs';

const SORTIE = 'dist-e2e';
// Sans Worker de notifications : les tests ne dépendent d'aucun service extérieur
// (une adresse posée dans .env.local serait sinon reprise).
execSync(`npx vite build --outDir ${SORTIE} --emptyOutDir`, {
  stdio: 'inherit',
  env: { ...process.env, VITE_API_URL: '' },
});
rmSync(`${SORTIE}/data`, { recursive: true, force: true });
cpSync('tests/fixtures/data', `${SORTIE}/data`, { recursive: true });
