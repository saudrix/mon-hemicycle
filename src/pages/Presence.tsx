import { useMemo, useState } from 'react';
import { Aide, CarteDepute, Chargement, Jauge, Pastille } from '../components';
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
  const actifs = (j: JourPresence) => (indicateur === 'vote' ? j.n > 0 : Object.keys(j.com).length > 0);
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
      selection.filter(actifs).map((j) => {
        if (indicateur === 'vote') {
          const siegeant = meta.deputes.filter((d) => enMandat(d, j.date)).length;
          const votes = Object.values(j.v).reduce((a, b) => a + b, 0);
          return { date: j.date, taux: votes / (j.n * siegeant) };
        }
        let p = 0;
        let t = 0;
        for (const [pr, e, a] of Object.values(j.com)) {
          p += pr;
          t += pr + e + a;
        }
        return { date: j.date, taux: t ? p / t : 0 };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selection, indicateur, meta],
  );

  const global = useMemo(() => [...cumuler(taux, () => 'tous').values()][0], [taux]);

  return (
    <div className="page">
      <h1>Présence des députés</h1>

      <div className="filtres" role="group" aria-label="Indicateur">
        <button aria-pressed={indicateur === 'vote'} onClick={() => setIndicateur('vote')}>
          Votes en séance
        </button>
        <button aria-pressed={indicateur === 'commission'} onClick={() => setIndicateur('commission')}>
          Commissions
        </button>
      </div>

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

      <section className="synthese">
        <span className="synthese-valeur">{pct(global ? valeur(global) : null)}</span>
        <span>
          {indicateur === 'vote'
            ? `de participation moyenne aux ${frise.length ? selection.reduce((a, j) => a + j.n, 0) : 0} scrutins`
            : 'de présence moyenne en commission'}
          <br />
          <small>
            {du === au ? `le ${formatDate(du)}` : `du ${formatDate(du)} au ${formatDate(au)}`} · {frise.length} jour
            {frise.length > 1 ? 's' : ''} de séance
          </small>
        </span>
      </section>

      {frise.length > 1 && (
        <div className="frise" role="img" aria-label="Taux jour par jour">
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
        <ClassementDeputes meta={meta} taux={taux} valeur={valeur} />
      ) : (
        <Repartition meta={meta} taux={taux} valeur={valeur} vue={vue} />
      )}
    </div>
  );
}

function Repartition({ meta, taux, valeur, vue }: { meta: Meta; taux: Taux[]; valeur: (t: Taux) => number | null; vue: Vue }) {
  const lignes = [...cumuler(taux, (i) => (vue === 'groupes' ? meta.deputes[i].groupe : meta.deputes[i].region))]
    .map(([cle, t]) => ({ cle, t, v: valeur(t) }))
    .filter((l) => l.v != null)
    .sort((a, b) => b.v! - a.v!);
  return (
    <ul className="liste repartition">
      {lignes.map(({ cle, t, v }) => {
        const groupe = vue === 'groupes' ? meta.groupes[cle] : undefined;
        return (
          <li key={cle}>
            <div className="repartition-tete">
              {groupe ? <Pastille groupe={groupe} /> : <strong>{cle}</strong>}
              <small>{t.deputes} députés</small>
              <b>{pct(v)}</b>
            </div>
            <Jauge valeur={v} couleur={groupe?.couleur} />
          </li>
        );
      })}
    </ul>
  );
}

function ClassementDeputes({ meta, taux, valeur }: { meta: Meta; taux: Taux[]; valeur: (t: Taux) => number | null }) {
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
      <input type="search" className="champ-recherche" placeholder="Nom ou département" value={q} onChange={(e) => setQ(e.target.value)} />
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
