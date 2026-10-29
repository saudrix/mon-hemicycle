# Contribuer à Mon Hémicycle

Merci de votre intérêt ! Ce projet vise à rendre les travaux de l'Assemblée nationale accessibles à tous. Chaque
contribution compte, du simple signalement à une nouvelle fonctionnalité.

## Signaler un problème

Ouvrez une *issue* en précisant :

- ce que vous avez vu (capture bienvenue) et ce que vous attendiez ;
- pour une erreur de chiffre : le député ou le numéro de scrutin concerné, et la source qui vous fait penser que le
  chiffre est faux.

## Proposer une modification

1. Créez une branche depuis `main`.
2. Installez et générez les données : `npm install && npm run data`.
3. Vérifiez que tout compile : `npm run build`.
4. Ouvrez une *pull request* qui explique le besoin et le choix fait.

## Principes

- **Neutralité** : l'application présente des faits, sans commentaire politique. Les classements et les couleurs
  ne doivent favoriser ni stigmatiser aucun groupe.
- **Transparence** : tout nouvel indicateur est documenté dans la section « Méthodologie » du README, avec ses
  limites.
- **Sobriété** : pas de backend, pas de traceur, des données compactes. Les dépendances doivent se justifier.
- **Accessibilité** : textes lisibles, contrastes suffisants, navigation au clavier et lecteur d'écran.

## Code de conduite

Échanges courtois et bienveillants, quelles que soient les opinions politiques de chacun. Les propos insultants
ou partisans dans les issues et les pull requests seront modérés.
