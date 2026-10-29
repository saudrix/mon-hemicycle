// Lecture de la liste des scrutins publiée sur assemblee-nationale.fr.
// Le site publie chaque scrutin quelques minutes après le vote, alors que l'open data
// n'est régénéré qu'une fois par nuit.

export type ScrutinDirect = {
  num: number;
  /** date ISO (AAAA-MM-JJ) */
  date: string;
  titre: string;
  adopte: boolean;
  pour: number | null;
  contre: number | null;
  abs: number | null;
  /** vote sur l'ensemble d'un texte ou motion de censure */
  important: boolean;
};

export const URL_LISTE = 'https://www.assemblee-nationale.fr/dyn/17/scrutins?limit=50';

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

const ENTITES: Record<string, string> = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' };

function texte(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#0*(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&([a-z]+);/g, (m, e) => ENTITES[e] ?? m)
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, ' ');
}

const IMPORTANT =
  /^(l'ensemble|la proposition de loi|le projet de loi|la motion de censure|la déclaration du gouvernement|la proposition de résolution)/i;

export function lireListe(html: string): ScrutinDirect[] {
  const t = texte(html);
  const res: ScrutinDirect[] = [];
  // Chaque scrutin commence par « Scrutin public n°… sur … » et se termine par l'annonce du résultat.
  const bloc = /Scrutin public n°(\d+) sur (.+?) (?:\S+ )?séance du \S+ (\d{1,2})(?:er)? (\S+) (\d{4}) Synthèse du vote (.*?)L'Assemblée nationale (a adopté|n'a pas adopté)/g;
  for (const m of t.matchAll(bloc)) {
    const [, num, titre, jour, mois, annee, synthese, sort] = m;
    const nombre = (re: RegExp) => {
      const x = synthese.match(re);
      return x ? Number(x[1]) : null;
    };
    const titreNet = titre.trim().replace(/\.$/, '');
    res.push({
      num: Number(num),
      date: `${annee}-${String(MOIS.indexOf(mois.toLowerCase()) + 1).padStart(2, '0')}-${jour.padStart(2, '0')}`,
      titre: titreNet.charAt(0).toUpperCase() + titreNet.slice(1),
      adopte: sort === 'a adopté',
      pour: nombre(/Pour l'adoption : (\d+)/),
      contre: nombre(/Contre : (\d+)/),
      abs: nombre(/Abstention : (\d+)/),
      important: IMPORTANT.test(titreNet),
    });
  }
  return res;
}
