# Jeu de dilemmes moraux (nom provisoire)

Un jeu web où vous faites face à une série de dilemmes de vie ou de mort, inspirés du célèbre problème du tramway (*trolley problem*). Il n'y a pas de bonne réponse : à la fin de la partie, le jeu vous montre votre profil moral.

## Le principe

- Une partie dure **10 à 15 minutes**, avec 12 à 15 dilemmes.
- Chaque dilemme propose 2 ou 3 options, dont parfois « Ne rien faire ».
- Chaque choix fait évoluer des scores cachés sur 8 axes moraux.
- Avant de commencer, vous pouvez renseigner quelques informations facultatives (tranche d'âge, situation). Elles restent dans votre navigateur.

## L'écran de résultats

- Un **diagramme radar** sur 8 axes : Utilitarisme, Principes moraux, Empathie, Loyauté, Justice, Respect de l'autorité, Interventionnisme, Prise de risque.
- Un **curseur Instinctif / Réfléchi**, calculé à partir de votre temps de réponse.
- Une **jauge de Cohérence**, qui compare vos choix sur des dilemmes construits sur la même logique.
- Un **profil final** et quelques textes d'interprétation.
- La possibilité de **télécharger votre profil** en image.

## Confidentialité

Le jeu ne collecte aucune donnée : rien n'est envoyé à un serveur, aucun cookie de suivi n'est utilisé.

## Technologies

- HTML, CSS et JavaScript, sans framework ni étape de build.
- [Chart.js](https://www.chartjs.org/) pour le diagramme radar (copie locale dans `lib/`).
- Tout le contenu (dilemmes, barème, profils, textes) est dans le dossier `data/`, au format JSON.

## Lancer le jeu en local

Le jeu charge des fichiers JSON : il faut donc passer par un petit serveur local plutôt que d'ouvrir `index.html` directement.

```bash
python -m http.server 8000
```

Puis ouvrez [http://localhost:8000](http://localhost:8000) dans votre navigateur.

## Structure du projet

```
├── index.html
├── css/            # styles
├── js/             # logique du jeu, calcul des scores, affichage des résultats
├── data/           # dilemmes, axes, profils et textes (JSON)
├── lib/            # Chart.js
├── outils/         # outil de vérification et de simulation du barème (hors production)
├── tests/          # tests des fonctions de calcul (hors production)
└── CLAUDE.md       # spécifications détaillées du projet
```

## Modifier le contenu

Pour ajouter, modifier ou retirer un dilemme, il suffit d'éditer `data/dilemmes.json`. Aucune modification du code n'est nécessaire.

Après chaque modification du barème, ouvrez `outils/verification.html` : il signale les axes trop peu testés, les axes qui varient toujours ensemble et les profils jamais attribués, grâce à une simulation de 1 000 parties.

Le format détaillé des fichiers et les règles de calcul sont décrits dans [CLAUDE.md](CLAUDE.md).

## Tests

Les fonctions de calcul (scores, normalisation, instinct, cohérence, profil) sont testées avec Node.js (version 18 ou plus), sans dépendance :

```bash
node --test
```

## Mise en ligne

Le jeu est un site 100 % statique : il suffit de copier les fichiers dans le dossier publié par le serveur web. Ne copiez pas `CLAUDE.md` ni les dossiers `outils/` et `tests/` en production.

## Évolutions prévues

- Une analyse de fin de partie par IA, en option.
- La comparaison avec les autres joueurs (avec enregistrement anonyme et consentement).
- Des illustrations pour les dilemmes.

## Contenu

Les dilemmes sont des créations originales inspirées d'expériences de pensée philosophiques classiques. Le jeu présente des situations fictives de vie ou de mort, décrites sobrement.
