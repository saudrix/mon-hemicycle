// Les organes de l'Assemblée où se réunissent les députés : commissions, délégations, groupes d'amitié…
// Un type par famille, avec ce qu'il faut en dire en deux phrases et s'il compte dans le taux de présence.

/** Organe tel qu'écrit par scripts/build-data.mjs dans commissions.json. */
export type Organe = {
  /** nom court */
  n: string;
  /** type dans l'open data (COMPER, CNPS, GA…) */
  t: string;
  /** membres en fonction (députés siégeant aujourd'hui) */
  m: number | null;
  /** président, s'il est député */
  p: string | null;
};

export type TypeOrgane =
  | 'permanente'
  | 'speciale'
  | 'cmp'
  | 'enquete'
  | 'europe'
  | 'controle'
  | 'delegation'
  | 'mission'
  | 'office'
  | 'amitie'
  | 'etudes'
  | 'autre';

export const TYPES_ORGANE: Record<TypeOrgane, { libelle: string; resume: string; compte: boolean }> = {
  permanente: {
    libelle: 'Commission permanente',
    resume: 'Examine les textes de loi avant la séance et contrôle le Gouvernement dans son domaine. Chaque député siège dans une seule des huit commissions permanentes.',
    compte: true,
  },
  speciale: {
    libelle: 'Commission spéciale',
    resume: 'Créée pour examiner un seul texte, à la place d’une commission permanente, quand il touche plusieurs domaines. Elle disparaît une fois le texte voté.',
    compte: true,
  },
  cmp: {
    libelle: 'Commission mixte paritaire',
    resume: 'Sept députés et sept sénateurs cherchent un texte commun quand les deux chambres ne sont pas d’accord. Ses membres sont désignés pour un seul texte.',
    compte: false,
  },
  enquete: {
    libelle: 'Commission d’enquête',
    resume: 'Enquête pendant six mois au plus sur un sujet précis, avec le pouvoir de convoquer qui elle veut. Trente députés au plus, en plus de leur commission permanente.',
    compte: false,
  },
  europe: {
    libelle: 'Commission des affaires européennes',
    resume: 'Suit les projets de textes européens et peut proposer des résolutions. Ses membres siègent aussi dans une commission permanente.',
    compte: false,
  },
  controle: {
    libelle: 'Organe de contrôle',
    resume: 'Évalue les politiques publiques ou contrôle le fonctionnement de l’Assemblée, sans examiner les textes de loi.',
    compte: false,
  },
  delegation: {
    libelle: 'Délégation',
    resume: 'Suit un sujet transversal (droits des femmes, droits des enfants, outre-mer, collectivités) et rend des rapports. Elle n’examine pas les lois.',
    compte: false,
  },
  mission: {
    libelle: 'Mission d’information',
    resume: 'Groupe de travail temporaire qui étudie un sujet et rend un rapport. Quelques députés désignés, en plus de leur commission.',
    compte: false,
  },
  office: {
    libelle: 'Office parlementaire',
    resume: 'Organe commun à l’Assemblée et au Sénat qui éclaire le Parlement sur les choix scientifiques et technologiques.',
    compte: false,
  },
  amitie: {
    libelle: 'Groupe d’amitié',
    resume: 'Entretient les liens avec le parlement d’un pays. Adhésion libre, sans rôle dans le vote des lois.',
    compte: false,
  },
  etudes: {
    libelle: 'Groupe d’études international',
    resume: 'Suit un pays ou un territoire avec lequel un groupe d’amitié n’est pas possible. Adhésion libre, sans rôle dans le vote des lois.',
    compte: false,
  },
  autre: {
    libelle: 'Autre réunion',
    resume: 'Réunion d’un organe de l’Assemblée qui n’examine pas les textes de loi.',
    compte: false,
  },
};

export function typeOrgane(o: Organe | undefined): TypeOrgane {
  switch (o?.t) {
    case 'COMPER':
      return 'permanente';
    case 'CNPS':
      return 'speciale';
    case 'CMP':
      return 'cmp';
    case 'CNPE':
      return 'enquete';
    case 'COMNL':
      return /europ/i.test(o.n) ? 'europe' : 'controle';
    case 'DELEG':
      return 'delegation';
    case 'MISINFO':
    case 'MISINFOPRE':
      return 'mission';
    case 'OFFPAR':
      return 'office';
    case 'GA':
      return 'amitie';
    case 'GEVI':
      return 'etudes';
    default:
      return 'autre';
  }
}
