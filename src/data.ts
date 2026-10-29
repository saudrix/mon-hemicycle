// Accès aux fichiers produits par scripts/build-data.mjs, avec un cache mémoire.

export type Groupe = { abrev: string; nom: string; couleur: string };

export type Depute = {
  id: string;
  civ: string;
  prenom: string;
  nom: string;
  groupe: string | null;
  dep: string | null;
  depNum: string | null;
  circo: number | null;
  region: string | null;
  actif: boolean;
  periodes: [string, string | null][];
};

export type Meta = {
  genereLe: string;
  legislature: string;
  dernierScrutin: string | null;
  groupes: Record<string, Groupe>;
  deputes: Depute[];
};

/** [numéro, date, type, adopté (1/0), titre, pour, contre, abstentions, non-votants, dossier] */
export type ScrutinResume = [number, string, string, 0 | 1, string, number, number, number, number, string | null];

export type Position = 'p' | 'c' | 'a' | 'n';

export type ScrutinDetail = {
  demandeur: string | null;
  typeMajorite: string;
  grp: GroupeVote[];
};

/** [groupe, membres, pour, contre, abstentions, non-votants, position majoritaire, index des députés par position] */
export type GroupeVote = [string, number, number, number, number, number, string, Record<Position, number[]>];

/** Position d'un député (par index) dans un scrutin, s'il a voté. */
export function positionDe(detail: ScrutinDetail, i: number): Position | undefined {
  for (const g of detail.grp) {
    for (const [p, ids] of Object.entries(g[7]) as [Position, number[]][]) if (ids.includes(i)) return p;
  }
  return undefined;
}

export type DeputeActivite = {
  /** [numéro du scrutin, position, position majoritaire du groupe] */
  votes: [number, Position, string][];
  /** [date, organe, présence : p = présent, e = excusé, a = absent] */
  commissions: [string, string, 'p' | 'e' | 'a'][];
};

export type JourPresence = {
  date: string;
  /** nombre de scrutins du jour (hors motions de censure) */
  n: number;
  /** nombre de votes de chaque député (par index) */
  v: Record<string, number>;
  /** présence en commission de chaque député : [présent, excusé, absent] */
  com: Record<string, [number, number, number]>;
};

const cache = new Map<string, Promise<unknown>>();

// Version web : données servies avec l'application. Version native : lues sur le site publié.
const BASE_DONNEES = (import.meta.env.VITE_DATA_URL as string | undefined) ?? import.meta.env.BASE_URL;

function load<T>(path: string): Promise<T> {
  if (!cache.has(path)) {
    const p = fetch(`${BASE_DONNEES}data/${path}`).then((r) => {
      if (!r.ok) throw new Error(`Données indisponibles (${path})`);
      return r.json();
    });
    p.catch(() => cache.delete(path));
    cache.set(path, p);
  }
  return cache.get(path) as Promise<T>;
}

export const getMeta = () => load<Meta>('meta.json');
export const getScrutins = () => load<{ dossiers: Record<string, string>; scrutins: ScrutinResume[] }>('scrutins.json');
export const getScrutinDetail = async (num: number) =>
  (await load<Record<string, ScrutinDetail>>(`scrutins/${Math.floor(num / 250)}.json`))[num];
export const getActivite = (id: string) => load<DeputeActivite>(`deputes/${id}.json`);
export const getPresence = () => load<{ jours: JourPresence[] }>('presence.json');
/** Scrutin lu en direct sur le site de l'Assemblée par le Worker, avant sa parution dans l'open data. */
export type ScrutinDirect = {
  num: number;
  date: string;
  titre: string;
  adopte: boolean;
  pour: number | null;
  contre: number | null;
  abs: number | null;
  important: boolean;
};

let recents: Promise<ScrutinDirect[]> | null = null;
export function getRecents(): Promise<ScrutinDirect[]> {
  const api = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '');
  if (!api) return Promise.resolve([]);
  recents ??= fetch(`${api}/api/recents`)
    .then((r) => (r.ok ? r.json() : { recents: [] }))
    .then((e: { recents?: ScrutinDirect[] }) => e.recents ?? [])
    .catch(() => []);
  return recents;
}

/** Index des scrutins complété par ceux publiés depuis la dernière génération des données. */
export async function getScrutinsAJour() {
  const [donnees, direct] = await Promise.all([getScrutins(), getRecents()]);
  const dernier = donnees.scrutins[0]?.[0] ?? 0;
  const enPlus: ScrutinResume[] = direct
    .filter((s) => s.num > dernier)
    .map((s) => [s.num, s.date, s.titre.toLowerCase().startsWith('la motion de censure') ? 'MOC' : 'SPO', s.adopte ? 1 : 0, s.titre, s.pour ?? 0, s.contre ?? 0, s.abs ?? 0, 0, null]);
  return { ...donnees, scrutins: [...enPlus, ...donnees.scrutins], direct: new Set(enPlus.map((s) => s[0])) };
}

export const getCommissions = () => load<Record<string, string>>('commissions.json');
export const getCirconscriptions = (dep: string) =>
  load<{ c: number; g: number[][][][] }[]>(`circonscriptions/${dep}.json`);

// ---------- Libellés ----------

export const TYPES_SCRUTIN: Record<string, string> = {
  SPO: 'Scrutin public ordinaire',
  SPS: 'Scrutin public solennel',
  MOC: 'Motion de censure',
};

export const POSITIONS: Record<Position, string> = { p: 'Pour', c: 'Contre', a: 'Abstention', n: 'Non-votant' };

const POSITION_MAJORITAIRE: Record<string, Position> = { pour: 'p', contre: 'c', abstention: 'a', nonVotant: 'n' };
export const positionMajoritaire = (s: string): Position | null => POSITION_MAJORITAIRE[s] ?? null;

export const photo = (id: string, legislature = '17') =>
  `https://www2.assemblee-nationale.fr/static/tribun/${legislature}/photos/${id.replace('PA', '')}.jpg`;

export const nomComplet = (d: Depute) => `${d.prenom} ${d.nom}`;

export const circonscription = (d: Depute) =>
  d.circo ? `${d.circo}${d.circo === 1 ? 're' : 'e'} circonscription · ${d.dep}` : d.dep ?? '';

const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const dateCourteFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
export const formatDate = (iso: string) => dateFmt.format(new Date(`${iso}T12:00:00`));
export const formatDateCourte = (iso: string) => dateCourteFmt.format(new Date(`${iso}T12:00:00`));
export const pct = (x: number | null) => (x == null || Number.isNaN(x) ? '–' : `${Math.round(x * 100)} %`);

// ---------- Présence ----------

/** Vrai si le député siégeait à cette date. */
export function enMandat(d: Depute, date: string) {
  return d.periodes.some(([debut, fin]) => debut <= date && (fin == null || date <= fin));
}

export type Taux = {
  /** votes exprimés (y compris non-votants) */
  votes: number;
  /** scrutins tenus pendant que le ou les députés siégeaient */
  scrutins: number;
  present: number;
  excuse: number;
  absent: number;
};

export const tauxVote = (t: Taux) => (t.scrutins ? t.votes / t.scrutins : null);
export const tauxCommission = (t: Taux) => {
  const total = t.present + t.excuse + t.absent;
  return total ? t.present / total : null;
};

const vide = (): Taux => ({ votes: 0, scrutins: 0, present: 0, excuse: 0, absent: 0 });

/** Cumule la présence de chaque député sur les jours donnés. */
export function presenceParDepute(meta: Meta, jours: JourPresence[]): Taux[] {
  const res = meta.deputes.map(vide);
  for (const j of jours) {
    meta.deputes.forEach((d, i) => {
      if (j.n && enMandat(d, j.date)) res[i].scrutins += j.n;
    });
    for (const [i, n] of Object.entries(j.v)) res[+i].votes += n;
    for (const [i, [p, e, a]] of Object.entries(j.com)) {
      res[+i].present += p;
      res[+i].excuse += e;
      res[+i].absent += a;
    }
  }
  return res;
}

/** Regroupe les taux individuels selon une clé (groupe, région…). */
export function cumuler(taux: Taux[], cle: (i: number) => string | null) {
  const res = new Map<string, Taux & { deputes: number }>();
  taux.forEach((t, i) => {
    const k = cle(i);
    if (k == null || (!t.scrutins && !t.present && !t.excuse && !t.absent)) return;
    const r = res.get(k) ?? { ...vide(), deputes: 0 };
    r.votes += t.votes;
    r.scrutins += t.scrutins;
    r.present += t.present;
    r.excuse += t.excuse;
    r.absent += t.absent;
    r.deputes++;
    res.set(k, r);
  });
  return res;
}

// ---------- Circonscription depuis une adresse ----------

function dansAnneau(x: number, y: number, anneau: number[][]) {
  let dedans = false;
  for (let i = 0, j = anneau.length - 1; i < anneau.length; j = i++) {
    const [xi, yi] = anneau[i];
    const [xj, yj] = anneau[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dedans = !dedans;
  }
  return dedans;
}

export async function trouverCirconscription(dep: string, lon: number, lat: number) {
  const circos = await getCirconscriptions(dep).catch(() => []);
  for (const { c, g } of circos) {
    for (const [exterieur, ...trous] of g) {
      if (dansAnneau(lon, lat, exterieur) && !trous.some((t) => dansAnneau(lon, lat, t))) return c;
    }
  }
  return null;
}

export type Adresse = { label: string; dep: string; lon: number; lat: number };

export async function chercherAdresses(q: string, signal?: AbortSignal): Promise<Adresse[]> {
  if (q.trim().length < 3) return [];
  const url = `https://data.geopf.fr/geocodage/search?autocomplete=1&limit=6&index=address&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) return [];
  const json = await res.json();
  return json.features.map((f: { geometry: { coordinates: [number, number] }; properties: { label: string; depcode?: string; citycode: string } }) => ({
    label: f.properties.label,
    dep: f.properties.depcode ?? f.properties.citycode.slice(0, f.properties.citycode.startsWith('97') ? 3 : 2),
    lon: f.geometry.coordinates[0],
    lat: f.geometry.coordinates[1],
  }));
}

// ---------- Mon député (mémorisé sur l'appareil) ----------

export type Choix = { depNum: string; circo: number; label: string };
const CLE = 'mon-hemicycle:circonscription';

export function lireChoix(): Choix | null {
  try {
    return JSON.parse(localStorage.getItem(CLE) ?? 'null');
  } catch {
    return null;
  }
}

export function enregistrerChoix(c: Choix | null) {
  try {
    if (c) localStorage.setItem(CLE, JSON.stringify(c));
    else localStorage.removeItem(CLE);
  } catch {
    // stockage indisponible (navigation privée) : le choix vaut pour la session
  }
}
