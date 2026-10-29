import { useEffect, useState } from 'react';
import { type EtatPush, type Mode, activer, desactiver, essai, etatPush } from './push';

/** Encart d'abonnement aux notifications de nouveaux scrutins. */
export function Notifications() {
  const [etat, setEtat] = useState<EtatPush | null>(null);
  const [mode, setMode] = useState<Mode>('tous');
  const [message, setMessage] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  const rafraichir = () =>
    etatPush().then((e) => {
      setEtat(e);
      if (e.statut === 'actif') setMode(e.mode);
    });
  useEffect(() => {
    rafraichir();
  }, []);

  if (!etat || etat.statut === 'indisponible') return null;

  const agir = async (action: () => Promise<unknown>, succes: string) => {
    setOccupe(true);
    setMessage(null);
    try {
      await action();
      setMessage(succes);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setOccupe(false);
      rafraichir();
    }
  };

  return (
    <section className="notifications">
      <strong>🔔 Nouveaux scrutins</strong>
      {etat.statut === 'a-installer' && (
        <p>
          Pour recevoir les notifications sur iPhone, ajoutez d'abord l'application à l'écran d'accueil : bouton
          Partager, puis « Sur l'écran d'accueil ». Ouvrez-la ensuite depuis son icône.
        </p>
      )}
      {etat.statut === 'refuse' && (
        <p>Les notifications sont bloquées. Autorisez-les dans les réglages du téléphone pour cette application.</p>
      )}
      {(etat.statut === 'inactif' || etat.statut === 'actif') && (
        <>
          <div className="filtres petits" role="group" aria-label="Quels scrutins">
            <button aria-pressed={mode === 'tous'} onClick={() => setMode('tous')}>
              Tous les scrutins
            </button>
            <button aria-pressed={mode === 'importants'} onClick={() => setMode('importants')}>
              Textes et censures
            </button>
          </div>
          <div className="notifications-actions">
            {etat.statut === 'inactif' || etat.mode !== mode ? (
              <button className="principal" disabled={occupe} onClick={() => agir(() => activer(mode), 'Notifications activées.')}>
                {etat.statut === 'actif' ? 'Enregistrer' : 'Me prévenir'}
              </button>
            ) : (
              <button className="secondaire" disabled={occupe} onClick={() => agir(essai, 'Notification d’essai envoyée.')}>
                Envoyer un essai
              </button>
            )}
            {etat.statut === 'actif' && (
              <button className="lien" disabled={occupe} onClick={() => agir(desactiver, 'Notifications désactivées.')}>
                Désactiver
              </button>
            )}
          </div>
          <small>
            {mode === 'tous'
              ? 'Une notification à chaque scrutin, regroupée quand plusieurs votes s’enchaînent.'
              : 'Seulement les votes sur l’ensemble d’un texte et les motions de censure.'}
          </small>
        </>
      )}
      {message && <p className="note">{message}</p>}
    </section>
  );
}
