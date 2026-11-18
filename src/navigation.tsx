// Ce qui se passe quand on change d'écran : la position dans la page, l'état des listes,
// le titre de l'onglet et le focus du lecteur d'écran.
//
// Chaque entrée de l'historique a sa clé (location.key). On y range la position de
// défilement et l'état des listes (« Voir plus », filtres) : au retour arrière, on
// retrouve la page telle qu'on l'avait quittée ; en ouvrant un écran, on part du haut.

import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

const PREFIXE = 'mon-hemicycle:page:';
const NOM_APP = 'Mon Hémicycle';

function lire<T>(cle: string): T | undefined {
  try {
    const v = sessionStorage.getItem(PREFIXE + cle);
    return v == null ? undefined : (JSON.parse(v) as T);
  } catch {
    return undefined;
  }
}

function ecrire(cle: string, valeur: unknown) {
  try {
    sessionStorage.setItem(PREFIXE + cle, JSON.stringify(valeur));
  } catch {
    // stockage indisponible : la page repartira de zéro au retour
  }
}

/**
 * Comme useState, mais l'état est rattaché à l'entrée de l'historique : il revient
 * tel quel au retour arrière, et repart de `initial` quand on rouvre l'écran.
 */
export function useEtatDePage<T>(nom: string, initial: T | (() => T)): [T, (v: T) => void] {
  const { key } = useLocation();
  const cle = `${key}:${nom}`;
  const [valeur, setValeur] = useState<T>(() => {
    const memo = lire<T>(cle);
    if (memo !== undefined) return memo;
    return typeof initial === 'function' ? (initial as () => T)() : initial;
  });
  const changer = useCallback(
    (v: T) => {
      setValeur(v);
      ecrire(cle, v);
    },
    [cle],
  );
  return [valeur, changer];
}

/** Attend que la condition soit vraie, image par image, au plus `duree` ms. */
function attendre(condition: () => boolean, duree: number, fin: (ok: boolean) => void) {
  const debut = performance.now();
  let id = 0;
  const tour = () => {
    if (condition()) return fin(true);
    if (performance.now() - debut > duree) return fin(false);
    id = requestAnimationFrame(tour);
  };
  id = requestAnimationFrame(tour);
  return () => cancelAnimationFrame(id);
}

/** Position de défilement, titre de l'onglet et focus, à chaque changement d'écran. */
export function GestionNavigation() {
  const { key } = useLocation();
  const type = useNavigationType();

  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  }, []);

  // Mémorise la position de la page courante. useLayoutEffect : l'écouteur est retiré
  // avant que le nouvel écran, plus court, ne ramène la page en haut.
  useLayoutEffect(() => {
    let image = 0;
    const noter = () => {
      cancelAnimationFrame(image);
      image = requestAnimationFrame(() => ecrire(`${key}:defilement`, Math.round(window.scrollY)));
    };
    window.addEventListener('scroll', noter, { passive: true });
    return () => {
      cancelAnimationFrame(image);
      window.removeEventListener('scroll', noter);
    };
  }, [key]);

  useEffect(() => {
    const premierAffichage = !NavigationVue.deja;
    NavigationVue.deja = true;
    const arretes: (() => void)[] = [];

    // Position : celle qu'on avait quittée au retour arrière, le haut sinon. Les données
    // arrivent après coup : on réessaie jusqu'à ce que la page soit assez longue.
    const cible = type === 'POP' ? (lire<number>(`${key}:defilement`) ?? 0) : 0;
    window.scrollTo(0, cible);
    if (cible > 0) {
      let touche = false;
      const lacher = () => (touche = true);
      const evenements = ['wheel', 'touchstart', 'keydown', 'mousedown'] as const;
      evenements.forEach((e) => window.addEventListener(e, lacher, { passive: true, once: true }));
      arretes.push(() => evenements.forEach((e) => window.removeEventListener(e, lacher)));
      arretes.push(
        attendre(
          () => {
            if (touche) return true;
            window.scrollTo(0, cible);
            return Math.abs(window.scrollY - cible) < 2;
          },
          5000,
          () => undefined,
        ),
      );
    }

    // Titre de l'onglet, et focus sur le titre de l'écran pour le lecteur d'écran.
    // Pas de focus au premier affichage : le lecteur d'écran lit déjà la page.
    arretes.push(
      attendre(
        () => !!document.querySelector('main h1'),
        5000,
        (ok) => {
          const h1 = document.querySelector<HTMLElement>('main h1');
          if (!ok || !h1) {
            document.title = NOM_APP;
            return;
          }
          const titre = (h1.dataset.titre ?? h1.innerText).replace(/\s+/g, ' ').trim();
          document.title = titre ? `${titre} · ${NOM_APP}` : NOM_APP;
          if (!premierAffichage) {
            h1.setAttribute('tabindex', '-1');
            h1.focus({ preventScroll: true });
          }
        },
      ),
    );
    return () => arretes.forEach((f) => f());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return null;
}

const NavigationVue = { deja: false };
