# 🎮 Défense de Zone — Shooter Game

> Mini-jeu sur navigateur développé en HTML, CSS et JavaScript Vanilla.

---

## 📝 Présentation

Le joueur contrôle une **tourelle** située en bas de l'écran et doit détruire des cibles tombant du ciel avant qu'elles n'atteignent le bas de la zone de jeu. Une fois toutes les cibles détruites, un **Boss final** apparaît.

---

## ✨ Fonctionnalités Principales

| Fonctionnalité | Description |
|---|---|
| 🎚️ **3 niveaux de difficulté** | Easy, Medium, Hard — modifie la vitesse de chute des cibles et du boss |
| 🔄 **Contrôle directionnel** | Rotation de l'arme de -45° à +45° |
| 🌊 **Système de vagues** | 10 cibles basiques, puis un Boss final (5 tirs pour le vaincre) |
| 💥 **Détection de collisions** | Impact entre projectiles, cibles et boss |
| 📊 **Tableau de bord** | Score, angle de tir, cibles restantes et points de vie en temps réel |
| 🔊 **Audio & Animations** | Effets sonores sur tirs réussis, animations de victoire/défaite |

---

## 🕹️ Contrôles

| Touche | Action |
|---|---|
| 🖱️ **Souris** | Sélectionner la difficulté puis cliquer sur **Play** |
| `Enter` | Raccourci pour lancer la partie |
| `←` Flèche Gauche | Tourner l'arme vers la gauche (jusqu'à -45°) |
| `→` Flèche Droite | Tourner l'arme vers la droite (jusqu'à +45°) |
| `↑` Flèche Haut | Tirer un projectile |

---

## ⚙️ Documentation Technique

Le fichier `jeuxjavascript.js` suit une **approche procédurale** et manipule directement le DOM.

### 1. Variables d'état global

| Variable | Rôle |
|---|---|
| `angle` | Rotation de la tourelle (pas de 5°) |
| `score` | Compteur de cibles détruites |
| `life` | Vies du joueur (1 par défaut — mort subite si une cible touche le sol) |
| `time` / `bossSpeed` | Vitesse du jeu, modifiée par les boutons de difficulté |
| `bossLife` | Points de vie du boss (5 par défaut) |

---

### 2. Fonctions Principales

#### `init()`
Démarre le jeu : masque le menu, lance l'animation des cibles et active les écouteurs d'événements clavier.

#### `createTarget()`
Génère 10 éléments `div.target` placés aléatoirement en haut de l'écran (coordonnées X et Y aléatoires).

#### `animateTarget()`
Contient les boucles temporelles principales via `setInterval` :

- ⬇️ Fait descendre les cibles régulières
- ⚠️ Alerte visuellement le joueur si les cibles s'approchent de la limite basse
- 💀 Déclenche le **Game Over** (`lose`) si une cible franchit la limite
- 👾 Gère l'apparition et le **mouvement en zigzag** du Boss une fois le score maximum atteint

#### `weaponDirection(e)`
Met à jour la rotation CSS (`transform: rotate`) de l'élément `.weapon` selon les flèches `←` / `→`.

#### `createBall(e)`
Instancie un élément `.ball` dans le DOM à la pression de `↑` et appelle `animateBall()`.

#### `animateBall(elem)`
Calcule la trajectoire (X, Y) du projectile en fonction de l'`angle` actuel.

#### `checkCollision(cur, ballTop, ballLeft, x, y)`
Moteur de collision principal :

1. Déplace la balle frame par frame
2. Vérifie si ses coordonnées croisent celles d'une `.target` (**Box collision**)
3. En cas de collision :
   - 🔊 Joue `shoot.mp3`
   - ➕ Incrémente le score
   - 🗑️ Supprime la cible et le projectile du DOM

#### `bossDeath(...)`
Gère spécifiquement la collision balle / Boss :

- Décrémente `bossLife` à chaque impact
- Déclenche l'écran de **victoire** (`won`) quand `bossLife` atteint 0
