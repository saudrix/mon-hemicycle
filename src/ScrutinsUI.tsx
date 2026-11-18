// Briques communes aux listes de scrutins : carte d'un vote, ligne compacte d'amendement,
// bloc d'amendements repliable, position de mon député.

import { useEtatDePage } from './navigation';
import { Link } from 'react-router-dom';
import { BarreVote } from './components';
import { type MesVotes, type ScrutinResume, enMandat, formatDate, formatDateCourte } from './data';
import { LIBELLES_NATURE, decouper } from './lecture';

const ABREGE = { p: 'Pour', c: 'Contre', a: 'Abst.', n: 'Non-votant' } as const;

/** « Mon député : Pour », ou « absent » s'il siégeait sans prendre part au vote. */
export function MaPosition({ s, mes }: { s: ScrutinResume; mes: MesVotes | null }) {
  if (!mes) return null;
  const pos = mes.positions.get(s[0]);
  if (pos) return <span className={`ma-position position-${pos}`}>Mon député : {ABREGE[pos]}</span>;
  // Motion de censure : seuls les votes « pour » sont publiés.
  if (s[2] === 'MOC' || !enMandat(mes.depute, s[1])) return null;
  return <span className="ma-position position-absent">Mon député : absent</span>;
}

/** Carte d'un vote clé (texte, article, motion). */
export function CarteScrutin({
  s,
  direct = false,
  mes,
  texte,
}: {
  s: ScrutinResume;
  direct?: boolean;
  mes: MesVotes | null;
  /** nom du texte, affiché quand la carte n'est pas déjà rangée sous son texte */
  texte?: string | null;
}) {
  const [num, date, type, adopte, titre, pour, contre, abs] = s;
  const { nature, objet, texte: cite, lecture } = decouper(titre);
  const nomTexte = texte === undefined ? null : texte ?? cite;
  return (
    <li>
      <Link to={`/scrutins/${num}`} className="carte-scrutin">
        <small>
          {formatDate(date)} · n° {num}
          <b className={`badge nature-${nature}`}>{LIBELLES_NATURE[nature]}</b>
          {type === 'SPS' && <b className="badge">Solennel</b>}
          {direct && <b className="badge direct">En direct</b>}
        </small>
        <span className="titre">{objet}</span>
        {nomTexte && (
          <span className="texte-cite">
            {nomTexte}
            {lecture && ` · ${lecture}`}
          </span>
        )}
        <BarreVote pour={pour} contre={contre} abs={abs} />
        <span className="carte-scrutin-pied">
          <span className={adopte ? 'sort adopte' : 'sort rejete'}>{adopte ? 'Adopté' : 'Rejeté'}</span>
          <MaPosition s={s} mes={mes} />
          <span className="chiffres">
            {type === 'MOC' ? (
              <>{pour} voix pour la censure</>
            ) : (
              <>
                <b className="t-p">{pour}</b> pour · <b className="t-c">{contre}</b> contre · <b className="t-a">{abs}</b> abst.
              </>
            )}
          </span>
        </span>
      </Link>
    </li>
  );
}

/** Ligne compacte d'un amendement : objet, résultat, position de mon député. */
export function LigneAmendement({ s, mes, avecDate = false }: { s: ScrutinResume; mes: MesVotes | null; avecDate?: boolean }) {
  const [num, date, , adopte, titre, pour, contre] = s;
  const { objet } = decouper(titre);
  return (
    <li>
      <Link to={`/scrutins/${num}`} className="ligne-amendement">
        <span className="ligne-amendement-objet">
          {avecDate && <small>{formatDateCourte(date)} · </small>}
          {objet}
        </span>
        <span className="ligne-amendement-pied">
          <span className={adopte ? 'sort adopte' : 'sort rejete'}>{adopte ? 'Adopté' : 'Rejeté'}</span>
          <small>
            {pour} pour · {contre} contre
          </small>
          <MaPosition s={s} mes={mes} />
        </span>
      </Link>
    </li>
  );
}

/** Amendements repliés derrière un bouton, ouverts d'office pendant une recherche. */
export function BlocAmendements({
  liste,
  mes,
  ouvertParDefaut = false,
  avecDate = false,
}: {
  liste: ScrutinResume[];
  mes: MesVotes | null;
  ouvertParDefaut?: boolean;
  avecDate?: boolean;
}) {
  // Le bloc reste ouvert au retour arrière. Son nom : son premier scrutin, unique dans l'écran.
  const nom = `amendements-${liste[0]?.[0]}-${ouvertParDefaut}`;
  const [ouvert, setOuvert] = useEtatDePage(`${nom}:ouvert`, ouvertParDefaut);
  const [limite, setLimite] = useEtatDePage(`${nom}:limite`, 30);
  if (!liste.length) return null;
  const adoptes = liste.filter((s) => s[3]).length;
  return (
    <div className="bloc-amendements">
      <button className="bloc-amendements-bouton" aria-expanded={ouvert} onClick={() => setOuvert(!ouvert)}>
        <span>
          {ouvert ? '▾' : '▸'} {liste.length} amendement{liste.length > 1 ? 's' : ''} mis aux voix
        </span>
        <small>
          {adoptes} adopté{adoptes > 1 ? 's' : ''}
        </small>
      </button>
      {ouvert && (
        <>
          <ul className="liste-amendements">
            {liste.slice(0, limite).map((s) => (
              <LigneAmendement key={s[0]} s={s} mes={mes} avecDate={avecDate} />
            ))}
          </ul>
          {liste.length > limite && (
            <button className="lien" onClick={() => setLimite(limite + 60)}>
              Voir {Math.min(60, liste.length - limite)} de plus
            </button>
          )}
        </>
      )}
    </div>
  );
}
