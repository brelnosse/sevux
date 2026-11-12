// Rendu canvas : décor, cibles, boss, tourelle, effets et interface en jeu.
import { W, H, DANGER_Y, TURRET_X, TURRET_Y, BARREL_LEN, TARGET_R, BOSS_R, BULLET_R, COL, FONT, DIFF, WAVES, settings } from './config.js';
import { ctx } from './dom.js';
import { view, sprites, circle } from './sprites.js';
import { game, bullets, hostiles, parts, rings, texts, multiplier } from './state.js';

export function render() {
	const k = view.scale * view.dpr;
	ctx.setTransform(k, 0, 0, k, 0, 0);
	const s = game.shake;
	if (s > 0) ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
	ctx.drawImage(sprites.bg, 0, 0, W, H);

	drawClouds();
	drawTargets();
	drawBossSprite();
	drawBullets();
	drawHostiles();
	drawTurret();
	drawParticles();
	drawRings();
	drawTexts();

	ctx.setTransform(k, 0, 0, k, 0, 0);
	if (game.state !== 'menu') drawHud();
	drawBanner();
	if (game.flash > 0) {
		ctx.globalAlpha = Math.min(game.flash, 0.85);
		ctx.fillStyle = game.flashColor; ctx.fillRect(0, 0, W, H);
		ctx.globalAlpha = 1;
	}
}

function drawClouds() {
	ctx.fillStyle = 'rgba(17,17,17,.05)';
	for (const c of game.clouds) {
		ctx.beginPath();
		if (ctx.roundRect) ctx.roundRect(c.x - c.w / 2, c.y, c.w, 22, 11);
		else ctx.rect(c.x - c.w / 2, c.y, c.w, 22);
		ctx.fill();
	}
}

function drawTargets() {
	for (const t of game.targets) {
		const fs = (TARGET_R * 2 + 18) * (t.r / TARGET_R);
		if (!t.alive || t.y < -fs) continue;
		const mood = t.blink < 0 ? 'blink' : (t.y > DANGER_Y - 170 ? 'scared' : 'idle');
		const spr = sprites.faces[t.color][mood];
		const charging = t.shoots && t.fireT < 0.35 && t.y > 40;
		ctx.save();
		ctx.translate(t.x, t.y);
		ctx.rotate(t.wob + (mood === 'scared' || charging ? Math.sin(game.time * 40) * 0.06 : 0));
		if (charging) {
			// le tireur clignote juste avant de tirer : le joueur peut anticiper
			ctx.fillStyle = Math.sin(game.time * 50) > 0 ? COL.red : COL.yellow;
			circle(ctx, 0, 0, t.r + 7); ctx.fill();
		}
		ctx.drawImage(spr, -fs / 2 + 3 * (t.r / TARGET_R), -fs / 2 + 3 * (t.r / TARGET_R), fs, fs);
		if (t.kind === 'armored' && t.hp > 1) drawHelmet(t.r);
		if (t.kind === 'shooter') drawCannon(t.r);
		if (t.hitT > 0) { ctx.globalAlpha = 0.6; ctx.fillStyle = COL.white; circle(ctx, 0, 0, t.r); ctx.fill(); ctx.globalAlpha = 1; }
		ctx.restore();
	}
}

function drawHelmet(r) {
	ctx.lineWidth = 4; ctx.strokeStyle = COL.ink; ctx.fillStyle = '#8a8f99';
	ctx.beginPath(); ctx.arc(0, -2, r + 4, Math.PI * 1.05, Math.PI * 1.95); ctx.lineTo(r * 0.75, -r * 0.35); ctx.lineTo(-r * 0.75, -r * 0.35); ctx.closePath();
	ctx.fill(); ctx.stroke();
	ctx.fillStyle = COL.ink; [-0.45, 0, 0.45].forEach((k) => { circle(ctx, k * r, -r * 0.62, 2.5); ctx.fill(); });
}

function drawCannon(r) {
	ctx.fillStyle = COL.ink; ctx.fillRect(-6, r - 4, 12, 12);
	ctx.fillStyle = COL.coral; ctx.fillRect(-4, r - 2, 8, 9);
}

function drawHostiles() {
	for (const h of hostiles) {
		if (h.type === 'shot') {
			ctx.strokeStyle = 'rgba(255,127,92,.45)'; ctx.lineWidth = 6; ctx.lineCap = 'round';
			ctx.beginPath(); ctx.moveTo(h.x - h.vx * 0.05, h.y - h.vy * 0.05); ctx.lineTo(h.x, h.y); ctx.stroke();
			ctx.fillStyle = COL.ink; circle(ctx, h.x + 2, h.y + 2, h.r); ctx.fill();
			ctx.fillStyle = COL.coral; circle(ctx, h.x, h.y, h.r); ctx.fill();
			ctx.lineWidth = 3; ctx.strokeStyle = COL.ink; ctx.stroke();
			ctx.fillStyle = COL.white; circle(ctx, h.x - 3, h.y - 3, 2.5); ctx.fill();
		} else {
			ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(h.t * 3);
			ctx.fillStyle = COL.ink; circle(ctx, 3, 3, h.r); ctx.fill();
			ctx.fillStyle = '#2b2b2b'; circle(ctx, 0, 0, h.r); ctx.fill();
			ctx.lineWidth = 3; ctx.strokeStyle = COL.ink; ctx.stroke();
			ctx.fillStyle = COL.white; circle(ctx, -4, -4, 3); ctx.fill();
			ctx.strokeStyle = COL.ink; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, -h.r); ctx.lineTo(4, -h.r - 7); ctx.stroke();
			ctx.fillStyle = Math.sin(h.t * 30) > 0 ? COL.yellow : COL.coral; circle(ctx, 5, -h.r - 9, 4); ctx.fill();
			ctx.restore();
		}
	}
}

function drawBossSprite() {
	const boss = game.boss;
	if (!boss) return;
	const [bw, bh] = sprites.boss.size;
	const calm = boss.kind === 'mini' ? sprites.boss.mini : sprites.boss.normal;
	const spr = boss.hitT > 0 ? sprites.boss.flash : (boss.rage ? sprites.boss.rage : calm);
	const sq = 1 + Math.sin(boss.wob) * 0.04;
	const k = boss.r / BOSS_R;
	ctx.save();
	ctx.translate(boss.x, boss.y);
	if (game.state === 'bossDying') ctx.translate((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10);
	ctx.rotate(Math.sin(boss.wob * 0.5) * 0.08);
	ctx.scale(sq * k, (2 - sq) * k);
	ctx.drawImage(spr, -bw / 2 + 4, -(bh - BOSS_R - 14), bw, bh);
	ctx.restore();
}

function drawBullets() {
	ctx.lineCap = 'round';
	for (const b of bullets) {
		if (!b.alive) continue;
		const tr = b.trail;
		if (tr.length >= 4) {
			ctx.strokeStyle = 'rgba(17,17,17,.25)'; ctx.lineWidth = 6;
			ctx.beginPath(); ctx.moveTo(tr[0], tr[1]);
			for (let i = 2; i < tr.length; i += 2) ctx.lineTo(tr[i], tr[i + 1]);
			ctx.lineTo(b.x, b.y); ctx.stroke();
		}
		ctx.fillStyle = COL.ink; circle(ctx, b.x + 2, b.y + 2, BULLET_R); ctx.fill();
		ctx.fillStyle = COL.yellow; circle(ctx, b.x, b.y, BULLET_R); ctx.fill();
		ctx.lineWidth = 3; ctx.strokeStyle = COL.ink; ctx.stroke();
	}
}

function drawTurret() {
	if (game.state === 'lost' || (game.state === 'over' && game.lives <= 0)) return;
	const dance = game.state === 'won' || (game.state === 'over' && game.lives > 0);
	const lift = dance ? Math.abs(Math.sin(game.dance * 6)) * 26 : 0;
	const ang = dance ? Math.sin(game.dance * 5) * 0.6 : game.angle;
	ctx.save();
	ctx.translate(TURRET_X, TURRET_Y - lift);
	// canon
	ctx.save();
	ctx.rotate(ang);
	const r = game.recoil * 10;
	ctx.fillStyle = COL.ink; ctx.fillRect(-11 + 4, -BARREL_LEN + r + 4, 22, BARREL_LEN);
	ctx.fillStyle = COL.pink; ctx.fillRect(-11, -BARREL_LEN + r, 22, BARREL_LEN);
	ctx.lineWidth = 4; ctx.strokeStyle = COL.ink; ctx.strokeRect(-11, -BARREL_LEN + r, 22, BARREL_LEN);
	ctx.fillStyle = COL.ink; ctx.fillRect(-14, -BARREL_LEN + r - 2, 28, 10);
	ctx.restore();
	// base
	ctx.fillStyle = COL.ink; ctx.beginPath(); ctx.arc(5, 5, 36, Math.PI, 0); ctx.closePath(); ctx.fill();
	ctx.fillStyle = COL.yellow; ctx.beginPath(); ctx.arc(0, 0, 36, Math.PI, 0); ctx.closePath(); ctx.fill();
	ctx.lineWidth = 4; ctx.stroke();
	ctx.fillStyle = COL.ink; circle(ctx, 0, -12, 7); ctx.fill();
	ctx.restore();
	// socle
	ctx.fillStyle = COL.ink; ctx.fillRect(TURRET_X - 70 + 5, TURRET_Y + 5, 140, 22);
	ctx.fillStyle = COL.mint; ctx.fillRect(TURRET_X - 70, TURRET_Y, 140, 22);
	ctx.lineWidth = 4; ctx.strokeStyle = COL.ink; ctx.strokeRect(TURRET_X - 70, TURRET_Y, 140, 22);
	// visée
	if (game.state === 'playing' || game.state === 'bossIntro') {
		ctx.save();
		ctx.setLineDash([6, 10]); ctx.lineDashOffset = -game.time * 40;
		ctx.strokeStyle = 'rgba(17,17,17,.3)'; ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(TURRET_X + Math.sin(game.angle) * (BARREL_LEN + 10), TURRET_Y - Math.cos(game.angle) * (BARREL_LEN + 10));
		ctx.lineTo(TURRET_X + Math.sin(game.angle) * 260, TURRET_Y - Math.cos(game.angle) * 260);
		ctx.stroke();
		ctx.restore();
	}
}

function drawParticles() {
	for (const p of parts) {
		if (!p.alive) continue;
		const a = Math.min(1, p.life / p.max * 1.5);
		const sz = p.size * (0.4 + 0.6 * a);
		ctx.save();
		ctx.translate(p.x, p.y); ctx.rotate(p.rot);
		ctx.fillStyle = p.color;
		if (p.shape === 1) {
			ctx.beginPath(); ctx.moveTo(0, -sz); ctx.lineTo(sz, sz); ctx.lineTo(-sz, sz); ctx.closePath(); ctx.fill();
		} else {
			ctx.fillRect(-sz / 2, -sz / 2, sz, sz);
		}
		if (sz > 6 && p.color !== COL.ink) { ctx.lineWidth = 2; ctx.strokeStyle = COL.ink; ctx.strokeRect(-sz / 2, -sz / 2, sz, sz); }
		ctx.restore();
	}
}

function drawRings() {
	for (const r of rings) {
		const k = r.t / r.dur;
		ctx.globalAlpha = 1 - k;
		ctx.lineWidth = 8 * (1 - k) + 1; ctx.strokeStyle = COL.ink;
		circle(ctx, r.x, r.y, r.r + (r.max - r.r) * k); ctx.stroke();
	}
	ctx.globalAlpha = 1;
}

function drawTexts() {
	ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
	for (const t of texts) {
		const k = t.t / t.dur;
		const pop = k < 0.15 ? 0.6 + k / 0.15 * 0.6 : 1.2 - Math.min(0.2, (k - 0.15));
		ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
		ctx.font = `${Math.round(t.size * pop)}px ${FONT}`;
		const y = t.y - k * 40;
		ctx.lineWidth = 5; ctx.strokeStyle = COL.white; ctx.strokeText(t.text, t.x, y);
		ctx.fillStyle = t.color; ctx.fillText(t.text, t.x, y);
		if (t.color !== COL.ink) { ctx.lineWidth = 1.5; ctx.strokeStyle = COL.ink; ctx.strokeText(t.text, t.x, y); }
	}
	ctx.globalAlpha = 1;
}

function box(x, y, w, h, fill) {
	ctx.fillStyle = COL.ink; ctx.fillRect(x + 4, y + 4, w, h);
	ctx.fillStyle = fill; ctx.fillRect(x, y, w, h);
	ctx.lineWidth = 3; ctx.strokeStyle = COL.ink; ctx.strokeRect(x, y, w, h);
}

function heart(x, y, s, full) {
	ctx.save(); ctx.translate(x, y); ctx.scale(s / 20, s / 20);
	ctx.beginPath();
	ctx.moveTo(0, 6); ctx.bezierCurveTo(0, 0, -10, -2, -10, 5); ctx.bezierCurveTo(-10, 11, -2, 15, 0, 19);
	ctx.bezierCurveTo(2, 15, 10, 11, 10, 5); ctx.bezierCurveTo(10, -2, 0, 0, 0, 6);
	ctx.fillStyle = full ? COL.coral : 'rgba(17,17,17,.15)'; ctx.fill();
	ctx.lineWidth = 2.5; ctx.strokeStyle = COL.ink; ctx.stroke();
	ctx.restore();
}

function drawHud() {
	ctx.textBaseline = 'middle';
	// score
	box(14, 14, 150, 54, COL.white);
	ctx.textAlign = 'left'; ctx.fillStyle = COL.ink;
	ctx.font = `11px ${FONT}`; ctx.fillText('SCORE', 26, 29);
	ctx.font = `24px ${FONT}`; ctx.fillText(String(game.score), 26, 52);
	const m = multiplier();
	if (m > 1) {
		box(170, 14, 54, 30, COL.pink);
		ctx.textAlign = 'center'; ctx.font = `15px ${FONT}`; ctx.fillStyle = COL.ink; ctx.fillText('x' + m, 197, 30);
	}
	// vies
	const lives = DIFF[settings.level].lives;
	box(W - 14 - (lives * 30 + 18), 14, lives * 30 + 18, 40, COL.white);
	for (let i = 0; i < lives; i++) heart(W - 14 - (lives * 30 + 18) + 24 + i * 30, 23, 22, i < game.lives);
	// progression
	if (game.boss) {
		const b = game.boss, bw = 240, bx = W / 2 - bw / 2;
		box(bx, 78, bw, 22, COL.white);
		ctx.fillStyle = b.rage ? COL.purple : COL.coral;
		ctx.fillRect(bx + 3, 81, Math.max(0, (bw - 6) * (b.hp / b.max)), 16);
		ctx.textAlign = 'center'; ctx.font = `11px ${FONT}`; ctx.fillStyle = COL.ink; ctx.fillText(b.label, W / 2, 90);
	}
	const left = game.targets.filter((t) => t.alive).length;
	box(W / 2 - 66, 14, 132, 40, game.boss ? COL.coral : COL.mint);
	ctx.textAlign = 'center'; ctx.fillStyle = COL.ink;
	ctx.font = `10px ${FONT}`; ctx.fillText(`VAGUE ${game.wave + 1}/${WAVES.length}`, W / 2, 26);
	ctx.font = `17px ${FONT}`; ctx.fillText(game.boss ? 'BOSS' : `${game.waveTotal - left}/${game.waveTotal}`, W / 2, 43);
}

function drawBanner() {
	const b = game.banner;
	if (!b) return;
	const inT = Math.min(1, b.t / 0.25);
	const outK = b.t > b.dur ? Math.min(1, (b.t - b.dur) / 0.4) : 0;
	const ease = 1 - Math.pow(1 - inT, 3);
	const sc = 2.6 - 1.6 * ease;
	ctx.save();
	ctx.globalAlpha = 1 - outK;
	ctx.translate(W / 2, H * 0.42 - outK * 60);
	ctx.rotate(-0.06);
	ctx.scale(sc, sc);
	ctx.font = `54px ${FONT}`;
	ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
	const tw = ctx.measureText(b.text).width + 50;
	ctx.fillStyle = COL.ink; ctx.fillRect(-tw / 2 + 8, -44 + 8, tw, 88);
	ctx.fillStyle = b.color; ctx.fillRect(-tw / 2, -44, tw, 88);
	ctx.lineWidth = 5; ctx.strokeStyle = COL.ink; ctx.strokeRect(-tw / 2, -44, tw, 88);
	ctx.fillStyle = COL.ink; ctx.fillText(b.text, 0, 4);
	ctx.restore();
	ctx.globalAlpha = 1;
}
