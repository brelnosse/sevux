// Sprites pré-rendus dans des canvas hors écran, redessinés seulement au redimensionnement.
import { W, H, DANGER_Y, TARGET_R, BOSS_R, COL, FACE_COLORS } from './config.js';
import { canvas } from './dom.js';

/** Échelle d'affichage et densité de pixels, mises à jour par resize(). */
export const view = { scale: 1, dpr: 1 };
export const sprites = { faces: {}, boss: {}, bg: null };

function makeSprite(w, h, draw) {
	const k = view.scale * view.dpr;
	const c = document.createElement('canvas');
	c.width = Math.ceil(w * k);
	c.height = Math.ceil(h * k);
	const g = c.getContext('2d');
	g.scale(k, k);
	draw(g, w, h);
	return c;
}

export function circle(g, x, y, r) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); }

function drawFace(g, cx, cy, r, color, mood) {
	g.fillStyle = COL.ink; circle(g, cx + 5, cy + 5, r); g.fill();
	g.fillStyle = color; circle(g, cx, cy, r); g.fill();
	g.lineWidth = 4; g.strokeStyle = COL.ink; g.stroke();
	g.fillStyle = 'rgba(255,255,255,.6)';
	g.beginPath(); g.ellipse(cx - r * 0.42, cy - r * 0.45, r * 0.22, r * 0.12, -0.6, 0, Math.PI * 2); g.fill();
	g.fillStyle = COL.ink; g.strokeStyle = COL.ink; g.lineCap = 'round';
	if (mood === 'blink') {
		g.lineWidth = 4;
		g.beginPath(); g.moveTo(cx - 13, cy - 6); g.lineTo(cx - 4, cy - 6); g.moveTo(cx + 4, cy - 6); g.lineTo(cx + 13, cy - 6); g.stroke();
	} else {
		const ey = mood === 'scared' ? 8 : 6;
		g.beginPath(); g.ellipse(cx - 9, cy - 6, 4.5, ey, 0, 0, Math.PI * 2); g.ellipse(cx + 9, cy - 6, 4.5, ey, 0, 0, Math.PI * 2); g.fill();
		g.fillStyle = COL.white; circle(g, cx - 8, cy - 8, 1.6); g.fill(); circle(g, cx + 10, cy - 8, 1.6); g.fill();
	}
	if (mood === 'scared') {
		g.fillStyle = COL.ink; g.beginPath(); g.ellipse(cx, cy + 12, 7, 9, 0, 0, Math.PI * 2); g.fill();
		g.fillStyle = COL.coral; g.beginPath(); g.ellipse(cx, cy + 16, 4, 3.5, 0, 0, Math.PI * 2); g.fill();
	} else {
		g.lineWidth = 4; g.beginPath(); g.arc(cx, cy + 4, 11, 0.18 * Math.PI, 0.82 * Math.PI); g.stroke();
	}
}

function drawBoss(g, cx, cy, r, body, mode) {
	// cornes
	g.lineWidth = 4; g.strokeStyle = COL.ink; g.lineJoin = 'round';
	[-1, 1].forEach((s) => {
		g.fillStyle = COL.yellow; g.beginPath();
		g.moveTo(cx + s * r * 0.35, cy - r * 0.75); g.lineTo(cx + s * r * 0.95, cy - r * 1.25); g.lineTo(cx + s * r * 0.8, cy - r * 0.45);
		g.closePath(); g.fill(); g.stroke();
	});
	g.fillStyle = COL.ink; circle(g, cx + 7, cy + 7, r); g.fill();
	g.fillStyle = body; circle(g, cx, cy, r); g.fill(); g.lineWidth = 5; g.stroke();
	if (mode === 'flash') return;
	g.fillStyle = 'rgba(255,255,255,.5)';
	g.beginPath(); g.ellipse(cx - r * 0.45, cy - r * 0.5, r * 0.2, r * 0.1, -0.6, 0, Math.PI * 2); g.fill();
	// sourcils
	g.lineWidth = 7; g.lineCap = 'round';
	g.beginPath(); g.moveTo(cx - 34, cy - 30); g.lineTo(cx - 8, cy - 18); g.moveTo(cx + 34, cy - 30); g.lineTo(cx + 8, cy - 18); g.stroke();
	// yeux
	g.fillStyle = COL.white; g.lineWidth = 4;
	circle(g, cx - 20, cy - 6, 11); g.fill(); g.stroke();
	circle(g, cx + 20, cy - 6, 11); g.fill(); g.stroke();
	g.fillStyle = mode === 'rage' ? COL.red : COL.ink;
	circle(g, cx - 17, cy - 4, 5); g.fill(); circle(g, cx + 17, cy - 4, 5); g.fill();
	// bouche + dents
	g.fillStyle = COL.ink; g.beginPath(); g.rect(cx - 26, cy + 16, 52, 20); g.fill();
	g.fillStyle = COL.white; g.beginPath();
	for (let i = 0; i < 5; i++) { const x = cx - 26 + i * 10.4; g.moveTo(x, cy + 16); g.lineTo(x + 5.2, cy + 25); g.lineTo(x + 10.4, cy + 16); }
	g.fill();
}

function drawBackground(g) {
	g.fillStyle = COL.paper; g.fillRect(0, 0, W, H);
	g.strokeStyle = 'rgba(17,17,17,.07)'; g.lineWidth = 2;
	g.beginPath();
	for (let x = 0; x <= W; x += 40) { g.moveTo(x, 0); g.lineTo(x, H); }
	for (let y = 0; y <= H; y += 40) { g.moveTo(0, y); g.lineTo(W, y); }
	g.stroke();
	// sol
	g.fillStyle = COL.paperDark; g.fillRect(0, DANGER_Y, W, H - DANGER_Y);
	g.strokeStyle = 'rgba(17,17,17,.12)'; g.lineWidth = 2; g.beginPath();
	for (let x = -H; x < W; x += 24) { g.moveTo(x, H); g.lineTo(x + (H - DANGER_Y), DANGER_Y); }
	g.stroke();
	// bande de danger
	g.save(); g.beginPath(); g.rect(0, DANGER_Y - 8, W, 16); g.clip();
	g.fillStyle = COL.yellow; g.fillRect(0, DANGER_Y - 8, W, 16);
	g.fillStyle = COL.ink;
	for (let x = -20; x < W + 20; x += 28) { g.beginPath(); g.moveTo(x, DANGER_Y + 8); g.lineTo(x + 14, DANGER_Y + 8); g.lineTo(x + 30, DANGER_Y - 8); g.lineTo(x + 16, DANGER_Y - 8); g.fill(); }
	g.restore();
	g.strokeStyle = COL.ink; g.lineWidth = 3; g.strokeRect(-2, DANGER_Y - 8, W + 4, 16);
}

export function buildSprites() {
	const fs = TARGET_R * 2 + 18;
	FACE_COLORS.forEach((c) => {
		sprites.faces[c] = {};
		['idle', 'blink', 'scared'].forEach((m) => {
			sprites.faces[c][m] = makeSprite(fs, fs, (g) => drawFace(g, fs / 2 - 3, fs / 2 - 3, TARGET_R, c, m));
		});
	});
	const bw = BOSS_R * 2 + 40, bh = BOSS_R * 3 + 20;
	sprites.boss.size = [bw, bh];
	sprites.boss.normal = makeSprite(bw, bh, (g) => drawBoss(g, bw / 2 - 4, bh - BOSS_R - 14, BOSS_R, COL.coral, 'normal'));
	sprites.boss.mini = makeSprite(bw, bh, (g) => drawBoss(g, bw / 2 - 4, bh - BOSS_R - 14, BOSS_R, COL.blue, 'normal'));
	sprites.boss.rage = makeSprite(bw, bh, (g) => drawBoss(g, bw / 2 - 4, bh - BOSS_R - 14, BOSS_R, COL.purple, 'rage'));
	sprites.boss.flash = makeSprite(bw, bh, (g) => drawBoss(g, bw / 2 - 4, bh - BOSS_R - 14, BOSS_R, COL.white, 'flash'));
	sprites.bg = makeSprite(W, H, drawBackground);
}

/** Adapte le canvas à la fenêtre (en gardant les proportions) puis régénère les sprites. */
export function resize() {
	const pad = 28;
	view.scale = Math.max(Math.min((window.innerWidth - pad) / W, (window.innerHeight - pad) / H, 1.5), 0.35);
	view.dpr = Math.min(window.devicePixelRatio || 1, 2);
	const cw = Math.round(W * view.scale), ch = Math.round(H * view.scale);
	canvas.style.width = cw + 'px';
	canvas.style.height = ch + 'px';
	canvas.width = Math.round(cw * view.dpr);
	canvas.height = Math.round(ch * view.dpr);
	buildSprites();
}
