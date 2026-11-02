import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Chargement, Pastille, PositionChip } from '../components';
import {
  type Depute,
  type Meta,
  type Position,
  type ScrutinDetail,
  POSITIONS,
  circonscription,
  formatDate,
  getCarte,
  getMeta,
  getScrutinDetail,
  getScrutins,
  nomComplet,
  photo,
  positionDe,
} from '../data';
import { useAsync } from '../hooks';

const COULEURS_VOTE: Record<Position | 'absent', string> = {
  p: 'var(--pour)',
  c: 'var(--contre)',
  a: 'var(--abs)',
  n: 'var(--nv)',
  absent: 'var(--vide)',
};

// Circonscriptions sans contour dans le fichier source : collectivités du Pacifique, Saint-Barthélemy
// et Saint-Martin, Français établis hors de France. Elles sont affichées en cases.
const SANS_CONTOUR = ['977', '986', '987', '988', '099'];

export function Carte() {
  const [params] = useSearchParams();
  const num = Number(params.get('scrutin')) || null;
  const donnees = useAsync(
    () =>
      Promise.all([
        getMeta(),
        getCarte(),
        num ? getScrutinDetail(num).catch(() => undefined) : Promise.resolve(undefined),
        num ? getScrutins() : Promise.resolve(undefined),
      ]),
    [num],
  );
  if (!donnees.data) return <Chargement error={donnees.error} />;
  const [meta, carte, detail, scrutins] = donnees.data;
  const scrutin = num ? scrutins?.scrutins.find((s) => s[0] === num) : undefined;
  return <Vue meta={meta} carte={carte} detail={num ? detail : undefined} titre={scrutin ? { num: scrutin[0], date: scrutin[1], titre: scrutin[4] } : undefined} />;
}

type Zone = Awaited<ReturnType<typeof getCarte>>[number];

function Vue({
  meta,
  carte,
  detail,
  titre,
}: {
  meta: Meta;
  carte: Zone[];
  detail?: ScrutinDetail;
  titre?: { num: number; date: string; titre: string };
}) {
  const [selection, setSelection] = useState<string | null>(null);
  const [filtre, setFiltre] = useState<string | null>(null);

  // Député en fonction de chaque circonscription, par clé « département-numéro ».
  const parCirco = useMemo(() => {
    const m = new Map<string, { depute: Depute; index: number }>();
    meta.deputes.forEach((d, index) => {
      if (d.actif && d.depNum && d.circo) m.set(`${d.depNum}-${d.circo}`, { depute: d, index });
    });
    return m;
  }, [meta]);

  const categorie = (cle: string): string => {
    const x = parCirco.get(cle);
    if (!x) return 'vacant';
    if (detail) return positionDe(detail, x.index) ?? 'absent';
    return x.depute.groupe ?? 'vacant';
  };

  const couleur = (cat: string) =>
    detail ? COULEURS_VOTE[cat as Position | 'absent'] ?? 'var(--vide)' : meta.groupes[cat]?.couleur ?? 'var(--vide)';

  // Légende : sièges par groupe, ou députés par position pour un scrutin.
  const legende = useMemo(() => {
    const compte = new Map<string, number>();
    for (const cle of parCirco.keys()) compte.set(categorie(cle), (compte.get(categorie(cle)) ?? 0) + 1);
    const ordre = detail ? ['p', 'c', 'a', 'n', 'absent'] : [...compte.keys()].sort((a, b) => compte.get(b)! - compte.get(a)!);
    return ordre.filter((c) => compte.get(c)).map((c) => ({ cat: c, n: compte.get(c)! }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parCirco, detail]);

  const libelle = (cat: string) =>
    detail ? (cat === 'absent' ? 'Absent' : POSITIONS[cat as Position]) : meta.groupes[cat]?.abrev ?? cat;

  const trace = (cle: string, d: string) => {
    const cat = categorie(cle);
    const estomper = filtre && filtre !== cat;
    return (
      <path
        key={cle}
        d={d}
        fill={couleur(cat)}
        className={selection === cle ? 'circo choisie' : 'circo'}
        opacity={estomper ? 0.15 : 1}
        onClick={() => setSelection(cle)}
      />
    );
  };

  const metro = carte.find((z) => z.id === 'metro')!;
  const encarts = carte.filter((z) => z.id !== 'metro');
  const cases = [...parCirco.entries()].filter(([, x]) => SANS_CONTOUR.includes(x.depute.depNum!));
  const choisi = selection ? parCirco.get(selection) : undefined;

  return (
    <div className="page">
      {titre ? (
        <>
          <p className="surtitre">Carte du vote · scrutin n° {titre.num}</p>
          <h1 className="titre-scrutin">{titre.titre}</h1>
          <p className="date">
            {formatDate(titre.date)} ·{' '}
            <Link to={`/scrutins/${titre.num}`}>détail du scrutin</Link> · <Link to="/carte">carte des groupes</Link>
          </p>
        </>
      ) : (
        <>
          <h1>La carte de l'Assemblée</h1>
          <p className="intro">Chaque circonscription prend la couleur du groupe de son député. Touchez-en une pour voir qui y siège.</p>
        </>
      )}

      <div className="legende-carte" role="group" aria-label="Légende">
        {legende.map(({ cat, n }) => (
          <button
            key={cat}
            aria-pressed={filtre === cat}
            onClick={() => setFiltre(filtre === cat ? null : cat)}
            title={detail ? undefined : meta.groupes[cat]?.nom}
          >
            <i style={{ background: cat === 'vacant' ? 'var(--vide)' : couleur(cat) }} />
            {cat === 'vacant' ? 'Siège vacant' : libelle(cat)} <b>{n}</b>
          </button>
        ))}
      </div>

      <svg className="carte" viewBox={`-5 -5 ${metro.largeur + 10} ${metro.hauteur + 10}`} role="img" aria-label={metro.nom}>
        {metro.circos.map((c) => trace(c.k, c.d))}
      </svg>

      {choisi && <Fiche depute={choisi.depute} meta={meta} position={detail ? (positionDe(detail, choisi.index) ?? null) : undefined} />}

      <div className="encarts">
        {encarts.map((z) => (
          <figure key={z.id} className={z.id === 'idf' ? 'encart large' : 'encart'}>
            <svg viewBox={`-3 -3 ${z.largeur + 6} ${z.hauteur + 6}`} role="img" aria-label={z.nom}>
              {z.circos.map((c) => trace(c.k, c.d))}
            </svg>
            <figcaption>{z.nom}</figcaption>
          </figure>
        ))}
      </div>

      <h2>Outre-mer et Français de l'étranger</h2>
      <div className="cases">
        {cases.map(([cle, { depute }]) => {
          const cat = categorie(cle);
          return (
            <button
              key={cle}
              className={selection === cle ? 'case choisie' : 'case'}
              style={{ background: couleur(cat), opacity: filtre && filtre !== cat ? 0.15 : 1 }}
              onClick={() => setSelection(cle)}
              title={`${depute.dep}, ${depute.circo}e`}
            >
              {depute.depNum === '099' ? `FE${depute.circo}` : depute.depNum}
            </button>
          );
        })}
      </div>
      <p className="note">FE : Français établis hors de France (11 circonscriptions).</p>
    </div>
  );
}

function Fiche({ depute, meta, position }: { depute: Depute; meta: Meta; position?: Position | null }) {
  return (
    <Link to={`/deputes/${depute.id}`} className="fiche-carte">
      <img src={photo(depute.id)} alt="" />
      <div>
        <strong>{nomComplet(depute)}</strong>
        <small>{circonscription(depute)}</small>
        <span className="fiche-carte-pied">
          <Pastille groupe={depute.groupe ? meta.groupes[depute.groupe] : undefined} />
          {position !== undefined && (position ? <PositionChip position={position} /> : <em>n'a pas voté</em>)}
        </span>
      </div>
      <span aria-hidden>›</span>
    </Link>
  );
}
