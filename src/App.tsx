import { useEffect } from 'react';
import { HashRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { getMeta, formatDate } from './data';
import { useAsync } from './hooks';
import { DeputePage } from './pages/Depute';
import { MonDepute } from './pages/MonDepute';
import { Presence } from './pages/Presence';
import { Scrutin } from './pages/Scrutin';
import { Scrutins } from './pages/Scrutins';

// HashRouter : les URL restent valides sur un hébergement statique (GitHub Pages) sans réécriture serveur.
export function App() {
  return (
    <HashRouter>
      <HautDePage />
      <header className="barre-titre">
        <span className="logo" aria-hidden>
          <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" />
        </span>
        <span>Mon Hémicycle</span>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<MonDepute />} />
          <Route path="/scrutins" element={<Scrutins />} />
          <Route path="/scrutins/:num" element={<Scrutin />} />
          <Route path="/presence" element={<Presence />} />
          <Route path="/deputes/:id" element={<DeputePage />} />
        </Routes>
        <Source />
      </main>
      <nav className="onglets-bas" aria-label="Navigation principale">
        <NavLink to="/" end>
          <Icone d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0" />
          Mon député
        </NavLink>
        <NavLink to="/scrutins">
          <Icone d="M4 20h16M6 16V9m4 7V5m4 11v-6m4 6V7" />
          Scrutins
        </NavLink>
        <NavLink to="/presence">
          <Icone d="M4 5h16v15H4zM4 10h16M9 3v4m6-4v4m-7 7 2.5 2.5L16 12" />
          Présence
        </NavLink>
      </nav>
    </HashRouter>
  );
}

function Icone({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

function HautDePage() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function Source() {
  const meta = useAsync(getMeta, []);
  return (
    <footer className="source">
      Données : open data de l'Assemblée nationale (Licence Ouverte)
      {meta.data?.dernierScrutin && <>, à jour du {formatDate(meta.data.dernierScrutin)}</>}. Application indépendante,
      non officielle.
    </footer>
  );
}
