// Textes de loi et amendements : relie chaque scrutin au dossier législatif qu'il concerne,
// et chaque scrutin sur un amendement à cet amendement (auteur, exposé sommaire).
//
// L'open data des scrutins ne renseigne le dossier que pour un scrutin sur trois, et jamais
// l'amendement. On les retrouve ainsi :
// - amendement : même numéro, examiné dans la même séance (ou, à défaut, tranché le même jour) ;
// - dossier : celui de l'amendement, sinon celui des textes examinés dans la même séance dont
//   le titre ressemble le plus au texte cité dans le titre du scrutin.

const list = (x) => (x == null ? [] : Array.isArray(x) ? x : [x]);

// ---------- Texte brut ----------

const ENTITES = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ', laquo: '«', raquo: '»', rsquo: '’', oelig: 'œ', eacute: 'é', egrave: 'è', agrave: 'à' };

export function texteBrut(html) {
  return html
    .replace(/<\/(p|div|li|h\d)>|<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&([a-z]+);/gi, (m, e) => ENTITES[e.toLowerCase()] ?? m)
    .replace(/[ \t  ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

// ---------- Amendements ----------

const MAX_EXPOSE = 4000;

/**
 * Index de tous les amendements, sans leur texte (lu ensuite pour les seuls amendements votés) :
 * clés « séance|numéro », « jour|numéro » et « dossier|numéro ».
 */
export function indexerAmendements(forEachJson) {
  const parSeance = new Map();
  const parJour = new Map();
  const parDossier = new Map();
  let n = 0;
  forEachJson((name) => name.includes('/AMANR'), (name, json) => {
    const a = json.amendement;
    n++;
    const num = String(a.identification.numeroLong);
    const [, dossier] = name.split('/');
    const jour = typeof a.cycleDeVie?.dateSort === 'string' ? a.cycleDeVie.dateSort.slice(0, 10) : null;
    const fiche = {
      uid: a.uid,
      fichier: name,
      dossier,
      jour,
      // Premier signataire seulement : la liste complète compte parfois tout un groupe.
      auteur: texteBrut(String(a.signataires?.libelle ?? '')).split(/, | et les membres /)[0],
      signataires: texteBrut(String(a.signataires?.libelle ?? '')).split(', ').length,
      tous: texteBrut(String(a.signataires?.libelle ?? '')),
      groupe: a.signataires?.auteur?.groupePolitiqueRef || null,
      gouvernement: a.signataires?.auteur?.typeAuteur === 'Gouvernement',
      article: a.pointeurFragmentTexte?.division?.articleDesignation ?? null,
    };
    if (typeof a.seanceDiscussionRef === 'string') ajouter(parSeance, `${a.seanceDiscussionRef}|${num}`, fiche);
    if (jour) ajouter(parJour, `${jour}|${num}`, fiche);
    ajouter(parDossier, `${dossier}|${num}`, fiche);
  });
  return { parSeance, parJour, parDossier, n };
}

/** Exposé sommaire des amendements retenus, en texte brut. */
export function lireExposes(forEachJson, fichiers) {
  const exposes = new Map();
  forEachJson((name) => fichiers.has(name), (name, json) => {
    const html = json.amendement.corps?.contenuAuteur?.exposeSommaire;
    const texte = typeof html === 'string' ? texteBrut(html) : '';
    exposes.set(name, texte.length > MAX_EXPOSE ? `${texte.slice(0, MAX_EXPOSE).replace(/\s+\S*$/, '')}…` : texte);
  });
  return exposes;
}

function ajouter(map, cle, valeur) {
  const l = map.get(cle);
  if (l) l.push(valeur);
  else map.set(cle, [valeur]);
}

/** Un seul dossier possible, sinon on préfère ne rien affirmer. */
function unique(fiches) {
  if (!fiches?.length) return null;
  return fiches.every((f) => f.dossier === fiches[0].dossier) ? fiches[0] : null;
}

const sansAccents = (s) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

/**
 * L'auteur cité dans le titre du scrutin (« de Mme Dupont », « du Gouvernement ») doit se retrouver
 * parmi les signataires de l'amendement : écarte les homonymes de numéro d'une autre lecture.
 */
function memeAuteur(titre, fiche) {
  if (/n° ?[\w-]+(?: \(rect\.\))? du Gouvernement/i.test(titre)) return fiche.gouvernement;
  const m = titre.match(/n° ?[\w-]+(?: \(rect\.\))? de (?:M\.|Mme|MM\.|Mmes) (.+?)(?=,| et | à | après | avant | au | aux | sur | de suppression| portant| \()/);
  if (!m) return true;
  const nom = sansAccents(m[1]).split(' ').pop();
  return sansAccents(fiche.tous).includes(nom);
}

// ---------- Dossiers législatifs ----------

/** Étapes affichées dans la frise du parcours. */
const ETAPES = {
  AN1: ['Assemblée', '1re lecture'],
  SN1: ['Sénat', '1re lecture'],
  ANLUNI: ['Assemblée', 'Lecture unique'],
  AN2: ['Assemblée', '2e lecture'],
  SN2: ['Sénat', '2e lecture'],
  AN3: ['Assemblée', '3e lecture'],
  SN3: ['Sénat', '3e lecture'],
  CMP: ['Commission mixte paritaire', 'Députés et sénateurs'],
  ANNLEC: ['Assemblée', 'Nouvelle lecture'],
  SNNLEC: ['Sénat', 'Nouvelle lecture'],
  ANLDEF: ['Assemblée', 'Lecture définitive'],
  CC: ['Conseil constitutionnel', 'Contrôle'],
  PROM: ['Promulgation', 'Publication au Journal officiel'],
};

function datesEtConclusions(actes, dates = [], conclusions = []) {
  for (const a of list(actes)) {
    if (a.dateActe) dates.push(a.dateActe.slice(0, 10));
    if (a.statutConclusion?.libelle) conclusions.push([a.dateActe ?? '', a.statutConclusion.libelle]);
    datesEtConclusions(a.actesLegislatifs?.acteLegislatif, dates, conclusions);
  }
  return { dates, conclusions };
}

/**
 * Auteur du texte d'origine, lu sur l'acte de dépôt initial (pas sur le titre, qui omet souvent
 * « projet de loi ») : PRJL… est un projet du Gouvernement, PION… une proposition, déposée à
 * l'Assemblée (PIONAN…) par des députés ou au Sénat (PIONSN…) par des sénateurs.
 */
function initiative(actes) {
  const depots = [];
  const parcourir = (as) => {
    for (const a of list(as)) {
      if (a['@xsi:type'] === 'DepotInitiative_Type' && a.texteAssocie) depots.push(a);
      parcourir(a.actesLegislatifs?.acteLegislatif);
    }
  };
  parcourir(actes);
  depots.sort((x, y) => (x.dateActe ?? '9').localeCompare(y.dateActe ?? '9'));
  const texte = depots[0]?.texteAssocie ?? '';
  if (texte.startsWith('PRJL')) return 'Gouvernement';
  if (texte.startsWith('PIONAN')) return 'Députés';
  if (texte.startsWith('PIONSN')) return 'Sénateurs';
  return null;
}

/**
 * Dossiers législatifs : titre, procédure, initiative et étapes [lieu, étape, début, issue, date de l'issue].
 * L'initiative est « Gouvernement » pour un projet, « Députés » ou « Sénateurs » pour une proposition.
 */
export function lireDossiers(forEachJson) {
  const dossiers = new Map();
  forEachJson((name) => name.includes('/dossierParlementaire/'), (_, json) => {
    const d = json.dossierParlementaire;
    const procedure = d.procedureParlementaire?.libelle ?? '';
    const etapes = [];
    for (const a of list(d.actesLegislatifs?.acteLegislatif)) {
      const e = ETAPES[a.codeActe];
      if (!e) continue;
      const enfants = list(a.actesLegislatifs?.acteLegislatif);
      const { dates, conclusions } = datesEtConclusions(enfants);
      dates.sort();
      // Date de l'étape : dépôt, saisine ou publication (les nominations de rapporteur peuvent la précéder de loin).
      const debut = enfants.find((x) => x.dateActe && /-(DEPOT|SAISIE|PUB)/.test(x.codeActe))?.dateActe?.slice(0, 10);
      conclusions.sort(([x], [y]) => x.localeCompare(y));
      const conclusion = conclusions.at(-1);
      const issue = conclusion?.[1]?.replace(/^considéré comme adopté.*49, alinéa 3.*$/i, 'considéré comme adopté (49.3)') ?? null;
      // Deux dates : le début de l'étape (dépôt, saisine) et celle de son issue (le vote), affichée avec l'issue.
      etapes.push([e[0], e[1], debut ?? dates[0] ?? null, issue, conclusion?.[0]?.slice(0, 10) || null]);
    }
    const titre = d.titreDossier.titre;
    dossiers.set(d.uid, {
      t: titre,
      p: procedure,
      i: initiative(d.actesLegislatifs?.acteLegislatif) ?? (/^projet/i.test(titre) ? 'Gouvernement' : /^proposition/i.test(titre) ? 'Députés' : null),
      e: etapes.sort((x, y) => (x[2] ?? '9').localeCompare(y[2] ?? '9')),
    });
  });
  return dossiers;
}

// ---------- Rattachement des scrutins ----------

const MOTS_VIDES = new Set(['pour', 'dans', 'avec', 'sans', 'visant', 'relative', 'relatif', 'portant', 'diverses', 'dispositions', 'projet', 'proposition', 'lecture', 'première', 'deuxième', 'nouvelle', 'loi', 'texte']);
const mots = (s) =>
  new Set(
    s
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((m) => m.length >= 4 && !MOTS_VIDES.has(m)),
  );

/** Partie du titre du scrutin qui cite le texte : « … du projet de loi de finances pour 2027 (première lecture) ». */
function texteCite(titre) {
  const m = titre.match(/\b(?:du|de la|de l'|au|à la) ((?:projet|proposition) de (?:loi|résolution)[\s\S]*)$/i);
  return m ? m[1] : null;
}

function ressemblance(a, b) {
  let commun = 0;
  for (const m of a) if (b.has(m)) commun++;
  return a.size && b.size ? commun / Math.min(a.size, b.size) : 0;
}

/**
 * Pour chaque scrutin : { dossier, amendement }.
 * scrutins : [{ num, titre, date, seance, dossierRef }]
 */
export function rattacher(scrutins, amendements, dossiers) {
  const resultat = new Map();
  const dossiersDeSeance = new Map();
  const noter = (seance, dossier) => {
    if (!dossier) return;
    if (!dossiersDeSeance.has(seance)) dossiersDeSeance.set(seance, new Set());
    dossiersDeSeance.get(seance).add(dossier);
  };

  // 1. Amendements, et dossiers déjà renseignés par l'open data.
  for (const s of scrutins) {
    const m = s.titre.match(/^(?:l'amendement|le sous-amendement) n° ?([\w-]+)/i);
    let amendement = null;
    if (m) {
      const filtre = (l) => l?.filter((f) => memeAuteur(s.titre, f) && (!s.dossierRef || f.dossier === s.dossierRef));
      amendement =
        unique(filtre(amendements.parSeance.get(`${s.seance}|${m[1]}`))) ??
        unique(filtre(amendements.parJour.get(`${s.date}|${m[1]}`)));
    }
    const dossier = s.dossierRef ?? amendement?.dossier ?? null;
    resultat.set(s.num, { dossier, amendement });
    noter(s.seance, dossier);
  }

  // 2. Scrutins restants : le texte de la séance dont le titre ressemble le plus au texte cité.
  // Seuls les dossiers passés en séance (pas les rapports, qui reprennent souvent le titre du texte).
  const motsDossier = new Map([...dossiers].filter(([, d]) => d.e.length).map(([uid, d]) => [uid, mots(d.t)]));
  for (const s of scrutins) {
    const r = resultat.get(s.num);
    if (r.dossier) continue;
    const cite = texteCite(s.titre);
    const candidats = [...(dossiersDeSeance.get(s.seance) ?? [])];
    if (candidats.length === 1 && !cite) {
      r.dossier = candidats[0];
      continue;
    }
    if (!cite) continue;
    const m = mots(cite);
    let meilleur = null;
    let score = 0;
    for (const uid of candidats.length ? candidats : motsDossier.keys()) {
      const x = ressemblance(m, motsDossier.get(uid) ?? new Set());
      if (x > score) [meilleur, score] = [uid, x];
    }
    if (meilleur && score >= (candidats.length ? 0.3 : 0.6)) r.dossier = meilleur;
  }

  // 3. Amendements dont la séance n'est pas renseignée : même numéro dans le même texte,
  //    en écartant ceux tranchés un autre jour (les numéros repartent à 1 à chaque lecture).
  for (const s of scrutins) {
    const r = resultat.get(s.num);
    const m = s.titre.match(/^(?:l'amendement|le sous-amendement) n° ?([\w-]+)/i);
    if (r.amendement || !r.dossier || !m) continue;
    const candidats = (amendements.parDossier.get(`${r.dossier}|${m[1]}`) ?? []).filter(
      (f) => (!f.jour || f.jour === s.date) && memeAuteur(s.titre, f),
    );
    if (candidats.length === 1) r.amendement = candidats[0];
  }
  return resultat;
}
