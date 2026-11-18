import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Chargement } from '../components';
import { type ScrutinResume, type Texte, formatDate, getMesVotes, getScrutinsAJour, getTextes } from '../data';
import { BandeauRetour } from '../design/Bandeau';
import { useAsync } from '../hooks';
import { decouper, estAmendement, natureDe } from '../lecture';
import { CarteScrutin, LigneAmendement } from '../ScrutinsUI';

type FiltreAmdt = 'tous' | 'adoptes' | 'rejetes';

/** Un texte de loi : son parcours, ses votes clés et l'historique des votes sur les amendements. */
export function TextePage() {
  const id = useParams().id ?? '';
  const donnees = useAsync(() => Promise.all([getScrutinsAJour(), getTextes().catch(() => ({}) as Record<string, Texte>), getMesVotes().catch(() => null)]), []);
  const [filtre, setFiltre] = useState<FiltreAmdt>('tous');
  const [limite, setLimite] = useState(50);

  if (!donnees.data) return <Chargement error={donnees.error} />;
  const [{ scrutins, dossiers, direct }, textes, mes] = donnees.data;
  const sansTexte = id === 'autres';
  const liste = scrutins.filter((s) => (sansTexte ? !s[9] : s[9] === id));
  if (!liste.length) return <p className="etat erreur">Texte introuvable.</p>;

  const texte = textes[id];
  const titre = sansTexte ? 'Autres votes' : texte?.t ?? dossiers[id] ?? decouper(liste[0][4]).texte ?? 'Texte';
  const cles = liste.filter((s) => !estAmendement(natureDe(s[4])));
  const amendements = liste.filter((s) => estAmendement(natureDe(s[4])));
  const filtres = amendements.filter((s) => filtre === 'tous' || (filtre === 'adoptes' ? s[3] : !s[3]));

  // Historique : amendements regroupés par jour de séance.
  const parJour = new Map<string, ScrutinResume[]>();
  for (const s of filtres.slice(0, limite)) {
    const g = parJour.get(s[1]);
    if (g) g.push(s);
    else parJour.set(s[1], [s]);
  }

  const etapes = texte?.e ?? [];
  const depot = etapes.map(([, , d]) => d).find((d): d is string => !!d);
  // Durée au Parlement : du premier dépôt à la promulgation, ou à aujourd'hui si le texte est en cours.
  const promulgation = etapes.find(([lieu]) => lieu === 'Promulgation');
  const fin = promulgation?.[4] ?? promulgation?.[2] ?? new Date().toISOString().slice(0, 10);
  const duree = depot ? moisEntre(depot, fin) : null;
  const sort = etapes.at(-1)?.[3];

  return (
    <>
      <BandeauRetour surtitre="Les scrutins">
        <p className="bandeau-procedure">{sansTexte ? 'Procédure et textes non identifiés' : (texte?.p ?? 'Texte')}</p>
        <h1>{titre}</h1>
        <p className="bandeau-pied">
          {duree != null && `${duree < 1 ? 'Moins d’un mois' : `${duree} mois`} au Parlement · `}
          {liste.length} scrutin{liste.length > 1 ? 's' : ''}
          {sort && ` · ${sort.split(',')[0].toLowerCase()}`}
        </p>
        {texte?.i && (
          <p className="bandeau-pied">
            Initiative : {texte.i === 'Gouvernement' ? 'le Gouvernement (projet de loi)' : `des ${texte.i.toLowerCase()}`}
          </p>
        )}
      </BandeauRetour>

      <div className="page">
      {texte && texte.e.length > 0 && (
        <section>
          <div className="bloc-tete titre-section">
            <h2>Le parcours</h2>
            <span className="compte">
              {texte.e.length} étape{texte.e.length > 1 ? 's' : ''}
            </span>
          </div>
          {/* Après un rejet en lecture ordinaire, la navette continue ; pas après une lecture définitive. */}
          {texte.e.some(([, etape, , issue]) => issue === 'rejeté' && !/définitive/i.test(etape)) && (
            <p className="note">Un rejet n’arrête pas forcément le texte : en cours de navette, il repart à l’autre chambre.</p>
          )}
          <ol className="parcours">
            {texte.e.map(([lieu, etape, debut, issue, dateIssue], i) => {
              const derniere = i === texte.e.length - 1;
              // Une étape terminée est datée par son issue (le vote) ; une étape en cours, par son début.
              const quand = issue && dateIssue ? formatDate(dateIssue) : debut ? (derniere ? `en cours depuis le ${formatDate(debut)}` : formatDate(debut)) : null;
              return (
                <li key={i} className={derniere ? 'actuelle' : undefined}>
                  <b>{lieu}</b>
                  <span>
                    {etape}
                    {quand && ` · ${quand}`}
                  </span>
                  {issue && <small data-issue={issue}>{issue}</small>}
                </li>
              );
            })}
          </ol>
        </section>
      )}
      {!sansTexte && (
        <p className="note">
          <a href={`https://www.assemblee-nationale.fr/dyn/17/dossiers/${id}`} target="_blank" rel="noreferrer">
            Le dossier complet sur assemblee-nationale.fr ↗
          </a>
        </p>
      )}

      {cles.length > 0 && (
        <section>
          <div className="bloc-tete titre-section">
            <h2>Les votes clés</h2>
            <span className="compte">
              {cles.length} sur {liste.length}
            </span>
          </div>
          <ul className="liste">
            {cles.map((s) => (
              <CarteScrutin key={s[0]} s={s} direct={direct.has(s[0])} mes={mes} />
            ))}
          </ul>
        </section>
      )}

      {amendements.length > 0 && (
        <details className="repli">
          <summary>
            {amendements.length} amendement{amendements.length > 1 ? 's' : ''} mis aux voix, avec l’exposé de leur auteur
          </summary>
          <div className="filtres petits" role="group" aria-label="Filtrer les amendements">
            {(
              [
                ['tous', 'Tous'],
                ['adoptes', `Adoptés (${amendements.filter((s) => s[3]).length})`],
                ['rejetes', `Rejetés (${amendements.filter((s) => !s[3]).length})`],
              ] as [FiltreAmdt, string][]
            ).map(([f, label]) => (
              <button key={f} aria-pressed={filtre === f} onClick={() => setFiltre(f)}>
                {label}
              </button>
            ))}
          </div>
          {[...parJour].map(([jour, lignes]) => (
            <div key={jour} className="historique-jour">
              <h3>{formatDate(jour)}</h3>
              <ul className="liste-amendements">
                {lignes.map((s) => (
                  <LigneAmendement key={s[0]} s={s} mes={mes} />
                ))}
              </ul>
            </div>
          ))}
          {filtres.length > limite && (
            <button className="plus" onClick={() => setLimite(limite + 100)}>
              Voir plus d’amendements
            </button>
          )}
        </details>
      )}
      </div>
    </>
  );
}

/** Nombre de mois entiers entre deux dates ISO. */
function moisEntre(debut: string, fin: string) {
  const a = new Date(`${debut}T12:00:00`);
  const b = new Date(`${fin}T12:00:00`);
  return Math.max(0, (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth());
}
