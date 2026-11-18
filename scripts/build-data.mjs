// Télécharge l'open data de l'Assemblée nationale et le transforme en fichiers
// JSON compacts, servis tels quels par l'application (public/data).
//
// Usage : node scripts/build-data.mjs [--offline]
//   --offline : réutilise les archives déjà présentes dans .cache sans les retélécharger.

import { createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { Unzip, UnzipInflate, unzipSync, strFromU8 } from 'fflate';
import { construireCarte } from './carte.mjs';
import { calculerIndicateurs } from './indicateurs.mjs';
import { indexerAmendements, lireDossiers, lireExposes, rattacher } from './textes.mjs';

const LEGISLATURE = '17';
// Première séance de la 17e législature, après les élections de juin et juillet 2024.
const DEBUT_LEGISLATURE = '2024-07-18';
const AN = `https://data.assemblee-nationale.fr/static/openData/repository/${LEGISLATURE}`;
const SOURCES = {
  scrutins: `${AN}/loi/scrutins/Scrutins.json.zip`,
  acteurs: `${AN}/amo/deputes_senateurs_ministres_legislature/AMO20_dep_sen_min_tous_mandats_et_organes.json.zip`,
  agenda: `${AN}/vp/reunions/Agenda.json.zip`,
  dossiers: `${AN}/loi/dossiers_legislatifs/Dossiers_Legislatifs.json.zip`,
  // ~350 Mo : lu en flux, fichier par fichier.
  amendements: `${AN}/loi/amendements_div_legis/Amendements.json.zip`,
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
    // Le serveur de l'Assemblée coupe parfois la connexion en plein téléchargement : on réessaie.
    for (let essai = 1; ; essai++) {
      console.log(`↓ ${name}${essai > 1 ? ` (essai ${essai})` : ''}`);
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`${url} : HTTP ${res.status}`);
        // Écrit à côté puis renomme : une archive interrompue ne remplace jamais la précédente.
        await pipeline(Readable.fromWeb(res.body), createWriteStream(`${file}.part`));
        renameSync(`${file}.part`, file);
        break;
      } catch (e) {
        if (essai >= 4) throw e;
        console.warn(`  ${name} : ${e.message}, nouvel essai dans ${essai * 10} s`);
        await new Promise((r) => setTimeout(r, essai * 10_000));
      }
    }
  }
  return readFileSync(file);
}

/** Parcourt une archive en flux, sans la décompresser entièrement en mémoire. */
function parcourirJson(zip) {
  return (filter, rappel) => {
    const unzip = new Unzip();
    unzip.register(UnzipInflate);
    unzip.onfile = (f) => {
      if (!f.name.endsWith('.json') || !filter(f.name)) return;
      const morceaux = [];
      f.ondata = (err, data, fin) => {
        if (err) throw err;
        morceaux.push(data);
        if (fin) rappel(f.name, JSON.parse(Buffer.concat(morceaux).toString('utf8')));
      };
      f.start();
    };
    const PAS = 1 << 20;
    for (let i = 0; i < zip.length; i += PAS) unzip.push(zip.subarray(i, i + PAS), i + PAS >= zip.length);
  };
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
      // Place dans l'hémicycle, numérotée de 1 à 650 de l'extrême droite à l'extrême gauche.
      place: dernier.mandature?.placeHemicycle ? Number(dernier.mandature.placeHemicycle) : null,
      // dateDebut est la date de l'élection : un suppléant ne siège qu'à sa prise de fonction.
      periodes: sieges.map((m) => [m.mandature?.datePriseFonction ?? m.dateDebut, m.dateFin ?? null]),
    });
  }
  deputes.sort((x, y) => x.nom.localeCompare(y.nom, 'fr') || x.prenom.localeCompare(y.prenom, 'fr'));

  // Membres en fonction de chaque organe : députés siégeant aujourd'hui, avec un mandat ouvert
  // dans l'organe (un même député peut y avoir deux mandats, membre et président par exemple).
  const siegent = new Set(deputes.filter((d) => d.actif).map((d) => d.id));
  const nomDe = new Map(deputes.map((d) => [d.id, `${d.prenom} ${d.nom}`]));
  const membres = new Map();
  /** rôles de chaque député dans les organes, quand il n'y est pas simple membre */
  const roles = new Map();
  for (const a of acteurs) {
    const id = a.uid['#text'] ?? a.uid;
    if (!siegent.has(id)) continue;
    for (const m of list(a.mandats?.mandat)) {
      const o = m.organes?.organeRef;
      if (!o || m.dateFin) continue;
      if (!membres.has(o)) membres.set(o, { ids: new Set(), president: null });
      const e = membres.get(o);
      e.ids.add(id);
      const q = m.infosQualite?.codeQualite;
      if (q === 'Président') e.president = id;
      if (q && q !== 'Membre') {
        if (!roles.has(id)) roles.set(id, {});
        roles.get(id)[o] = m.infosQualite.libQualiteSex || q;
      }
    }
  }

  const commissions = {};
  // Seules les commissions qui examinent les lois comptent dans le taux de présence : les huit
  // commissions permanentes (chaque député est membre de l'une d'elles) et les commissions
  // spéciales créées pour un texte. Les autres réunions (groupes d'amitié, enquêtes, délégations,
  // affaires européennes…) restent listées sur la fiche, sans peser sur le taux.
  const comptees = new Set();
  for (const o of organes.values()) {
    if (['COMPER', 'CMP', 'CNPE', 'CNPS', 'COMSPSENAT', 'COMNL', 'GA', 'GEVI', 'MISINFO', 'MISINFOPRE', 'CSPECIALE', 'CENQUETE', 'DELEG', 'OFFPAR'].includes(o.codeType)) {
      const e = membres.get(o.uid);
      // n : nom, t : type d'organe, m : membres en fonction, p : président (s'il est député)
      commissions[o.uid] = {
        n: o.libelleAbrege || o.libelle,
        t: o.codeType,
        m: e?.ids.size ?? null,
        p: e?.president ? nomDe.get(e.president) : null,
      };
    }
    if (TYPES_COMPTES.includes(o.codeType)) comptees.add(o.uid);
  }
  return { groupes, deputes, commissions, comptees, roles };
}

// ---------- Scrutins ----------

/** Types d'organes comptés dans la présence en commission : permanentes et spéciales. */
const TYPES_COMPTES = ['COMPER', 'CNPS'];

const POSITIONS = { pours: 'p', contres: 'c', abstentions: 'a', nonVotants: 'n' };

function buildScrutins(zip, indexOf) {
  const resume = [];
  const details = {};
  const dossiers = {};
  const votesParDepute = new Map();
  const seances = new Map();

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
    seances.set(num, s.seanceRef);

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
  return { resume, details, dossiers, votesParDepute, seances };
}

// ---------- Présence en commission (agenda) ----------

function buildPresenceCommission(zip, indexOf, comptees) {
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
      // 4e valeur : 1 si la réunion compte dans le taux de présence en commission.
      parDepute.get(i).push([date, r.organeReuniRef, code, comptees.has(r.organeReuniRef) ? 1 : 0]);
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
  const [zScrutins, zActeurs, zAgenda, zDossiers, zAmendements, bCirco] = await Promise.all(
    Object.entries(SOURCES).map(([name, url]) => download(name, url)),
  );

  const { groupes, deputes, commissions, comptees, roles } = buildActeurs(zActeurs);
  const index = new Map(deputes.map((d, i) => [d.id, i]));
  const indexOf = (id) => index.get(id);
  console.log(`✓ ${deputes.length} députés (${deputes.filter((d) => d.actif).length} en fonction), ${Object.keys(groupes).length} groupes`);

  const { resume, details, dossiers, votesParDepute, seances } = buildScrutins(zScrutins, indexOf);
  console.log(`✓ ${resume.length} scrutins`);

  // Textes de loi et amendements rattachés à chaque scrutin.
  const textes = lireDossiers(parcourirJson(zDossiers));
  const amendements = indexerAmendements(parcourirJson(zAmendements));
  const liens = rattacher(
    resume.map((s) => ({ num: s[0], date: s[1], titre: s[4], dossierRef: s[9], seance: seances.get(s[0]) })),
    amendements,
    textes,
  );
  const exposes = lireExposes(
    parcourirJson(zAmendements),
    new Set([...liens.values()].flatMap((l) => (l.amendement ? [l.amendement.fichier] : []))),
  );
  let avecAmendement = 0;
  const utilises = new Set();
  for (const s of resume) {
    const { dossier, amendement } = liens.get(s[0]);
    s[9] = dossier;
    if (dossier) {
      utilises.add(dossier);
      dossiers[dossier] = textes.get(dossier)?.t ?? dossiers[dossier] ?? null;
    }
    if (amendement) {
      avecAmendement++;
      details[s[0]].amdt = {
        uid: amendement.uid,
        auteur: amendement.auteur,
        signataires: amendement.signataires,
        groupe: amendement.groupe,
        gouvernement: amendement.gouvernement,
        article: amendement.article,
        expose: exposes.get(amendement.fichier) ?? '',
      };
    }
  }
  const nbAmdt = resume.filter((s) => /^(L'amendement|Le sous-amendement)/.test(s[4])).length;
  console.log(
    `✓ ${amendements.n} amendements ; ${avecAmendement}/${nbAmdt} scrutins d'amendement reliés, ` +
      `${resume.filter((s) => s[9]).length}/${resume.length} scrutins rattachés à un texte`,
  );

  const commission = buildPresenceCommission(zAgenda, indexOf, comptees);
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
  write('indicateurs.json', calculerIndicateurs({ textes, resume, debut: DEBUT_LEGISLATURE, legislature: LEGISLATURE }));
  // Parcours des textes votés : [lieu, étape, date, issue].
  write('textes.json', Object.fromEntries([...utilises].filter((uid) => textes.has(uid)).map((uid) => [uid, textes.get(uid)])));

  // Détail des scrutins par paquets de 250 pour ne charger que ce qui est consulté.
  const paquets = {};
  for (const [num, det] of Object.entries(details)) (paquets[Math.floor(num / 250)] ??= {})[num] = det;
  for (const [p, contenu] of Object.entries(paquets)) write(`scrutins/${p}.json`, contenu);

  deputes.forEach((d, i) => {
    write(`deputes/${d.id}.json`, {
      votes: (votesParDepute.get(i) ?? []).sort((x, y) => y[0] - x[0]),
      commissions: (commission.get(i) ?? []).sort((x, y) => y[0].localeCompare(x[0])),
      roles: roles.get(d.id) ?? {},
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
    for (const [date, , code, compte] of lignes) {
      if (!compte) continue;
      const c = (jour(date).com[i] ??= [0, 0, 0]);
      c['pea'.indexOf(code)]++;
    }
  }
  write('presence.json', {
    jours: [...jours.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, j]) => ({ date, ...j })),
  });

  write('commissions.json', commissions);
  for (const [dep, features] of Object.entries(circos)) write(`circonscriptions/${dep}.json`, features);
  write(
    'carte.json',
    construireCarte(Object.entries(circos).flatMap(([dep, fs]) => fs.map((f) => ({ dep, circo: f.c, polygones: f.g })))),
  );

  console.log(`✓ données écrites dans ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
