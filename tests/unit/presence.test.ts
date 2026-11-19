// Calculs de présence et rattachement à la circonscription choisie.

import { describe, expect, test } from 'vitest';
import {
  cumuler,
  deputeDuChoix,
  enMandat,
  positionDe,
  presenceParDepute,
  tauxCommission,
  tauxVote,
  type Depute,
  type JourPresence,
  type Meta,
  type ScrutinDetail,
} from '../../src/data';

const depute = (id: string, periodes: Depute['periodes'], extra: Partial<Depute> = {}): Depute => ({
  id,
  civ: 'Mme',
  prenom: 'Prénom',
  nom: id,
  groupe: 'G1',
  dep: 'Ariège',
  depNum: '09',
  circo: 1,
  region: 'Occitanie',
  actif: true,
  place: 1,
  periodes,
  ...extra,
});

const meta = (deputes: Depute[]): Meta => ({ genereLe: 'x', legislature: '17', dernierScrutin: '2025-01-01', groupes: {}, deputes }) as Meta;

describe('enMandat', () => {
  const d = depute('A', [['2024-07-18', '2024-12-31'], ['2025-06-01', null]]);
  test.each([
    ['2024-07-18', true],
    ['2024-12-31', true],
    ['2025-03-01', false],
    ['2026-01-01', true],
  ])('%s', (date, attendu) => expect(enMandat(d, date)).toBe(attendu));
});

describe('presenceParDepute', () => {
  // A siège tout le temps, B arrive le 2 janvier : le scrutin du 1er ne lui est pas compté.
  const m = meta([depute('A', [['2024-07-18', null]]), depute('B', [['2025-01-02', null]])]);
  const jours: JourPresence[] = [
    { date: '2025-01-01', n: 4, v: { 0: 3 }, com: { 0: [1, 0, 0] } },
    { date: '2025-01-02', n: 2, v: { 0: 2, 1: 1 }, com: { 1: [0, 1, 1] } },
  ];
  const taux = presenceParDepute(m, jours);

  test('ne compte que les scrutins tenus pendant le mandat', () => {
    expect(taux[0]).toMatchObject({ votes: 5, scrutins: 6, present: 1 });
    expect(taux[1]).toMatchObject({ votes: 1, scrutins: 2, present: 0, excuse: 1, absent: 1 });
    expect(tauxVote(taux[1])).toBe(0.5);
    expect(tauxCommission(taux[1])).toBe(0);
  });

  test('sans scrutin ni réunion, pas de taux (et non 0 %)', () => {
    expect(tauxVote({ votes: 0, scrutins: 0, present: 0, excuse: 0, absent: 0 })).toBeNull();
    expect(tauxCommission({ votes: 0, scrutins: 0, present: 0, excuse: 0, absent: 0 })).toBeNull();
  });

  test('cumul par groupe : additionne et compte les députés', () => {
    const parGroupe = cumuler(taux, () => 'G1');
    expect(parGroupe.get('G1')).toMatchObject({ votes: 6, scrutins: 8, deputes: 2 });
  });
});

describe('deputeDuChoix', () => {
  const ancien = depute('ANCIEN', [['2024-07-18', '2025-01-01']], { actif: false });
  const actuel = depute('ACTUEL', [['2025-01-02', null]]);
  const m = meta([ancien, actuel]);

  test('retient le député en mandat, pas son prédécesseur', () => {
    expect(deputeDuChoix(m, { depNum: '09', circo: 1, label: '' })?.id).toBe('ACTUEL');
  });

  test('circonscription vacante ou pas de choix : personne', () => {
    expect(deputeDuChoix(m, { depNum: '09', circo: 2, label: '' })).toBeNull();
    expect(deputeDuChoix(m, null)).toBeNull();
  });
});

test('positionDe : retrouve le vote d’un député dans les groupes', () => {
  const detail = { grp: [['G1', 3, 1, 1, 0, 1, 'p', { p: [0], c: [2], a: [], n: [5] }]] } as unknown as ScrutinDetail;
  expect(positionDe(detail, 0)).toBe('p');
  expect(positionDe(detail, 5)).toBe('n');
  expect(positionDe(detail, 9)).toBeUndefined();
});
