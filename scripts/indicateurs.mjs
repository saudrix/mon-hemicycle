// Indicateurs sur le fonctionnement de l'Assemblée, affichés en tête des sections de
// « Comment travaille l'Assemblée ». Chaque chiffre est recalculé à chaque génération,
// à partir des mêmes fichiers que le reste de l'application.

const mediane = (valeurs) => {
  const l = [...valeurs].sort((a, b) => a - b);
  if (!l.length) return null;
  const m = Math.floor(l.length / 2);
  return l.length % 2 ? l[m] : (l[m - 1] + l[m]) / 2;
};

const JOUR = 24 * 3600 * 1000;

/**
 * textes : Map uid -> { t, p, i, e } (lireDossiers) ; resume : scrutins résumés
 * [num, date, type, adopté, titre, pour, contre, abs, nv, dossier] ; sieges : 577.
 */
export function calculerIndicateurs({ textes, resume, debut, legislature, sieges = 577 }) {
  // Lois promulguées depuis le début de la législature. Les traités et conventions sont
  // à part : ce sont des lois qui autorisent leur ratification, toujours à l'initiative du Gouvernement.
  const promulguees = [];
  for (const t of textes.values()) {
    const prom = t.e.find(([lieu]) => lieu === 'Promulgation');
    const date = prom && (prom[4] ?? prom[2]);
    if (date && date >= debut) promulguees.push({ ...t, date });
  }
  const conventions = promulguees.filter((t) => /ratification/i.test(t.p));
  const lois = promulguees.filter((t) => !/ratification/i.test(t.p));
  const projets = lois.filter((t) => t.i === 'Gouvernement');
  const duree = mediane(
    lois.flatMap((t) => {
      const depot = t.e.map(([, , d]) => d).filter(Boolean).sort()[0];
      return depot ? [(new Date(t.date) - new Date(depot)) / JOUR] : [];
    }),
  );

  // 49.3 : l'Assemblée ouvre un dossier par engagement de la responsabilité du Gouvernement.
  const engagements = [...textes.entries()].filter(
    ([uid, t]) => uid.includes(`L${legislature}N`) && /^Engagement de la responsabilité du Gouvernement/i.test(t.t),
  );
  const textes493 = new Set(
    engagements.map(([, t]) => {
      const m = t.t.match(/((?:projet|proposition) de loi .*? pour \d{4})/i) ?? t.t.match(/((?:projet|proposition) de loi[^,]*)/i);
      return m ? m[1].charAt(0).toUpperCase() + m[1].slice(1) : t.t;
    }),
  );

  const censures = resume.filter((s) => s[2] === 'MOC');
  const participation = (type) => mediane(resume.filter((s) => s[2] === type).map((s) => (s[5] + s[6] + s[7] + s[8]) / sieges));

  return {
    depuis: debut,
    lois: {
      promulguees: promulguees.length,
      conventions: conventions.length,
      horsConventions: lois.length,
      projets: projets.length,
      propositions: lois.length - projets.length,
      dureeMedianeJours: duree == null ? null : Math.round(duree),
    },
    article493: { engagements: engagements.length, textes: [...textes493] },
    censure: {
      votees: censures.length,
      adoptees: censures.filter((s) => s[3]).map((s) => s[1]),
    },
    scrutins: {
      ordinaires: resume.filter((s) => s[2] === 'SPO').length,
      solennels: resume.filter((s) => s[2] === 'SPS').length,
      participationOrdinaires: participation('SPO'),
      participationSolennels: participation('SPS'),
    },
  };
}
