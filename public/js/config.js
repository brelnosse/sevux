// Constantes du jeu, stockage local et réglages partagés entre les modules.

export const W = 600, H = 720;
export const DANGER_Y = H - 170;
export const TURRET_X = W / 2, TURRET_Y = H - 62;
export const BARREL_LEN = 76;
export const TARGET_R = 28, BOSS_R = 58, BULLET_R = 7;
export const BULLET_SPEED = 950, FIRE_DELAY = 0.16;
export const MAX_ANGLE = Math.PI / 3, AIM_SPEED = Math.PI * 0.9;
export const TARGET_COUNT = 10;

export const COL = {
	ink: '#111111', paper: '#FFF6E0', paperDark: '#F4E7C4', yellow: '#FFD23F',
	pink: '#FF8AD8', mint: '#74F2A8', coral: '#FF7F5C', blue: '#5B8CFF',
	purple: '#9B5DE5', white: '#FFFFFF', red: '#FF3B3B',
};
export const TARGET_COLORS = [COL.yellow, COL.pink, COL.mint, COL.blue];
export const FONT = '"Archivo Black", "Arial Black", sans-serif';

export const DIFF = {
	easy:   { fall: [14, 22], lives: 3, bossHp: 6,  bossSpeed: 120, bossDrop: 20 },
	medium: { fall: [22, 32], lives: 3, bossHp: 8,  bossSpeed: 165, bossDrop: 26 },
	hard:   { fall: [34, 48], lives: 2, bossHp: 10, bossSpeed: 215, bossDrop: 32 },
};

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
