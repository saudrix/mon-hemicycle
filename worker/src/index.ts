// Worker Cloudflare de Mon Hémicycle :
// - toutes les 5 minutes, regarde si de nouveaux scrutins sont publiés sur assemblee-nationale.fr ;
// - garde les derniers scrutins pour l'application (qui ne reçoit l'open data qu'une fois par nuit) ;
// - envoie une notification push aux téléphones abonnés.

import { type Position, type ScrutinDirect, URL_LISTE, lireListe, lireVotes, urlScrutin } from './an';
import { type Abonnement, type Vapid, envoyer } from './webpush';

type Env = {
  DONNEES: KVNamespace;
  VAPID_PUBLIC_KEY: string;
  /** clé privée VAPID au format JWK (secret) */
  VAPID_PRIVATE_JWK: string;
  VAPID_SUBJECT: string;
  /** origines autorisées, séparées par des virgules */
  ORIGINES: string;
  /** URL de l'application, ouverte au toucher de la notification */
  URL_APP: string;
};

/** tous : chaque scrutin ; importants : votes sur l'ensemble d'un texte et motions de censure */
type Mode = 'tous' | 'importants';
/** député suivi : identifiant de l'Assemblée (PA…) et nom affiché dans la notification */
type DeputeSuivi = { id: string; nom: string };
type Inscription = { abonnement: Abonnement; mode: Mode; depute?: DeputeSuivi; cree: string };
type Etat = { dernier: number; recents: ScrutinDirect[]; verifieLe: string };

const ETAT = 'etat';
const MAX_RECENTS = 150;
/** pages de scrutin lues au plus par passage (limite de sous-requêtes du Worker) */
const MAX_PAGES_VOTES = 15;
const AGENT = 'MonHemicycle/0.1 (+https://github.com/saudrix/mon-hemicycle)';

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const origine = req.headers.get('Origin') ?? '';
    const cors = entetesCors(origine, env);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const { pathname } = new URL(req.url);
    const json = (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

    try {
      if (pathname === '/api/config' && req.method === 'GET') {
        return json({ vapidPublicKey: env.VAPID_PUBLIC_KEY });
      }

      if (pathname === '/api/recents' && req.method === 'GET') {
        const etat = await lireEtat(env);
        return new Response(JSON.stringify(etat ?? { recents: [] }), {
          headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' },
        });
      }

      if (pathname === '/api/abonnement') {
        if (!cors['Access-Control-Allow-Origin']) return json({ erreur: 'Origine non autorisée' }, 403);
        const corps = (await req.json()) as { abonnement?: Abonnement; mode?: Mode; depute?: DeputeSuivi; endpoint?: string };
        if (req.method === 'POST') {
          const a = corps.abonnement;
          if (!a?.endpoint?.startsWith('https://') || !a.keys?.p256dh || !a.keys?.auth) return json({ erreur: 'Abonnement invalide' }, 400);
          const d = corps.depute;
          const depute = d && /^PA\d+$/.test(d.id) && typeof d.nom === 'string' ? { id: d.id, nom: d.nom.slice(0, 80) } : undefined;
          const inscription: Inscription = {
            abonnement: a,
            mode: corps.mode === 'importants' ? 'importants' : 'tous',
            depute,
            cree: new Date().toISOString(),
          };
          await env.DONNEES.put(await cle(a.endpoint), JSON.stringify(inscription));
          return json({ ok: true });
        }
        if (req.method === 'DELETE' && corps.endpoint) {
          await env.DONNEES.delete(await cle(corps.endpoint));
          return json({ ok: true });
        }
      }

      // Notification d'essai, pour vérifier l'installation sur un téléphone.
      if (pathname === '/api/essai' && req.method === 'POST') {
        if (!cors['Access-Control-Allow-Origin']) return json({ erreur: 'Origine non autorisée' }, 403);
        const { endpoint } = (await req.json()) as { endpoint: string };
        const brut = await env.DONNEES.get(await cle(endpoint));
        if (!brut) return json({ erreur: 'Abonnement inconnu' }, 404);
        const statut = await envoyer((JSON.parse(brut) as Inscription).abonnement, {
          title: 'Mon Hémicycle',
          body: 'Les notifications fonctionnent. Vous serez prévenu à chaque nouveau scrutin.',
          url: env.URL_APP,
          tag: 'essai',
        }, vapid(env));
        return json({ statut });
      }

      return json({ erreur: 'Introuvable' }, 404);
    } catch (e) {
      return json({ erreur: (e as Error).message }, 500);
    }
  },

  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(veille(env));
  },
};

async function veille(env: Env) {
  const res = await fetch(URL_LISTE, { headers: { 'User-Agent': AGENT } });
  if (!res.ok) throw new Error(`Liste des scrutins : HTTP ${res.status}`);
  const liste = lireListe(await res.text());
  if (!liste.length) throw new Error('Aucun scrutin lu : la page a peut-être changé de forme');

  const etat = await lireEtat(env);
  const max = Math.max(...liste.map((s) => s.num));
  if (etat && max <= etat.dernier) return;

  // Premier passage : on mémorise l'existant sans notifier.
  const nouveaux = etat ? liste.filter((s) => s.num > etat.dernier).sort((a, b) => a.num - b.num) : [];
  const recents = [...liste, ...(etat?.recents ?? [])]
    .filter((s, i, tous) => tous.findIndex((x) => x.num === s.num) === i)
    .sort((a, b) => b.num - a.num)
    .slice(0, MAX_RECENTS);
  await env.DONNEES.put(ETAT, JSON.stringify({ dernier: max, recents, verifieLe: new Date().toISOString() } satisfies Etat));

  if (nouveaux.length) await notifier(env, nouveaux);
}

async function notifier(env: Env, nouveaux: ScrutinDirect[]) {
  const inscriptions = (
    await Promise.all(
      (await toutesLesCles(env)).map(async (k) => {
        const brut = await env.DONNEES.get(k);
        return brut ? { k, ...(JSON.parse(brut) as Inscription) } : null;
      }),
    )
  ).filter((x) => x !== null);

  // Le vote de chaque député n'est lu que si quelqu'un suit un député.
  const votes = inscriptions.some((i) => i.depute) ? await lireVotesDe(nouveaux) : new Map<number, Record<string, Position>>();
  const v = vapid(env);

  await Promise.all(
    inscriptions.map(async ({ k, abonnement, mode, depute }) => {
      const positions = new Map<number, Position>();
      if (depute) {
        for (const s of nouveaux) {
          const p = votes.get(s.num)?.[depute.id];
          if (p) positions.set(s.num, p);
        }
      }
      // Scrutins choisis (tous ou importants), plus ceux où le député suivi a voté pour, contre ou abstention.
      const selection = nouveaux.filter(
        (s) => mode === 'tous' || s.important || (positions.has(s.num) && positions.get(s.num) !== 'nv'),
      );
      if (!selection.length) return;
      const statut = await envoyer(abonnement, message(selection, env, depute, positions), v);
      if (statut === 404 || statut === 410) await env.DONNEES.delete(k);
    }),
  );
}

/** Vote de chaque député pour les nouveaux scrutins (les plus récents d'abord si la liste est longue). */
async function lireVotesDe(scrutins: ScrutinDirect[]) {
  const votes = new Map<number, Record<string, Position>>();
  const aLire = [...scrutins].sort((a, b) => b.num - a.num).slice(0, MAX_PAGES_VOTES);
  await Promise.all(
    aLire.map(async (s) => {
      try {
        const res = await fetch(urlScrutin(s.num), { headers: { 'User-Agent': AGENT } });
        if (res.ok) votes.set(s.num, lireVotes(await res.text()));
      } catch {
        // page indisponible : la notification partira sans le vote du député
      }
    }),
  );
  return votes;
}

const LIBELLES: Record<Position, string> = { pour: 'pour', contre: 'contre', abstention: 'abstention', nv: 'non-votant' };

function message(scrutins: ScrutinDirect[], env: Env, depute?: DeputeSuivi, positions = new Map<number, Position>()) {
  const dernier = scrutins.at(-1)!;
  const resultat = (s: ScrutinDirect) =>
    `${s.adopte ? 'Adopté' : 'Rejeté'}${s.pour != null && s.contre != null ? ` (${s.pour} pour, ${s.contre} contre)` : ''}`;
  const aVote = (p: Position) =>
    p === 'abstention' ? 'a choisi l’abstention' : p === 'nv' ? 'n’a pas voté (non-votant)' : `a voté ${p}`;

  if (scrutins.length === 1) {
    const p = positions.get(dernier.num);
    return {
      title: depute && p ? `${depute.nom} ${aVote(p)} · ${dernier.adopte ? 'adopté' : 'rejeté'}` : `${resultat(dernier)} · scrutin n° ${dernier.num}`,
      body: depute && p ? `${dernier.titre}. ${resultat(dernier)}.` : dernier.titre,
      url: `${env.URL_APP}#/scrutins/${dernier.num}`,
      tag: 'scrutins',
    };
  }

  // Plusieurs scrutins d'un coup : un résumé des positions du député suivi, puis le dernier scrutin.
  const compte = new Map<Position, number>();
  for (const s of scrutins) {
    const p = positions.get(s.num);
    if (p) compte.set(p, (compte.get(p) ?? 0) + 1);
  }
  const resume = depute && compte.size
    ? `${depute.nom} : ${[...compte].map(([p, n]) => `${n} ${LIBELLES[p]}`).join(', ')}. `
    : '';
  return {
    title: `${scrutins.length} nouveaux scrutins`,
    body: `${resume}Dernier : ${dernier.titre}, ${resultat(dernier).toLowerCase()}.`,
    url: `${env.URL_APP}#/scrutins`,
    tag: 'scrutins',
  };
}

// ---------- Utilitaires ----------

const vapid = (env: Env): Vapid => ({
  publicKey: env.VAPID_PUBLIC_KEY,
  privateJwk: JSON.parse(env.VAPID_PRIVATE_JWK),
  sujet: env.VAPID_SUBJECT,
});

async function lireEtat(env: Env) {
  const brut = await env.DONNEES.get(ETAT);
  return brut ? (JSON.parse(brut) as Etat) : null;
}

async function cle(endpoint: string) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint));
  return `abonnement:${[...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}

async function toutesLesCles(env: Env) {
  const cles: string[] = [];
  let curseur: string | undefined;
  do {
    const page = await env.DONNEES.list({ prefix: 'abonnement:', cursor: curseur });
    cles.push(...page.keys.map((k) => k.name));
    curseur = page.list_complete ? undefined : page.cursor;
  } while (curseur);
  return cles;
}

function entetesCors(origine: string, env: Env): Record<string, string> {
  const autorisees = env.ORIGINES.split(',').map((o) => o.trim());
  const ok = autorisees.includes(origine) || /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)(:\d+)?$/.test(origine);
  return ok
    ? {
        'Access-Control-Allow-Origin': origine,
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        Vary: 'Origin',
      }
    : {};
}
