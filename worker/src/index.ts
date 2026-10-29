// Worker Cloudflare de Mon Hémicycle :
// - toutes les 5 minutes, regarde si de nouveaux scrutins sont publiés sur assemblee-nationale.fr ;
// - garde les derniers scrutins pour l'application (qui ne reçoit l'open data qu'une fois par nuit) ;
// - envoie une notification push aux téléphones abonnés.

import { type ScrutinDirect, URL_LISTE, lireListe } from './an';
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
type Inscription = { abonnement: Abonnement; mode: Mode; cree: string };
type Etat = { dernier: number; recents: ScrutinDirect[]; verifieLe: string };

const ETAT = 'etat';
const MAX_RECENTS = 150;

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
        const corps = (await req.json()) as { abonnement?: Abonnement; mode?: Mode; endpoint?: string };
        if (req.method === 'POST') {
          const a = corps.abonnement;
          if (!a?.endpoint?.startsWith('https://') || !a.keys?.p256dh || !a.keys?.auth) return json({ erreur: 'Abonnement invalide' }, 400);
          const inscription: Inscription = { abonnement: a, mode: corps.mode === 'importants' ? 'importants' : 'tous', cree: new Date().toISOString() };
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
  const res = await fetch(URL_LISTE, { headers: { 'User-Agent': 'MonHemicycle/0.1 (+https://github.com)' } });
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
  const importants = nouveaux.filter((s) => s.important);
  const cles = await toutesLesCles(env);
  const v = vapid(env);
  await Promise.all(
    cles.map(async (k) => {
      const brut = await env.DONNEES.get(k);
      if (!brut) return;
      const { abonnement, mode } = JSON.parse(brut) as Inscription;
      const selection = mode === 'importants' ? importants : nouveaux;
      if (!selection.length) return;
      const statut = await envoyer(abonnement, message(selection, env), v);
      if (statut === 404 || statut === 410) await env.DONNEES.delete(k);
    }),
  );
}

function message(scrutins: ScrutinDirect[], env: Env) {
  const dernier = scrutins.at(-1)!;
  const resultat = (s: ScrutinDirect) =>
    `${s.adopte ? 'Adopté' : 'Rejeté'}${s.pour != null && s.contre != null ? ` (${s.pour} pour, ${s.contre} contre)` : ''}`;
  if (scrutins.length === 1) {
    return {
      title: `${resultat(dernier)} · scrutin n° ${dernier.num}`,
      body: dernier.titre,
      url: `${env.URL_APP}#/scrutins/${dernier.num}`,
      tag: 'scrutins',
    };
  }
  return {
    title: `${scrutins.length} nouveaux scrutins`,
    body: `Dernier : ${dernier.titre} ${resultat(dernier).toLowerCase()}.`,
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
