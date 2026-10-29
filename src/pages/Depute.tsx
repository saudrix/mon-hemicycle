import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Aide, Chargement, Jauge, Pastille, PositionChip, Stat } from '../components';
import {
  type DeputeActivite,
  type Meta,
  type ScrutinResume,
  circonscription,
  enMandat,
  formatDate,
  getActivite,
  getCommissions,
  getMeta,
  getScrutins,
  nomComplet,
  pct,
  photo,
  positionMajoritaire,
} from '../data';
import { useAsync } from '../hooks';

export function DeputePage() {
  const { id } = useParams();
  return <DeputeVue id={id!} />;
}

const MOIS = new Intl.DateTimeFormat('fr-FR', { month: 'short' });

export function DeputeVue({ id }: { id: string }) {
  const donnees = useAsync(() => Promise.all([getMeta(), getScrutins(), getActivite(id), getCommissions()]), [id]);
  if (!donnees.data) return <Chargement error={donnees.error} />;
  const [meta, { scrutins }, activite, commissions] = donnees.data;
  return <Fiche meta={meta} scrutins={scrutins} activite={activite} commissions={commissions} id={id} />;
}

function Fiche({
  meta,
  scrutins,
  activite,
  commissions,
  id,
}: {
  meta: Meta;
  scrutins: ScrutinResume[];
  activite: DeputeActivite;
  commissions: Record<string, string>;
  id: string;
}) {
  const depute = meta.deputes.find((d) => d.id === id);
  const [onglet, setOnglet] = useState<'votes' | 'commissions'>('votes');

  const stats = useMemo(() => {
    if (!depute) return null;
    const vote = new Map(activite.votes.map((v) => [v[0], v]));
    // Scrutins tenus pendant le mandat, hors motions de censure (seuls les « pour » y sont publiés).
    const pendantMandat = scrutins.filter((s) => s[2] !== 'MOC' && enMandat(depute, s[1]));
    const derniere = pendantMandat[0]?.[1] ?? '';
    const debut3Mois = decaler(derniere, -3);
    const recents = pendantMandat.filter((s) => s[1] > debut3Mois);

    const exprimes = activite.votes.filter((v) => v[1] !== 'n');
    const commeGroupe = exprimes.filter((v) => positionMajoritaire(v[2]) === v[1]).length;

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
    for (const [date, , p] of activite.commissions) {
      const m = parMois.get(date.slice(0, 7));
      if (!m) continue;
      m.convoc++;
      if (p === 'p') m.present++;
    }

    const com = { p: 0, e: 0, a: 0 };
    const parCommission = new Map<string, { p: number; e: number; a: number }>();
    for (const [, organe, p] of activite.commissions) {
      com[p]++;
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
      loyaute: exprimes.length ? commeGroupe / exprimes.length : null,
      commission: com.p + com.e + com.a ? com.p / (com.p + com.e + com.a) : null,
      com,
      parCommission: [...parCommission].sort((a, b) => b[1].p + b[1].e + b[1].a - (a[1].p + a[1].e + a[1].a)),
      mois,
    };
  }, [depute, scrutins, activite]);

  if (!depute || !stats) return <p className="etat erreur">Député introuvable.</p>;
  const groupe = depute.groupe ? meta.groupes[depute.groupe] : undefined;
  const parNumero = new Map(scrutins.map((s) => [s[0], s]));

  return (
    <div className="page">
      <header className="fiche-entete" style={{ ['--groupe' as string]: groupe?.couleur }}>
        <img src={photo(depute.id)} alt="" />
        <div>
          <h1>{nomComplet(depute)}</h1>
          <p>{circonscription(depute)}</p>
          <Pastille groupe={groupe} />
          {!depute.actif && <p className="note">Ne siège plus actuellement.</p>}
        </div>
      </header>

      <section className="stats">
        <Stat label="des scrutins votés" valeur={pct(stats.participation)} detail={`${pct(stats.participation3Mois)} sur 3 mois`} />
        <Stat label="présent en commission" valeur={pct(stats.commission)} detail={`${stats.com.e} absences excusées`} />
        <Stat
          label="votes solennels"
          valeur={`${stats.solennels.votes}/${stats.solennels.total}`}
          detail="les grands textes"
        />
        <Stat label="votes comme son groupe" valeur={pct(stats.loyaute)} />
      </section>
      <Aide>
        <p>
          <strong>Scrutins votés</strong> : part des scrutins publics de l'hémicycle auxquels le député a pris part depuis
          le début de son mandat. Beaucoup de scrutins ordinaires ont lieu pendant que les commissions siègent : un taux
          bas ne veut pas dire que le député ne travaille pas.
        </p>
        <p>
          <strong>Présent en commission</strong> : part des réunions de commission où il était convoqué et noté présent.
          C'est la mesure de présence la plus fiable publiée par l'Assemblée.
        </p>
        <p>
          <strong>Votes solennels</strong> : les votes sur l'ensemble des textes importants, annoncés à l'avance.
        </p>
      </Aide>

      <section>
        <h2>Présence sur 12 mois</h2>
        <div className="histo" role="img" aria-label="Participation aux scrutins et présence en commission par mois">
          {stats.mois.map((m) => (
            <div key={m.cle} className={m.scrutins || m.convoc ? 'histo-col' : 'histo-col hors'}>
              <div className="histo-barres">
                <span className="h-vote" style={{ height: `${m.scrutins ? (m.votes / m.scrutins) * 100 : 0}%` }} />
                <span className="h-com" style={{ height: `${m.convoc ? (m.present / m.convoc) * 100 : 0}%` }} />
              </div>
              <small>{MOIS.format(new Date(`${m.cle}-15`)).replace('.', '')}</small>
            </div>
          ))}
        </div>
        <p className="legende">
          <i className="h-vote" /> scrutins votés <i className="h-com" /> présence en commission
        </p>
      </section>

      <div className="onglets" role="tablist">
        <button role="tab" aria-selected={onglet === 'votes'} onClick={() => setOnglet('votes')}>
          Ses votes ({activite.votes.length})
        </button>
        <button role="tab" aria-selected={onglet === 'commissions'} onClick={() => setOnglet('commissions')}>
          Commissions
        </button>
      </div>

      {onglet === 'votes' ? (
        <ListeVotes activite={activite} parNumero={parNumero} />
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
                <Jauge valeur={c.p / total} />
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
  );
}

function ListeVotes({ activite, parNumero }: { activite: DeputeActivite; parNumero: Map<number, ScrutinResume> }) {
  const [solennels, setSolennels] = useState(false);
  const [limite, setLimite] = useState(30);
  const votes = activite.votes.filter((v) => !solennels || parNumero.get(v[0])?.[2] === 'SPS');
  return (
    <>
      <label className="interrupteur">
        <input type="checkbox" checked={solennels} onChange={(e) => setSolennels(e.target.checked)} />
        Seulement les votes solennels
      </label>
      <ul className="liste">
        {votes.slice(0, limite).map(([num, position, majorite]) => {
          const s = parNumero.get(num);
          if (!s) return null;
          const divergent = position !== 'n' && positionMajoritaire(majorite) !== position;
          return (
            <li key={num}>
              <Link to={`/scrutins/${num}`} className="ligne-vote">
                <small>
                  {formatDate(s[1])} · {s[3] ? 'adopté' : 'rejeté'}
                </small>
                <span className="titre">{s[4]}</span>
                <span className="ligne-vote-pied">
                  <PositionChip position={position} />
                  {divergent && <em className="divergent">pas comme son groupe</em>}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {votes.length > limite && (
        <button className="plus" onClick={() => setLimite(limite + 50)}>
          Voir plus
        </button>
      )}
    </>
  );
}

/** Décale une date ISO de n mois. */
function decaler(iso: string, n: number) {
  const d = new Date(`${iso || new Date().toISOString().slice(0, 10)}T12:00:00`);
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
}
