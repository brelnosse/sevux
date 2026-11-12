// Constantes du jeu, stockage local et réglages partagés entre les modules.

export const W = 600, H = 720;
export const DANGER_Y = H - 170;
export const TURRET_X = W / 2, TURRET_Y = H - 62;
export const BARREL_LEN = 76;
export const TARGET_R = 28, BOSS_R = 58, BULLET_R = 7;
export const BULLET_SPEED = 950, FIRE_DELAY = 0.2, FIRE_BUFFER = 0.18;
export const MAX_ANGLE = Math.PI / 3, AIM_SPEED = Math.PI * 0.9;
export const SHOT_R = 9, BOMB_R = 12;

export const COL = {
	ink: '#111111', paper: '#FFF6E0', paperDark: '#F4E7C4', yellow: '#FFD23F',
	pink: '#FF8AD8', mint: '#74F2A8', coral: '#FF7F5C', blue: '#5B8CFF',
	purple: '#9B5DE5', white: '#FFFFFF', red: '#FF3B3B',
};
export const TARGET_COLORS = [COL.yellow, COL.mint];
export const KIND_COLORS = { fast: COL.pink, armored: COL.blue, shooter: COL.coral };
export const FACE_COLORS = [COL.yellow, COL.mint, COL.pink, COL.blue, COL.coral];
export const FONT = '"Archivo Black", "Arial Black", sans-serif';

// fall : vitesse de chute (px/s) · fireEvery : délai entre deux tirs d'un ennemi tireur (s)
// shotSpeed : vitesse des projectiles ennemis · bossHp : points de vie du boss final
export const DIFF = {
	easy:   { fall: [18, 28], lives: 3, bossHp: 9,  bossSpeed: 130, bossDrop: 22, fireEvery: 3.4, shotSpeed: 150, bombEvery: 2.6 },
	medium: { fall: [26, 38], lives: 3, bossHp: 12, bossSpeed: 170, bossDrop: 28, fireEvery: 2.6, shotSpeed: 190, bombEvery: 2.0 },
	hard:   { fall: [36, 52], lives: 2, bossHp: 15, bossSpeed: 220, bossDrop: 34, fireEvery: 1.9, shotSpeed: 235, bombEvery: 1.5 },
};

// Types d'ennemis
export const KINDS = {
	normal:  { r: 28, hp: 1, speed: 1,    sway: 1,   points: 100, shoots: false },
	fast:    { r: 22, hp: 1, speed: 1.6,  sway: 1.8, points: 150, shoots: false },
	armored: { r: 32, hp: 2, speed: 0.8,  sway: 0.6, points: 200, shoots: false },
	shooter: { r: 28, hp: 1, speed: 0.85, sway: 0.8, points: 175, shoots: true },
};

// Déroulé d'une partie : 3 vagues, chacune terminée par un boss (deux mini-boss puis le boss final).
export const WAVES = [
	{ count: 12, spacing: 62, speed: 1.0,  kinds: { normal: 0.8, shooter: 0.2 },
		boss: { kind: 'mini', label: 'MINI-BOSS', hpRatio: 0.4, r: 44, speed: 0.85, bombs: false } },
	{ count: 16, spacing: 54, speed: 1.15, kinds: { normal: 0.5, fast: 0.25, shooter: 0.25 },
		boss: { kind: 'mini', label: 'MINI-BOSS', hpRatio: 0.6, r: 48, speed: 0.95, bombs: true } },
	{ count: 20, spacing: 48, speed: 1.3,  kinds: { normal: 0.3, fast: 0.25, armored: 0.2, shooter: 0.25 },
		boss: { kind: 'final', label: 'BOSS FINAL', hpRatio: 1, r: 58, speed: 1.1, bombs: true } },
];

// localStorage peut être bloqué (navigation privée) : on ne plante jamais.
export const store = {
	get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
	set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* navigation privée */ } },
};

// Réglages modifiés en cours de partie (un objet partagé : les modules ES ne peuvent pas réassigner un import).
const savedLevel = store.get('sevux-level', 'medium');
export const settings = {
	level: DIFF[savedLevel] ? savedLevel : 'medium',
	best: parseInt(store.get('sevux-best', '0'), 10) || 0,
};
