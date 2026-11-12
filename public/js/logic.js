// Règles du jeu : tir, collisions, vagues, ennemis tireurs, boss, victoire et défaite.
import {
	W, DANGER_Y, TURRET_X, TURRET_Y, BARREL_LEN, BULLET_R, BULLET_SPEED, FIRE_DELAY, FIRE_BUFFER,
	MAX_ANGLE, AIM_SPEED, SHOT_R, BOMB_R, COL, DIFF, WAVES, settings,
} from './config.js';
import { audio } from './audio.js';
import {
	game, input, bullets, hostiles, parts, rings, texts, spawnPart, multiplier, startWave,
	addShake, addFlash, setBanner, popText, explode, confetti,
} from './state.js';

/** Branché par main.js : affiche l'écran de fin quand l'animation de victoire/défaite est terminée. */
export const hooks = { onEnd: () => {} };

const isLastWave = () => game.wave >= WAVES.length - 1;

// ------------------------------------------------------------ tir du joueur (coup par coup)
/** Un appui = un tir. Pendant le rechargement, l'appui est mémorisé un court instant. */
export function queueFire() { game.fireQueue = FIRE_BUFFER; }

function fire() {
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

// ------------------------------------------------------------ ennemis
function damageTarget(t) {
	if (game.state === 'lost' || game.state === 'over') return;
	t.hp--;
	if (t.hp > 0) {
		// ennemi blindé : le premier tir fait sauter le casque
		t.hitT = 0.12; game.hits++; game.combo++;
		explode(t.x, t.y - t.r * 0.6, COL.ink, 8, 200);
		popText(t.x, t.y - 30, 'CLANG', COL.blue, 18);
		addShake(3); audio.play('clang');
		return;
	}
	t.alive = false;
	explode(t.x, t.y, t.color);
	registerHit(t.points, t.x, t.y);
	addShake(6); game.freeze = 0.035;
	audio.play('hit');
}

/** Projectile ennemi visant la tourelle : à abattre avant qu'il n'atteigne la bande de danger. */
function enemyShot(t) {
	const d = DIFF[settings.level];
	const dx = TURRET_X - t.x, dy = (TURRET_Y - 20) - t.y;
	const len = Math.hypot(dx, dy) || 1;
	const speed = d.shotSpeed * (1 + game.wave * 0.1);
	hostiles.push({ type: 'shot', x: t.x, y: t.y + t.r, vx: (dx / len) * speed, vy: (dy / len) * speed, r: SHOT_R, t: 0 });
	for (let i = 0; i < 5; i++) spawnPart(t.x, t.y + t.r, (Math.random() - 0.5) * 120, 60 + Math.random() * 80, 0.25, 4, COL.coral, 0);
	audio.play('enemyShot');
}

function dropBomb(boss) {
	const d = DIFF[settings.level];
	hostiles.push({ type: 'bomb', x: boss.x, y: boss.y + boss.r * 0.7, vx: (Math.random() - 0.5) * 70, vy: d.shotSpeed * 0.75, r: BOMB_R, t: 0 });
	audio.play('bomb');
}

function loseLife(x, y) {
	game.lives--; game.combo = 0;
	explode(x, y, COL.red, 30, 380);
	addShake(14); addFlash(0.45, COL.red);
	audio.play('hurt');
	if (game.lives <= 0) gameOver();
}

// ------------------------------------------------------------ boss
function startBoss() {
	const d = DIFF[settings.level];
	const spec = WAVES[game.wave].boss;
	const hp = Math.max(3, Math.round(d.bossHp * spec.hpRatio));
	game.boss = {
		kind: spec.kind, label: spec.label, r: spec.r, x: W / 2, y: -spec.r * 2, targetY: 70 + spec.r,
		hp, max: hp, dir: Math.random() < 0.5 ? -1 : 1, speed: d.bossSpeed * spec.speed,
		rage: false, hitT: 0, wob: 0, dying: 0, entering: true, bombs: spec.bombs, bombT: d.bombEvery,
	};
	game.state = 'bossIntro';
	setBanner(spec.label, spec.kind === 'final' ? COL.coral : COL.blue, 1.8);
	addShake(16); addFlash(0.7);
	audio.play('boss');
}

function hitBoss(b) {
	// une balle encore en vol ne doit pas « ressusciter » une partie déjà perdue dans la même image
	if (game.state === 'lost' || game.state === 'over') return;
	const boss = game.boss;
	boss.hp--; boss.hitT = 0.1; boss.y -= 8;
	explode(b.x, b.y, boss.rage ? COL.purple : (boss.kind === 'final' ? COL.coral : COL.blue), 14, 260);
	registerHit(250, b.x, b.y);
	addShake(8); game.freeze = 0.04;
	audio.play('bossHit');
	if (!boss.rage && boss.hp <= boss.max / 2 && boss.hp > 0) {
		boss.rage = true; boss.speed *= boss.kind === 'final' ? 1.45 : 1.25;
		if (boss.kind === 'final') setBanner('ENRAGÉ !', COL.purple, 1.1);
		addFlash(0.4, COL.purple); addShake(12);
		audio.play('rage');
	}
	if (boss.hp <= 0) {
		const bonus = boss.kind === 'final' ? 2000 : 1000;
		boss.dying = 1.2; game.state = 'bossDying'; game.score += bonus;
		popText(boss.x, boss.y - 80, '+' + bonus, COL.ink, 34);
	}
}

/** Mini-boss vaincu : vie bonus (ou points si les vies sont pleines), puis vague suivante. */
function nextWave() {
	const maxLives = DIFF[settings.level].lives;
	if (game.lives < maxLives) { game.lives++; popText(W / 2, 200, '+1 VIE', COL.coral, 30); }
	else { game.score += 500; popText(W / 2, 200, '+500', COL.ink, 30); }
	game.state = 'playing';
	startWave(game.wave + 1);
}

function win() {
	game.state = 'won'; game.endTimer = 1.4; game.dance = 0;
	hostiles.length = 0;
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
	if (playing) { updateTurret(dt); updateHostiles(dt); }
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
	if (game.fireQueue > 0) {
		game.fireQueue -= dt;
		if (game.cooldown <= 0) { fire(); game.fireQueue = 0; }
	}
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
			const dx = t.x - b.x, dy = t.y - b.y, rr = t.r + BULLET_R;
			if (dx * dx + dy * dy < rr * rr) { b.alive = false; b.hit = true; damageTarget(t); break; }
		}
		if (!b.alive) continue;
		for (let i = hostiles.length - 1; i >= 0; i--) {
			const h = hostiles[i];
			const dx = h.x - b.x, dy = h.y - b.y, rr = h.r + BULLET_R + 2;
			if (dx * dx + dy * dy < rr * rr) {
				b.alive = false; b.hit = true; hostiles.splice(i, 1);
				explode(h.x, h.y, COL.yellow, 10, 220);
				registerHit(50, h.x, h.y); audio.play('hit');
				break;
			}
		}
		const boss = game.boss;
		if (b.alive && boss && !boss.entering && boss.hp > 0) {
			const dx = boss.x - b.x, dy = boss.y - b.y, rr = boss.r + BULLET_R;
			if (dx * dx + dy * dy < rr * rr) { b.alive = false; b.hit = true; hitBoss(b); }
		}
	}
}

function updateTargets(dt) {
	const d = DIFF[settings.level];
	for (const t of game.targets) {
		if (!t.alive) continue;
		t.y += t.vy * dt;
		t.x = t.baseX + Math.sin(game.time * 1.6 + t.phase) * t.sway;
		t.blink -= dt; if (t.blink < -0.12) t.blink = 1.5 + Math.random() * 3;
		t.wob = Math.sin(game.time * 6 + t.phase) * 0.12;
		t.hitT = Math.max(0, t.hitT - dt);
		if (t.shoots && t.y > 40 && t.y < DANGER_Y - 140) {
			t.fireT -= dt;
			if (t.fireT <= 0) { enemyShot(t); t.fireT = d.fireEvery * (0.8 + Math.random() * 0.4); }
		}
		if (t.y + t.r >= DANGER_Y) { t.alive = false; loseLife(t.x, DANGER_Y); if (game.state === 'lost') return; }
	}
}

function updateHostiles(dt) {
	for (let i = hostiles.length - 1; i >= 0; i--) {
		const h = hostiles[i];
		h.t += dt; h.x += h.vx * dt; h.y += h.vy * dt;
		if (h.x < -30 || h.x > W + 30) { hostiles.splice(i, 1); continue; }
		if (h.y + h.r >= DANGER_Y) {
			hostiles.splice(i, 1);
			loseLife(h.x, DANGER_Y);
			if (game.state === 'lost') return;
		}
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
			explode(boss.x + (Math.random() - 0.5) * boss.r * 1.5, boss.y + (Math.random() - 0.5) * boss.r * 1.5, boss.rage ? COL.purple : COL.coral, 16, 300);
			addShake(10); audio.play('hit');
		}
		if (boss.dying <= 0) {
			explode(boss.x, boss.y, COL.yellow, 70, 600); audio.play('boom');
			game.boss = null;
			if (isLastWave()) win(); else nextWave();
		}
		return;
	}
	if (game.state !== 'playing') return;
	const d = DIFF[settings.level];
	boss.x += boss.dir * boss.speed * dt;
	if (boss.x < boss.r + 12 || boss.x > W - boss.r - 12) {
		boss.x = Math.max(boss.r + 12, Math.min(W - boss.r - 12, boss.x));
		boss.dir *= -1; boss.y += d.bossDrop; addShake(5);
		for (let i = 0; i < 8; i++) spawnPart(boss.x + boss.dir * -boss.r, boss.y + (Math.random() - 0.5) * 60, boss.dir * 120 * Math.random(), -60, 0.4, 5, COL.ink, 400);
	}
	if (boss.bombs) {
		boss.bombT -= dt;
		if (boss.bombT <= 0) {
			dropBomb(boss);
			boss.bombT = d.bombEvery * (boss.rage ? 0.6 : 1) * (boss.kind === 'mini' ? 1.3 : 1);
		}
	}
	if (boss.y + boss.r >= DANGER_Y) { game.lives = 0; gameOver(); }
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
