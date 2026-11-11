// Règles du jeu : tir, collisions, vagues, boss, victoire et défaite.
import {
	W, DANGER_Y, TURRET_X, TURRET_Y, BARREL_LEN, TARGET_R, BOSS_R, BULLET_R, BULLET_SPEED, FIRE_DELAY,
	MAX_ANGLE, AIM_SPEED, COL, DIFF, settings,
} from './config.js';
import { audio } from './audio.js';
import {
	game, input, bullets, parts, rings, texts, spawnPart, multiplier,
	addShake, addFlash, setBanner, popText, explode, confetti,
} from './state.js';

/** Branché par main.js : affiche l'écran de fin quand l'animation de victoire/défaite est terminée. */
export const hooks = { onEnd: () => {} };

// ------------------------------------------------------------ actions
function fire() {
	if (game.cooldown > 0) return;
	const b = bullets.find((x) => !x.alive);
	if (!b) return;
	const sx = Math.sin(game.angle), sy = -Math.cos(game.angle);
	b.alive = true; b.hit = false;
	b.x = TURRET_X + sx * BARREL_LEN; b.y = TURRET_Y + sy * BARREL_LEN;
	b.vx = sx * BULLET_SPEED; b.vy = sy * BULLET_SPEED; b.trail.length = 0;
	game.cooldown = FIRE_DELAY; game.recoil = 1; game.shots++;
	for (let i = 0; i < 6; i++) {
		const a = game.angle - Math.PI / 2 + (Math.random() - 0.5) * 0.9;
		spawnPart(b.x, b.y, Math.cos(a) * 220, Math.sin(a) * 220, 0.15 + Math.random() * 0.1, 4 + Math.random() * 4, i % 2 ? COL.yellow : COL.coral, 0);
	}
	audio.play('shoot');
}

function registerHit(points, x, y) {
	const before = multiplier();
	game.combo++; game.hits++;
	const m = multiplier();
	game.score += points * m;
	popText(x, y - 20, '+' + points * m, COL.ink, 22);
	if (m > before) { popText(x, y - 52, 'COMBO x' + m, COL.pink, 26); audio.play('combo'); }
}

function killTarget(t) {
	t.alive = false;
	explode(t.x, t.y, t.color);
	registerHit(100, t.x, t.y);
	addShake(6); game.freeze = 0.035;
	audio.play('hit');
}

function loseLife(x, y) {
	game.lives--; game.combo = 0;
	explode(x, y, COL.red, 30, 380);
	addShake(14); addFlash(0.45, COL.red);
	audio.play('hurt');
	if (game.lives <= 0) gameOver();
}

function startBoss() {
	const d = DIFF[settings.level];
	game.boss = {
		x: W / 2, y: -BOSS_R * 2, targetY: 120, hp: d.bossHp, max: d.bossHp, dir: Math.random() < 0.5 ? -1 : 1,
		speed: d.bossSpeed, rage: false, hitT: 0, wob: 0, dying: 0, entering: true,
	};
	game.state = 'bossIntro';
	setBanner('BOSS FINAL', COL.coral, 1.8);
	addShake(16); addFlash(0.7);
	audio.play('boss');
}

function hitBoss(b) {
	const boss = game.boss;
	boss.hp--; boss.hitT = 0.1; boss.y -= 8;
	explode(b.x, b.y, boss.rage ? COL.purple : COL.coral, 14, 260);
	registerHit(250, b.x, b.y);
	addShake(8); game.freeze = 0.04;
	audio.play('bossHit');
	if (!boss.rage && boss.hp <= boss.max / 2 && boss.hp > 0) {
		boss.rage = true; boss.speed *= 1.45;
		setBanner('ENRAGÉ !', COL.purple, 1.1);
		addFlash(0.4, COL.purple); addShake(12);
		audio.play('rage');
	}
	if (boss.hp <= 0) { boss.dying = 1.2; game.state = 'bossDying'; game.score += 2000; popText(boss.x, boss.y - 80, '+2000', COL.ink, 34); }
}

function win() {
	game.state = 'won'; game.endTimer = 1.4; game.dance = 0;
	game.score += game.lives * 500;
	confetti(); addFlash(0.8);
	setBanner('VICTOIRE !', COL.yellow, 2.5);
	audio.play('win');
}

function gameOver() {
	if (game.state === 'lost') return;
	game.state = 'lost'; game.endTimer = 1.4;
	explode(TURRET_X, TURRET_Y, COL.coral, 50, 500);
	addShake(22); addFlash(0.6, COL.red);
	setBanner('PERDU', COL.coral, 2);
	audio.play('boom'); audio.play('lose');
}

// ------------------------------------------------------------ mise à jour
export function update(dt) {
	game.time += dt;
	game.clouds.forEach((c) => { c.x += c.v * dt; if (c.x - c.w > W) c.x = -c.w; });
	updateEffects(dt);
	if (game.freeze > 0) { game.freeze -= dt; return; }

	const playing = game.state === 'playing' || game.state === 'bossIntro' || game.state === 'bossDying';
	if (playing) updateTurret(dt);
	updateBullets(dt);

	if (game.state === 'playing') {
		updateTargets(dt);
		if (game.targets.every((t) => !t.alive) && !game.boss && game.lives > 0) startBoss();
	}
	if (game.boss) updateBoss(dt);
	if (game.state === 'won') { game.dance += dt; }
	if (game.state === 'won' || game.state === 'lost') {
		game.endTimer -= dt;
		if (game.endTimer <= 0) hooks.onEnd();
	}
}

function updateTurret(dt) {
	if (input.left) { game.angle -= AIM_SPEED * dt; input.pointerAim = false; }
	if (input.right) { game.angle += AIM_SPEED * dt; input.pointerAim = false; }
	game.angle = Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, game.angle));
	game.cooldown -= dt;
	game.recoil = Math.max(0, game.recoil - dt * 7);
	if (input.fire || input.pointerFire) fire();
}

function updateBullets(dt) {
	for (const b of bullets) {
		if (!b.alive) continue;
		b.trail.push(b.x, b.y); if (b.trail.length > 6) b.trail.splice(0, 2);
		b.x += b.vx * dt; b.y += b.vy * dt;
		if (b.x < -20 || b.x > W + 20 || b.y < -20) {
			b.alive = false;
			if (!b.hit) game.combo = 0;
			continue;
		}
		for (const t of game.targets) {
			if (!t.alive) continue;
			const dx = t.x - b.x, dy = t.y - b.y, rr = TARGET_R + BULLET_R;
			if (dx * dx + dy * dy < rr * rr) { b.alive = false; b.hit = true; killTarget(t); break; }
		}
		const boss = game.boss;
		if (b.alive && boss && !boss.entering && boss.hp > 0) {
			const dx = boss.x - b.x, dy = boss.y - b.y, rr = BOSS_R + BULLET_R;
			if (dx * dx + dy * dy < rr * rr) { b.alive = false; b.hit = true; hitBoss(b); }
		}
	}
}

function updateTargets(dt) {
	for (const t of game.targets) {
		if (!t.alive) continue;
		t.y += t.vy * dt;
		t.x = t.baseX + Math.sin(game.time * 1.6 + t.phase) * t.sway;
		t.blink -= dt; if (t.blink < -0.12) t.blink = 1.5 + Math.random() * 3;
		t.wob = Math.sin(game.time * 6 + t.phase) * 0.12;
		if (t.y + TARGET_R >= DANGER_Y) { t.alive = false; loseLife(t.x, DANGER_Y); if (game.state === 'lost') return; }
	}
}

function updateBoss(dt) {
	const boss = game.boss;
	boss.hitT = Math.max(0, boss.hitT - dt);
	boss.wob += dt * (boss.rage ? 14 : 8);
	if (boss.entering) {
		boss.y += (boss.targetY - boss.y) * Math.min(1, dt * 2.5);
		if (game.banner === null || game.banner.t > game.banner.dur) { boss.entering = false; game.state = 'playing'; }
		return;
	}
	if (game.state === 'bossDying') {
		boss.dying -= dt;
		if (Math.random() < dt * 14) {
			explode(boss.x + (Math.random() - 0.5) * 90, boss.y + (Math.random() - 0.5) * 90, boss.rage ? COL.purple : COL.coral, 16, 300);
			addShake(10); audio.play('hit');
		}
		if (boss.dying <= 0) {
			explode(boss.x, boss.y, COL.yellow, 70, 600); audio.play('boom');
			game.boss = null; win();
		}
		return;
	}
	if (game.state !== 'playing') return;
	const d = DIFF[settings.level];
	boss.x += boss.dir * boss.speed * dt;
	if (boss.x < BOSS_R + 12 || boss.x > W - BOSS_R - 12) {
		boss.x = Math.max(BOSS_R + 12, Math.min(W - BOSS_R - 12, boss.x));
		boss.dir *= -1; boss.y += d.bossDrop; addShake(5);
		for (let i = 0; i < 8; i++) spawnPart(boss.x + boss.dir * -BOSS_R, boss.y + (Math.random() - 0.5) * 60, boss.dir * 120 * Math.random(), -60, 0.4, 5, COL.ink, 400);
	}
	if (boss.y + BOSS_R >= DANGER_Y) { game.lives = 0; gameOver(); }
}

function updateEffects(dt) {
	game.shake = Math.max(0, game.shake - dt * 40);
	game.flash = Math.max(0, game.flash - dt * 2.5);
	for (const p of parts) {
		if (!p.alive) continue;
		p.life -= dt; if (p.life <= 0) { p.alive = false; continue; }
		p.vy += p.grav * dt; p.vx *= 1 - dt * 1.5;
		p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
	}
	for (let i = rings.length - 1; i >= 0; i--) { rings[i].t += dt; if (rings[i].t > rings[i].dur) rings.splice(i, 1); }
	for (let i = texts.length - 1; i >= 0; i--) { texts[i].t += dt; if (texts[i].t > texts[i].dur) texts.splice(i, 1); }
	if (game.banner) { game.banner.t += dt; if (game.banner.t > game.banner.dur + 0.4) game.banner = null; }
}
