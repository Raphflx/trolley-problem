# CLAUDE.md — Jeu de dilemmes moraux (nom provisoire)

Ce fichier décrit le projet pour Claude Code. Lis-le en entier avant d'écrire du code et respecte les décisions qu'il contient. Si une décision manque ou semble contradictoire, pose la question plutôt que d'inventer.

---

## 1. Le projet en bref

Un jeu web où le joueur enchaîne des **dilemmes de vie ou de mort** inspirés du trolley problem. Chaque choix ajoute ou retire des points sur des **axes moraux**. À la fin, le joueur voit son profil :
- un **diagramme radar à 8 axes** ;
- un **curseur Instinctif / Réfléchi** ;
- une **jauge de Cohérence** ;
- un **profil final** (archétype) et des textes d'interprétation.

**Il n'y a pas d'IA dans cette version.** Toute l'analyse repose sur un barème de points défini dans les fichiers de données. Une analyse par IA viendra plus tard, en option (voir section 11) : l'architecture doit la permettre sans tout réécrire.

### Public et ton
- **Grand public.**
- **Ton sérieux mais accessible** : phrases simples, pas de jargon philosophique, pas de noms de philosophes dans les textes affichés au joueur.
- **Situations de vie ou de mort**, décrites sobrement : aucune description gore ou complaisante.
- Le jeu **ne juge jamais** le joueur. Les textes décrivent et questionnent (« vous avez tendance à… »), ils ne moralisent pas (« vous êtes quelqu'un de mauvais »).

### Durée cible
Une partie dure **10 à 15 minutes**, avec 12 à 15 dilemmes.

---

## 2. Choix techniques

- **HTML / CSS / JavaScript vanilla**, sans framework ni étape de build. Le jeu doit fonctionner en ouvrant `index.html` via un petit serveur local (voir section 10).
- **Chart.js** pour le radar. Copie la bibliothèque en local dans `lib/` (pas de CDN), pour que le jeu fonctionne hors ligne.
- **Aucune donnée envoyée à un serveur** dans cette version (voir section 8).
- **Responsive** : le jeu doit être confortable sur mobile comme sur ordinateur.
- Code et commentaires **en français** pour les noms métier (axes, dilemmes, profils) ; noms de variables techniques en anglais acceptés.
- Pas de dépendance npm à l'exécution.

---

## 3. Arborescence attendue

```
/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── main.js          # enchaînement des écrans
│   ├── moteur.js        # chargement des dilemmes, enregistrement des choix, chronométrage
│   ├── scores.js        # calcul et normalisation des scores, cohérence, instinct/réflexion
│   ├── profils.js       # choix du profil final et des textes d'interprétation
│   └── resultats.js     # affichage du radar, du curseur, de la jauge, export image
├── data/
│   ├── axes.json
│   ├── dilemmes.json
│   ├── profils.json
│   └── textes.json      # textes d'interprétation par axe et par seuil
├── lib/
│   └── chart.umd.min.js
└── CLAUDE.md
```

**Règle importante** : tout le contenu (dilemmes, points, profils, textes) vit dans `data/`. Le code ne doit contenir **aucun texte de dilemme ni aucun barème en dur**. On doit pouvoir modifier, ajouter ou retirer un dilemme en éditant seulement `dilemmes.json`.

---

## 4. Les axes

### 4.1 Axes du radar (8)

| id | Nom affiché | Ce qu'il mesure (score élevé) |
|---|---|---|
| `utilitarisme` | Utilitarisme | Cherche le meilleur bilan, compte les vies |
| `principes` | Principes moraux | Refuse de franchir certaines limites (utiliser une personne comme un moyen, mentir, trahir une promesse), même quand les conséquences seraient meilleures |
| `empathie` | Empathie | Touché par la souffrance d'une personne précise, même inconnue |
| `loyaute` | Loyauté | Protège ses proches et son groupe en priorité |
| `justice` | Justice | Tient compte du mérite et de la responsabilité de chacun |
| `autorite` | Respect de l'autorité | Suit les lois, les règles et les ordres |
| `interventionnisme` | Interventionnisme | Tendance à agir plutôt qu'à laisser les choses suivre leur cours |
| `risque` | Prise de risque | Accepte une issue incertaine si elle peut être meilleure |

Ces axes sont définis dans `data/axes.json` (id, nom affiché, description courte affichée en infobulle sur l'écran de résultats). L'ordre du fichier est l'ordre d'affichage sur le radar.

### 4.2 Axes affichés à part (2)

| id | Affichage | Calcul |
|---|---|---|
| `instinct` | Curseur **Instinctif ◄──●──► Réfléchi** | Temps de réponse (section 6.3) |
| `coherence` | Jauge **Cohérence : xx %** | Dilemmes jumeaux (section 6.4) |

Ces deux axes **ne figurent pas sur le radar**. Le curseur n'a pas de « bonne » extrémité : ne le colore pas comme un score (pas de rouge/vert).

### 4.3 Paires d'axes à ne pas confondre
Le contenu des dilemmes doit séparer ces paires ; le code n'a rien de particulier à faire, mais l'outil de vérification (section 9) doit les surveiller :
- **Interventionnisme / Prise de risque** : agir n'est pas toujours risqué, et l'inaction peut l'être.
- **Empathie / Loyauté** : l'empathie vaut aussi pour un inconnu, la loyauté privilégie son groupe.
- **Principes / Interventionnisme** : respecter un principe demande parfois d'agir.
- **Principes / Autorité** : les principes viennent du joueur, l'autorité de règles extérieures.

---

## 5. Format des données

### 5.1 `dilemmes.json`

```json
[
  {
    "id": "levier",
    "titre": "Le levier",
    "texte": "Description de la situation, 60 à 120 mots.",
    "options": [
      {
        "id": "agir",
        "libelle": "Actionner le levier",
        "passive": false,
        "points": { "utilitarisme": 2, "principes": -1, "interventionnisme": 2 }
      },
      {
        "id": "rien",
        "libelle": "Ne rien faire",
        "passive": true,
        "points": { "principes": 1, "interventionnisme": -2 }
      }
    ],
    "jumeau": { "groupe": "sacrifice-1-pour-5", "logique": { "agir": "A", "rien": "B" } },
    "minuteur": null
  }
]
```

Règles :
- 2 à 3 options par dilemme.
- `points` : entiers de **−2 à +2**. Un axe absent vaut 0.
- `passive: true` signale l'option « ne rien faire ». Elle s'affiche comme **un vrai bouton**, visuellement de même importance que les autres : le joueur doit sentir que c'est un choix.
- `jumeau` (facultatif) : les dilemmes du même `groupe` testent la même logique avec un habillage différent. `logique` associe chaque option à une lettre ; deux options de même lettre dans deux dilemmes jumeaux sont considérées comme cohérentes.
- `minuteur` (facultatif) : nombre de secondes. Si le temps s'écoule, l'option `passive` est choisie automatiquement. **Le joueur doit voir le compte à rebours et savoir dès le début du dilemme que l'inaction sera le choix par défaut.** Utiliser au maximum sur 2 ou 3 dilemmes.

### 5.2 `profils.json`

Chaque profil a un `id`, un `nom` (ex. « Le Stratège »), une `description` (3 à 5 phrases) et une `condition` portant sur les axes dominants :

```json
{
  "id": "stratege",
  "nom": "Le Stratège",
  "description": "…",
  "condition": { "dominants": ["utilitarisme", "interventionnisme"] }
}
```

Le profil attribué est celui dont les axes `dominants` correspondent le mieux aux 2 ou 3 axes les plus élevés du joueur (voir section 6.5). Prévoir un profil **« L'Équilibré »** par défaut, attribué quand aucun axe ne se détache nettement (écart entre l'axe le plus haut et le plus bas inférieur à 25 points).

### 5.3 `textes.json`

Pour chaque axe du radar, un texte pour un score **élevé (≥ 70)** et un pour un score **faible (≤ 30)**. Rien n'est affiché entre les deux. Sur l'écran de résultats, n'afficher que les **3 textes les plus marqués** (scores les plus éloignés de 50), pour ne pas noyer le joueur.

Ajouter aussi les textes du curseur Instinct/Réflexion (3 zones) et de la jauge de Cohérence (3 zones : < 50 %, 50-79 %, ≥ 80 %).

---

## 6. Règles de calcul

### 6.1 Score brut
Pour chaque axe : somme des points de toutes les options choisies.

### 6.2 Normalisation (0-100)
Pour chaque axe, calculer **automatiquement à partir de `dilemmes.json`** :
- `min` = somme, sur tous les dilemmes, du plus petit nombre de points que l'axe peut recevoir dans ce dilemme (0 si l'axe n'y apparaît pas) ;
- `max` = idem avec le plus grand.

Puis : `score = round((brut - min) / (max - min) * 100)`.
Si `max == min` (axe jamais touché), afficher 50 et signaler l'anomalie dans la console.

### 6.3 Instinct / Réflexion
- Chronométrer chaque dilemme entre l'affichage complet du texte et le clic.
- Retirer un temps de lecture estimé : `nombre_de_mots / 4` secondes.
- Ignorer les dilemmes à minuteur dans ce calcul.
- Prendre la **médiane** des temps ajustés (moins sensible à une pause du joueur).
- Positionner le curseur : ≤ 2 s → 0 (instinctif), ≥ 15 s → 100 (réfléchi), linéaire entre les deux. Garder ces bornes dans une constante facile à modifier.

### 6.4 Cohérence
- Pour chaque groupe de jumeaux : les choix sont cohérents si toutes les options choisies ont la même lettre `logique`.
- `coherence = groupes cohérents / groupes jumeaux × 100`.
- S'il n'y a aucun groupe, ne pas afficher la jauge.

### 6.5 Profil final
- Classer les 8 axes par score décroissant.
- Pour chaque profil, compter combien de ses axes `dominants` figurent dans le top 3 du joueur ; à égalité, départager par la somme des scores de ces axes.
- Appliquer la règle de « L'Équilibré » (section 5.2) avant tout.

Toutes ces fonctions doivent être **pures** (entrée : données + choix ; sortie : scores) et testables séparément.

---

## 7. Écrans

1. **Accueil** : titre, une phrase d'accroche, durée estimée, bouton « Commencer ».
2. **Avertissement** : le jeu présente des situations de vie ou de mort, fictives ; il n'y a pas de bonne réponse ; aucune donnée n'est envoyée.
3. **Informations facultatives** (voir section 8) : formulaire court, avec un bouton **« Passer »** aussi visible que « Continuer ».
4. **Dilemmes** : un par écran. Titre, texte, boutons d'options. Barre de progression (« 4 / 14 »). Pas de retour en arrière possible sur un choix validé.
5. **Résultats** :
   - nom et description du profil ;
   - radar à 8 axes (valeurs affichées sur les points, comme sur un radar classique) ;
   - curseur Instinctif / Réfléchi ;
   - jauge de Cohérence ;
   - les 3 textes d'interprétation les plus marqués ;
   - bouton **« Télécharger mon profil »** (image PNG du radar et du profil, générée côté navigateur) ;
   - bouton **« Rejouer »**.

Accessibilité : contrastes suffisants, navigation possible au clavier, taille de texte lisible sur mobile.

---

## 8. Informations facultatives sur le joueur

Le joueur peut renseigner, **sans obligation** :
- **Tranche d'âge** : moins de 18 ans, 18-24, 25-34, 35-49, 50-64, 65 et plus.
- **Situation** : en études, en activité, en recherche d'emploi, retraité, autre.
- Si **en études**, **niveau** : collège, lycée, Bac+1 à Bac+3, Bac+4 et plus.
- Si **en activité**, **catégorie** : employé, ouvrier, cadre, profession intermédiaire, indépendant, autre.

Règles :
- Chaque champ propose aussi « Je préfère ne pas répondre ».
- Pas de champ texte libre, pas de nom, pas d'e-mail.
- **Dans cette version, ces informations restent dans le navigateur** (en mémoire pendant la partie). Rien n'est envoyé ni stocké sur un serveur.
- Prévoir dans le code un objet `resultatPartie` regroupant les informations facultatives, les choix, les temps et les scores, prêt à être envoyé plus tard à une API. Ne pas implémenter l'envoi.

**Si un enregistrement côté serveur est ajouté plus tard**, il faudra au préalable : un consentement explicite et séparé, des données anonymes (pas d'adresse IP conservée), une mention d'information RGPD et une durée de conservation. Ne rien enregistrer tant que ce n'est pas en place.

---

## 9. Outil de vérification du barème

Créer une page `outils/verification.html` (non liée depuis le jeu) qui lit `dilemmes.json` et affiche :
- pour chaque axe, le nombre de dilemmes qui le touchent (**alerte si moins de 4**) et son `min` / `max` ;
- pour chaque paire de la section 4.3, le nombre d'options où les deux axes varient dans le même sens et dans des sens opposés (**alerte si ils varient presque toujours ensemble**) ;
- la liste des groupes de jumeaux et leur validité (au moins 2 dilemmes, toutes les options associées à une lettre) ;
- une **simulation** : 1 000 parties avec des choix aléatoires, et la distribution des scores par axe et des profils attribués (alerte si un profil n'est jamais attribué ou l'est dans plus de 40 % des cas).

Cet outil sert à équilibrer le jeu sans avoir à faire des dizaines de parties à la main.

---

## 10. Lancement local et mise en ligne

### Local
Le jeu charge des fichiers JSON : il ne fonctionne pas en ouvrant `index.html` directement depuis le disque (`file://`). Le lancer avec un serveur local, par exemple :
```
python -m http.server 8000
```
puis ouvrir `http://localhost:8000`.

### Mise en ligne
Hébergement prévu sur un **Raspberry Pi 4** personnel (IP fixe, accès SSH depuis un PC Windows). Le jeu est un site **100 % statique** : il suffit de copier les fichiers dans le dossier servi par le serveur web. Avant de proposer une procédure de déploiement, **demander quel serveur web est installé** (Apache, Nginx…) et le chemin du dossier publié.

Ne pas copier `CLAUDE.md` ni `outils/` en production.

---

## 11. Évolutions prévues (ne pas implémenter maintenant)

- **Analyse par IA en option** à la fin de la partie : dialogue avec le joueur sur ses contradictions, analyse de justifications écrites. L'appel à l'API devra passer par un serveur (jamais de clé d'API dans le navigateur).
- **Comparaison avec les autres joueurs**, éventuellement par tranche d'âge ou situation, qui nécessitera l'enregistrement anonyme décrit en section 8.
- Illustrations des dilemmes.

Garder le code modulaire pour que ces ajouts restent simples.

---

## 12. Ce qu'il ne faut pas faire

- Ne pas reprendre de textes, scénarios, graphismes ou noms de jeux existants (Trolley Problem, Inc., Dr. Trolley's Problem, Moral Machine…). Les dilemmes sont des créations originales.
- Ne pas mettre de contenu ou de barème en dur dans le code.
- Ne pas ajouter de suivi, de cookies publicitaires ou d'outil d'analyse d'audience.
- Ne pas afficher de jugement moral sur le joueur.
