import { useDeferredValue, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Chargement } from '../components';
import { Notifications } from '../Notifications';
import {
  type MesVotes,
  type ScrutinResume,
  type Texte,
  formatDate,
  formatDateCourte,
  getMesVotes,
  getMeta,
  getScrutinsAJour,
  getTextes,
} from '../data';
import { BandeauPage } from '../design/Bandeau';
import { BarresParJour, VignetteVote } from '../design/Illustrations';
import { useAsync } from '../hooks';
import { decouper, estAmendement, natureDe } from '../lecture';
import { BlocAmendements, CarteScrutin } from '../ScrutinsUI';

type Filtre = 'tous' | 'SPS' | 'MOC';
type Groupement = 'texte' | 'jour' | 'jour-texte';

const CLE_GROUPEMENT = 'mon-hemicycle:groupement';
const SANS_TEXTE = 'autres';
const PAS = 12;

const normaliser = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

function lireGroupement(): Groupement {
  try {
    const g = localStorage.getItem(CLE_GROUPEMENT);
    return g === 'jour' || g === 'jour-texte' ? g : 'texte';
  } catch {
    return 'texte';
  }
}

/** Regroupe en conservant l'ordre d'apparition (la liste est triée du plus récent au plus ancien). */
function grouper<K>(liste: ScrutinResume[], cle: (s: ScrutinResume) => K) {
  const groupes = new Map<K, ScrutinResume[]>();
  for (const s of liste) {
    const k = cle(s);
    const g = groupes.get(k);
    if (g) g.push(s);
    else groupes.set(k, [s]);
  }
  return [...groupes];
}

const separer = (liste: ScrutinResume[]) => ({
  cles: liste.filter((s) => !estAmendement(natureDe(s[4]))),
  amendements: liste.filter((s) => estAmendement(natureDe(s[4]))),
});

export function Scrutins() {
  const donnees = useAsync(
    () =>
      Promise.all([
        getScrutinsAJour(),
        getTextes().catch(() => ({}) as Record<string, Texte>),
        getMesVotes().catch(() => null),
        getMeta(),
      ]),
    [],
  );
  const [q, setQ] = useState('');
  const [filtre, setFiltre] = useState<Filtre>('tous');
  const [groupement, setGroupementEtat] = useState<Groupement>(lireGroupement);
  const [limite, setLimite] = useState(PAS);
  const recherche = useDeferredValue(q);

  const setGroupement = (g: Groupement) => {
    setGroupementEtat(g);
    setLimite(PAS);
    try {
      localStorage.setItem(CLE_GROUPEMENT, g);
    } catch {
      // stockage indisponible : le choix vaut pour la session
    }
  };

  const liste = useMemo(() => {
    if (!donnees.data) return [];
    const mots = normaliser(recherche).split(/\s+/).filter(Boolean);
    const { dossiers, scrutins } = donnees.data[0];
    return scrutins.filter((s) => {
      if (filtre !== 'tous' && s[2] !== filtre) return false;
      if (!mots.length) return true;
      const texte = normaliser(`${s[4]} ${s[9] ? dossiers[s[9]] : ''} ${s[0]}`);
      return mots.every((m) => texte.includes(m));
    });
  }, [donnees.data, recherche, filtre]);

  if (!donnees.data) return <Chargement error={donnees.error} />;
  const [{ dossiers, direct }, textes, mes, meta] = donnees.data;
  const legislature = meta.legislature;
  const enRecherche = recherche.trim().length > 0;
  const ctx: Contexte = { dossiers, textes, mes, direct, enRecherche };

  const groupes =
    groupement === 'texte' ? grouper(liste, (s) => s[9] ?? SANS_TEXTE) : grouper(liste, (s) => s[1]);

  // Le texte qui se joue maintenant : le plus récent dont l'ensemble n'a pas
  // encore été voté. Il ne s'affiche que sur la liste complète.
  const enCours =
    groupement === 'texte' && !enRecherche && filtre === 'tous'
      ? groupes.find(
          ([id, liste]) =>
            id !== SANS_TEXTE && liste.length > 3 && !liste.some((s) => ['ensemble', 'resolution'].includes(natureDe(s[4]))),
        )
      : undefined;

  return (
    <>
      <BandeauPage
        titre={
          <>
            Que vote
            <br />
            l’Assemblée ?
          </>
        }
      >
        <div className="champ-recherche">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="M16.5 16.5 21 21" />
          </svg>
          <input
            type="search"
            aria-label="Rechercher un texte, un mot-clé ou un numéro de scrutin"
            placeholder="Un texte, un mot-clé, un n°…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setLimite(PAS);
            }}
          />
        </div>
      </BandeauPage>

      <div className="page">
        <div className="bloc-tete surtitre-ligne">
          <span className="surtitre">Regrouper</span>
          <span className="compte">
            {liste.length.toLocaleString('fr-FR')} scrutins ·{' '}
            {groupement === 'texte'
              ? `${groupes.length.toLocaleString('fr-FR')} textes`
              : `${groupes.length.toLocaleString('fr-FR')} jours`}
          </span>
        </div>
        <div className="groupement" role="group" aria-label="Regrouper les scrutins">
          {(
            [
              ['texte', 'Par texte'],
              ['jour', 'Par jour'],
              ['jour-texte', 'Jour puis texte'],
            ] as [Groupement, string][]
          ).map(([g, label]) => (
            <button key={g} aria-pressed={groupement === g} onClick={() => setGroupement(g)}>
              {label}
            </button>
          ))}
        </div>
        <div className="filtres" role="group" aria-label="Type de scrutin">
          {(
            [
              ['tous', 'Tous'],
              ['SPS', 'Solennels'],
              ['MOC', 'Motions de censure'],
            ] as [Filtre, string][]
          ).map(([f, label]) => (
            <button key={f} className="filtre" aria-pressed={filtre === f} onClick={() => setFiltre(f)}>
              {label}
            </button>
          ))}
        </div>

        <Notifications />

        {enCours && <EnDiscussion id={enCours[0]} scrutins={enCours[1]} ctx={ctx} />}

      {groupement === 'texte' ? (
        <>
          <div className="bloc-tete titre-section">
            <h2>Textes votés</h2>
            <span className="compte">
              {legislature}
              <sup>e</sup> législature
            </span>
          </div>
          <ul className="liste">
            {groupes.slice(0, limite).map(([k, scrutins]) => (
              <CarteTexte key={k} id={k} scrutins={scrutins} ctx={ctx} />
            ))}
          </ul>
        </>
      ) : (
        groupes.slice(0, limite).map(([jour, scrutins]) => (
          <Journee key={jour} jour={jour} scrutins={scrutins} ctx={ctx} parTexte={groupement === 'jour-texte'} />
        ))
      )}
        {groupes.length > limite && (
          <button className="plus" onClick={() => setLimite(limite + PAS)}>
            Voir plus
          </button>
        )}
      </div>
    </>
  );
}

/**
 * Le texte en cours de discussion prend la carte pleine couleur : c'est le seul
 * qui se joue maintenant, et le corail dit ici l'urgence, pas un vote contre.
 */
function EnDiscussion({ id, scrutins, ctx }: { id: string; scrutins: ScrutinResume[]; ctx: Contexte }) {
  const jours = grouper(scrutins, (s) => s[1])
    .map(([cle, l]) => ({ cle, n: l.length }))
    .reverse();
  const pic = jours.reduce((a, b) => (b.n >= a.n ? b : a), jours[0]);
  const { amendements } = separer(scrutins);
  return (
    <Link to={`/textes/${id}`} className="en-discussion">
      <span className="badge-encre">En discussion</span>
      <h2>{nomDuTexte(id, scrutins, ctx)}</h2>
      <p className="en-discussion-detail">
        {scrutins.length} scrutins en {jours.length} jour{jours.length > 1 ? 's' : ''}, dont {pic.n} le {formatDateCourte(pic.cle).replace(/\.$/, '')}. {amendements.length} amendement{amendements.length > 1 ? 's' : ''}. Aucun vote sur
        l’ensemble.
      </p>
      <BarresParJour
        jours={jours}
        description={`Nombre de scrutins par jour de séance : ${jours.map((j) => `${j.n} le ${formatDateCourte(j.cle)}`).join(', ')}.`}
      />
      <p className="en-discussion-pied">
        {formatDateCourte(jours[0].cle)} → {formatDateCourte(jours.at(-1)!.cle)}
      </p>
    </Link>
  );
}

type Contexte = {
  dossiers: Record<string, string>;
  textes: Record<string, Texte>;
  mes: MesVotes | null;
  direct: Set<number>;
  enRecherche: boolean;
};

const nomDuTexte = (id: string, scrutins: ScrutinResume[], ctx: Contexte) =>
  id === SANS_TEXTE
    ? 'Autres votes'
    : ctx.dossiers[id] ?? decouper(scrutins[0][4]).texte ?? 'Texte sans titre';

/** Carte d'un texte : son verdict, son volume, et où il en est. */
function CarteTexte({ id, scrutins, ctx }: { id: string; scrutins: ScrutinResume[]; ctx: Contexte }) {
  const { cles, amendements } = separer(scrutins);
  const etape = ctx.textes[id]?.e.at(-1);
  const final = cles.find((s) => ['ensemble', 'resolution'].includes(natureDe(s[4])));
  const repere = final ?? scrutins[0];
  return (
    <li>
      <Link to={`/textes/${id}`} className="carte-texte">
        <VignetteVote pour={repere[5]} contre={repere[6]} />
        <span className="carte-texte-corps">
          <span className="titre">{nomDuTexte(id, scrutins, ctx)}</span>
          <span className="carte-texte-verdict">
            {final ? (
              <b className={final[3] ? 'sort adopte' : 'sort rejete'}>{final[3] ? 'Adopté' : 'Rejeté'}</b>
            ) : (
              <b className="sort en-cours">En cours</b>
            )}
            <span className="chiffres">
              {final
                ? `${final[5]} pour, ${final[6]} contre`
                : `dernier vote le ${formatDate(scrutins[0][1])}`}
            </span>
            {final && <span className="date">{formatDateCourte(final[1])}</span>}
          </span>
          <span className="carte-texte-pied">
            {cles.length} vote{cles.length > 1 ? 's' : ''} clé{cles.length > 1 ? 's' : ''} · {amendements.length} amendement
            {amendements.length > 1 ? 's' : ''}
            {etape && <b className="badge discret">{etape[0] === 'Promulgation' ? 'Promulguée' : `${etape[1]}, ${etape[0].toLowerCase()}`}</b>}
          </span>
        </span>
      </Link>
    </li>
  );
}

/** Une journée de séance : votes clés, puis amendements repliés ; éventuellement texte par texte. */
function Journee({ jour, scrutins, ctx, parTexte }: { jour: string; scrutins: ScrutinResume[]; ctx: Contexte; parTexte: boolean }) {
  const date = new Date(`${jour}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <section className="journee">
      <h2 className="journee-titre">
        {date}
        <small>
          {scrutins.length} scrutin{scrutins.length > 1 ? 's' : ''}
        </small>
      </h2>
      {parTexte ? (
        grouper(scrutins, (s) => s[9] ?? SANS_TEXTE).map(([id, liste]) => (
          <div key={id} className="journee-texte">
            {id === SANS_TEXTE ? (
              <h3>{nomDuTexte(id, liste, ctx)}</h3>
            ) : (
              <h3>
                <Link to={`/textes/${id}`}>{nomDuTexte(id, liste, ctx)} ›</Link>
              </h3>
            )}
            <Votes liste={liste} ctx={ctx} avecTexte={false} />
          </div>
        ))
      ) : (
        <Votes liste={scrutins} ctx={ctx} avecTexte />
      )}
    </section>
  );
}

function Votes({ liste, ctx, avecTexte }: { liste: ScrutinResume[]; ctx: Contexte; avecTexte: boolean }) {
  const { cles, amendements } = separer(liste);
  return (
    <>
      {cles.length > 0 && (
        <ul className="liste">
          {cles.map((s) => (
            <CarteScrutin
              key={s[0]}
              s={s}
              direct={ctx.direct.has(s[0])}
              mes={ctx.mes}
              texte={avecTexte ? (s[9] ? ctx.dossiers[s[9]] : null) : undefined}
            />
          ))}
        </ul>
      )}
      <BlocAmendements key={String(ctx.enRecherche)} liste={amendements} mes={ctx.mes} ouvertParDefaut={ctx.enRecherche} />
    </>
  );
}
