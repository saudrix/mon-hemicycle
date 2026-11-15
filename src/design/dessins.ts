// =============================================================================
// Encre et couleur — la géométrie des dessins
// =============================================================================
// Rien ici ne touche au DOM : ce sont des fonctions pures qui rendent des
// chemins SVG. Les composants qui les consomment sont dans Illustrations.tsx.
//
// Un dessin n'invente jamais une donnée. Quand la place exacte d'un député est
// connue, elle est utilisée telle quelle ; quand elle ne l'est pas, le siège
// n'est pas entouré.

export type Point = { ang: number; x: number; y: number; k: number };

/**
 * L'hémicycle vu du perchoir : l'ellipse écrase la hauteur, et les rangées du
 * fond portent des sièges plus petits pour creuser la profondeur.
 *
 * Les points sortent triés par angle décroissant, c'est-à-dire de l'extrême
 * gauche à l'extrême droite — l'ordre inverse de `placeHemicycle`, qui numérote
 * de 1 (extrême droite) à 650 (extrême gauche).
 */
export function sieges(total: number, rows: number, rIn: number, rOut: number, cx: number, cy: number, aplat: number): Point[] {
  const radii: number[] = [];
  for (let i = 0; i < rows; i++) radii.push(rIn + (rOut - rIn) * (i / (rows - 1)));
  const somme = radii.reduce((a, b) => a + b, 0);
  const parRangee = radii.map((r) => Math.floor((total * r) / somme));
  let reste = total - parRangee.reduce((a, b) => a + b, 0);
  let k = rows - 1;
  while (reste > 0) {
    parRangee[k]++;
    reste--;
    k = k === 0 ? rows - 1 : k - 1;
  }
  const pts: Point[] = [];
  for (let r = 0; r < rows; r++) {
    const n = parRangee[r];
    const R = radii[r];
    const marge = 0.03;
    for (let j = 0; j < n; j++) {
      const t = n === 1 ? 0.5 : j / (n - 1);
      const ang = Math.PI * (1 - marge) - t * Math.PI * (1 - 2 * marge);
      pts.push({
        ang,
        x: cx + R * Math.cos(ang),
        y: cy - R * Math.sin(ang) * aplat,
        k: 0.58 + 0.42 * (r / (rows - 1)),
      });
    }
  }
  pts.sort((a, b) => b.ang - a.ang);
  return pts;
}

/** Un chemin fait d'un petit disque par siège : un seul `path` pour 574 sièges. */
export function chemin(pts: Point[], r: number) {
  let d = '';
  for (const p of pts) {
    const rr = +(r * p.k).toFixed(2);
    d += `M${p.x.toFixed(1)} ${(p.y - rr).toFixed(1)}a${rr} ${rr} 0 1 0 0.01 0z`;
  }
  return d;
}

/** La demi-coupole du logo : les points restent lisibles à toutes les tailles. */
export function dome(cx: number, cy: number, rangs: number, rIn: number, rOut: number, aplat: number, rayon: number) {
  const pts: { ang: number; x: number; y: number }[] = [];
  for (let r = 0; r < rangs; r++) {
    const R = rIn + (rOut - rIn) * (r / (rangs - 1));
    const n = 7 + r * 4;
    for (let j = 0; j < n; j++) {
      const t = n === 1 ? 0.5 : j / (n - 1);
      const ang = Math.PI * 0.97 - t * Math.PI * 0.94;
      pts.push({ ang, x: cx + R * Math.cos(ang), y: cy - R * Math.sin(ang) * aplat });
    }
  }
  pts.sort((a, b) => b.ang - a.ang);
  let d = '';
  for (const p of pts) d += `M${p.x.toFixed(1)} ${(p.y - rayon).toFixed(1)}a${rayon} ${rayon} 0 1 0 0.01 0z`;
  return { d, pts };
}

// ---------------------------------------------------------------- Les jauges

const A0 = Math.PI * 0.88;
const BALAYAGE = Math.PI * 1.24;

/** Arc ouvert de 223°, lisible même quand la valeur est minuscule. */
export function arc(cx: number, cy: number, R: number, v: number) {
  const a = A0 + BALAYAGE * Math.max(0.004, v);
  return (
    `M${(cx + R * Math.cos(A0)).toFixed(2)} ${(cy + R * Math.sin(A0)).toFixed(2)}` +
    `A${R} ${R} 0 ${BALAYAGE * v > Math.PI ? 1 : 0} 1 ` +
    `${(cx + R * Math.cos(a)).toFixed(2)} ${(cy + R * Math.sin(a)).toFixed(2)}`
  );
}

/** L'encoche de la médiane, en travers de l'arc. */
export function tick(cx: number, cy: number, R: number, v: number, demi: number) {
  const a = A0 + BALAYAGE * v;
  const co = Math.cos(a);
  const si = Math.sin(a);
  return (
    `M${(cx + (R - demi) * co).toFixed(2)} ${(cy + (R - demi) * si).toFixed(2)}` +
    `L${(cx + (R + demi) * co).toFixed(2)} ${(cy + (R + demi) * si).toFixed(2)}`
  );
}

// --------------------------------------------------------------- La vignette

/**
 * Une demi-couronne de points pour résumer un vote, lisible à 54 px de large.
 * `partPour` coupe la couronne : les points de gauche sont des « pour ».
 */
export function vignette(partPour: number) {
  const rangs = 4;
  const cx = 31;
  const cy = 31;
  const pts: { ang: number; x: number; y: number }[] = [];
  for (let r = 0; r < rangs; r++) {
    const R = 11 + r * 6.2;
    const n = 9 + r * 3;
    for (let j = 0; j < n; j++) {
      const ang = Math.PI - (j / (n - 1)) * Math.PI;
      pts.push({ ang, x: cx + R * Math.cos(ang), y: cy - R * Math.sin(ang) * 0.86 });
    }
  }
  pts.sort((a, b) => b.ang - a.ang);
  const coupe = Math.round(pts.length * Math.min(Math.max(partPour, 0), 1));
  const d = (liste: typeof pts) =>
    liste.map((p) => `M${p.x.toFixed(1)} ${(p.y - 1.9).toFixed(1)}a1.9 1.9 0 1 0 0.01 0z`).join('');
  return { pour: d(pts.slice(0, coupe)), contre: d(pts.slice(coupe)) };
}

// --------------------------------------------------------------- La médiane

/** Médiane d'une série, en ignorant les valeurs manquantes. */
export function mediane(valeurs: (number | null)[]): number | null {
  const v = valeurs.filter((x): x is number => x != null && !Number.isNaN(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = v.length >> 1;
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}
