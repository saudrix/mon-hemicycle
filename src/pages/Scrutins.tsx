import { useDeferredValue, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarreVote, Chargement } from '../components';
import { Notifications } from '../Notifications';
import { type ScrutinResume, formatDate, getScrutinsAJour } from '../data';
import { useAsync } from '../hooks';

type Filtre = 'tous' | 'SPS' | 'MOC';

const normaliser = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export function Scrutins() {
  const donnees = useAsync(getScrutinsAJour, []);
  const [q, setQ] = useState('');
  const [filtre, setFiltre] = useState<Filtre>('tous');
  const [limite, setLimite] = useState(40);
  const recherche = useDeferredValue(q);

  const liste = useMemo(() => {
    if (!donnees.data) return [];
    const mots = normaliser(recherche).split(/\s+/).filter(Boolean);
    const { dossiers, scrutins } = donnees.data;
    return scrutins.filter((s) => {
      if (filtre !== 'tous' && s[2] !== filtre) return false;
      if (!mots.length) return true;
      const texte = normaliser(`${s[4]} ${s[9] ? dossiers[s[9]] : ''} ${s[0]}`);
      return mots.every((m) => texte.includes(m));
    });
  }, [donnees.data, recherche, filtre]);

  if (!donnees.data) return <Chargement error={donnees.error} />;

  return (
    <div className="page">
      <h1>Scrutins</h1>
      <Notifications />
      <input
        type="search"
        className="champ-recherche"
        placeholder="Rechercher : retraites, budget, n° 4512…"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setLimite(40);
        }}
      />
      <div className="filtres" role="group" aria-label="Type de scrutin">
        {(
          [
            ['tous', 'Tous'],
            ['SPS', 'Solennels'],
            ['MOC', 'Motions de censure'],
          ] as [Filtre, string][]
        ).map(([f, label]) => (
          <button key={f} aria-pressed={filtre === f} onClick={() => setFiltre(f)}>
            {label}
          </button>
        ))}
      </div>
      <p className="compte">{liste.length.toLocaleString('fr-FR')} scrutins</p>
      <ul className="liste">
        {liste.slice(0, limite).map((s) => (
          <CarteScrutin key={s[0]} s={s} direct={donnees.data!.direct.has(s[0])} />
        ))}
      </ul>
      {liste.length > limite && (
        <button className="plus" onClick={() => setLimite(limite + 60)}>
          Voir plus
        </button>
      )}
    </div>
  );
}

function CarteScrutin({ s, direct }: { s: ScrutinResume; direct: boolean }) {
  const [num, date, type, adopte, titre, pour, contre, abs] = s;
  return (
    <li>
      <Link to={`/scrutins/${num}`} className="carte-scrutin">
        <small>
          {formatDate(date)} · n° {num}
          {type === 'SPS' && <b className="badge">Solennel</b>}
          {type === 'MOC' && <b className="badge">Censure</b>}
          {direct && <b className="badge direct">En direct</b>}
        </small>
        <span className="titre">{titre}</span>
        <BarreVote pour={pour} contre={contre} abs={abs} />
        <span className="carte-scrutin-pied">
          <span className={adopte ? 'sort adopte' : 'sort rejete'}>{adopte ? 'Adopté' : 'Rejeté'}</span>
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
