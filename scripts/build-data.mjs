// Télécharge l'open data de l'Assemblée nationale et le transforme en fichiers
// JSON compacts, servis tels quels par l'application (public/data).
//
// Usage : node scripts/build-data.mjs [--offline]
//   --offline : réutilise les archives déjà présentes dans .cache sans les retélécharger.

import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { unzipSync, strFromU8 } from 'fflate';

const LEGISLATURE = '17';
const AN = `https://data.assemblee-nationale.fr/static/openData/repository/${LEGISLATURE}`;
const SOURCES = {
  scrutins: `${AN}/loi/scrutins/Scrutins.json.zip`,
  acteurs: `${AN}/amo/deputes_senateurs_ministres_legislature/AMO20_dep_sen_min_tous_mandats_et_organes.json.zip`,
  agenda: `${AN}/vp/reunions/Agenda.json.zip`,
  circonscriptions:
    'https://static.data.gouv.fr/resources/contours-geographiques-des-circonscriptions-legislatives/20240613-191520/circonscriptions-legislatives-p10.geojson',
};

const CACHE = '.cache';
const OUT = 'public/data';
const offline = process.argv.includes('--offline');
const MAX_AGE_MS = 6 * 3600 * 1000;

// Codes des collectivités d'outre-mer dans le fichier de contours -> numéro de département de l'AN.
const DEP_OUTRE_MER = { ZA: '971', ZB: '972', ZC: '973', ZD: '974', ZM: '976', ZS: '975' };

// ---------- Téléchargement ----------

async function download(name, url) {
  const file = join(CACHE, url.split('/').pop());
  const fresh = existsSync(file) && Date.now() - statSync(file).mtimeMs < MAX_AGE_MS;
  if (!(offline && existsSync(file)) && !fresh) {
    console.log(`↓ ${name}`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url} : HTTP ${res.status}`);
    writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
  return readFileSync(file);
}

function* jsonEntries(zip, filter = () => true) {
  const files = unzipSync(new Uint8Array(zip), { filter: (f) => f.name.endsWith('.json') && filter(f.name) });
  for (const [name, data] of Object.entries(files)) yield [name, JSON.parse(strFromU8(data))];
}

// L'open data passe du XML au JSON : un élément unique n'est pas mis dans un tableau.
const list = (x) => (x == null ? [] : Array.isArray(x) ? x : [x]);
const day = (s) => (s ? s.slice(0, 10) : null);

// ---------- Députés et groupes ----------

function buildActeurs(zip) {
  const organes = new Map();
  const acteurs = [];
  for (const [name, json] of jsonEntries(zip)) {
    if (name.includes('/organe/')) organes.set(json.organe.uid, json.organe);
    else if (name.includes('/acteur/')) acteurs.push(json.acteur);
  }

  const groupes = {};
  for (const o of organes.values()) {
    if (o.codeType !== 'GP' || o.legislature !== LEGISLATURE) continue;
    groupes[o.uid] = { abrev: o.libelleAbrev, nom: o.libelle, couleur: o.couleurAssociee || '#8D949A' };
  }

  const deputes = [];
  for (const a of acteurs) {
    const mandats = list(a.mandats?.mandat);
    const sieges = mandats
      .filter((m) => m.typeOrgane === 'ASSEMBLEE' && m.legislature === LEGISLATURE)
      .sort((x, y) => x.dateDebut.localeCompare(y.dateDebut));
    if (!sieges.length) continue;

    const gp = mandats
      .filter((m) => m.typeOrgane === 'GP' && groupes[m.organes?.organeRef])
      .sort((x, y) => (y.dateFin ?? '9999').localeCompare(x.dateFin ?? '9999') || y.dateDebut.localeCompare(x.dateDebut))[0];
    const dernier = sieges.at(-1);
    const lieu = dernier.election?.lieu ?? {};
    const ident = a.etatCivil.ident;
    deputes.push({
      id: a.uid['#text'] ?? a.uid,
      civ: ident.civ,
      prenom: ident.prenom,
      nom: ident.nom,
      groupe: gp?.organes?.organeRef ?? null,
      dep: lieu.departement ?? null,
      depNum: lieu.numDepartement ?? null,
      circo: lieu.numCirco ? Number(lieu.numCirco) : null,
      region: lieu.region ?? null,
      actif: sieges.some((m) => !m.dateFin),
      // dateDebut est la date de l'élection : un suppléant ne siège qu'à sa prise de fonction.
      periodes: sieges.map((m) => [m.mandature?.datePriseFonction ?? m.dateDebut, m.dateFin ?? null]),
    });
  }
  deputes.sort((x, y) => x.nom.localeCompare(y.nom, 'fr') || x.prenom.localeCompare(y.prenom, 'fr'));

  const commissions = {};
  for (const o of organes.values()) {
    if (['COMPER', 'CMP', 'CNPE', 'CNPS', 'COMSPSENAT', 'GA', 'MISINFO', 'CSPECIALE', 'CENQUETE', 'DELEG', 'OFFPAR'].includes(o.codeType)) {
      commissions[o.uid] = o.libelleAbrege || o.libelle;
    }
  }
  return { groupes, deputes, commissions };
}

// ---------- Scrutins ----------

const POSITIONS = { pours: 'p', contres: 'c', abstentions: 'a', nonVotants: 'n' };

function buildScrutins(zip, indexOf) {
  const resume = [];
  const details = {};
  const dossiers = {};
  const votesParDepute = new Map();

  for (const [, json] of jsonEntries(zip)) {
    const s = json.scrutin;
    const num = Number(s.numero);
    const code = s.typeVote.codeTypeVote;
    const d = s.syntheseVote.decompte;
    const dossier = s.objet?.dossierLegislatif;
    if (dossier?.dossierRef) dossiers[dossier.dossierRef] = dossier.libelle;
    const titre = s.titre.charAt(0).toUpperCase() + s.titre.slice(1);

    resume.push([
      num, s.dateScrutin, code, s.sort.code === 'adopté' ? 1 : 0, titre,
      +d.pour, +d.contre, +d.abstentions, +d.nonVotants, dossier?.dossierRef ?? null,
    ]);

    const grp = [];
    for (const g of list(s.ventilationVotes?.organe?.groupes?.groupe)) {
      const v = g.vote;
      const dv = v.decompteVoix;
      // Votes nominatifs rattachés au groupe du député au moment du vote.
      const nominatif = { p: [], c: [], a: [], n: [] };
      grp.push([g.organeRef, +g.nombreMembresGroupe, +dv.pour, +dv.contre, +dv.abstentions, +dv.nonVotants, v.positionMajoritaire, nominatif]);
      for (const [cle, pos] of Object.entries(POSITIONS)) {
        for (const votant of list(v.decompteNominatif?.[cle]?.votant)) {
          const i = indexOf(votant.acteurRef);
          if (i == null) continue;
          nominatif[pos].push(i);
          if (!votesParDepute.has(i)) votesParDepute.set(i, []);
          votesParDepute.get(i).push([num, pos, v.positionMajoritaire]);
        }
      }
    }
    details[num] = {
      demandeur: s.demandeur?.texte ?? null,
      typeMajorite: s.typeVote.typeMajorite,
      grp,
    };
  }
  resume.sort((x, y) => y[0] - x[0]);
  return { resume, details, dossiers, votesParDepute };
}

// ---------- Présence en commission (agenda) ----------

function buildPresenceCommission(zip, indexOf) {
  const parDepute = new Map();
  const aujourdhui = new Date().toISOString().slice(0, 10);
  for (const [, json] of jsonEntries(zip)) {
    const r = json.reunion;
    if (!r?.participants?.participantsInternes) continue;
    // Les réunions à venir listent déjà les convoqués, sans présence réelle.
    const date = day(r.timeStampDebut);
    if (date > aujourdhui || r.cycleDeVie?.etat !== 'Confirmé') continue;
    for (const p of list(r.participants.participantsInternes.participantInterne)) {
      const i = indexOf(p.acteurRef);
      if (i == null || !p.presence) continue;
      const code = p.presence === 'présent' ? 'p' : p.presence === 'excusé' ? 'e' : 'a';
      if (!parDepute.has(i)) parDepute.set(i, []);
      parDepute.get(i).push([date, r.organeReuniRef, code]);
    }
  }
  return parDepute;
}

// ---------- Circonscriptions ----------

const round = (c) => (typeof c[0] === 'number' ? [Math.round(c[0] * 1e4) / 1e4, Math.round(c[1] * 1e4) / 1e4] : c.map(round));

function buildCirconscriptions(buffer) {
  const geo = JSON.parse(buffer.toString('utf8'));
  const parDep = {};
  for (const f of geo.features) {
    const { codeDepartement, codeCirconscription } = f.properties;
    const dep = DEP_OUTRE_MER[codeDepartement] ?? codeDepartement;
    const geometry = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    (parDep[dep] ??= []).push({ c: Number(codeCirconscription.slice(-2)), g: round(geometry) });
  }
  return parDep;
}

// ---------- Écriture ----------

function write(path, data) {
  const file = join(OUT, path);
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, JSON.stringify(data));
}

async function main() {
  mkdirSync(CACHE, { recursive: true });
  const [zScrutins, zActeurs, zAgenda, bCirco] = await Promise.all(
    Object.entries(SOURCES).map(([name, url]) => download(name, url)),
  );

  const { groupes, deputes, commissions } = buildActeurs(zActeurs);
  const index = new Map(deputes.map((d, i) => [d.id, i]));
  const indexOf = (id) => index.get(id);
  console.log(`✓ ${deputes.length} députés (${deputes.filter((d) => d.actif).length} en fonction), ${Object.keys(groupes).length} groupes`);

  const { resume, details, dossiers, votesParDepute } = buildScrutins(zScrutins, indexOf);
  console.log(`✓ ${resume.length} scrutins`);

  const commission = buildPresenceCommission(zAgenda, indexOf);
  console.log(`✓ présence en commission pour ${commission.size} députés`);

  const circos = buildCirconscriptions(bCirco);

  rmSync(OUT, { recursive: true, force: true });

  write('meta.json', {
    genereLe: new Date().toISOString(),
    legislature: LEGISLATURE,
    dernierScrutin: resume[0]?.[1] ?? null,
    groupes,
    deputes,
  });
  write('scrutins.json', { dossiers, scrutins: resume });

  // Détail des scrutins par paquets de 250 pour ne charger que ce qui est consulté.
  const paquets = {};
  for (const [num, det] of Object.entries(details)) (paquets[Math.floor(num / 250)] ??= {})[num] = det;
  for (const [p, contenu] of Object.entries(paquets)) write(`scrutins/${p}.json`, contenu);

  deputes.forEach((d, i) => {
    write(`deputes/${d.id}.json`, {
      votes: (votesParDepute.get(i) ?? []).sort((x, y) => y[0] - x[0]),
      commissions: (commission.get(i) ?? []).sort((x, y) => y[0].localeCompare(x[0])),
    });
  });

  // Agrégats de présence par jour, pour les écrans de statistiques :
  // nombre de scrutins du jour, votes de chaque député, présence en commission de chaque député.
  const jours = new Map();
  const jour = (date) => {
    if (!jours.has(date)) jours.set(date, { n: 0, v: {}, com: {} });
    return jours.get(date);
  };
  for (const s of resume) {
    if (s[2] === 'MOC') continue; // motion de censure : seuls les votes « pour » sont publiés
    jour(s[1]).n++;
  }
  const parNumero = new Map(resume.map((s) => [s[0], s]));
  for (const [i, votes] of votesParDepute) {
    for (const [num] of votes) {
      const s = parNumero.get(num);
      if (!s || s[2] === 'MOC') continue;
      const j = jour(s[1]);
      j.v[i] = (j.v[i] ?? 0) + 1;
    }
  }
  for (const [i, lignes] of commission) {
    for (const [date, , code] of lignes) {
      const c = (jour(date).com[i] ??= [0, 0, 0]);
      c['pea'.indexOf(code)]++;
    }
  }
  write('presence.json', {
    jours: [...jours.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, j]) => ({ date, ...j })),
  });

  write('commissions.json', commissions);
  for (const [dep, features] of Object.entries(circos)) write(`circonscriptions/${dep}.json`, features);

  console.log(`✓ données écrites dans ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
