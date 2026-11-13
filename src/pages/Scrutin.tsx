import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BarreVote, Chargement, Pastille, PositionChip } from '../components';
import {
  type Amendement,
  type GroupeVote,
  type Meta,
  type Position,
  type ScrutinDirect,
  POSITIONS,
  TYPES_SCRUTIN,
  formatDate,
  getMeta,
  getScrutinDetail,
  getRecents,
  getScrutins,
  lireChoix,
  positionDe,
  positionMajoritaire,
} from '../data';
import { useAsync } from '../hooks';
import { LIBELLES_NATURE, decouper, portee } from '../lecture';

export function Scrutin() {
  const num = Number(useParams().num);
  const donnees = useAsync(
    () => Promise.all([getMeta(), getScrutins(), getScrutinDetail(num).catch(() => undefined), getRecents()]),
    [num],
  );
  if (!donnees.data) return <Chargement error={donnees.error} />;
  const [meta, { scrutins, dossiers }, detail, recents] = donnees.data;
  const s = scrutins.find((x) => x[0] === num);
  if (!s || !detail) {
    const direct = recents.find((x) => x.num === num);
    return direct ? <ScrutinDirectVue s={direct} /> : <p className="etat erreur">Scrutin introuvable.</p>;
  }

  const [, date, type, adopte, titre, pour, contre, abs, nv, dossier] = s;
  const choix = lireChoix();
  const monDepute = choix && meta.deputes.findIndex((d) => d.actif && d.depNum === choix.depNum && d.circo === choix.circo);
  const maPosition =
    monDepute != null && monDepute >= 0
      ? positionDe(detail, monDepute)
      : undefined;
  const votants = pour + contre + abs;
  const lecture = decouper(titre);
  const nomTexte = (dossier && dossiers[dossier]) || lecture.texte;
  const consequence = portee(lecture.nature, !!adopte, lecture.lecture);

  return (
    <div className="page">
      <p className="surtitre">
        {LIBELLES_NATURE[lecture.nature]} · {TYPES_SCRUTIN[type] ?? type} · n° {num}
      </p>
      <h1 className="titre-scrutin">{lecture.objet}</h1>
      <p className="date">{formatDate(date)}</p>
      {nomTexte &&
        (dossier ? (
          <Link to={`/textes/${dossier}`} className="lien-texte">
            <span>
              📁 {nomTexte}
              {lecture.lecture && <small> · {lecture.lecture}</small>}
            </span>
            <span aria-hidden>›</span>
          </Link>
        ) : (
          <p className="dossier">📁 {nomTexte}</p>
        ))}

      <section className={`resultat ${adopte ? 'adopte' : 'rejete'}`}>
        <strong>{adopte ? 'Adopté' : 'Rejeté'}</strong>
        {type === 'MOC' ? (
          <p>{pour} députés ont voté la censure (majorité requise : 289).</p>
        ) : (
          <>
            <div className="resultat-chiffres">
              <span className="t-p">
                <b>{pour}</b> pour
              </span>
              <span className="t-c">
                <b>{contre}</b> contre
              </span>
              <span className="t-a">
                <b>{abs}</b> abstentions
              </span>
            </div>
            <BarreVote pour={pour} contre={contre} abs={abs} />
            <small>
              {votants} votants{nv ? `, ${nv} non-votant${nv > 1 ? 's' : ''}` : ''} · {detail.typeMajorite}
            </small>
          </>
        )}
      </section>

      {choix && monDepute != null && monDepute >= 0 && (
        <Link to={`/deputes/${meta.deputes[monDepute].id}`} className="mon-vote">
          <span>
            Mon député, {meta.deputes[monDepute].prenom} {meta.deputes[monDepute].nom}
          </span>
          {maPosition ? <PositionChip position={maPosition} /> : <em>n'a pas pris part au vote</em>}
        </Link>
      )}

      {consequence && (
        <section className="portee">
          <h2>Ce que ça change</h2>
          <p>{consequence}</p>
        </section>
      )}

      {detail.amdt && <Expose a={detail.amdt} meta={meta} />}

      <Link to={`/carte?scrutin=${num}`} className="lien-carte">
        🗺️ Voir ce vote sur la carte de France
      </Link>

      <section>
        <h2>Vote des groupes</h2>
        <ul className="liste groupes">
          {[...detail.grp]
            .sort((a, b) => b[1] - a[1])
            .map((g) => (
              <LigneGroupe key={g[0]} g={g} meta={meta} />
            ))}
        </ul>
        <p className="legende">
          <i className="b-p" /> pour <i className="b-c" /> contre <i className="b-a" /> abstention <i className="b-n" />{' '}
          non-votant <i className="b-vide" /> absent
        </p>
      </section>

      <p className="note">Intitulé officiel : {titre}</p>
      {detail.demandeur && <p className="note">Scrutin demandé par : {detail.demandeur}</p>}
      <p className="note">
        <a href={`https://www.assemblee-nationale.fr/dyn/17/scrutins/${num}`} target="_blank" rel="noreferrer">
          Voir sur assemblee-nationale.fr ↗
        </a>
      </p>
    </div>
  );
}

/** Exposé sommaire de l'amendement : le point de vue de son auteur, replié après quelques lignes. */
function Expose({ a, meta }: { a: Amendement; meta: Meta }) {
  const [ouvert, setOuvert] = useState(false);
  const groupe = a.groupe ? meta.groupes[a.groupe] : undefined;
  const long = a.expose.length > 320;
  return (
    <section className="expose">
      <h2>L’auteur explique</h2>
      <p className="expose-auteur">
        {a.gouvernement ? 'Le Gouvernement' : a.auteur}
        {a.signataires > 1 && ` et ${a.signataires - 1} cosignataire${a.signataires > 2 ? 's' : ''}`}
        {groupe && <Pastille groupe={groupe} />}
      </p>
      {a.expose ? (
        <>
          <div className={`expose-texte${ouvert || !long ? '' : ' replie'}`}>
            {a.expose.split('\n').map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          {long && (
            <button className="lien" onClick={() => setOuvert(!ouvert)}>
              {ouvert ? 'Replier' : 'Lire la suite'}
            </button>
          )}
        </>
      ) : (
        <p className="note">L’auteur n’a pas publié d’exposé pour cet amendement.</p>
      )}
      <p className="note">
        Texte rédigé par l’auteur de l’amendement : il présente son point de vue, pas celui de l’Assemblée.{' '}
        <a href={`https://www.assemblee-nationale.fr/dyn/17/amendements/${a.uid}`} target="_blank" rel="noreferrer">
          L’amendement complet ↗
        </a>
      </p>
    </section>
  );
}

/** Scrutin pas encore présent dans l'open data : résumé lu sur le site de l'Assemblée. */
function ScrutinDirectVue({ s }: { s: ScrutinDirect }) {
  return (
    <div className="page">
      <p className="surtitre">
        Scrutin public · n° {s.num} <b className="badge direct">En direct</b>
      </p>
      <h1 className="titre-scrutin">{s.titre}</h1>
      <p className="date">{formatDate(s.date)}</p>
      <section className={`resultat ${s.adopte ? 'adopte' : 'rejete'}`}>
        <strong>{s.adopte ? 'Adopté' : 'Rejeté'}</strong>
        {s.contre != null ? (
          <>
            <div className="resultat-chiffres">
              <span className="t-p"><b>{s.pour}</b> pour</span>
              <span className="t-c"><b>{s.contre}</b> contre</span>
              <span className="t-a"><b>{s.abs}</b> abstentions</span>
            </div>
            <BarreVote pour={s.pour ?? 0} contre={s.contre} abs={s.abs ?? 0} />
          </>
        ) : (
          s.pour != null && <p>{s.pour} députés ont voté pour.</p>
        )}
      </section>
      <p className="note">
        Le détail par groupe et par député sera disponible ici après la mise à jour de cette nuit. En attendant :{' '}
        <a href={`https://www.assemblee-nationale.fr/dyn/17/scrutins/${s.num}`} target="_blank" rel="noreferrer">
          voir sur assemblee-nationale.fr ↗
        </a>
      </p>
    </div>
  );
}

function LigneGroupe({ g, meta }: { g: GroupeVote; meta: Meta }) {
  const [ouvert, setOuvert] = useState(false);
  const [id, membres, pour, contre, abs, nv, majorite, v] = g;
  const groupe = meta.groupes[id];
  const pos = positionMajoritaire(majorite);
  const votants = pour + contre + abs + nv;
  return (
    <li className="ligne-groupe">
      <button onClick={() => setOuvert(!ouvert)} aria-expanded={ouvert}>
        <span className="ligne-groupe-tete">
          <Pastille groupe={groupe ?? { abrev: id, nom: id, couleur: '#999' }} />
          <small>
            {votants}/{membres} ont voté
          </small>
          {pos && votants > 0 && <PositionChip position={pos} />}
        </span>
        <BarreVote pour={pour} contre={contre} abs={abs} nv={nv} total={membres} />
      </button>
      {ouvert && (
        <div className="noms">
          {(['p', 'c', 'a', 'n'] as Position[]).map((p) => {
            const noms = v[p].map((i) => meta.deputes[i]).filter(Boolean);
            if (!noms.length) return null;
            return (
              <p key={p}>
                <b>{POSITIONS[p]}</b> :{' '}
                {noms.map((d, k) => (
                  <span key={d.id}>
                    {k > 0 && ', '}
                    <Link to={`/deputes/${d.id}`}>
                      {d.prenom} {d.nom}
                    </Link>
                  </span>
                ))}
              </p>
            );
          })}
        </div>
      )}
    </li>
  );
}
