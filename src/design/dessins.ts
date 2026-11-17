// =============================================================================
// Encre et couleur - la géométrie des dessins
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
 * gauche à l'extrême droite - l'ordre inverse de `placeHemicycle`, qui numérote
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

// ------------------------------------------------------------- Un repère

/**
 * Le centre de la boîte d'un tracé SVG, pour y poser un repère.
 * Les contours de circonscription sont faits de `M`, `L` et `Z` seulement :
 * les nombres s'y lisent deux par deux.
 */
export function centre(d: string): { x: number; y: number } | null {
  const n = d.match(/-?\d+(?:\.\d+)?/g);
  if (!n || n.length < 4) return null;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let i = 0; i + 1 < n.length; i += 2) {
    const x = +n[i];
    const y = +n[i + 1];
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  return { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
}

// --------------------------------------------------------------- La médiane

/** Médiane d'une série, en ignorant les valeurs manquantes. */
export function mediane(valeurs: (number | null)[]): number | null {
  const v = valeurs.filter((x): x is number => x != null && !Number.isNaN(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = v.length >> 1;
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

// ------------------------------------------------------- Lire sur une couleur

const canal = (v: number) => {
  const x = v / 255;
  return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
};

/** Luminance relative d'une couleur `#rrggbb`. */
function luminance(hex: string) {
  const h = hex.replace('#', '');
  const n = h.length === 3 ? [...h].map((c) => c + c) : [h.slice(0, 2), h.slice(2, 4), h.slice(4, 6)];
  const [r, g, b] = n.map((x) => canal(parseInt(x, 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * L'encre ou le crème, selon ce qui se lit le mieux sur un fond donné.
 * Les couleurs de groupe sont celles de l'Assemblée : on ne les change pas,
 * on choisit le texte qui tient dessus.
 */
export function texteSur(fond: string | undefined): string {
  if (!fond || !/^#[0-9a-f]{3,6}$/i.test(fond)) return 'var(--encre)';
  const l = luminance(fond);
  const surEncre = (l + 0.05) / (luminance('#17213d') + 0.05);
  const surCreme = (luminance('#fbf7ef') + 0.05) / (l + 0.05);
  return surEncre >= surCreme ? 'var(--encre)' : 'var(--creme)';
}

// ----------------------------------------------------------- Montrer du doigt

/**
 * La flèche manuscrite qui désigne un point : sa queue et sa pointe.
 *
 * La pointe se déduit de la tangente de la courbe, elle n'est jamais écrite à
 * la main. C'est la seule façon qu'elle reste dans l'axe quand on change
 * l'inclinaison, le sens ou l'échelle : le dernier point de contrôle est posé
 * sur cet axe, donc la tangente à l'arrivée vaut exactement `angle`.
 *
 * `angle` est la direction du trajet, pas celle d'où vient la flèche.
 * `bombe` vaut 1 ou -1 et dit de quel côté la courbe s'écarte : en miroir, il
 * s'inverse avec l'angle, sinon le geste ne se reflète pas.
 */
export function montrer(cx: number, cy: number, u: number, angle: number, bombe: 1 | -1 = 1) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  // La pointe s'arrête avant la cible, sinon elle la mange.
  const tx = cx - c * u * 0.26;
  const ty = cy - s * u * 0.26;
  const qx = tx - c * u * 0.5;
  const qy = ty - s * u * 0.5;
  // Le départ s'écarte perpendiculairement, pour que la courbe se lise.
  const dx = tx - c * u * 1.3 - s * u * 0.4 * bombe;
  const dy = ty - s * u * 1.3 + c * u * 0.4 * bombe;
  const aile = (ecart: number) => {
    const a = angle + Math.PI + ecart;
    return `${(tx + Math.cos(a) * u * 0.3).toFixed(2)} ${(ty + Math.sin(a) * u * 0.3).toFixed(2)}`;
  };
  const t = `${tx.toFixed(2)} ${ty.toFixed(2)}`;
  return {
    queue: `M${dx.toFixed(2)} ${dy.toFixed(2)}Q${qx.toFixed(2)} ${qy.toFixed(2)} ${t}`,
    pointe: `M${aile(-0.46)}L${t}L${aile(0.46)}`,
    depart: { x: dx, y: dy },
  };
}
