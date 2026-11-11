# SEVUX — Défends la zone

Mini-jeu de tir dans le navigateur, en HTML, CSS et JavaScript vanilla (canvas 2D). Il est caché en easter egg dans mon portfolio.

## Le jeu

Tu contrôles une tourelle en bas de l'écran. Une vague de 10 cibles descend : détruis-les avant qu'elles franchissent la bande de danger. Quand la vague est nettoyée, le **boss final** arrive. Il zigzague, descend à chaque rebond et devient **enragé** (plus rapide) à mi-vie.

| Fonctionnalité | Détail |
|---|---|
| 3 difficultés | Facile, Normal, Difficile : vitesse de chute, nombre de vies, points de vie et vitesse du boss |
| Combos | Les tirs réussis à la suite font monter un multiplicateur (jusqu'à x5). Un tir raté le remet à zéro |
| Juice | Particules, ondes de choc, secousse d'écran, *hit-stop*, flashs, bannières animées, confettis de victoire |
| Score | Bonus de vies restantes, précision affichée en fin de partie, record sauvegardé (localStorage) |
| Hall of fame | En fin de partie, le joueur inscrit son pseudo. Le classement en ligne s'affiche dans le menu, dans l'écran de fin et sur le portfolio |
| Son | Effets synthétisés en direct avec la Web Audio API, coupables avec `M` |
| Mobile | Viser et tirer au doigt, mise à l'échelle automatique à la taille de l'écran |

## Contrôles

| Action | Clavier | Souris / tactile |
|---|---|---|
| Viser | `←` `→` (ou `A` `D`) | déplacer le pointeur |
| Tirer | `↑`, `Espace` (ou `W`), maintenir pour un tir continu | clic / toucher (maintenir pour un tir continu) |
| Lancer / rejouer | `Entrée` | bouton |
| Pause | `P` ou `Échap` | — |
| Son | `M` | bouton ♪ |

## Technique

- **Une seule boucle** `requestAnimationFrame` avec *delta time* (vitesse identique quel que soit l'écran) et mise en pause quand l'onglet est caché.
- **Sprites pré-rendus** dans des canvas hors écran (visages, boss, décor), redessinés seulement au redimensionnement, à la bonne résolution pour les écrans Retina (`devicePixelRatio`).
- **Pools d'objets** pour les balles et les particules : aucune allocation pendant le jeu.
- **Collisions cercle-cercle** calculées en mémoire, sans aucune lecture du DOM.
- **Aucun asset** : graphismes et sons sont générés par le code (aucune image ni aucun fichier audio à télécharger).

## Classement en ligne

Le classement est servi par une **Netlify Function** (`netlify/functions/scores.mjs`), qui stocke les données dans **Netlify Blobs**. Aucun service externe ni aucune clé ne sont nécessaires.

| Requête | Effet |
|---|---|
| `GET /api/scores?limit=10` | Meilleurs scores (CORS ouvert : le portfolio peut les lire) |
| `POST /api/scores` | `{ name, score, level, accuracy, won }` : un seul score par pseudo (le meilleur est gardé), top 100 conservé |

Garde-fous côté serveur (`lib/leaderboard.mjs`) :
- pseudo de 2 à 16 caractères (lettres, chiffres, espace, `_ . -`) ;
- score entier et plafonné ;
- difficulté validée ;
- un envoi toutes les 15 s par visiteur (adresse IP hachée, jamais stockée en clair).

Comme le jeu tourne côté navigateur, un tricheur motivé pourra toujours envoyer un faux score : il faudra alors faire le ménage à la main dans les Blobs depuis l'interface Netlify.

## Structure

```
public/                 le jeu (publié par Netlify)
netlify/functions/      API du classement
lib/leaderboard.mjs     validation et tri, partagés entre l'API et le serveur local
dev-server.mjs          serveur local : jeu + API en mémoire
```

## Lancer en local

```bash
npm install
npm run dev     # http://localhost:5055 (ajoute ?debug pour __sevux.end() dans la console)
npm test        # tests de l'API
```
