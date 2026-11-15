import { useMemo, useState } from 'react';
import { Aide, CarteDepute, Chargement, Pastille } from '../components';
import {
  type JourPresence,
  type Meta,
  type Taux,
  cumuler,
  enMandat,
  formatDate,
  formatDateCourte,
  getMeta,
  getPresence,
  pct,
  presenceParDepute,
  tauxCommission,
  tauxVote,
} from '../data';
import { BandeauPage } from '../design/Bandeau';
import { Halteres } from '../design/Illustrations';
import { mediane } from '../design/dessins';
import { useAsync } from '../hooks';

type Indicateur = 'vote' | 'commission';
type Vue = 'groupes' | 'regions' | 'deputes';

const PERIODES: [string, string, number | null][] = [
  ['jour', 'Dernière séance', 0],
  ['30j', '30 jours', 30],
  ['3m', '3 mois', 91],
  ['12m', '12 mois', 365],
  ['tout', 'Législature', null],
];

export function Presence() {
  const donnees = useAsync(() => Promise.all([getMeta(), getPresence()]), []);
  if (!donnees.data) return <Chargement error={donnees.error} />;
  const [meta, { jours }] = donnees.data;
  return <Tableau meta={meta} jours={jours} />;
}

function Tableau({ meta, jours }: { meta: Meta; jours: JourPresence[] }) {
  const [indicateur, setIndicateur] = useState<Indicateur>('vote');
  const [vue, setVue] = useState<Vue>('groupes');
  const actifs = (j: JourPresence) => j.n > 0;
  const derniere = [...jours].reverse().find(actifs)?.date ?? jours.at(-1)!.date;
  const [periode, setPeriode] = useState<string>('3m');
  const [du, setDu] = useState<string>(decalerJours(derniere, -91));
  const [au, setAu] = useState<string>(derniere);

  const choisirPeriode = (cle: string, nbJours: number | null) => {
    setPeriode(cle);
    setAu(derniere);
    setDu(nbJours == null ? jours[0].date : decalerJours(derniere, -nbJours));
  };

  const selection = useMemo(() => jours.filter((j) => j.date >= du && j.date <= au), [jours, du, au]);
  const taux = useMemo(() => presenceParDepute(meta, selection), [meta, selection]);
  const valeur = indicateur === 'vote' ? tauxVote : tauxCommission;

  // Taux global jour par jour, pour la frise.
  const frise = useMemo(
    () =>
      selection
        .filter((j) => j.n > 0)
        .map((j) => {
          const siegeant = meta.deputes.filter((d) => enMandat(d, j.date)).length;
          const votes = Object.values(j.v).reduce((a, b) => a + b, 0);
          return { date: j.date, taux: votes / (j.n * siegeant) };
        }),
    [selection, meta],
  );

  const global = useMemo(() => [...cumuler(taux, () => 'tous').values()][0], [taux]);

  // Les deux médianes de l'Assemblée, qui servent de repère sur les haltères.
  const medianes = useMemo(() => {
    const assis = meta.deputes.map((d, i) => ({ d, t: taux[i] })).filter((x) => x.d.actif);
    return {
      seance: mediane(assis.map((x) => tauxVote(x.t))),
      commission: mediane(assis.map((x) => tauxCommission(x.t))),
    };
  }, [meta, taux]);

  return (
    <>
      <BandeauPage
        titre="Qui siège vraiment ?"
        intro="Deux mesures qui ne disent pas la même chose. Jamais l’une sans l’autre : un classement sur une seule est faux."
      />

      <div className="page">
      <div className="filtres petits" role="group" aria-label="Période">
        {PERIODES.map(([cle, label, n]) => (
          <button key={cle} aria-pressed={periode === cle} onClick={() => choisirPeriode(cle, n)}>
            {label}
          </button>
        ))}
      </div>
      <div className="dates">
        <label>
          Du
          <input
            type="date"
            value={du}
            min={jours[0].date}
            max={au}
            onChange={(e) => {
              setDu(e.target.value);
              setPeriode('perso');
            }}
          />
        </label>
        <label>
          au
          <input
            type="date"
            value={au}
            min={du}
            max={jours.at(-1)!.date}
            onChange={(e) => {
              setAu(e.target.value);
              setPeriode('perso');
            }}
          />
        </label>
      </div>

      {/* Les deux médianes côte à côte : l'ordre de lecture dit qu'elles se valent. */}
      <div className="medianes">
        <div className="mediane mediane-commission">
          <span className="tuile-chiffre">{pct(medianes.commission)}</span>
          <span className="tuile-label">médiane en commission</span>
        </div>
        <div className="mediane mediane-seance">
          <span className="tuile-chiffre">{pct(medianes.seance)}</span>
          <span className="tuile-label">médiane en séance</span>
        </div>
      </div>
      <p className="note">
        {du === au ? `Le ${formatDate(du)}` : `Du ${formatDate(du)} au ${formatDate(au)}`} · {frise.length} jour
        {frise.length > 1 ? 's' : ''} de séance · {selection.reduce((a, j) => a + j.n, 0)} scrutins · moyenne{' '}
        {pct(global ? tauxVote(global) : null)} en séance et {pct(global ? tauxCommission(global) : null)} en commission.
      </p>

      {frise.length > 1 && <h2 className="titre-frise">La séance, jour par jour</h2>}
      {frise.length > 1 && (
        <div className="frise" role="img" aria-label="Participation aux scrutins, jour de séance par jour de séance">
          {frise.map((j) => (
            <button
              key={j.date}
              title={`${formatDateCourte(j.date)} : ${pct(j.taux)}`}
              onClick={() => {
                setDu(j.date);
                setAu(j.date);
                setPeriode('perso');
              }}
            >
              <span style={{ height: `${Math.max(j.taux * 100, 2)}%` }} />
            </button>
          ))}
        </div>
      )}
      {frise.length > 1 && <p className="note">Touchez une barre pour voir une journée.</p>}

      <Aide>
        {indicateur === 'vote' ? (
          <p>
            Part des scrutins publics auxquels les députés ont pris part, pendant leur mandat. Les scrutins ordinaires se
            tiennent souvent en même temps que les commissions : la participation y est naturellement faible. Les
            motions de censure sont exclues.
          </p>
        ) : (
          <p>
            Part des réunions de commission où les députés convoqués ont été notés présents par l'Assemblée. Les
            absences excusées comptent comme des absences.
          </p>
        )}
        <p>Les députés sont rattachés à leur groupe et à leur région actuels.</p>
      </Aide>

      <div className="onglets" role="tablist">
        {(
          [
            ['groupes', 'Par groupe'],
            ['regions', 'Par région'],
            ['deputes', 'Par député'],
          ] as [Vue, string][]
        ).map(([v, label]) => (
          <button key={v} role="tab" aria-selected={vue === v} onClick={() => setVue(v)}>
            {label}
          </button>
        ))}
      </div>

      {vue === 'deputes' ? (
        <ClassementDeputes
          meta={meta}
          taux={taux}
          valeur={valeur}
          indicateur={indicateur}
          setIndicateur={setIndicateur}
        />
      ) : (
        <Repartition meta={meta} taux={taux} vue={vue} medianes={medianes} />
      )}
      </div>
    </>
  );
}

/** Un haltère par groupe ou par région : de la séance à la commission. */
function Repartition({
  meta,
  taux,
  vue,
  medianes,
}: {
  meta: Meta;
  taux: Taux[];
  vue: Vue;
  medianes: { seance: number | null; commission: number | null };
}) {
  const lignes = [...cumuler(taux, (i) => (vue === 'groupes' ? meta.deputes[i].groupe : meta.deputes[i].region))]
    .map(([cle, t]) => ({ cle, t, seance: tauxVote(t), commission: tauxCommission(t) }))
    .filter((l) => l.seance != null || l.commission != null)
    .sort((a, b) => (b.commission ?? b.seance ?? 0) - (a.commission ?? a.seance ?? 0));
  return (
    <>
      <p className="note">Chaque trait va de la séance à la commission.</p>
      <div className="bloc bloc-halteres">
        <Halteres
          medSeance={medianes.seance}
          medCommission={medianes.commission}
          lignes={lignes.map(({ cle, t, seance, commission }) => {
            const groupe = vue === 'groupes' ? meta.groupes[cle] : undefined;
            return {
              cle,
              nom: (
                <>
                  {groupe ? <Pastille groupe={groupe} /> : <strong>{cle}</strong>}
                  <small>{t.deputes} députés</small>
                </>
              ),
              seance,
              commission,
              detail: `${seance == null ? '–' : Math.round(seance * 100)} → ${pct(commission)}`,
            };
          })}
        />
      </div>
      <p className="legende-chips legende-halteres">
        <i className="chip-seance rond" /> séance
        <i className="chip-commission rond" /> commission
      </p>
    </>
  );
}

function ClassementDeputes({
  meta,
  taux,
  valeur,
  indicateur,
  setIndicateur,
}: {
  meta: Meta;
  taux: Taux[];
  valeur: (t: Taux) => number | null;
  indicateur: Indicateur;
  setIndicateur: (i: Indicateur) => void;
}) {
  const [ordre, setOrdre] = useState<'desc' | 'asc'>('desc');
  const [q, setQ] = useState('');
  const [limite, setLimite] = useState(30);
  const recherche = q.toLowerCase();
  const lignes = meta.deputes
    .map((d, i) => ({ d, v: valeur(taux[i]) }))
    .filter((l) => l.v != null && `${l.d.prenom} ${l.d.nom} ${l.d.dep}`.toLowerCase().includes(recherche))
    .sort((a, b) => (ordre === 'desc' ? b.v! - a.v! : a.v! - b.v!));
  return (
    <>
      <p className="note">Un classement se fait sur une mesure à la fois : choisissez laquelle.</p>
      <div className="filtres petits" role="group" aria-label="Mesure du classement">
        <button aria-pressed={indicateur === 'commission'} onClick={() => setIndicateur('commission')}>
          En commission
        </button>
        <button aria-pressed={indicateur === 'vote'} onClick={() => setIndicateur('vote')}>
          En séance
        </button>
      </div>
      <div className="champ-recherche">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="M16.5 16.5 21 21" />
        </svg>
        <input type="search" aria-label="Nom ou département" placeholder="Nom ou département" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="filtres petits">
        <button aria-pressed={ordre === 'desc'} onClick={() => setOrdre('desc')}>
          Les plus présents
        </button>
        <button aria-pressed={ordre === 'asc'} onClick={() => setOrdre('asc')}>
          Les moins présents
        </button>
      </div>
      <ul className="liste">
        {lignes.slice(0, limite).map(({ d, v }) => (
          <li key={d.id}>
            <CarteDepute depute={d} groupe={d.groupe ? meta.groupes[d.groupe] : undefined} taux={v} />
          </li>
        ))}
      </ul>
      {lignes.length > limite && (
        <button className="plus" onClick={() => setLimite(limite + 50)}>
          Voir plus
        </button>
      )}
    </>
  );
}

function decalerJours(iso: string, n: number) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
