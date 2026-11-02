# Sudoku 数

Sudoku pour Android dans l'esthétique de la série : fond bleu nuit, encre blanc cassé, accents bordeaux.

## Installer l'application sur le téléphone

1. Sur ton téléphone, ouvre la page **Releases** de ce dépôt (colonne de droite sur GitHub, ou `…/sudoku/releases`).
2. Dans la dernière version, touche le fichier `sudoku-1.0.X.apk` pour le télécharger.
3. Ouvre le fichier téléchargé. Android demande d'autoriser l'installation depuis cette source : accepte, puis touche **Installer**.
4. Si Google Play Protect affiche un avertissement (« application inconnue »), choisis **Installer quand même**. C'est normal pour une appli qui ne vient pas du Play Store.

Les mises à jour s'installent par-dessus l'ancienne version sans perdre la partie en cours ni les records.

## Le jeu

- **Règles** : remplir la grille 9×9 avec les chiffres de 1 à 9, une seule fois par ligne, colonne et carré 3×3.
- **5 niveaux** classés par technique nécessaire : Facile et Moyen (chiffres isolés), Difficile (paires et alignements dans les carrés), Expert et Maître (raisonnements par l'absurde). Chaque grille est générée au hasard, symétrique, et vérifiée à solution unique.
- **Pavé de chiffres** avec mode **Notes** (candidats) et gomme ; les conflits apparaissent en rouge, la ligne, la colonne et le carré de la case choisie sont surlignés, ainsi que les chiffres identiques ; un chiffre placé 9 fois s'estompe dans le pavé.
- **Indices progressifs** expliqués (« dans cette ligne, le 4 ne peut aller qu'ici »…), vérifier, annuler, effacer, chrono, records, mode clair / sombre, zoom, sauvegarde automatique. Clavier pris en charge (chiffres, flèches, N pour les notes). Fonctionne hors connexion.

## Structure

- `src/` : sources de l'appli. `core.js` (noyau commun à la série : accueil, niveaux, zoom, indices, records, thème), `template.html`, les fichiers du jeu, `app.json` (nom, kanji). `python3 src/build.py` assemble `www/index.html` (APK, polices incluses) et `preview.html` (version web).
- `assets/` : icône et écran de démarrage (sources des images générées dans `android/`).
- `android/` : projet Android généré par Capacitor, signé avec une clé fixe pour que les mises à jour s'installent par-dessus.
- `.github/workflows/build-apk.yml` : compile l'APK et le publie dans les Releases à chaque modification sur `main` (ou à la demande depuis l'onglet **Actions**).

## Modifier l'appli

Modifier les fichiers de `src/`, lancer `python3 src/build.py`, puis tester dans un navigateur : servir le dossier `www/` (par exemple `python3 -m http.server` dans `www/`) et ouvrir la page en mode mobile.
