// Lecture des titres officiels de scrutin : chaque cas reprend un titre réel de l'open data.

import { describe, expect, test } from 'vitest';
import { decouper, estAmendement, natureDe, portee } from '../../src/lecture';

describe('decouper', () => {
  test('amendement : objet, texte et lecture séparés', () => {
    expect(
      decouper(
        "L'amendement n° 781 de M. Piquemal à l'article premier du projet de loi visant la relance et la décentralisation du logement (première lecture).",
      ),
    ).toEqual({
      nature: 'amendement',
      objet: "Amendement n° 781 de M. Piquemal à l'article premier",
      texte: 'Projet de loi visant la relance et la décentralisation du logement',
      lecture: 'première lecture',
    });
  });

  test('ensemble du texte après commission mixte paritaire', () => {
    expect(
      decouper(
        "L'ensemble de la proposition de loi visant à renforcer l'effectivité des droits voisins des éditeurs et des agences de presse (texte de la commission mixte paritaire).",
      ),
    ).toEqual({
      nature: 'ensemble',
      objet: 'Vote sur l’ensemble du texte',
      texte: "Proposition de loi visant à renforcer l'effectivité des droits voisins des éditeurs et des agences de presse",
      lecture: 'texte de la commission mixte paritaire',
    });
  });

  test('lecture définitive', () => {
    const d = decouper("L'ensemble de la proposition de loi relative au droit à l'aide à mourir (lecture définitive).");
    expect(d.lecture).toBe('lecture définitive');
    expect(d.texte).toBe("Proposition de loi relative au droit à l'aide à mourir");
  });

  test('article et partie', () => {
    expect(decouper("L'article 8 du projet de loi de finances de fin de gestion pour 2026 (première lecture).")).toMatchObject({
      nature: 'article',
      objet: 'Article 8',
      texte: 'Projet de loi de finances de fin de gestion pour 2026',
    });
    expect(decouper('La première partie du projet de loi de finances pour 2027 (première lecture).')).toMatchObject({
      nature: 'partie',
      objet: 'Première partie',
      texte: 'Projet de loi de finances pour 2027',
    });
  });

  test("coquille « L'aticle » de l'open data : reconnue comme un article", () => {
    expect(
      decouper("L'aticle 6 du projet de loi sur la justice criminelle et le respect des victimes (première lecture)."),
    ).toMatchObject({ nature: 'article', texte: 'Projet de loi sur la justice criminelle et le respect des victimes' });
  });

  test('motion de rejet : le texte visé est retrouvé', () => {
    expect(
      decouper(
        "La motion de rejet préalable, déposée par Mme Mathilde Panot, de la proposition de loi visant au renforcement de l'attractivité de l'épargne salariale et à la mise en œuvre d'une procédure de déblocage exceptionnelle (première lecture).",
      ),
    ).toMatchObject({
      nature: 'rejet',
      objet: 'Motion de rejet préalable, déposée par Mme Mathilde Panot',
      texte:
        "Proposition de loi visant au renforcement de l'attractivité de l'épargne salariale et à la mise en œuvre d'une procédure de déblocage exceptionnelle",
    });
  });

  test('motion de censure : pas de texte ni de lecture', () => {
    expect(
      decouper(
        "La motion de censure déposée en application de l'article 49, alinéa 3, de la Constitution par Mme Marine Le Pen, M. Éric Ciotti et 104 députés.",
      ),
    ).toMatchObject({ nature: 'censure', texte: null, lecture: null });
  });
});

describe('natureDe', () => {
  test.each([
    ['Le sous-amendement n° 25 de Mme Létard à l’amendement n° 1', 'sous-amendement'],
    ['Les amendements identiques n° 12 et 45', 'amendement'],
    ['La proposition de résolution invitant le Gouvernement à agir', 'resolution'],
    ['La motion de renvoi en commission de la proposition de loi', 'renvoi'],
    ['La déclaration du Gouvernement portant sur la lutte contre le narcotrafic', 'declaration'],
    ['Le projet de loi constitutionnelle', 'ensemble'],
    ['Un titre inconnu', 'autre'],
  ] as const)('%s', (titre, nature) => {
    expect(natureDe(titre)).toBe(nature);
  });

  test('seuls amendements et sous-amendements sont masqués par défaut', () => {
    expect(estAmendement('amendement')).toBe(true);
    expect(estAmendement('sous-amendement')).toBe(true);
    expect(estAmendement('article')).toBe(false);
  });
});

describe('portee', () => {
  test('motion de censure rejetée sur un 49.3 : le texte est considéré comme adopté', () => {
    const p = portee('censure', false, null, "La motion de censure déposée en application de l'article 49, alinéa 3, de la Constitution");
    expect(p).toContain('reste en place');
    expect(p).toContain('considéré comme adopté');
  });

  test('motion de censure adoptée : le Gouvernement est renversé', () => {
    expect(portee('censure', true, null)).toContain('renversé');
  });

  test('ensemble rejeté en lecture définitive : rejet définitif', () => {
    expect(portee('ensemble', false, 'lecture définitive')).toBe('L’Assemblée rejette définitivement le texte.');
  });

  test("loi organique adoptée définitivement : passage obligé au Conseil constitutionnel", () => {
    expect(portee('ensemble', true, 'lecture définitive', 'Le projet de loi organique relatif à…')).toContain(
      'doit être examiné par le Conseil constitutionnel',
    );
    expect(portee('ensemble', true, 'lecture définitive', 'La proposition de loi relative à…')).toContain(
      'peut encore être soumis',
    );
  });

  test('ensemble adopté en première lecture : rien de définitif annoncé', () => {
    const p = portee('ensemble', true, 'première lecture')!;
    expect(p).toContain('pas encore définitif');
  });

  test('déclaration 50-1 : pas de mise en jeu de la responsabilité', () => {
    expect(portee('declaration', true, null, 'La déclaration du Gouvernement (article 50-1)')).toContain(
      'n’engage pas sa responsabilité',
    );
  });

  test('vote non reconnu : pas de phrase inventée', () => {
    expect(portee('autre', true, null)).toBeNull();
  });
});
