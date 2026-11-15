// =============================================================================
// Encre et couleur — les bandeaux
// =============================================================================
// Une seule couleur pleine par écran, et c'est elle : le jaune de marque porte
// le titre de l'écran. Les écrans de détail portent la flèche de retour et le
// nom de l'application à la place du titre.

import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Marque } from './Illustrations';

/** Le bandeau d'un onglet : son titre, parfois une phrase, parfois un champ. */
export function BandeauPage({ titre, intro, children }: { titre: ReactNode; intro?: ReactNode; children?: ReactNode }) {
  return (
    <header className="bandeau bandeau-page">
      <span className="bandeau-decor" aria-hidden />
      <h1>{titre}</h1>
      {intro && <p className="bandeau-intro">{intro}</p>}
      {children}
    </header>
  );
}

/** Le bandeau d'un écran de détail : on en revient, donc la flèche d'abord. */
export function BandeauRetour({ titre, surtitre }: { titre?: ReactNode; surtitre?: ReactNode }) {
  const navigate = useNavigate();
  return (
    <header className="bandeau bandeau-retour">
      <span className="bandeau-decor" aria-hidden />
      <div className="bandeau-marque">
        <button type="button" className="retour" onClick={() => navigate(-1)} aria-label="Revenir à l'écran précédent">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <Marque taille={30} />
        <span>Mon Hémicycle</span>
      </div>
      {surtitre && <p className="bandeau-surtitre">{surtitre}</p>}
      {titre && <h1>{titre}</h1>}
    </header>
  );
}
