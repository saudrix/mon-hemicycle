// Lecture d'un scrutin en langage clair : nature du vote, texte concerné, portée du résultat.
// Tout est déduit du titre officiel, rédigé par l'Assemblée selon des formules stables.

export type Nature =
  | 'amendement'
  | 'sous-amendement'
  | 'article'
  | 'partie'
  | 'ensemble'
  | 'censure'
  | 'rejet'
  | 'renvoi'
  | 'motion'
  | 'declaration'
  | 'resolution'
  | 'autre';

const NATURES: [RegExp, Nature][] = [
  [/^(l['’]amendement|les amendements)/i, 'amendement'],
  [/^(le|les) sous-amendements?/i, 'sous-amendement'],
  [/^l['’]ensemble de la proposition de résolution/i, 'resolution'],
  [/^la proposition de résolution/i, 'resolution'],
  [/^l['’]ensemble/i, 'ensemble'],
  [/^(la|le) (proposition|projet) de loi/i, 'ensemble'],
  [/^l['’]article/i, 'article'],
  [/^la (première|deuxième|troisième|quatrième|seconde) partie/i, 'partie'],
  [/^la motion de censure/i, 'censure'],
  [/^la motion de rejet p\w*alable/i, 'rejet'],
  [/^la motion de renvoi en commission/i, 'renvoi'],
  [/^la motion/i, 'motion'],
  [/^la déclaration du gouvernement/i, 'declaration'],
];

export const natureDe = (titre: string): Nature => NATURES.find(([re]) => re.test(titre))?.[1] ?? 'autre';

/** Amendements et sous-amendements : masqués par défaut dans les listes. */
export const estAmendement = (n: Nature) => n === 'amendement' || n === 'sous-amendement';

export const LIBELLES_NATURE: Record<Nature, string> = {
  amendement: 'Amendement',
  'sous-amendement': 'Sous-amendement',
  article: 'Article',
  partie: 'Partie du texte',
  ensemble: 'Ensemble du texte',
  censure: 'Motion de censure',
  rejet: 'Motion de rejet',
  renvoi: 'Renvoi en commission',
  motion: 'Motion',
  declaration: 'Déclaration du Gouvernement',
  resolution: 'Résolution',
  autre: 'Autre vote',
};

const majuscule = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Découpe le titre officiel :
 * « L'amendement n° 1022 de M. Fournier après l'article 15 du projet de loi de finances pour 2027 (première lecture). »
 * -> objet « Amendement n° 1022 de M. Fournier après l'article 15 », texte « Projet de loi de finances pour 2027 »,
 *    lecture « première lecture ».
 */
export function decouper(titre: string) {
  const t = titre.replace(/\.$/, '').replace(/’/g, "'");
  const lectureM = t.match(/\(((?:première|deuxième|troisième|nouvelle) lecture|lecture définitive|lecture unique|texte de la commission mixte paritaire)\)\s*$/i);
  const lecture = lectureM?.[1] ?? null;
  const sansLecture = lectureM ? t.slice(0, lectureM.index).trim() : t;
  const citeM = sansLecture.match(/(?:,\s*)?(?:(?<=\s)(?:du|de la|de l'|au|à la|sur le|sur la)\s+|\()((?:projet|proposition) de (?:loi|résolution).*?)\)?$/i);
  const entier = sansLecture.match(/^(?:la|le) ((?:projet|proposition) de (?:loi|résolution).*)$/i);
  const texte = citeM ? majuscule(citeM[1]) : entier ? majuscule(entier[1]) : null;
  let objet = (citeM ? sansLecture.slice(0, citeM.index) : sansLecture).trim().replace(/,$/, '');
  const nature = natureDe(t);
  if (nature === 'ensemble' || nature === 'resolution') objet = 'Vote sur l’ensemble du texte';
  else objet = majuscule(objet.replace(/^(l'|la |le |les )/i, ''));
  return { nature, objet: objet || majuscule(sansLecture), texte, lecture };
}

/** Ce que change le résultat du vote, en une ou deux phrases. */
export function portee(nature: Nature, adopte: boolean, lecture: string | null): string | null {
  const l = lecture?.toLowerCase() ?? '';
  switch (nature) {
    case 'amendement':
      return adopte
        ? 'La modification proposée est intégrée au texte. Le texte devra encore être voté dans son ensemble.'
        : 'Le texte reste inchangé sur ce point.';
    case 'sous-amendement':
      return adopte
        ? 'L’amendement auquel il se rattache est modifié avant d’être lui-même mis aux voix.'
        : 'L’amendement auquel il se rattache reste inchangé.';
    case 'article':
      return adopte
        ? 'L’article est maintenu dans le texte, avec les amendements adoptés.'
        : 'L’article est supprimé du texte.';
    case 'partie':
      return adopte
        ? 'Cette partie du texte est adoptée ; l’examen se poursuit.'
        : 'Cette partie du texte est rejetée.';
    case 'ensemble':
      if (!adopte) return 'L’Assemblée rejette le texte à cette étape de son parcours.';
      if (l.includes('définitive')) return 'Le Parlement adopte définitivement le texte : il peut être promulgué.';
      if (l.includes('commission mixte paritaire'))
        return 'L’Assemblée adopte le compromis trouvé entre députés et sénateurs. Le Sénat doit aussi l’adopter pour que le texte soit définitif.';
      return 'L’Assemblée adopte le texte à cette étape. Il poursuit ensuite son parcours (Sénat, commission mixte paritaire) jusqu’à son adoption définitive.';
    case 'resolution':
      return adopte
        ? 'L’Assemblée adopte la résolution : elle exprime une position, sans valeur de loi.'
        : 'L’Assemblée rejette la résolution.';
    case 'censure':
      return adopte
        ? 'Le Gouvernement est renversé : il doit remettre sa démission.'
        : 'Le Gouvernement reste en place. Si la motion répondait à un recours au 49.3, le texte concerné est considéré comme adopté.';
    case 'rejet':
      return adopte
        ? 'Le texte est rejeté sans être examiné article par article.'
        : 'L’Assemblée passe à l’examen du texte.';
    case 'renvoi':
      return adopte
        ? 'Le texte retourne en commission : son examen en séance est interrompu.'
        : 'L’examen du texte se poursuit en séance.';
    case 'declaration':
      return 'Ce vote exprime l’avis des députés sur une déclaration du Gouvernement (article 50-1 de la Constitution). Il n’engage pas sa responsabilité.';
    default:
      return null;
  }
}
