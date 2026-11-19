// Lot 2 « comprendre » : étapes d'un texte en clair et indicateurs de la législature.

import { describe, expect, test } from 'vitest';
import { libelleIssue } from '../../src/lecture';
// @ts-expect-error module JavaScript des scripts de données, sans types
import { calculerIndicateurs } from '../../scripts/indicateurs.mjs';

describe('libelleIssue', () => {
  test.each([
    ['adopté', 'Adopté'],
    ['Adoptée sans modification', 'Adopté sans modification'],
    ['modifié', 'Adopté avec des modifications'],
    ['rejeté', 'Rejeté'],
    ['accord', 'Accord sur un texte commun'],
    ['désaccord', 'Pas de texte commun'],
    ['partiellement conforme', 'En partie censuré'],
    ['non conforme', 'Censuré'],
    ['conforme avec réserve', 'Conforme, avec des réserves d’interprétation'],
    ['considéré comme adopté (article 49.3 de la Constitution)', 'Considéré comme adopté, sans vote (49.3)'],
  ])('%s', (issue, libelle) => expect(libelleIssue(issue)).toBe(libelle));

  test('formule inconnue : reprise telle quelle, avec une majuscule', () => {
    expect(libelleIssue('retiré')).toBe('Retiré');
  });
});

describe('calculerIndicateurs', () => {
  const textes = new Map([
    // Loi d'initiative parlementaire : déposée le 1er septembre, promulguée 100 jours après.
    ['DLR5L17N1', { t: 'Loi A', p: 'Proposition de loi ordinaire', i: 'Assemblée', e: [['Assemblée', '1re lecture', '2024-09-01', 'adopté', '2024-10-01'], ['Promulgation', '', '2024-12-10', null, null]] }],
    // Projet du Gouvernement : 200 jours.
    ['DLR5L17N2', { t: 'Loi B', p: 'Projet de loi ordinaire', i: 'Gouvernement', e: [['Sénat', '1re lecture', '2024-10-01', 'adopté', null], ['Promulgation', '', '2025-04-19', null, null]] }],
    // Convention : comptée à part.
    ['DLR5L17N3', { t: 'Accord X', p: 'Projet de loi de ratification', i: 'Gouvernement', e: [['Assemblée', '1re lecture', '2024-09-01', null, null], ['Promulgation', '', '2024-11-01', null, null]] }],
    // Promulguée avant le début de la législature : ignorée.
    ['DLR5L16N4', { t: 'Loi C', p: 'Proposition de loi ordinaire', i: 'Sénat', e: [['Promulgation', '', '2024-05-01', null, null]] }],
    // Deux engagements du 49.3 sur le même texte.
    ['DLR5L17N5', { t: 'Engagement de la responsabilité du Gouvernement sur le projet de loi de finances pour 2025', p: '', i: '', e: [] }],
    ['DLR5L17N6', { t: 'Engagement de la responsabilité du Gouvernement sur le projet de loi de finances pour 2025, seconde partie', p: '', i: '', e: [] }],
  ]);
  const resume = [
    [1, '2024-10-08', 'MOC', 0, 'Motion de censure', 197, 0, 0, 0, null],
    [2, '2024-12-04', 'MOC', 1, 'Motion de censure', 331, 0, 0, 0, null],
    [3, '2025-01-10', 'SPO', 1, 'Amendement', 50, 30, 0, 0, null],
    [4, '2025-01-11', 'SPO', 0, 'Amendement', 100, 120, 10, 0, null],
    [5, '2025-01-12', 'SPS', 1, 'Ensemble', 300, 200, 50, 4, null],
  ];
  const ind = calculerIndicateurs({ textes, resume, debut: '2024-07-18', legislature: '17' });

  test('lois promulguées depuis le début de la législature, conventions à part', () => {
    expect(ind.lois).toEqual({
      promulguees: 3,
      conventions: 1,
      horsConventions: 2,
      projets: 1,
      propositions: 1,
      dureeMedianeJours: 150,
    });
  });

  test('49.3 : chaque engagement compte, les textes une seule fois', () => {
    expect(ind.article493).toEqual({ engagements: 2, textes: ['Projet de loi de finances pour 2025'] });
  });

  test('motions de censure votées et adoptées', () => {
    expect(ind.censure).toEqual({ votees: 2, adoptees: ['2024-12-04'] });
  });

  test('participation médiane, rapportée aux 577 sièges', () => {
    expect(ind.scrutins.ordinaires).toBe(2);
    expect(ind.scrutins.solennels).toBe(1);
    expect(ind.scrutins.participationOrdinaires).toBeCloseTo((80 / 577 + 230 / 577) / 2);
    expect(ind.scrutins.participationSolennels).toBeCloseTo(554 / 577);
  });
});
