import { type ReactNode, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Aide, Chargement, Jauge, Pastille, PositionChip } from '../components';
import { BancHemicycle, Illu, JaugeArc, Marque, type MoisPresence, MoisParMois, illuPosition } from '../design/Illustrations';
import { mediane } from '../design/dessins';
import {
  type Choix,
  type DeputeActivite,
  type Depute,
  type Meta,
  type ScrutinResume,
  enMandat,
  formatDate,
  getActivite,
  getCommissions,
  getMeta,
  getPresence,
  getScrutins,
  nomComplet,
  bancsDeLaSalle,
  pct,
  photo,
  positionMajoritaire,
  presenceParDepute,
  tauxCommission,
  tauxVote,
} from '../data';
import { useAsync } from '../hooks';

export function DeputePage() {
  const { id } = useParams();
  return <DeputeVue id={id!} variante="autre" />;
}

const MOIS = new Intl.DateTimeFormat('fr-FR', { month: 'short' });

/** `mien` : l'écran d'accueil, avec le bandeau « Votre député » et le choix d'adresse. */
export type Variante = 'mien' | 'autre';

export function DeputeVue({
  id,
  variante,
  choix,
  onChangerAdresse,
}: {
  id: string;
  variante: Variante;
  choix?: Choix | null;
  onChangerAdresse?: () => void;
}) {
  const donnees = useAsync(() => Promise.all([getMeta(), getScrutins(), getActivite(id), getCommissions()]), [id]);
  // Les médianes arrivent à part : elles demandent le fichier de présence complet
  // et l'écran n'a pas à les attendre pour s'afficher.
  const medianes = useMedianes();
  if (!donnees.data) return <Chargement error={donnees.error} />;
  const [meta, { scrutins }, activite, commissions] = donnees.data;
  return (
    <Fiche
      meta={meta}
      scrutins={scrutins}
      activite={activite}
      commissions={commissions}
      id={id}
      variante={variante}
      choix={choix}
      onChangerAdresse={onChangerAdresse}
      medianes={medianes}
    />
  );
}

/** Médianes de l'Assemblée : un pourcentage ne sort jamais seul. */
type Medianes = { seance: number | null; commission: number | null } | undefined;

function useMedianes(): Medianes {
  const r = useAsync(() => Promise.all([getMeta(), getPresence()]), []);
  return useMemo(() => {
    if (!r.data) return undefined;
    const [meta, { jours }] = r.data;
    const taux = presenceParDepute(meta, jours);
    const assis = meta.deputes.map((d, i) => ({ d, t: taux[i] })).filter((x) => x.d.actif);
    return {
      seance: mediane(assis.map((x) => tauxVote(x.t))),
      commission: mediane(assis.map((x) => tauxCommission(x.t))),
    };
  }, [r.data]);
}

function Fiche({
  meta,
  scrutins,
  activite,
  commissions,
  id,
  variante,
  choix,
  onChangerAdresse,
  medianes,
}: {
  meta: Meta;
  scrutins: ScrutinResume[];
  activite: DeputeActivite;
  commissions: Record<string, string>;
  id: string;
  variante: Variante;
  choix?: Choix | null;
  onChangerAdresse?: () => void;
  medianes: Medianes;
}) {
  const depute = meta.deputes.find((d) => d.id === id);
  const [onglet, setOnglet] = useState<'votes' | 'commissions'>('votes');
  const [filtre, setFiltre] = useState<'tous' | 'solennels' | 'divergents'>('tous');

  const stats = useMemo(() => {
    if (!depute) return null;
    const vote = new Map(activite.votes.map((v) => [v[0], v]));
    // Scrutins tenus pendant le mandat, hors motions de censure (seuls les « pour » y sont publiés).
    const pendantMandat = scrutins.filter((s) => s[2] !== 'MOC' && enMandat(depute, s[1]));
    const derniere = pendantMandat[0]?.[1] ?? '';
    const debut3Mois = decaler(derniere, -3);
    const recents = pendantMandat.filter((s) => s[1] > debut3Mois);

    const exprimes = activite.votes.filter((v) => v[1] !== 'n');
    const divergents = exprimes.filter((v) => positionMajoritaire(v[2]) !== v[1]);

    // Participation et présence mois par mois, sur les 12 derniers mois.
    const mois: { cle: string; scrutins: number; votes: number; present: number; convoc: number }[] = [];
    for (let k = 11; k >= 0; k--) mois.push({ cle: decaler(derniere, -k).slice(0, 7), scrutins: 0, votes: 0, present: 0, convoc: 0 });
    const parMois = new Map(mois.map((m) => [m.cle, m]));
    for (const s of pendantMandat) {
      const m = parMois.get(s[1].slice(0, 7));
      if (!m) continue;
      m.scrutins++;
      if (vote.has(s[0])) m.votes++;
    }
    // Le taux ne retient que les commissions permanentes et spéciales ; la liste par commission montre tout.
    // (Données générées avant ce choix : pas de 4e valeur, tout compte.)
    const comptees = activite.commissions.filter((c) => c[3] !== 0);
    for (const [date, , p] of comptees) {
      const m = parMois.get(date.slice(0, 7));
      if (!m) continue;
      m.convoc++;
      if (p === 'p') m.present++;
    }

    const com = { p: 0, e: 0, a: 0 };
    const parCommission = new Map<string, { p: number; e: number; a: number }>();
    for (const [, , p] of comptees) com[p]++;
    for (const [, organe, p] of activite.commissions) {
      const c = parCommission.get(organe) ?? { p: 0, e: 0, a: 0 };
      c[p]++;
      parCommission.set(organe, c);
    }

    return {
      participation: pendantMandat.length ? pendantMandat.filter((s) => vote.has(s[0])).length / pendantMandat.length : null,
      participation3Mois: recents.length ? recents.filter((s) => vote.has(s[0])).length / recents.length : null,
      solennels: (() => {
        const sps = pendantMandat.filter((s) => s[2] === 'SPS');
        return { total: sps.length, votes: sps.filter((s) => vote.has(s[0])).length };
      })(),
      loyaute: exprimes.length ? (exprimes.length - divergents.length) / exprimes.length : null,
      divergents: divergents.length,
      commission: com.p + com.e + com.a ? com.p / (com.p + com.e + com.a) : null,
      com,
      parCommission: [...parCommission].sort((a, b) => b[1].p + b[1].e + b[1].a - (a[1].p + a[1].e + a[1].a)),
      mois,
    };
  }, [depute, scrutins, activite]);

  // Le banc : les groupes rangés selon leur place moyenne, chacun d'un bloc.
  const salle = useMemo(() => {
    const bancs = bancsDeLaSalle(meta);
    return {
      total: bancs.total,
      rang: bancs.rang.get(id) ?? null,
      rangsGroupe: bancs.rangsParGroupe.get(depute?.groupe ?? '') ?? new Set<number>(),
    };
  }, [meta, id, depute?.groupe]);

  if (!depute || !stats) return <p className="etat erreur">Député introuvable.</p>;
  const groupe = depute.groupe ? meta.groupes[depute.groupe] : undefined;
  const parNumero = new Map(scrutins.map((s) => [s[0], s]));
  const elle = depute.civ === 'Mme';
  const moisVue: MoisPresence[] = stats.mois.map((m) => ({
    cle: m.cle,
    nom: MOIS.format(new Date(`${m.cle}-15`)).replace('.', ''),
    seance: m.scrutins ? m.votes / m.scrutins : null,
    commission: m.convoc ? m.present / m.convoc : null,
  }));

  const voirDivergents = () => {
    setOnglet('votes');
    setFiltre('divergents');
    document.getElementById('son-activite')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <>
      <BandeauDepute
        depute={depute}
        groupe={groupe?.nom}
        variante={variante}
        legislature={meta.legislature}
        adresse={choix?.label}
        onChangerAdresse={onChangerAdresse}
      />

      <div className="page">
        {!depute.actif && <p className="note">Ne siège plus actuellement.</p>}

        {/* On situe la personne dans la salle avant de la chiffrer. */}
        <section className="bloc bloc-banc">
          <div className="bloc-tete">
            <h2>Son banc</h2>
            <span className="bloc-tete-note">
              {depute.place != null ? `Siège n° ${depute.place} · ` : ''}
              <Pastille groupe={groupe} />
            </span>
          </div>
          <BancHemicycle
            total={salle.total}
            rang={salle.rang}
            rangsGroupe={salle.rangsGroupe}
            mot={elle ? 'elle' : 'lui'}
            description={
              depute.place != null
                ? `Hémicycle de ${salle.total} sièges vu du perchoir. Le banc du groupe ${groupe?.nom ?? 'sans groupe'} est à l'encre et le siège n° ${depute.place} est entouré.`
                : `Hémicycle de ${salle.total} sièges vu du perchoir. Le banc du groupe ${groupe?.nom ?? 'sans groupe'} est à l'encre ; la place de ce député n'est pas publiée.`
            }
          />
        </section>

        {/* Deux arcs, deux médianes. Un pourcentage ne sort jamais seul. */}
        <section className="bloc bloc-mesures">
          <h2>Ses deux mesures</h2>
          <div className="mesures">
            <JaugeArc
              valeur={stats.commission}
              med={medianes === undefined ? undefined : medianes.commission}
              teinte="var(--commission)"
              lieu="en commission"
              libelleValeur={pct(stats.commission)}
              libelleMediane={pct(medianes?.commission ?? null)}
            />
            <JaugeArc
              valeur={stats.participation}
              med={medianes === undefined ? undefined : medianes.seance}
              teinte="var(--seance)"
              lieu="en séance"
              libelleValeur={pct(stats.participation)}
              libelleMediane={pct(medianes?.seance ?? null)}
            />
          </div>
          <p className="mesures-pied">
            Sur trois mois : {pct(stats.participation3Mois)} en séance. {accordAbsences(stats.com.e)}
          </p>
        </section>

        <div className="tuiles">
          <button type="button" className="tuile tuile-action" onClick={voirDivergents}>
            <span className="tuile-chiffre">{pct(stats.loyaute)}</span>
            <span className="tuile-label">votes comme son groupe</span>
            <span className="tuile-lien">
              voir les {stats.divergents} autres
              <Chevron />
            </span>
          </button>
          <div className="tuile">
            <span className="tuile-chiffre">
              {stats.solennels.votes}/{stats.solennels.total}
            </span>
            <span className="tuile-label">votes solennels, les grands textes</span>
          </div>
        </div>

        <Aide titre="Comment lire ces chiffres ?">
          <p>
            <strong>En séance</strong> : part des scrutins publics de l'hémicycle auxquels {elle ? 'la députée a' : 'le député a'}{' '}
            pris part depuis le début de son mandat. Beaucoup de scrutins ordinaires ont lieu pendant que les commissions
            siègent : un taux bas ne veut pas dire que {elle ? 'la députée' : 'le député'} ne travaille pas. La médiane est
            celle de l'Assemblée entière.
          </p>
          <p>
            <strong>En commission</strong> : part des réunions de sa commission permanente, ou d'une commission spéciale
            chargée d'un texte, où {elle ? 'elle' : 'il'} était convoqué{elle ? 'e' : ''} et noté{elle ? 'e' : ''} présent
            {elle ? 'e' : ''}. C'est là que les lois sont examinées avant la séance, et c'est la mesure de présence la plus
            fiable publiée par l'Assemblée. Les autres réunions (commissions d'enquête, délégations, groupes d'amitié) sont
            facultatives : elles figurent dans la liste par commission sans peser sur le taux.
          </p>
          <p>
            <strong>Votes solennels</strong> : les votes sur l'ensemble des textes importants, annoncés à l'avance.
          </p>
        </Aide>

        <section className="bloc bloc-mois">
          <div className="bloc-tete">
            <h2>Mois par mois</h2>
            <span className="legende-chips">
              <i className="chip-commission" /> commission
              <i className="chip-seance" /> séance
            </span>
          </div>
          <MoisParMois
            mois={moisVue}
            description={`Présence de ${nomComplet(depute)} mois par mois, en commission et en séance. Les mois hachurés sont hors session.`}
          />
        </section>

        <div className="onglets" role="tablist" id="son-activite">
          <button role="tab" aria-selected={onglet === 'votes'} onClick={() => setOnglet('votes')}>
            Ses votes <span className="compte">{activite.votes.length}</span>
          </button>
          <button role="tab" aria-selected={onglet === 'commissions'} onClick={() => setOnglet('commissions')}>
            Commissions <span className="compte">{stats.parCommission.length}</span>
          </button>
        </div>

        {onglet === 'votes' ? (
          <ListeVotes activite={activite} parNumero={parNumero} filtre={filtre} setFiltre={setFiltre} />
        ) : (
          <ul className="liste">
            {stats.parCommission.map(([organe, c]) => {
              const total = c.p + c.e + c.a;
              return (
                <li key={organe} className="ligne-commission">
                  <div>
                    <strong>{commissions[organe] ?? organe}</strong>
                    <small>
                      {c.p} présent · {c.e} excusé · {c.a} absent
                    </small>
                  </div>
                  <span>{pct(c.p / total)}</span>
                  <Jauge valeur={c.p / total} couleur="var(--commission)" />
                </li>
              );
            })}
            {!stats.parCommission.length && <p className="etat">Aucune réunion de commission enregistrée.</p>}
          </ul>
        )}

        <p className="note">
          <a href={`https://www.assemblee-nationale.fr/dyn/deputes/${depute.id}`} target="_blank" rel="noreferrer">
            Fiche officielle sur assemblee-nationale.fr ↗
          </a>
        </p>
      </div>
    </>
  );
}

/** « 1 absence excusée », « 3 absences excusées », et rien du tout s'il n'y en a pas. */
function accordAbsences(n: number) {
  if (!n) return '';
  return n === 1 ? '1 absence excusée en commission.' : `${n} absences excusées en commission.`;
}

/**
 * Le bandeau de marque, qui porte aussi l'identité. Une seule couleur pleine
 * par écran : ici le jaune, et rien d'autre.
 */
function BandeauDepute({
  depute,
  groupe,
  variante,
  legislature,
  adresse,
  onChangerAdresse,
}: {
  depute: Depute;
  groupe?: string;
  variante: Variante;
  legislature: string;
  adresse?: string;
  onChangerAdresse?: () => void;
}) {
  const navigate = useNavigate();
  const circo = depute.circo ? `${depute.dep}, ${depute.circo}` : (depute.dep ?? '');
  return (
    <header className="bandeau bandeau-depute">
      <span className="bandeau-decor" aria-hidden />
      <div className="bandeau-marque">
        <Marque />
        <span>Mon Hémicycle</span>
        {variante === 'autre' && (
          <button type="button" className="retour" onClick={() => navigate(-1)} aria-label="Revenir à l'écran précédent">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
        )}
      </div>

      <div className="identite">
        <span className="portrait">
          <img src={photo(depute.id)} alt={`Portrait officiel de ${nomComplet(depute)}`} />
        </span>
        <span className="identite-texte">
          <span className="surtitre">
            {variante === 'mien' ? (depute.civ === 'Mme' ? 'Votre députée' : 'Votre député') : `${legislature}ᵉ législature`}
          </span>
          <h1>{nomComplet(depute)}</h1>
          <span className="identite-pied">
            <span className="identite-lieu">
              {groupe ? `${groupe} · ` : ''}
              {circo}
              {depute.circo ? <sup>{depute.circo === 1 ? 're' : 'e'}</sup> : null}
            </span>
            {variante === 'mien' && onChangerAdresse && (
              <button type="button" className="changer" onClick={onChangerAdresse}>
                Changer
              </button>
            )}
          </span>
          {variante === 'mien' && adresse && <span className="identite-adresse">📍 {adresse}</span>}
        </span>
      </div>
    </header>
  );
}

function Chevron() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}

function ListeVotes({
  activite,
  parNumero,
  filtre,
  setFiltre,
}: {
  activite: DeputeActivite;
  parNumero: Map<number, ScrutinResume>;
  filtre: 'tous' | 'solennels' | 'divergents';
  setFiltre: (f: 'tous' | 'solennels' | 'divergents') => void;
}) {
  const [limite, setLimite] = useState(30);
  const votes = activite.votes.filter(([num, position, majorite]) => {
    if (filtre === 'solennels') return parNumero.get(num)?.[2] === 'SPS';
    if (filtre === 'divergents') return position !== 'n' && positionMajoritaire(majorite) !== position;
    return true;
  });
  return (
    <>
      <div className="filtres" role="group" aria-label="Filtrer ses votes">
        <Filtre actif={filtre === 'tous'} onClick={() => setFiltre('tous')}>
          Tous
        </Filtre>
        <Filtre actif={filtre === 'solennels'} onClick={() => setFiltre('solennels')}>
          Solennels
        </Filtre>
        <Filtre actif={filtre === 'divergents'} onClick={() => setFiltre('divergents')}>
          Pas comme son groupe
        </Filtre>
      </div>
      <ul className="liste">
        {votes.slice(0, limite).map(([num, position, majorite]) => {
          const s = parNumero.get(num);
          if (!s) return null;
          const divergent = position !== 'n' && positionMajoritaire(majorite) !== position;
          return (
            <li key={num}>
              <Link to={`/scrutins/${num}`} className="ligne-vote">
                <span className="ligne-vote-illu" aria-hidden>
                  <Illu nom={illuPosition(position)} />
                </span>
                <span className="ligne-vote-corps">
                  <small>
                    {formatDate(s[1])} · {s[3] ? 'adopté' : 'rejeté'}
                  </small>
                  <span className="titre">{s[4]}</span>
                  <span className="ligne-vote-pied">
                    <PositionChip position={position} />
                    {divergent && <em className="divergent">pas comme son groupe</em>}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {!votes.length && <p className="etat">Aucun vote dans ce filtre.</p>}
      {votes.length > limite && (
        <button className="plus" onClick={() => setLimite(limite + 50)}>
          Voir plus
        </button>
      )}
    </>
  );
}

function Filtre({ actif, onClick, children }: { actif: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className="filtre" aria-pressed={actif} onClick={onClick}>
      {children}
    </button>
  );
}

/** Décale une date ISO de n mois. */
function decaler(iso: string, n: number) {
  const d = new Date(`${iso || new Date().toISOString().slice(0, 10)}T12:00:00`);
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
}
