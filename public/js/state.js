// État de la partie, pools d'objets et effets visuels.
import { W, DIFF, COL, TARGET_COUNT, TARGET_COLORS, settings } from './config.js';

// ------------------------------------------------------------ pools (aucune allocation pendant le jeu)
const MAX_PARTS = 600;
export const parts = Array.from({ length: MAX_PARTS }, () => ({ alive: false }));
let partCursor = 0;

export function spawnPart(x, y, vx, vy, life, size, color, grav = 600, shape = 0) {
	const p = parts[partCursor]; partCursor = (partCursor + 1) % MAX_PARTS;
	p.alive = true; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = life; p.max = life;
	p.size = size; p.color = color; p.grav = grav; p.shape = shape;
	p.rot = Math.random() * 6.28; p.vr = (Math.random() - 0.5) * 12;
}

export const bullets = Array.from({ length: 40 }, () => ({ alive: false, trail: [] }));
export const rings = [];
export const texts = [];

// ------------------------------------------------------------ état
export const game = {
	state: 'menu', time: 0, score: 0, lives: 3, combo: 0, shots: 0, hits: 0,
	angle: 0, recoil: 0, cooldown: 0, shake: 0, flash: 0, flashColor: COL.white, freeze: 0,
	targets: [], boss: null, banner: null, endTimer: 0, dance: 0, clouds: [],
};

export const input = { left: false, right: false, fire: false, pointerFire: false, pointerAim: false };

export function resetRound() {
	const d = DIFF[settings.level];
	Object.assign(game, {
		time: 0, score: 0, lives: d.lives, combo: 0, shots: 0, hits: 0, angle: 0, recoil: 0, cooldown: 0,
		shake: 0, flash: 0, freeze: 0, boss: null, banner: null, endTimer: 0, dance: 0,
	});
	bullets.forEach((b) => { b.alive = false; });
	parts.forEach((p) => { p.alive = false; });
	rings.length = 0; texts.length = 0;
	game.targets = [];
	for (let i = 0; i < TARGET_COUNT; i++) {
		const baseX = 50 + Math.random() * (W - 100);
		game.targets.push({
			alive: true, baseX, x: baseX, y: -50 - i * 62 - Math.random() * 40,
			vy: d.fall[0] + Math.random() * (d.fall[1] - d.fall[0]),
			phase: Math.random() * 6.28, sway: 10 + Math.random() * 16,
			color: TARGET_COLORS[i % TARGET_COLORS.length], blink: 1 + Math.random() * 3, wob: 0,
		});
	}
	setBanner('VAGUE 1', COL.mint, 1.3);
}

export function initClouds() {
	game.clouds = Array.from({ length: 5 }, (_, i) => ({
		x: Math.random() * W, y: 60 + i * 85 + Math.random() * 30, w: 60 + Math.random() * 70, v: 6 + Math.random() * 10,
	}));
}

export function multiplier() { return Math.min(1 + Math.floor(game.combo / 3), 5); }

// ------------------------------------------------------------ effets
export function addShake(a) { game.shake = Math.max(game.shake, a); }
export function addFlash(a, c = COL.white) { game.flash = Math.max(game.flash, a); game.flashColor = c; }
export function setBanner(text, color, dur) { game.banner = { text, color, t: 0, dur }; }
export function popText(x, y, text, color = COL.ink, size = 22) { texts.push({ x, y, text, color, size, t: 0, dur: 0.9 }); }

export function explode(x, y, color, n = 22, power = 320) {
	for (let i = 0; i < n; i++) {
		const a = Math.random() * Math.PI * 2, s = power * (0.35 + Math.random() * 0.75);
		const c = i % 3 === 0 ? COL.ink : (i % 3 === 1 ? color : COL.white);
		spawnPart(x, y, Math.cos(a) * s, Math.sin(a) * s - 120, 0.5 + Math.random() * 0.5, 5 + Math.random() * 7, c, 700, i % 2);
	}
	rings.push({ x, y, r: 6, max: 70 + n, t: 0, dur: 0.35, color });
}

export function confetti() {
	const colors = [COL.yellow, COL.pink, COL.mint, COL.blue, COL.coral];
	for (let i = 0; i < 180; i++) {
		spawnPart(Math.random() * W, -20 - Math.random() * 200, (Math.random() - 0.5) * 160, 80 + Math.random() * 200,
			2.5 + Math.random() * 1.5, 6 + Math.random() * 6, colors[i % colors.length], 220, i % 2);
	}
}
