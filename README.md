# Mon Hémicycle

**Les votes et la présence des députés, en clair, dans la poche.**

Mon Hémicycle est une application mobile libre et gratuite qui rend lisibles les travaux de l'Assemblée nationale :
qui est mon député, comment vote-t-il, est-il présent, et que s'est-il passé lors de chaque scrutin.

Elle fonctionne sur iPhone, Android et ordinateur. Pas de store, pas de compte : on l'ouvre dans le navigateur, on
l'ajoute à l'écran d'accueil, c'est tout.

> Projet indépendant, sans lien avec l'Assemblée nationale. Les chiffres proviennent exclusivement de l'open data
> officiel ; voir [Méthodologie](#méthodologie) pour savoir ce qu'ils mesurent, et ce qu'ils ne mesurent pas.

## Fonctionnalités

- **Mon député** : à partir de son adresse, retrouver sa circonscription et la personne qui y siège ; voir ses votes,
  sa participation aux scrutins, sa présence en commission mois par mois, et la part de ses votes conformes à la
  position de son groupe.
- **Scrutins** : tous les scrutins publics de la législature, avec recherche, filtre (solennels, motions de censure),
  résultat pour / contre / abstention, répartition par groupe politique et liste nominative des votants.
- **En direct et notifications** : les scrutins apparaissent dans l'application quelques minutes après le vote,
  et l'on peut recevoir une notification à chaque nouveau scrutin, ou seulement pour les votes sur l'ensemble d'un
  texte et les motions de censure.
- **Présence** : taux de participation aux scrutins et de présence en commission, sur une journée ou une période
  choisie, par groupe, par région ou par député.

## Installer l'application

Ouvrir l'adresse de l'application dans le navigateur du téléphone, puis :

- **iPhone (Safari)** : bouton Partager, puis « Sur l'écran d'accueil ».
- **Android (Chrome)** : menu ⋮, puis « Installer l'application » (ou « Ajouter à l'écran d'accueil »).

L'application s'ouvre ensuite en plein écran comme une application native, et les pages déjà consultées restent
disponibles hors connexion.

Pour recevoir les notifications, aller dans l'onglet *Scrutins* puis « Me prévenir ». Sur iPhone (iOS 16.4 ou plus
récent), il faut d'abord avoir ajouté l'application à l'écran d'accueil et l'ouvrir depuis son icône.

## Méthodologie

| Indicateur | Calcul | Limite à connaître |
|---|---|---|
| Scrutins votés | Scrutins publics auxquels le député a pris part (pour, contre, abstention, non-votant) ÷ scrutins tenus pendant son mandat. Les motions de censure sont exclues, car seuls les votes « pour » y sont publiés. | Beaucoup de scrutins ordinaires ont lieu en même temps que les réunions de commission. Une participation faible ne signifie pas que le député ne travaille pas. |
| Présence en commission | Réunions où le député est noté « présent » ÷ réunions où il était convoqué. Les absences excusées comptent comme des absences. | Ne couvre que les réunions dont l'Assemblée publie la feuille de présence. |
| Votes solennels | Votes solennels auxquels le député a pris part ÷ votes solennels tenus pendant son mandat. | Ce sont les votes sur l'ensemble des grands textes, annoncés à l'avance. |
| Votes comme son groupe | Votes (pour, contre, abstention) identiques à la position majoritaire de son groupe au moment du vote. | N'a pas de sens pour les non-inscrits. |

Dans les vues par groupe et par région, chaque député est rattaché à son groupe et à sa région **actuels**, et les
taux sont pondérés (total des votes ÷ total des scrutins des membres).

Les mises au point (corrections de vote déclarées après coup) ne sont pas prises en compte : comme l'Assemblée, on
affiche le vote tel qu'il a été enregistré.

## Sources de données

| Donnée | Source | Licence |
|---|---|---|
| Scrutins, votes nominatifs | [data.assemblee-nationale.fr](https://data.assemblee-nationale.fr), jeu « Scrutins » | [Licence Ouverte 2.0](https://www.etalab.gouv.fr/licence-ouverte-open-licence/) |
| Députés, groupes, mandats | data.assemblee-nationale.fr, jeu « Députés, sénateurs et ministres (AMO20) » | Licence Ouverte 2.0 |
| Présence en commission | data.assemblee-nationale.fr, jeu « Agenda » (feuilles de présence des réunions) | Licence Ouverte 2.0 |
| Contours des circonscriptions | [data.gouv.fr](https://www.data.gouv.fr/fr/datasets/contours-geographiques-des-circonscriptions-legislatives/) | Licence Ouverte 2.0 |
| Géocodage des adresses | [Géoplateforme IGN](https://geoservices.ign.fr/documentation/services/services-geoplateforme/geocodage), appelée depuis le navigateur | Licence Ouverte 2.0 |
| Photos des députés | Site de l'Assemblée nationale, chargées à la volée | Droits de l'Assemblée nationale |

**Vie privée** : l'adresse saisie est envoyée uniquement au service de géocodage de l'IGN. Seule la circonscription
trouvée est conservée, dans le stockage local du téléphone. Aucun compte, aucun traceur, aucun serveur à nous.

## Architecture

```
open data AN ──► scripts/build-data.mjs ──► public/data/*.json ──► application (PWA statique)
  (zip JSON)      (chaque nuit, en CI)        (fichiers compacts)       GitHub Pages
                                                                          ▲      ▲
site AN ───────► worker/ (Cloudflare, toutes les 5 min) ── /api/recents ──┘      │
 (page scrutins)   veille, abonnements (KV), envoi Web Push ── notification ──► téléphone
```

L'open data n'est régénéré qu'une fois par nuit, alors que le site de l'Assemblée publie chaque scrutin quelques
minutes après le vote. Le Worker lit donc la page des 50 derniers scrutins toutes les 5 minutes (environ 300
requêtes par jour), garde les nouveautés et prévient les abonnés. Chaque nuit, la reconstruction complète depuis
l'open data prend le relais avec le détail par groupe et par député.

- **Pas de backend.** Un script Node télécharge l'open data, le transforme en fichiers JSON compacts (index des
  scrutins, détail par paquets de 250, un fichier par député, agrégats de présence par jour, contours par
  département), puis l'application les lit directement.
- **Application** : React + TypeScript, construite avec Vite, installable (PWA) grâce à `vite-plugin-pwa`. Les
  données sont mises en cache au fil de la consultation.
- **Notifications** : un [Cloudflare Worker](worker/) envoie les notifications Web Push (VAPID et chiffrement
  aes128gcm implémentés avec la Web Crypto API, sans dépendance). Les abonnements sont stockés dans Workers KV :
  seuls l'adresse technique du service de push du navigateur et le type d'alerte choisi sont conservés.
- **Mise à jour** : le workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) reconstruit les données
  et redéploie chaque matin, et à chaque push sur `main`.

```
scripts/build-data.mjs   transformation de l'open data
src/data.ts              types, chargement des données, calculs de présence, géocodage
src/pages/               MonDepute, Depute, Scrutins, Scrutin, Presence
src/components.tsx       barres de vote, jauges, cartes
```

## Développement

Prérequis : Node.js 22 ou plus récent.

```bash
npm install
npm run data      # télécharge l'open data (~45 Mo) et génère public/data
npm run dev       # http://localhost:5173
```

`npm run data -- --offline` réutilise les archives déjà téléchargées dans `.cache/`.

### Tester sur son téléphone

`npm run dev` écoute sur le réseau local. Avec le téléphone sur le même Wi-Fi que l'ordinateur, ouvrir l'adresse
« Network » affichée par Vite (par exemple `http://192.168.1.20:5173`).

L'installation sur l'écran d'accueil et le mode hors connexion exigent HTTPS : pour les tester, utiliser la version
déployée sur GitHub Pages.

### Applications iOS et Android

La même application est enveloppée dans une coque native avec [Capacitor](https://capacitorjs.com) (dossiers `ios/`
et `android/`). La version native n'embarque pas les données : elle les lit sur le site publié
(`VITE_DATA_URL` dans `.env.mobile`).

```bash
npm run ios        # construit, synchronise et ouvre le projet dans Xcode
npm run android    # idem dans Android Studio
```

Pour l'installer sur son propre iPhone sans passer par l'App Store : brancher le téléphone, choisir son identifiant
Apple dans *Signing & Capabilities* (un compte gratuit suffit, l'app reste alors installée 7 jours), puis lancer.

### Déployer sur GitHub Pages

1. Pousser le dépôt sur GitHub.
2. Dans *Settings → Pages*, choisir la source **GitHub Actions**.
3. Le workflow publie l'application sur `https://<compte>.github.io/<dépôt>/`.

### Déployer le Worker de notifications (facultatif)

Sans Worker, l'application fonctionne avec les données de la nuit, sans direct ni notifications.

```bash
cd worker
npm install
npm test                         # lecture du site de l'AN, chiffrement push, signature VAPID
npx wrangler login
node scripts/vapid.mjs           # génère la paire de clés VAPID
npx wrangler secret put VAPID_PRIVATE_JWK
npx wrangler deploy
```

Renseigner dans `worker/wrangler.toml` la clé publique (`VAPID_PUBLIC_KEY`), l'URL de l'application (`URL_APP`) et
son origine (`ORIGINES`), puis déclarer l'adresse du Worker dans la variable GitHub `VITE_API_URL`.

En local, `npm run dev` dans `worker/` démarre le Worker sur le port 8787 (clés dans `worker/.dev.vars`), et
`VITE_API_URL=http://localhost:8787` dans `.env.local` y branche l'application.

## Feuille de route

- Résumés en langage clair des scrutins et des dossiers législatifs
- Notification du vote de mon député
- Suivi de plusieurs députés, comparaison
- Interventions en séance et questions écrites
- Notifications natives (APNs, FCM) dans les applications iOS et Android
- Publication sur l'App Store et le Play Store

## Contribuer

Les contributions sont les bienvenues : signalement d'erreur, amélioration de la méthodologie, nouvelles vues.
Voir [CONTRIBUTING.md](CONTRIBUTING.md).

## Licence

Code sous licence [MIT](LICENSE). Les données restent soumises à leurs licences respectives (voir
[Sources de données](#sources-de-données)) ; toute réutilisation doit mentionner l'Assemblée nationale comme source.
