// Parcours d'accueil au premier lancement : présentation, mon député, notifications.
// Chaque étape peut être passée ; l'application s'ouvre ensuite sur « Mon député ».

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Chargement, Pastille } from './components';
import { type Choix, circonscription, deputeDuChoix, enregistrerChoix, getMeta, lireChoix, nomComplet, photo } from './data';
import { useAsync } from './hooks';
import { Notifications } from './Notifications';
import { ChoixManuel, RechercheAdresse } from './pages/MonDepute';
import { etatPush, suivreDepute } from './push';

const CLE = 'mon-hemicycle:accueil-vu';

/** Au premier lancement seulement : ni accueil déjà vu, ni député déjà choisi. */
export function accueilAFaire() {
  try {
    return !localStorage.getItem(CLE) && !lireChoix();
  } catch {
    return false;
  }
}

function marquerVu() {
  try {
    localStorage.setItem(CLE, new Date().toISOString());
  } catch {
    // stockage indisponible : l'accueil reviendra au prochain lancement
  }
}

export function Accueil({ onFin }: { onFin: () => void }) {
  const [etape, setEtape] = useState(0);
  // L'étape des notifications n'existe pas là où elles sont indisponibles (application native).
  const [avecNotifications, setAvecNotifications] = useState(true);
  const navigate = useNavigate();
  useEffect(() => {
    etatPush().then((e) => setAvecNotifications(e.statut !== 'indisponible'));
  }, []);

  const total = avecNotifications ? 3 : 2;
  const terminer = () => {
    marquerVu();
    navigate('/');
    window.scrollTo(0, 0);
    onFin();
  };
  const suivante = () => (etape + 1 >= total ? terminer() : setEtape(etape + 1));

  return (
    <div className="accueil">
      <div className="accueil-haut">
        <ol className="accueil-points" aria-label={`Étape ${etape + 1} sur ${total}`}>
          {Array.from({ length: total }, (_, i) => (
            <li key={i} className={i <= etape ? 'fait' : undefined} />
          ))}
        </ol>
        <button className="lien" onClick={terminer}>
          Passer
        </button>
      </div>

      {etape === 0 && <Presentation onSuite={suivante} />}
      {etape === 1 && <MonDeputeEtape onSuite={suivante} derniere={total === 2} />}
      {etape === 2 && <NotificationsEtape onSuite={terminer} />}
    </div>
  );
}

function Presentation({ onSuite }: { onSuite: () => void }) {
  return (
    <section className="accueil-etape">
      <img className="accueil-logo" src={`${import.meta.env.BASE_URL}icon.svg`} alt="" />
      <h1>Les votes de l’Assemblée, en clair</h1>
      <p className="intro">Mon Hémicycle rend lisible ce que font les députés, à partir des données publiques de l’Assemblée nationale.</p>
      <ul className="accueil-atouts">
        <li>
          <b>👤 Votre député</b>
          <span>Ses votes, sa participation et sa présence en commission.</span>
        </li>
        <li>
          <b>🗳️ Chaque scrutin expliqué</b>
          <span>Rangé sous son texte de loi, avec ce que le résultat change.</span>
        </li>
        <li>
          <b>🔔 Prévenu à chaque vote</b>
          <span>Une notification à chaque scrutin, ou à chaque vote de votre député.</span>
        </li>
      </ul>
      <button className="principal large" onClick={onSuite}>
        Commencer
      </button>
      <p className="note">Application indépendante et gratuite, sans compte ni publicité.</p>
    </section>
  );
}

function MonDeputeEtape({ onSuite, derniere }: { onSuite: () => void; derniere: boolean }) {
  const meta = useAsync(getMeta, []);
  const [choix, setChoix] = useState<Choix | null>(lireChoix);
  if (!meta.data) return <Chargement error={meta.error} />;
  const depute = deputeDuChoix(meta.data, choix);

  const choisir = (c: Choix | null) => {
    enregistrerChoix(c);
    setChoix(c);
    if (c) suivreDepute(deputeDuChoix(meta.data!, c)).catch(() => {});
  };

  return (
    <section className="accueil-etape">
      <h1>Qui vous représente ?</h1>
      {depute && choix ? (
        <>
          <p className="intro">📍 {choix.label}</p>
          <div className="accueil-depute">
            <img src={photo(depute.id)} alt="" />
            <div>
              <small>{depute.civ === 'Mme' ? 'Votre députée' : 'Votre député'}</small>
              <strong>{nomComplet(depute)}</strong>
              <small>{circonscription(depute)}</small>
              <Pastille groupe={depute.groupe ? meta.data.groupes[depute.groupe] : undefined} />
            </div>
          </div>
          <button className="principal large" onClick={onSuite}>
            {derniere ? 'C’est parti' : 'Continuer'}
          </button>
          <button className="lien" onClick={() => choisir(null)}>
            Ce n’est pas la bonne adresse
          </button>
        </>
      ) : (
        <>
          <p className="intro">Indiquez votre adresse pour retrouver la personne qui vous représente à l’Assemblée nationale.</p>
          {choix && !depute && <p className="etat erreur">Le siège de cette circonscription est vacant pour le moment.</p>}
          <RechercheAdresse meta={meta.data} onChoix={choisir} />
          <ChoixManuel meta={meta.data} onChoix={choisir} />
          <p className="note">
            L’adresse est envoyée au service de géocodage public de l’IGN, puis seule la circonscription est gardée, sur cet
            appareil.
          </p>
          <button className="lien" onClick={onSuite}>
            Plus tard
          </button>
        </>
      )}
    </section>
  );
}

function NotificationsEtape({ onSuite }: { onSuite: () => void }) {
  return (
    <section className="accueil-etape">
      <h1>Être prévenu</h1>
      <p className="intro">
        Choisissez les scrutins qui vous intéressent. Vous pourrez changer d’avis à tout moment dans l’onglet Scrutins.
      </p>
      <Notifications />
      <button className="principal large" onClick={onSuite}>
        Terminer
      </button>
    </section>
  );
}
