// Contours simplifiés des circonscriptions pour la carte de France (public/data/carte.json).
// Chaque zone (métropole, zoom sur Paris et la petite couronne, chaque territoire d'outre-mer)
// est projetée dans son propre repère et tracée en chemins SVG.

const ZONES = [
  { id: 'metro', nom: 'France métropolitaine', largeur: 1000, garde: (dep) => !dep.startsWith('97') },
  { id: 'idf', nom: 'Paris et petite couronne', largeur: 500, garde: (dep) => ['75', '92', '93', '94'].includes(dep) },
  { id: '971', nom: 'Guadeloupe', largeur: 300, garde: (dep) => dep === '971' },
  { id: '972', nom: 'Martinique', largeur: 300, garde: (dep) => dep === '972' },
  { id: '973', nom: 'Guyane', largeur: 300, garde: (dep) => dep === '973' },
  { id: '974', nom: 'La Réunion', largeur: 300, garde: (dep) => dep === '974' },
  { id: '976', nom: 'Mayotte', largeur: 300, garde: (dep) => dep === '976' },
  { id: '975', nom: 'Saint-Pierre-et-Miquelon', largeur: 300, garde: (dep) => dep === '975' },
];

/** Tolérance de simplification et surface minimale d'une île, en unités de la zone. */
const TOLERANCE = 0.7;
const SURFACE_MIN = 4;

function simplifier(points, tolerance) {
  if (points.length < 4) return points;
  const garder = new Uint8Array(points.length);
  garder[0] = garder[points.length - 1] = 1;
  const pile = [[0, points.length - 1]];
  while (pile.length) {
    const [a, b] = pile.pop();
    const [ax, ay] = points[a];
    const [bx, by] = points[b];
    const dx = bx - ax;
    const dy = by - ay;
    const longueur = Math.hypot(dx, dy) || 1;
    let max = 0;
    let indice = -1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * points[i][0] - dx * points[i][1] + bx * ay - by * ax) / longueur;
      if (d > max) {
        max = d;
        indice = i;
      }
    }
    if (max > tolerance) {
      garder[indice] = 1;
      pile.push([a, indice], [indice, b]);
    }
  }
  return points.filter((_, i) => garder[i]);
}

/** Un anneau fermé commence et finit au même point : on le simplifie en deux moitiés. */
function simplifierAnneau(anneau) {
  const milieu = Math.floor(anneau.length / 2);
  return [...simplifier(anneau.slice(0, milieu + 1), TOLERANCE).slice(0, -1), ...simplifier(anneau.slice(milieu), TOLERANCE)].slice(0, -1);
}

const surface = (anneau) =>
  Math.abs(anneau.reduce((s, [x, y], i) => {
    const [x2, y2] = anneau[(i + 1) % anneau.length];
    return s + x * y2 - x2 * y;
  }, 0)) / 2;

const chemin = (anneaux) =>
  anneaux.map((a) => `M${a.map(([x, y]) => `${Math.round(x * 10) / 10} ${Math.round(y * 10) / 10}`).join('L')}Z`).join('');

/**
 * @param {{ dep: string, circo: number, polygones: number[][][][] }[]} circonscriptions coordonnées lon/lat
 */
export function construireCarte(circonscriptions) {
  return ZONES.map((zone) => {
    const membres = circonscriptions.filter((c) => zone.garde(c.dep));
    // Projection équirectangulaire corrigée de la latitude moyenne de la zone.
    let [minLon, maxLon, minLat, maxLat] = [Infinity, -Infinity, Infinity, -Infinity];
    for (const c of membres)
      for (const poly of c.polygones)
        for (const [lon, lat] of poly[0]) {
          minLon = Math.min(minLon, lon);
          maxLon = Math.max(maxLon, lon);
          minLat = Math.min(minLat, lat);
          maxLat = Math.max(maxLat, lat);
        }
    const k = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
    const echelle = zone.largeur / ((maxLon - minLon) * k);
    const projeter = ([lon, lat]) => [(lon - minLon) * k * echelle, (maxLat - lat) * echelle];

    const circos = membres.map((c) => {
      // Contour extérieur de chaque polygone ; les petites îles sont retirées, sauf la plus grande.
      const anneaux = c.polygones
        .map((poly) => simplifierAnneau(poly[0].map(projeter)))
        .filter((a) => a.length >= 3)
        .sort((a, b) => surface(b) - surface(a));
      const gardes = anneaux.filter((a, i) => i === 0 || surface(a) >= SURFACE_MIN);
      return { k: `${c.dep}-${c.circo}`, d: chemin(gardes) };
    });

    return {
      id: zone.id,
      nom: zone.nom,
      largeur: zone.largeur,
      hauteur: Math.ceil((maxLat - minLat) * echelle),
      circos,
    };
  });
}
