import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { type Depute, type Groupe, type Position, POSITIONS, circonscription, nomComplet, photo, pct } from './data';

export function Chargement({ error }: { error?: Error }) {
  if (error) return <p className="etat erreur">{error.message}</p>;
  return (
    <div className="etat" aria-live="polite">
      <span className="spinner" aria-hidden /> Chargement…
    </div>
  );
}

export function Pastille({ groupe }: { groupe?: Groupe }) {
  if (!groupe) return null;
  return (
    <span className="pastille" title={groupe.nom}>
      <i style={{ background: groupe.couleur }} />
      {groupe.abrev}
    </span>
  );
}

export function PositionChip({ position }: { position: Position }) {
  return <span className={`position position-${position}`}>{POSITIONS[position]}</span>;
}

/** Barre empilée pour / contre / abstention (et non-votants si fournis). */
export function BarreVote({ pour, contre, abs, nv = 0, total }: { pour: number; contre: number; abs: number; nv?: number; total?: number }) {
  const t = total ?? pour + contre + abs + nv;
  if (!t) return <div className="barre vide" />;
  const w = (n: number) => `${(n / t) * 100}%`;
  return (
    <div className="barre" role="img" aria-label={`${pour} pour, ${contre} contre, ${abs} abstentions`}>
      <span className="b-p" style={{ width: w(pour) }} />
      <span className="b-c" style={{ width: w(contre) }} />
      <span className="b-a" style={{ width: w(abs) }} />
      {nv > 0 && <span className="b-n" style={{ width: w(nv) }} />}
    </div>
  );
}

export function Jauge({ valeur, couleur }: { valeur: number | null; couleur?: string }) {
  return (
    <div className="jauge">
      <span style={{ width: `${(valeur ?? 0) * 100}%`, background: couleur }} />
    </div>
  );
}

export function Stat({ label, valeur, detail }: { label: string; valeur: ReactNode; detail?: ReactNode }) {
  return (
    <div className="stat">
      <span className="stat-valeur">{valeur}</span>
      <span className="stat-label">{label}</span>
      {detail && <span className="stat-detail">{detail}</span>}
    </div>
  );
}

export function CarteDepute({ depute, groupe, taux }: { depute: Depute; groupe?: Groupe; taux?: number | null }) {
  return (
    <Link to={`/deputes/${depute.id}`} className="carte-depute">
      <img src={photo(depute.id)} alt="" loading="lazy" />
      <div>
        <strong>{nomComplet(depute)}</strong>
        <small>{circonscription(depute)}</small>
        <Pastille groupe={groupe} />
      </div>
      {taux !== undefined && <span className="carte-taux">{pct(taux)}</span>}
    </Link>
  );
}

export function Aide({ children }: { children: ReactNode }) {
  return (
    <details className="aide">
      <summary>Comment lire ce chiffre ?</summary>
      <div>{children}</div>
    </details>
  );
}
