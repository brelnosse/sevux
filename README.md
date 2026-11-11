# SEVUX — Défends la zone

Mini-jeu de tir dans le navigateur, en HTML, CSS et JavaScript vanilla (canvas 2D), avec un classement en ligne. Il est caché en easter egg dans mon portfolio.

**▶ Jouer : [sevux.netlify.app](https://sevux.netlify.app)**

## Le jeu

Tu contrôles une tourelle en bas de l'écran. Une vague de 10 cibles descend : détruis-les avant qu'elles franchissent la bande de danger. Quand la vague est nettoyée, le **boss final** arrive. Il zigzague, descend à chaque rebond et devient **enragé** (plus rapide) à mi-vie.

| Fonctionnalité | Détail |
|---|---|
| 3 difficultés | Facile, Normal, Difficile : vitesse de chute, nombre de vies, points de vie et vitesse du boss |
| Combos | Les tirs réussis à la suite font monter un multiplicateur (jusqu'à x5). Un tir raté le remet à zéro |
| Effets | Particules, ondes de choc, secousse d'écran, *hit-stop*, flashs, bannières animées, confettis de victoire |
| Score | Bonus de vies restantes, précision affichée en fin de partie, record personnel sauvegardé (localStorage) |
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

- **Une seule boucle** `requestAnimationFrame` avec *delta time* (même vitesse quel que soit l'écran), mise en pause quand l'onglet est caché.
- **Sprites pré-rendus** dans des canvas hors écran (visages, boss, décor), redessinés seulement au redimensionnement, à la bonne résolution pour les écrans Retina (`devicePixelRatio`).
- **Pools d'objets** pour les balles et les particules : aucune allocation pendant le jeu.
- **Collisions cercle-cercle** calculées en mémoire, sans aucune lecture du DOM.
- **Aucun asset** : graphismes et sons sont générés par le code, rien à télécharger à part les polices.

## Classement en ligne

Le classement est servi par une **Netlify Function** (`netlify/functions/scores.mjs`) qui stocke les données dans **Netlify Blobs**.

| Requête | Réponse |
|---|---|
| `GET /api/scores?limit=10` | `{ entries, total }` : les meilleurs scores (`limit` entre 1 et 50) |
| `POST /api/scores` | corps `{ name, score, level, accuracy, won }` → `201 { rank, improved, entries, total }` |

Règles appliquées par le serveur (`lib/leaderboard.mjs`) :
- un seul score par pseudo (le meilleur est gardé, sans tenir compte de la casse) ;
- les 100 meilleurs scores sont conservés ;
- un envoi toutes les 15 secondes par visiteur.

## Sécurité

| Risque | Protection |
|---|---|
| XSS | Pseudo limité à 2–16 caractères : lettres, chiffres, espace, `_ . -`. Pas de `<`, `>`, guillemets, `&`, ni de caractères invisibles ou d'inversion de sens d'écriture. Le jeu affiche les scores avec `textContent`, jamais avec `innerHTML` |
| Injection | Pas de base SQL : données stockées en JSON. Seuls des champs connus et typés entrent et sortent de l'API (`__proto__` et champs inconnus ignorés) |
| Valeurs aberrantes | Score entier et plafonné, difficulté prise dans une liste fixe, précision bornée entre 0 et 100 |
| Abus | Corps de requête limité à 1 000 octets (refusé avant lecture), limite de débit par visiteur |
| Vie privée | L'IP n'est jamais stockée : seul un hachage SHA-256 salé est gardé pour la limite de débit, puis effacé au premier envoi qui suit l'expiration des 15 s. Le sel est aléatoire, généré au premier envoi et conservé dans les Blobs privés : il n'est pas dans ce dépôt |
| En-têtes | Page du jeu : `Content-Security-Policy` (scripts du site uniquement), `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`. API : `nosniff` et CSP `default-src 'none'` |

**Limites connues :**
- Le jeu tourne dans le navigateur : quelqu'un de motivé peut envoyer un faux score sous le plafond.
- Le format des pseudos est filtré, pas leur sens.

Dans les deux cas, on supprime l'entrée à la main depuis l'interface Netlify (*Blobs* → magasin `sevux-leaderboard` → clé `top`).

## Configuration et déploiement (Netlify)

Tout est déclaré dans `netlify.toml` : dossier publié `public/`, fonctions dans `netlify/functions/`, en-têtes de sécurité.

| Variable d'environnement | Obligatoire | Rôle |
|---|---|---|
| — | — | Aucune variable nécessaire : Netlify fournit l'accès aux Blobs automatiquement |
| `SCORES_SALT` | non | Sel personnalisé pour le hachage des IP. Sans lui, un sel aléatoire est généré et conservé dans les Blobs |

## Intégrer le jeu dans un autre site

Le portfolio, hébergé ailleurs, affiche le jeu et le classement de cette manière :

```html
<!-- le jeu dans une iframe -->
<iframe src="https://sevux.netlify.app/" title="SEVUX" allow="autoplay; fullscreen"></iframe>
```

```js
// lire le classement (CORS ouvert)
const { entries } = await fetch('https://sevux.netlify.app/api/scores?limit=5').then((r) => r.json());

// être prévenu quand un joueur inscrit son score depuis l'iframe
window.addEventListener('message', (event) => {
	if (event.origin === 'https://sevux.netlify.app' && event.data?.type === 'sevux:score') {
		// recharger le classement…
	}
});
```

## Structure

```
public/                    le jeu (dossier publié par Netlify)
netlify/functions/         API du classement
lib/leaderboard.mjs        validation, tri et sécurité, partagés entre l'API et le serveur local
lib/leaderboard.test.mjs   tests de l'API
dev-server.mjs             serveur local : jeu + API en mémoire, mêmes en-têtes qu'en production
```

## Lancer en local

```bash
npm install
npm run dev     # http://localhost:5055
npm test        # 8 tests (validation, injections, limite de débit, en-têtes)
```

En local uniquement, ajouter `?debug` à l'adresse expose `__sevux.end(score, won)` dans la console pour afficher directement l'écran de fin.

## Crédits

Créé par **Brel NOSSE**, puis réécrit (canvas, classement en ligne, sécurité) avec l'aide de **Claude** (IA d'Anthropic).
