# Encre et couleur

Le design system de Mon Hémicycle. Trois fichiers dans `src/design/`, et les
règles qui vont avec.

## Le parti pris

**Suivre un député est une affaire sérieuse, et on peut la rendre accueillante.**

Un trait d'encre marine, des aplats francs, des dessins faits à la main.
L'illustration porte la chaleur, la donnée reste nue. L'application n'est pas un
tableau de bord : c'est un document public qui se lit.

Ce qui en découle, et qu'on retrouve partout :

- une seule couleur pleine par écran, jamais deux ;
- une couche se signale par un **trait**, jamais par une ombre ;
- ce qui se range est crème, ce qui se clique est cerné d'encre.

## Où ça vit

| Fichier | Rôle |
|---|---|
| `src/design/jetons.css` | la palette, les gris calculés, la typographie, les formes |
| `src/design/socle.css` | remise à zéro, échelle typographique, focus, états |
| `src/design/composants.css` | les objets du système, et le branchement des classes existantes |
| `src/styles.css` | la couche applicative : grilles, gabarits, cas particuliers |

Les quatre sont chaînés par `src/styles.css`, qui est le seul import de
`main.tsx`.

### Les couches

```css
@layer app, systeme;
```

`styles.css` enferme l'ancien contenu dans la couche `app`, et
`composants.css` est importé dans la couche `systeme`, qui passe après. Le
système reprend donc la main sur les règles héritées sans avoir à batailler à
coups de sélecteurs plus précis.

C'est un état de transition assumé : la couche `app` se réduira écran par
écran. Tant qu'elle existe, une règle qui ne s'applique pas est presque toujours
une règle restée dans `app` alors que sa place est dans `composants.css`.

## Les couleurs

### Trois familles qui ne se croisent jamais

**La marque** porte l'identité et la navigation.

| Jeton | Valeur | Usage |
|---|---|---|
| `--encre` | `#17213D` | texte, traits, barre basse, bandeaux sombres |
| `--jaune` | `#FFD84D` | bandeau de marque, état actif, action principale |
| `--creme` | `#FBF7EF` | ce qui se range |
| `--gris-illu` | `#EBECF0` | le fond des illustrations, et lui seul |

**Les votes**, et seulement les votes. Quand une de ces trois couleurs apparaît,
c'est qu'il est question d'un vote.

| Jeton | Valeur |
|---|---|
| `--pour` | `#2FBF71` |
| `--contre` | `#FF6F5E` |
| `--abstention` | `#F0B429` |
| `--absent` | encre à 20 % |

**Les mesures**, et seulement les mesures.

| Jeton | Valeur | Usage |
|---|---|---|
| `--commission` | `#B388FF` | présence en commission |
| `--seance` | `#17213D` | participation aux scrutins |

Le violet ne dit jamais un vote. C'est précisément pour ça que l'abstention est
passée à l'ambre : les deux se disputaient le même registre.

### Les couleurs de groupe sont une exception

Sur la carte et dans les listes de groupes, les couleurs sont celles de
l'Assemblée, pas les nôtres. C'est une convention politique que le lecteur
connaît déjà, et c'est le seul endroit où le rouge et le vert ne parlent pas
d'un vote. L'écran de la carte le dit en toutes lettres.

**Pourquoi pas les logos de partis** : ce sont des groupes parlementaires et non
des partis. LIOT fédère des élus sans parti commun, GDR réunit communistes et
ultramarins, « non inscrit » n'est pas une organisation. Deux ou trois des
quatorze groupes seulement ont un logo identifiable, l'open data n'en contient
aucun, ce sont des marques déposées, et un logo ne survit pas aux 9 px d'une
puce de liste. Le sigle, lui, est affiché partout à côté de la couleur.

## Les gris, calculés

Un seul gris par fond, calculé et non choisi à l'œil. Les ratios ci-dessous sont
mesurés.

| Jeton | Sur blanc | Sur crème | Sur gris illu |
|---|---|---|---|
| `--texte-second` (encre 68 %) | 5,40:1 | 5,56:1 | 4,89:1 |

| Jeton | Fond | Ratio |
|---|---|---|
| `--texte-sur-marque` (encre 86 %) | jaune | 8,18:1 |
| `--texte-sur-marque` | corail | 4,80:1 |
| `--texte-sur-marque` | violet | 4,73:1 |
| `--texte-sur-encre` (crème 60 %) | encre | 6,19:1 |

Les badges de position ont leur propre paire, parce que le blanc sur le vert ou
sur le corail tombait à 2,2:1 :

| Badge | Encre | Fond | Ratio |
|---|---|---|---|
| Pour | `#0F6B3F` | `#DCF7E7` | 5,79:1 |
| Contre | `#B9381B` | `#FFE6E2` | 4,85:1 |
| Abstention | `#7A5410` | `#FBEFD8` | 5,94:1 |

Et sur le bandeau d'un verdict, c'est l'encre pleine qui tient : 5,9:1 sur le
vert, 5,4:1 sur le corail.

## La typographie

| Jeton | Police | Usage |
|---|---|---|
| `--titres` | Outfit 600/700/800 | verdicts, noms, chiffres |
| `--texte-police` | Inter 400 à 700 | tout le texte courant |
| `--manuscrit` | Caveat 600 | annotations, **jamais** une donnée |

Les chiffres sortent en `tabular-nums` : un tableau de taux ne doit pas danser
quand les valeurs changent.

## Les formes

| Jeton | Valeur | Usage |
|---|---|---|
| `--r-section` | 28px | un bloc de contenu |
| `--r-carte` | 24px | une carte |
| `--r-petit` | 22px | une ligne, une vignette |
| `--r-puce` | 999px | pilule, badge, onglet |
| `--trait` | 2px encre | ce qui se clique ou ce qui compte |

Un encart de `p` pixels dans un rayon `R` impose un rayon intérieur de `R - p`
au maximum, sinon l'angle de l'élément intérieur dépasse celui du conteneur.
La pastille de l'onglet actif en a fait les frais.

## Les règles

1. **Un bandeau, une couleur.** Jaune pour la marque, vert ou corail pour un
   verdict. Le reste de l'écran est blanc, crème et encre.
2. **Trois familles qui ne se croisent pas.** Marque, vote, mesure. Le violet ne
   dit jamais un vote, le corail ne dit jamais une présence.
3. **Jamais un chiffre seul.** Un pourcentage sort avec sa médiane ou son total,
   sinon il ment. 6 % de participation ne veut rien dire ; 6 % quand la médiane
   est à 23 %, si.
4. **La position se recalcule.** Depuis les décomptes, jamais depuis le champ
   `positionMajoritaire` de l'open data, qui se contredit.
5. **Rien sous 4,5:1.** Un seul gris par fond, calculé. Et **aucune opacité sur
   un bloc de texte** : c'est par là que les gris dérivent sans qu'on s'en
   aperçoive.
6. **L'état actif ne tient pas sur la seule couleur.** Un trait l'accompagne
   toujours.
7. **Deux décors par écran au maximum.** Jamais sur un mot ni sur une donnée.
   Le test : si je le masque, est-ce que je perds quelque chose ?
8. **Une seule exception.** La carte, où les couleurs sont celles des groupes.

## Ce qui a été corrigé en chemin

Deux défauts réels, trouvés en appliquant le système.

**La frise des jours de séance ne s'affichait pas.** La classe `frise` servait à
deux composants sans rapport : la bande des jours de l'écran Présence et le
parcours législatif de la fiche d'un texte. La seconde définition écrasait la
première, et les barres tombaient à zéro pixel de haut. Le parcours a pris son
propre nom.

**Les badges de position étaient illisibles.** Blanc sur vert et blanc sur
corail, soit 2,2:1, très en dessous du seuil. Remplacés par les paires
calculées.

## Deux champs d'open data inexploités

À verser au dossier, ils ne coûtent presque rien et changent ce qui s'affiche.

**`placeHemicycle`** donne la place de chaque député dans la salle, numérotée de
1 à 650, de l'extrême droite à l'extrême gauche. Les 574 députés en fonction en
ont une, toutes distinctes. La preuve que la numérotation est bien géographique :
les places moyennes par groupe reproduisent l'axe politique sans exception, du
RN (76) à LFI (595). `scripts/build-data.mjs` télécharge le fichier et ne lit pas
ce champ.

**`codeType`** sur un organe distingue une commission permanente (`COMPER`) d'un
groupe d'amitié (`GA`), et il y a 150 groupes d'amitié dans le fichier.
`commissions.json` ne garde que le libellé, si bien que le taux de présence en
commission mélange les deux. Pour Alain David : 73 % avec les groupes d'amitié,
**81 %** sur ses seules commissions, où il est à 80 % sur 186 convocations. Il
est présent 1 fois sur 21 en groupe d'amitié, ce qui n'est pas la même
information.

## Deux coquilles

- `meta.groupes` contient **deux entrées « UDR »**, une nommée « UDR » et une
  « Union des droites pour la République ». Selon le scrutin, l'application
  affichera l'une ou l'autre.
- « 1 absences excusées » sur la fiche d'un député : singulier à accorder.

## Ce qui reste

- Réduire la couche `app` : chaque règle qui relève du système descend dans
  `composants.css`.
- Les illustrations au trait, qui portent la chaleur de la direction, ne sont pas
  encore dans l'application : les emoji de l'accueil en tiennent lieu.
- La carte ne se lit aujourd'hui que par la couleur. En vision deutéranope, EPR
  et UDR sont à un écart perceptuel de 12,4 et RN et EPR de 16,0, soit 228 sièges
  sur 574 confondus. Le toucher nomme déjà le groupe ; il faudrait que la légende
  filtre en estompant le reste.
