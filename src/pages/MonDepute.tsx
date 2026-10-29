import { useEffect, useMemo, useState } from 'react';
import { Chargement } from '../components';
import {
  type Adresse,
  type Choix,
  type Meta,
  chercherAdresses,
  enregistrerChoix,
  getMeta,
  lireChoix,
  trouverCirconscription,
} from '../data';
import { useAsync } from '../hooks';
import { DeputeVue } from './Depute';

export function MonDepute() {
  const meta = useAsync(getMeta, []);
  const [choix, setChoix] = useState<Choix | null>(lireChoix);

  if (!meta.data) return <Chargement error={meta.error} />;

  const choisir = (c: Choix | null) => {
    enregistrerChoix(c);
    setChoix(c);
  };

  const depute = choix && meta.data.deputes.find((d) => d.actif && d.depNum === choix.depNum && d.circo === choix.circo);

  if (choix && depute) {
    return (
      <>
        <div className="adresse-choisie">
          <span>📍 {choix.label}</span>
          <button className="lien" onClick={() => choisir(null)}>
            Changer
          </button>
        </div>
        <DeputeVue id={depute.id} />
      </>
    );
  }

  return (
    <div className="page">
      <h1>Qui est mon député ?</h1>
      <p className="intro">
        Indiquez votre adresse pour retrouver la personne qui vous représente à l'Assemblée nationale, ses votes et sa
        présence.
      </p>
      {choix && !depute && (
        <p className="etat erreur">
          Le siège de cette circonscription est vacant pour le moment. Essayez une autre adresse.
        </p>
      )}
      <RechercheAdresse meta={meta.data} onChoix={choisir} />
      <ChoixManuel meta={meta.data} onChoix={choisir} />
      <p className="note">
        L'adresse est envoyée au service de géocodage public de l'IGN (Géoplateforme) puis seule la circonscription est
        gardée, sur cet appareil.
      </p>
    </div>
  );
}

function RechercheAdresse({ meta, onChoix }: { meta: Meta; onChoix: (c: Choix) => void }) {
  const [q, setQ] = useState('');
  const [resultats, setResultats] = useState<Adresse[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(() => chercherAdresses(q, ctrl.signal).then(setResultats, () => {}), 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const valider = async (a: Adresse) => {
    setMessage('Recherche de la circonscription…');
    const circo = await trouverCirconscription(a.dep, a.lon, a.lat);
    if (circo == null || !meta.deputes.some((d) => d.depNum === a.dep)) {
      setMessage("Circonscription introuvable pour cette adresse. Choisissez-la dans la liste ci-dessous.");
      return;
    }
    setMessage(null);
    onChoix({ depNum: a.dep, circo, label: a.label });
  };

  return (
    <div className="recherche">
      <label htmlFor="adresse">Mon adresse</label>
      <input
        id="adresse"
        type="search"
        autoComplete="street-address"
        placeholder="12 rue de la République, Lyon"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {resultats.length > 0 && (
        <ul className="suggestions">
          {resultats.map((a) => (
            <li key={a.label}>
              <button onClick={() => valider(a)}>{a.label}</button>
            </li>
          ))}
        </ul>
      )}
      {message && <p className="etat">{message}</p>}
    </div>
  );
}

function ChoixManuel({ meta, onChoix }: { meta: Meta; onChoix: (c: Choix) => void }) {
  const [dep, setDep] = useState('');
  const departements = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of meta.deputes) if (d.actif && d.depNum && d.dep) m.set(d.depNum, d.dep);
    return [...m].sort(([a], [b]) => a.localeCompare(b));
  }, [meta]);
  const circos = meta.deputes
    .filter((d) => d.actif && d.depNum === dep && d.circo)
    .sort((a, b) => a.circo! - b.circo!);

  return (
    <details className="choix-manuel">
      <summary>Je connais ma circonscription, ou je vis à l'étranger</summary>
      <div className="champs">
        <select value={dep} onChange={(e) => setDep(e.target.value)} aria-label="Département">
          <option value="">Département…</option>
          {departements.map(([num, nom]) => (
            <option key={num} value={num}>
              {num === '099' ? nom : `${num} · ${nom}`}
            </option>
          ))}
        </select>
        <select
          disabled={!dep}
          value=""
          aria-label="Circonscription"
          onChange={(e) => {
            const d = circos.find((x) => String(x.circo) === e.target.value)!;
            onChoix({ depNum: dep, circo: d.circo!, label: `${d.dep}, ${d.circo}${d.circo === 1 ? 're' : 'e'} circonscription` });
          }}
        >
          <option value="">Circonscription…</option>
          {circos.map((d) => (
            <option key={d.id} value={d.circo!}>
              {d.circo}
              {d.circo === 1 ? 're' : 'e'} · {d.prenom} {d.nom}
            </option>
          ))}
        </select>
      </div>
    </details>
  );
}
