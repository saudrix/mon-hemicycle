// =============================================================================
// Encre et couleur - les dessins
// =============================================================================
// Les objets dessinés du système : la marque, le banc dans l'hémicycle, les
// jauges à médiane, l'histogramme mois par mois, et les illustrations au trait.

import { type ReactNode, useMemo } from 'react';
import { type Point, arc, chemin, dome, montrer, sieges, tick, vignette } from './dessins';

const BASE = import.meta.env.BASE_URL;

/** Les illustrations au trait, servies depuis public/illus. */
export const ILLUS = {
  hemicycleVide: 'hemicycle-vide',
  perchoir: 'perchoir',
  texteDeLoi: 'texte-de-loi',
  votePour: 'vote-pour',
  voteContre: 'vote-contre',
  voteAbstention: 'vote-abstention',
  presenceCommission: 'presence-commission',
  bancVide: 'banc-vide',
  navette: 'navette',
  rechercheVide: 'recherche-vide',
} as const;

export type NomIllu = keyof typeof ILLUS;

export function Illu({ nom, alt = '', className }: { nom: NomIllu; alt?: string; className?: string }) {
  return <img className={className} src={`${BASE}illus/${ILLUS[nom]}.webp`} alt={alt} loading="lazy" decoding="async" />;
}

/** L'illustration qui va avec une position de vote. */
export const illuPosition = (p: string): NomIllu =>
  p === 'p' ? 'votePour' : p === 'c' ? 'voteContre' : p === 'a' ? 'voteAbstention' : 'bancVide';

// ------------------------------------------------------------------- Marque

const MARQUE = dome(66, 76, 4, 20, 56, 0.9, 4.2);
const MARQUE_SIEGE = MARQUE.pts[Math.floor(MARQUE.pts.length * 0.2)];

/** La demi-coupole de points, avec son siège jaune. */
export function Marque({ taille = 36 }: { taille?: number }) {
  return (
    <svg className="marque-logo" width={taille} height={(taille * 92) / 132} viewBox="0 0 132 92" role="img" aria-label="Mon Hémicycle">
      <path d={MARQUE.d} fill="currentColor" />
      <circle cx={MARQUE_SIEGE.x.toFixed(1)} cy={MARQUE_SIEGE.y.toFixed(1)} r="5.4" fill="var(--jaune)" stroke="currentColor" strokeWidth="1.6" />
      <rect x="49" y="79" width="34" height="9" rx="4" fill="currentColor" />
    </svg>
  );
}

// --------------------------------------------------------------- Son banc

/**
 * L'hémicycle vu du perchoir, le banc du groupe à l'encre et le siège entouré.
 *
 * `rang` et `rangsGroupe` sont des positions dans l'ordre réel des places
 * (`placeHemicycle`), de l'extrême gauche à l'extrême droite. Quand la place
 * n'est pas connue, rien n'est entouré et aucune flèche n'est tracée.
 */
export function BancHemicycle({
  total,
  rang,
  rangsGroupe,
  description,
  mot = 'lui',
}: {
  total: number;
  rang: number | null;
  rangsGroupe: ReadonlySet<number>;
  description: string;
  /** « lui » ou « elle » : l'annotation désigne une personne. */
  mot?: string;
}) {
  const vue = useMemo(() => {
    const pts = sieges(total, 13, 54, 168, 175, 136, 0.55);
    const banc = pts.filter((_, i) => rangsGroupe.has(i));
    const siege = rang != null && rang >= 0 && rang < pts.length ? pts[rang] : null;
    return { tous: chemin(pts, 3.3), banc: chemin(banc, 3.3), siege };
  }, [total, rang, rangsGroupe]);

  const s = vue.siege;
  // La flèche part du côté qui laisse de la place : vers l'intérieur du dessin.
  const sens: 1 | -1 = s && s.x > 175 ? -1 : 1;
  // Elle arrive à plat plutôt qu'en diagonale : le dessin est large et bas.
  const geste = s ? montrer(s.x, s.y, 40, sens === 1 ? Math.PI * (5 / 6) : Math.PI / 6, sens) : null;

  return (
    // Le cadre monte au-dessus des sièges : la flèche et son mot ont besoin de
    // cette marge quand le siège est au dernier rang, tout en haut du dessin.
    <svg className="banc" viewBox="0 -26 350 176" role="img" aria-label={description}>
      <path d={vue.tous} fill="var(--encre)" opacity="0.2" />
      <path d={vue.banc} fill="var(--encre)" />
      {s && geste && (
        <>
          <path d={geste.queue} fill="none" stroke="var(--encre)" strokeWidth="2.1" strokeLinecap="round" />
          <path
            d={geste.pointe}
            fill="none"
            stroke="var(--encre)"
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <text
            className="banc-mot"
            x={(geste.depart.x + 5 * sens).toFixed(1)}
            y={geste.depart.y.toFixed(1)}
            textAnchor={sens === 1 ? 'start' : 'end'}
          >
            {mot}
          </text>
          <circle cx={s.x.toFixed(1)} cy={s.y.toFixed(1)} r="4.6" fill="var(--jaune)" stroke="var(--encre)" strokeWidth="1.6" />
        </>
      )}
      <g transform="translate(175 143)">
        <rect x="-29" y="-3" width="58" height="13" rx="5" fill="var(--encre)" />
        <rect x="-17" y="-13" width="34" height="11" rx="4.5" fill="none" stroke="var(--encre)" strokeWidth="2.4" />
      </g>
    </svg>
  );
}

// ------------------------------------------------------- La salle, un vote

/**
 * L'hémicycle entier colorié par le vote de chacun. Les positions inconnues
 * restent à l'encre pâle : un siège sans donnée n'est pas un absent.
 */
export function SalleVotes({
  total,
  positions,
  rang,
  description,
  mot = 'lui',
}: {
  total: number;
  /** position de chaque siège, par rang dans la salle */
  positions: ReadonlyMap<number, 'p' | 'c' | 'a' | 'n'>;
  rang: number | null;
  description: string;
  mot?: string;
}) {
  const vue = useMemo(() => {
    const pts = sieges(total, 13, 54, 168, 175, 136, 0.55);
    const par = { p: [] as Point[], c: [] as Point[], a: [] as Point[], n: [] as Point[], vide: [] as Point[] };
    pts.forEach((p, i) => par[positions.get(i) ?? 'vide'].push(p));
    return {
      p: chemin(par.p, 3.3),
      c: chemin(par.c, 3.3),
      a: chemin(par.a, 3.3),
      n: chemin(par.n, 3.3),
      vide: chemin(par.vide, 3.3),
      siege: rang != null && rang >= 0 && rang < pts.length ? pts[rang] : null,
    };
  }, [total, positions, rang]);

  const s = vue.siege;
  const sens = s && s.x > 175 ? -1 : 1;
  return (
    // Le cadre monte au-dessus des sièges : la flèche et son mot ont besoin de
    // cette marge quand le siège est au dernier rang, tout en haut du dessin.
    <svg className="banc" viewBox="0 -26 350 176" role="img" aria-label={description}>
      <path d={vue.vide} fill="var(--encre)" opacity="0.18" />
      <path d={vue.n} fill="var(--absent)" />
      <path d={vue.a} fill="var(--abstention)" />
      <path d={vue.c} fill="var(--contre)" />
      <path d={vue.p} fill="var(--pour)" />
      {s && (
        <>
          <path
            d={`M${(s.x + 58 * sens).toFixed(1)} ${(s.y - 46).toFixed(1)}C${(s.x + 40 * sens).toFixed(1)} ${(s.y - 40).toFixed(1)} ${(s.x + 30 * sens).toFixed(1)} ${(s.y - 34).toFixed(1)} ${(s.x + 15 * sens).toFixed(1)} ${(s.y - 15).toFixed(1)}`}
            fill="none"
            stroke="var(--encre)"
            strokeWidth="2.1"
            strokeLinecap="round"
          />
          <path
            d={`M${(s.x + 23 * sens).toFixed(1)} ${(s.y - 21).toFixed(1)}L${(s.x + 15 * sens).toFixed(1)} ${(s.y - 15).toFixed(1)}L${(s.x + 23 * sens).toFixed(1)} ${(s.y - 11).toFixed(1)}`}
            fill="none"
            stroke="var(--encre)"
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <text className="banc-mot" x={(s.x + 62 * sens).toFixed(1)} y={(s.y - 46).toFixed(1)} textAnchor={sens === 1 ? 'start' : 'end'}>
            {mot}
          </text>
          <circle cx={s.x.toFixed(1)} cy={s.y.toFixed(1)} r="5.6" fill="none" stroke="var(--encre)" strokeWidth="2" />
        </>
      )}
      <g transform="translate(175 143)">
        <rect x="-29" y="-3" width="58" height="13" rx="5" fill="var(--encre)" />
        <rect x="-17" y="-13" width="34" height="11" rx="4.5" fill="none" stroke="var(--encre)" strokeWidth="2.4" />
      </g>
    </svg>
  );
}

// --------------------------------------------------------------- Les jauges

const JX = 75;
const JY = 55;
const JR = 47;
const FOND = arc(JX, JY, JR, 1);

/**
 * Un taux sur un arc ouvert, avec l'encoche de sa médiane.
 * Règle du système : un pourcentage ne sort jamais seul.
 */
export function JaugeArc({
  valeur,
  med,
  teinte,
  lieu,
  libelleValeur,
  libelleMediane,
}: {
  valeur: number | null;
  /** `undefined` tant que la médiane de l'Assemblée se calcule. */
  med: number | null | undefined;
  teinte: string;
  lieu: string;
  libelleValeur: string;
  libelleMediane: string;
}) {
  const alt =
    valeur == null
      ? `Taux ${lieu} indisponible.`
      : med == null
        ? `${libelleValeur} ${lieu}.`
        : `${libelleValeur} ${lieu}, pour une médiane de ${libelleMediane}.`;
  return (
    <div className="jauge-arc">
      <svg viewBox="0 0 150 90" role="img" aria-label={alt}>
        <path d={FOND} fill="none" stroke="var(--encre)" strokeOpacity="0.12" strokeWidth="12" strokeLinecap="round" />
        {valeur != null && <path d={arc(JX, JY, JR, valeur)} fill="none" stroke={teinte} strokeWidth="12" strokeLinecap="round" />}
        {med != null && <path d={tick(JX, JY, JR, med, 8)} stroke="var(--encre)" strokeWidth="2.6" strokeLinecap="round" />}
        <text className="jauge-chiffre" x="75" y="84" textAnchor="middle">
          {libelleValeur}
        </text>
      </svg>
      <p className="jauge-lieu">{lieu}</p>
      {/* Tant que la médiane se calcule, la ligne garde sa place sans rien affirmer. */}
      <p className="jauge-med">{med === undefined ? ' ' : med === null ? 'médiane indisponible' : `médiane ${libelleMediane}`}</p>
    </div>
  );
}

// ------------------------------------------------------------- La vignette

/** Le résultat d'un vote en demi-couronne : vert à gauche, corail à droite. */
export function VignetteVote({ pour, contre }: { pour: number; contre: number }) {
  const total = pour + contre;
  const d = useMemo(() => vignette(total ? pour / total : 0.5), [pour, total]);
  return (
    <span className="vignette" aria-hidden>
      <svg viewBox="0 0 62 34">
        <path d={d.contre} fill="var(--contre)" />
        <path d={d.pour} fill="var(--pour)" />
      </svg>
    </span>
  );
}

/** Un nombre de scrutins par jour, la pointe détachée. */
export function BarresParJour({ jours, description }: { jours: { cle: string; n: number }[]; description: string }) {
  const max = Math.max(1, ...jours.map((j) => j.n));
  const pic = jours.reduce((a, b) => (b.n >= a.n ? b : a), jours[0]);
  const pas = 300 / Math.max(jours.length, 1);
  const l = Math.min(26, pas - 4);
  return (
    <svg className="barres-jour" viewBox="0 0 300 54" role="img" aria-label={description}>
      {jours.map((j, i) => {
        const h = Math.max(3, (j.n / max) * 44);
        const sommet = j === pic;
        return (
          <g key={j.cle}>
            <rect x={(i * pas + (pas - l) / 2).toFixed(1)} y={(50 - h).toFixed(1)} width={l.toFixed(1)} height={h.toFixed(1)} rx="6" fill={sommet ? 'var(--encre)' : 'rgba(255,255,255,0.72)'} />
            {sommet && (
              <text className="barre-pic" x={(i * pas + pas / 2).toFixed(1)} y={(50 - h + 14).toFixed(1)} textAnchor="middle">
                {j.n}
              </text>
            )}
          </g>
        );
      })}
      <path d="M0 50h300" stroke="var(--encre)" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

// --------------------------------------------------------------- Les haltères

export type Haltere = { cle: string; nom: ReactNode; seance: number | null; commission: number | null; detail: string };

/**
 * Un trait par groupe, de la séance à la commission. Les deux mesures ne
 * disent pas la même chose : un classement sur une seule est faux, donc elles
 * ne se montrent jamais l'une sans l'autre.
 */
export function Halteres({
  lignes,
  medSeance,
  medCommission,
}: {
  lignes: Haltere[];
  medSeance: number | null;
  medCommission: number | null;
}) {
  // L'échelle s'arrête au-dessus de la plus grande valeur, par pas de 20 points :
  // à l'échelle 0-100 tout se tasserait à gauche. L'axe est gradué, donc il ne
  // trompe personne.
  const sommet = Math.max(
    0.2,
    ...lignes.flatMap((l) => [l.seance ?? 0, l.commission ?? 0]),
    medSeance ?? 0,
    medCommission ?? 0,
  );
  const max = Math.min(1, Math.ceil((sommet + 0.04) * 5) / 5);
  const pos = (v: number) => `${(Math.min(Math.max(v, 0), max) / max) * 100}%`;
  const graduations: number[] = [];
  for (let t = 0; t <= max + 1e-9; t += 0.2) graduations.push(Math.round(t * 100) / 100);
  return (
    <div className="halteres">
      <ul>
        {lignes.map((l) => {
          const a = l.seance ?? 0;
          const b = l.commission ?? 0;
          return (
            <li key={l.cle}>
              <span className="haltere-nom">{l.nom}</span>
              <span className="haltere-piste">
                {medSeance != null && <i className="repere repere-seance" style={{ left: pos(medSeance) }} aria-hidden />}
                {medCommission != null && <i className="repere repere-commission" style={{ left: pos(medCommission) }} aria-hidden />}
                {l.seance != null && l.commission != null && (
                  <i className="haltere-trait" style={{ left: pos(Math.min(a, b)), width: pos(Math.abs(b - a)) }} aria-hidden />
                )}
                {l.seance != null && <i className="pt pt-seance" style={{ left: pos(a) }} aria-hidden />}
                {l.commission != null && <i className="pt pt-commission" style={{ left: pos(b) }} aria-hidden />}
              </span>
              <span className="haltere-vals">{l.detail}</span>
            </li>
          );
        })}
      </ul>
      <div className="haltere-axe" aria-hidden>
        {graduations.map((t) => (
          <span key={t} style={{ left: pos(t) }}>
            {Math.round(t * 100)} %
          </span>
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------- Mois par mois

export type MoisPresence = {
  cle: string;
  nom: string;
  /** part des scrutins votés, ou null si le mois est hors session */
  seance: number | null;
  /** part des convocations honorées, ou null */
  commission: number | null;
};

const BASE_Y = 70;
const HAUT = 58;

/** Deux barres par mois : la commission en violet, la séance à l'encre. */
export function MoisParMois({ mois, description }: { mois: MoisPresence[]; description: string }) {
  const pas = 296 / Math.max(mois.length, 1);
  const largeur = Math.min(8, pas / 3.1);
  return (
    <svg className="mois" viewBox="0 0 300 86" role="img" aria-label={description}>
      <defs>
        <pattern id="hors-session" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="5" stroke="var(--encre)" strokeOpacity="0.22" strokeWidth="2" />
        </pattern>
      </defs>
      {mois.map((m, i) => {
        const x = 4 + i * pas;
        const hors = m.seance == null && m.commission == null;
        const hc = hors ? HAUT : Math.max(2, Math.round((m.commission ?? 0) * HAUT));
        const hs = hors ? 0 : Math.max(2, Math.round((m.seance ?? 0) * HAUT));
        return (
          <g key={m.cle}>
            <rect x={x.toFixed(1)} y={(BASE_Y - hc).toFixed(1)} width={largeur.toFixed(1)} height={hc.toFixed(1)} rx="3" fill={hors ? 'url(#hors-session)' : 'var(--commission)'} />
            {!hors && (
              <rect x={(x + largeur + 1.5).toFixed(1)} y={(BASE_Y - hs).toFixed(1)} width={largeur.toFixed(1)} height={hs.toFixed(1)} rx="3" fill="var(--seance)" />
            )}
            <text className="mois-nom" x={(x + largeur + 0.75).toFixed(1)} y="84" textAnchor="middle">
              {m.nom}
            </text>
          </g>
        );
      })}
      <path d="M2 70.5H298" stroke="var(--encre)" strokeOpacity="0.2" strokeWidth="1.4" />
    </svg>
  );
}
