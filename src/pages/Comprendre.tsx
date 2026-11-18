// « Comment travaille l'Assemblée » : chaque mot affiché par l'application, expliqué.
// Une section par adresse (/comprendre/commissions…) pour que les liens des autres écrans
// ouvrent directement la bonne. Le texte ne décrit que ce que l'application montre.

import { useEffect, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BandeauRetour } from '../design/Bandeau';
import { TYPES_ORGANE, type TypeOrgane } from '../organes';

export type SectionComprendre = 'loi' | 'votes' | 'motions' | 'commissions' | 'mesures';

/** Lien vers une section de la page, depuis un autre écran. */
export function LienComprendre({ section, children }: { section: SectionComprendre; children: ReactNode }) {
  return (
    <Link className="lien-comprendre" to={`/comprendre/${section}`}>
      {children} ›
    </Link>
  );
}

const SECTIONS: { id: SectionComprendre; titre: string; contenu: () => ReactNode }[] = [
  { id: 'loi', titre: 'Le chemin d’une loi', contenu: CheminLoi },
  { id: 'votes', titre: 'La séance et les votes', contenu: Votes },
  { id: 'motions', titre: 'Le 49.3, la censure et les motions', contenu: Motions },
  { id: 'commissions', titre: 'Les commissions et les autres réunions', contenu: Commissions },
  { id: 'mesures', titre: 'Ce que mesure l’application, et ce qu’elle ne mesure pas', contenu: Mesures },
];

export function Comprendre() {
  const section = useParams().section as SectionComprendre | undefined;

  // Une section demandée s'ouvre et vient en haut de l'écran (après le retour en haut de page).
  useEffect(() => {
    if (!section) return;
    const id = requestAnimationFrame(() => document.getElementById(`comprendre-${section}`)?.scrollIntoView({ block: 'start' }));
    return () => cancelAnimationFrame(id);
  }, [section]);

  return (
    <>
      <BandeauRetour surtitre="Pour s’y retrouver" titre="Comment travaille l’Assemblée" />
      <div className="page comprendre">
        <p className="intro">
          Les mots et les chiffres de l’application, expliqués simplement : comment une loi est votée, ce que veulent dire
          les votes, et ce que mesurent vraiment les taux de présence.
        </p>
        <nav aria-label="Sommaire">
          <ol className="sommaire">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <Link to={`/comprendre/${s.id}`} replace>
                  {s.titre}
                </Link>
              </li>
            ))}
          </ol>
        </nav>
        {SECTIONS.map(({ id, titre, contenu: Contenu }) => (
          // key : une section demandée par l'adresse s'ouvre, même si elle était fermée.
          <details key={`${id}-${section === id}`} id={`comprendre-${id}`} className="repli comprendre-section" open={section === id}>
            <summary>
              <h2>{titre}</h2>
            </summary>
            <Contenu />
          </details>
        ))}
      </div>
    </>
  );
}

function CheminLoi() {
  return (
    <>
      <p>
        Un texte de loi naît d’un <strong>projet de loi</strong>, déposé par le Gouvernement, ou d’une{' '}
        <strong>proposition de loi</strong>, déposée par des députés ou des sénateurs. Il est déposé à l’Assemblée ou au
        Sénat.
      </p>
      <ol className="etapes-loi">
        <li>
          <strong>En commission.</strong> La commission compétente l’examine d’abord, le modifie par des amendements et
          adopte son propre texte.
        </li>
        <li>
          <strong>En séance.</strong> Tous les députés examinent ensuite le texte de la commission dans l’hémicycle : les
          amendements, puis chaque article, puis l’ensemble du texte. C’est une <strong>lecture</strong>.
        </li>
        <li>
          <strong>La navette.</strong> Le texte adopté part dans l’autre chambre, qui fait sa propre lecture. Il fait des
          allers-retours tant que députés et sénateurs ne l’ont pas adopté dans les mêmes termes.
        </li>
        <li>
          <strong>La commission mixte paritaire (CMP).</strong> Après deux lectures dans chaque chambre, ou une seule si le
          Gouvernement a engagé la procédure accélérée, sept députés et sept sénateurs cherchent un texte commun, que les
          deux chambres votent ensuite.
        </li>
        <li>
          <strong>Nouvelle lecture et lecture définitive.</strong> Si la CMP échoue, chaque chambre relit le texte, puis le
          Gouvernement peut demander à l’Assemblée de statuer seule : c’est la lecture définitive. L’Assemblée a le dernier
          mot.
        </li>
        <li>
          <strong>Le Conseil constitutionnel.</strong> Il vérifie que la loi respecte la Constitution. C’est obligatoire
          pour une loi organique ; pour une loi ordinaire, il faut qu’on le saisisse, par exemple 60 députés ou 60
          sénateurs.
        </li>
        <li>
          <strong>La promulgation.</strong> Le président de la République signe la loi, qui est publiée au Journal
          officiel.
        </li>
      </ol>
      <p>
        Dans l’application, la frise d’un texte suit ces étapes. Chacune est datée par son vote quand il a eu lieu, et
        sinon par le jour où elle a commencé.
      </p>
    </>
  );
}

function Votes() {
  return (
    <>
      <p>
        La plupart des votes de l’hémicycle se font à main levée : personne ne sait qui a voté quoi. Un vote n’est
        nominatif que s’il a lieu par <strong>scrutin public</strong>, à la demande du Gouvernement, d’un président de
        groupe ou de commission. L’application ne montre que ces scrutins publics.
      </p>
      <dl className="lexique">
        <dt>Scrutin public ordinaire</dt>
        <dd>
          Il a lieu pendant le débat, souvent sur un amendement. Une centaine de députés seulement y prennent part : les
          autres siègent au même moment en commission, travaillent dans leur circonscription ou suivent d’autres textes.
          Un faible nombre de votants est donc normal.
        </dd>
        <dt>Scrutin public solennel</dt>
        <dd>
          Décidé à l’avance pour les textes importants, sur l’ensemble du texte. Il a lieu à une heure annoncée, en
          général le mardi après les questions au Gouvernement, et presque tous les députés votent.
        </dd>
        <dt>Amendement, article, ensemble du texte</dt>
        <dd>
          Un amendement propose de modifier le texte. Chaque article est ensuite voté tel que modifié, puis l’ensemble du
          texte. Seul le vote sur l’ensemble dit si l’Assemblée adopte le texte à cette lecture.
        </dd>
        <dt>Majorité</dt>
        <dd>
          Un texte ou un amendement est adopté s’il recueille plus de voix pour que de voix contre. Les abstentions ne
          comptent pas dans ce calcul.
        </dd>
        <dt>Non-votant</dt>
        <dd>
          Député présent qui ne prend pas part au vote. C’est le plus souvent le président de séance, qui par tradition ne
          vote pas.
        </dd>
        <dt>Vote par délégation</dt>
        <dd>
          Un député empêché peut confier son vote à un collègue, qui ne peut en porter qu’un seul en plus du sien. Le vote
          est alors compté au nom du député absent.
        </dd>
      </dl>
    </>
  );
}

function Motions() {
  return (
    <dl className="lexique">
      <dt>Le 49.3</dt>
      <dd>
        L’article 49, alinéa 3, de la Constitution permet au Gouvernement de faire adopter un texte sans vote, en engageant
        sa responsabilité. Les députés ont alors 24 heures pour déposer une motion de censure. Si aucune n’est adoptée, le
        texte est considéré comme adopté par l’Assemblée à cette lecture. Le Gouvernement peut l’utiliser sans limite pour
        les budgets, et pour un seul autre texte par session.
      </dd>
      <dt>Motion de censure</dt>
      <dd>
        Elle renverse le Gouvernement si elle obtient la majorité absolue des députés, soit 289 voix. Seuls les votes pour
        sont comptés : c’est pourquoi l’application n’affiche que ce nombre. Elle peut être déposée à tout moment par un
        dixième des députés (article 49, alinéa 2), ou en réponse à un 49.3.
      </dd>
      <dt>Question de confiance</dt>
      <dd>
        Le Gouvernement engage sa responsabilité sur son programme (article 49, alinéa 1). Si l’Assemblée la refuse, il
        doit démissionner.
      </dd>
      <dt>Déclaration du Gouvernement</dt>
      <dd>
        Le Gouvernement peut faire une déclaration suivie d’un vote sur un sujet (article 50-1). Ce vote donne l’avis des
        députés, sans engager la responsabilité du Gouvernement.
      </dd>
      <dt>Motion de rejet préalable</dt>
      <dd>
        Votée avant l’examen d’un texte, elle demande de le rejeter d’emblée. Adoptée, elle rejette le texte sans débat
        sur ses articles. Son parcours peut toutefois continuer, au Sénat ou en commission mixte paritaire selon l’étape :
        une majorité l’adopte parfois exprès pour accélérer.
      </dd>
      <dt>Motion de renvoi en commission</dt>
      <dd>Adoptée, elle interrompt le débat en séance et renvoie le texte à la commission, qui doit l’examiner à nouveau.</dd>
    </dl>
  );
}

/** L'ordre de lecture des types : ce qui compte dans le taux d'abord. */
const ORDRE_TYPES: TypeOrgane[] = [
  'permanente',
  'speciale',
  'cmp',
  'enquete',
  'europe',
  'controle',
  'delegation',
  'mission',
  'office',
  'amitie',
  'etudes',
];

const DETAILS: Partial<Record<TypeOrgane, ReactNode>> = {
  permanente: (
    <>
      Leur nombre est fixé par la Constitution : Lois, Finances, Affaires sociales, Affaires économiques, Affaires
      étrangères, Affaires culturelles et éducation, Défense, Développement durable. Chacune compte environ 72 membres,
      répartis selon le poids des groupes. La commission des finances est toujours présidée par un député de
      l’opposition.
    </>
  ),
  speciale: <>Elle est composée comme une commission permanente, d’environ 70 députés de tous les groupes.</>,
  cmp: (
    <>
      Elle se réunit pour un texte précis, une fois les lectures nécessaires faites. Ses membres titulaires et suppléants
      sont désignés à chaque fois.
    </>
  ),
  enquete: (
    <>
      Chaque groupe d’opposition ou minoritaire peut en obtenir une par an. Les personnes convoquées doivent venir et
      témoigner sous serment. Elle ne peut pas enquêter sur des faits jugés par la justice.
    </>
  ),
  controle: <>Par exemple le Comité d’évaluation et de contrôle des politiques publiques, présidé par le président ou la présidente de l’Assemblée.</>,
  delegation: <>Les députés élus outre-mer sont membres de droit de la délégation aux outre-mer.</>,
  office: <>L’Office parlementaire d’évaluation des choix scientifiques et technologiques réunit 18 députés et 18 sénateurs.</>,
  amitie: <>On en compte environ 150. Un député peut adhérer à plusieurs d’entre eux.</>,
  etudes: <>Par exemple sur Taïwan, la Corée du Nord ou la Biélorussie.</>,
};

function Commissions() {
  return (
    <>
      <p>
        Les députés travaillent beaucoup en dehors de l’hémicycle, dans des réunions de plusieurs sortes. Seules celles
        qui examinent les lois comptent dans le taux de présence en commission affiché par l’application : les
        commissions permanentes et les commissions spéciales. Les autres sont facultatives ou ponctuelles ; elles figurent
        sur la fiche de chaque député, sans peser sur son taux.
      </p>
      <ul className="types-organe">
        {ORDRE_TYPES.map((t) => {
          const { libelle, resume, compte } = TYPES_ORGANE[t];
          return (
            <li key={t}>
              <h3>{libelle}</h3>
              <p>
                {resume} {DETAILS[t]}
              </p>
              <p className={compte ? 'compte-oui' : 'compte-non'}>
                {compte ? 'Compte dans le taux de présence en commission.' : 'Ne compte pas dans le taux de présence.'}
              </p>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function Mesures() {
  return (
    <>
      <dl className="lexique">
        <dt>Présence en séance</dt>
        <dd>
          Part des scrutins publics auxquels le député a pris part depuis le début de son mandat, hors motions de censure.
          Comme beaucoup de scrutins ordinaires ont lieu pendant les réunions de commission, un taux bas ne veut pas dire
          que le député ne travaille pas. Pour l’instant, l’application compte aussi les votes par délégation et ceux des
          non-votants comme une participation.
        </dd>
        <dt>Présence en commission</dt>
        <dd>
          Part des réunions de sa commission permanente, ou d’une commission spéciale, où le député était convoqué et a été
          noté présent par l’Assemblée. Une absence excusée compte comme une absence. C’est la mesure la plus fiable que
          publie l’Assemblée.
        </dd>
        <dt>Médiane</dt>
        <dd>
          La moitié des députés fait mieux, l’autre moitié moins bien. Un pourcentage seul ne dit rien : comparez-le
          toujours à la médiane.
        </dd>
        <dt>Votes comme son groupe</dt>
        <dd>Part de ses votes pour, contre ou abstention identiques à la position de la majorité de son groupe.</dd>
      </dl>
      <p>
        <strong>Ce que l’application ne mesure pas</strong> : le travail en circonscription, les questions écrites au
        Gouvernement, les rapports, les amendements déposés, les prises de parole, ni le travail au sein de son groupe. Ces
        chiffres décrivent une partie de l’activité d’un député, pas sa valeur.
      </p>
    </>
  );
}
