import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Chargement } from '../components';
import { type ScrutinResume, type Texte, formatDate, getMesVotes, getScrutinsAJour, getTextes } from '../data';
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

  return (
    <div className="page">
      <p className="surtitre">{sansTexte ? 'Procédure et textes non identifiés' : texte?.p ?? 'Texte'}</p>
      <h1 className="titre-scrutin">{titre}</h1>
      {texte?.i && <p className="date">Initiative : {texte.i === 'Gouvernement' ? 'le Gouvernement (projet de loi)' : `des ${texte.i.toLowerCase()}`}</p>}

      {texte && texte.e.length > 0 && (
        <section>
          <h2>Parcours du texte</h2>
          <ol className="parcours">
            {texte.e.map(([lieu, etape, date, issue], i) => (
              <li key={i} className={i === texte.e.length - 1 ? 'actuelle' : undefined}>
                <b>{lieu}</b>
                <span>
                  {etape}
                  {date && ` · ${formatDate(date)}`}
                </span>
                {issue && <small>{issue}</small>}
              </li>
            ))}
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
          <h2>Votes clés ({cles.length})</h2>
          <ul className="liste">
            {cles.map((s) => (
              <CarteScrutin key={s[0]} s={s} direct={direct.has(s[0])} mes={mes} />
            ))}
          </ul>
        </section>
      )}

      {amendements.length > 0 && (
        <section>
          <h2>Amendements mis aux voix ({amendements.length})</h2>
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
        </section>
      )}
    </div>
  );
}
