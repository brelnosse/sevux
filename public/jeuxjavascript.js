/*  SEVUX — Défends la zone
 *  Canvas 2D, une seule boucle requestAnimationFrame, sprites pré-rendus,
 *  pools d'objets et sons synthétisés (Web Audio) : aucun asset à télécharger.
 */
(() => {
	'use strict';

	// ------------------------------------------------------------ constantes
	const W = 600, H = 720;
	const DANGER_Y = H - 170;
	const TURRET_X = W / 2, TURRET_Y = H - 62;
	const BARREL_LEN = 76;
	const TARGET_R = 28, BOSS_R = 58, BULLET_R = 7;
	const BULLET_SPEED = 950, FIRE_DELAY = 0.16;
	const MAX_ANGLE = Math.PI / 3, AIM_SPEED = Math.PI * 0.9;
	const TARGET_COUNT = 10;

	const COL = {
		ink: '#111111', paper: '#FFF6E0', paperDark: '#F4E7C4', yellow: '#FFD23F',
		pink: '#FF8AD8', mint: '#74F2A8', coral: '#FF7F5C', blue: '#5B8CFF',
		purple: '#9B5DE5', white: '#FFFFFF', red: '#FF3B3B',
	};
	const TARGET_COLORS = [COL.yellow, COL.pink, COL.mint, COL.blue];
	const FONT = '"Archivo Black", "Arial Black", sans-serif';

	const DIFF = {
		easy:   { fall: [14, 22], lives: 3, bossHp: 6,  bossSpeed: 120, bossDrop: 20 },
		medium: { fall: [22, 32], lives: 3, bossHp: 8,  bossSpeed: 165, bossDrop: 26 },
		hard:   { fall: [34, 48], lives: 2, bossHp: 10, bossSpeed: 215, bossDrop: 32 },
	};

	// ------------------------------------------------------------ DOM
	const $ = (id) => document.getElementById(id);
	const stage = $('stage');
	const canvas = $('game');
	const ctx = canvas.getContext('2d', { alpha: false });
	const ui = {
		menu: $('menu'), pause: $('pause'), end: $('end'),
		play: $('play'), resume: $('resume'), quit: $('quit'), restart: $('restart'), toMenu: $('toMenu'),
		mute: $('mute'), levels: document.querySelectorAll('.level'),
		bestMenu: $('bestMenu'), endTitle: $('endTitle'), endSticker: $('endSticker'),
		endScore: $('endScore'), endAcc: $('endAcc'), endBest: $('endBest'),
		scoreForm: $('scoreForm'), pseudo: $('pseudo'), saveScore: $('saveScore'), formMsg: $('formMsg'),
		endBoard: $('endBoard'), menuBoard: $('menuBoard'), menuBoardWrap: $('menuBoardWrap'),
	};

	// ------------------------------------------------------------ stockage (peut être bloqué)
	const store = {
		get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
		set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* navigation privée */ } },
	};

	// ------------------------------------------------------------ classement en ligne
	const API = window.SEVUX_API || '/api/scores';
	const LEVEL_LABEL = { easy: 'Facile', medium: 'Normal', hard: 'Difficile' };
	const NAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N} _.\-]{1,15}$/u;
	const sameName = (a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }) === 0;

	const leaderboard = {
		async top(limit) {
			const res = await fetch(`${API}?limit=${limit}`, { headers: { Accept: 'application/json' } });
			if (!res.ok) throw new Error(String(res.status));
			return res.json();
		},
		async submit(entry) {
			const res = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry) });
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw Object.assign(new Error(data.error || 'Erreur serveur.'), { status: res.status });
			return data;
		},
	};

	function renderBoard(list, entries, highlight) {
		list.replaceChildren(...entries.map((e) => {
			const li = document.createElement('li');
			if (highlight && sameName(e.name, highlight)) li.classList.add('me');
			li.title = `${LEVEL_LABEL[e.level] || ''} · ${e.accuracy}% de précision`;
			const name = document.createElement('span');
			name.className = 'name';
			name.textContent = e.name + (e.won ? ' 👑' : '');
			const pts = document.createElement('span');
			pts.className = 'pts';
			pts.textContent = e.score;
			li.append(name, pts);
			return li;
		}));
		list.hidden = entries.length === 0;
	}

	async function loadMenuBoard() {
		try {
			const data = await leaderboard.top(5);
			renderBoard(ui.menuBoard, data.entries, store.get('sevux-pseudo', ''));
			ui.menuBoardWrap.hidden = data.entries.length === 0;
		} catch (e) {
			ui.menuBoardWrap.hidden = true;
		}
	}

	function setFormMessage(text, kind = '') {
		ui.formMsg.textContent = text;
		ui.formMsg.className = 'form-msg' + (kind ? ' ' + kind : '');
	}

	let lastResult = null;

	async function submitScore(e) {
		e.preventDefault();
		if (!lastResult || lastResult.sent) return;
		const name = ui.pseudo.value.normalize('NFC').replace(/\s+/g, ' ').trim();
		if (!NAME_PATTERN.test(name)) {
			setFormMessage('2 à 16 caractères : lettres, chiffres, espace, _ . -', 'error');
			ui.pseudo.focus();
			return;
		}
		ui.saveScore.disabled = true;
		setFormMessage('Envoi…');
		try {
			const data = await leaderboard.submit({ name, ...lastResult });
			lastResult.sent = true;
			store.set('sevux-pseudo', name);
			ui.pseudo.disabled = true;
			setFormMessage(data.improved ? `Bien joué ${name}, tu es #${data.rank} !` : `Ton meilleur score reste #${data.rank}.`, 'ok');
			renderBoard(ui.endBoard, data.entries, name);
			audio.play('combo');
			if (window.parent !== window) window.parent.postMessage({ type: 'sevux:score', rank: data.rank }, '*');
		} catch (err) {
			ui.saveScore.disabled = false;
			setFormMessage(err.status ? err.message : 'Classement indisponible pour le moment.', 'error');
		}
	}

	function resetScoreForm(score, accuracy, won) {
		lastResult = score > 0 ? { score, level, accuracy, won, sent: false } : null;
		ui.scoreForm.hidden = !lastResult;
		ui.pseudo.disabled = false;
		ui.pseudo.value = store.get('sevux-pseudo', '');
		ui.saveScore.disabled = false;
		ui.endBoard.hidden = true;
		setFormMessage('');
	}

	// ------------------------------------------------------------ audio synthétisé
	const audio = {
		ctx: null, master: null, muted: store.get('sevux-muted', '0') === '1', noise: null,
		init() {
			if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
			const AC = window.AudioContext || window.webkitAudioContext;
			if (!AC) return;
			this.ctx = new AC();
			this.master = this.ctx.createGain();
			this.master.gain.value = this.muted ? 0 : 0.35;
			this.master.connect(this.ctx.destination);
			const len = this.ctx.sampleRate * 0.5;
			this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
			const data = this.noise.getChannelData(0);
			for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
		},
		toggle() {
			this.muted = !this.muted;
			store.set('sevux-muted', this.muted ? '1' : '0');
			if (this.master) this.master.gain.value = this.muted ? 0 : 0.35;
			ui.mute.classList.toggle('muted', this.muted);
		},
		tone(type, f0, f1, dur, vol = 0.3, delay = 0) {
			if (!this.ctx || this.muted) return;
			const t = this.ctx.currentTime + delay;
			const o = this.ctx.createOscillator(), g = this.ctx.createGain();
			o.type = type;
			o.frequency.setValueAtTime(f0, t);
			o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
			g.gain.setValueAtTime(vol, t);
			g.gain.exponentialRampToValueAtTime(0.001, t + dur);
			o.connect(g); g.connect(this.master);
			o.start(t); o.stop(t + dur + 0.02);
		},
		burst(dur, vol = 0.3, freq = 1200, delay = 0) {
			if (!this.ctx || this.muted) return;
			const t = this.ctx.currentTime + delay;
			const s = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
			s.buffer = this.noise;
			f.type = 'lowpass'; f.frequency.setValueAtTime(freq, t); f.frequency.exponentialRampToValueAtTime(80, t + dur);
			g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
			s.connect(f); f.connect(g); g.connect(this.master);
			s.start(t); s.stop(t + dur + 0.02);
		},
		play(name) {
			switch (name) {
				case 'shoot': this.tone('square', 900, 260, 0.08, 0.12); break;
				case 'hit': this.tone('triangle', 520, 1400, 0.09, 0.3); this.burst(0.18, 0.25, 2500); break;
				case 'combo': [660, 880, 1320].forEach((f, i) => this.tone('square', f, f, 0.07, 0.12, i * 0.05)); break;
				case 'hurt': this.tone('sawtooth', 300, 60, 0.4, 0.3); this.burst(0.3, 0.3, 800); break;
				case 'boss': this.tone('sawtooth', 70, 140, 0.9, 0.35); this.tone('square', 140, 70, 0.9, 0.15, 0.1); this.burst(0.8, 0.3, 400); break;
				case 'bossHit': this.tone('square', 180, 70, 0.15, 0.3); this.burst(0.15, 0.25, 1800); break;
				case 'rage': this.tone('sawtooth', 120, 480, 0.5, 0.25); break;
				case 'boom': this.burst(0.6, 0.45, 1500); this.tone('sine', 120, 30, 0.6, 0.45); break;
				case 'win': [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone('square', f, f, 0.16, 0.14, i * 0.11)); break;
				case 'lose': [440, 370, 311, 220].forEach((f, i) => this.tone('triangle', f, f * 0.97, 0.25, 0.25, i * 0.18)); break;
				case 'click': this.tone('square', 600, 900, 0.05, 0.1); break;
				default: break;
			}
		},
	};
	ui.mute.classList.toggle('muted', audio.muted);

	// ------------------------------------------------------------ redimensionnement & sprites
	let scale = 1, dpr = 1;
	const sprites = { faces: {}, boss: {}, bg: null };

	function makeSprite(w, h, draw) {
		const k = scale * dpr;
		const c = document.createElement('canvas');
		c.width = Math.ceil(w * k);
		c.height = Math.ceil(h * k);
		const g = c.getContext('2d');
		g.scale(k, k);
		draw(g, w, h);
		return c;
	}

	function circle(g, x, y, r) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); }

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
		[[-1, COL.yellow], [1, COL.yellow]].forEach(([s, c]) => {
			g.fillStyle = c; g.beginPath();
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

	function buildSprites() {
		const fs = TARGET_R * 2 + 18;
		TARGET_COLORS.forEach((c) => {
			sprites.faces[c] = {};
			['idle', 'blink', 'scared'].forEach((m) => {
				sprites.faces[c][m] = makeSprite(fs, fs, (g) => drawFace(g, fs / 2 - 3, fs / 2 - 3, TARGET_R, c, m));
			});
		});
		const bw = BOSS_R * 2 + 40, bh = BOSS_R * 3 + 20;
		sprites.boss.size = [bw, bh];
		sprites.boss.normal = makeSprite(bw, bh, (g) => drawBoss(g, bw / 2 - 4, bh - BOSS_R - 14, BOSS_R, COL.coral, 'normal'));
		sprites.boss.rage = makeSprite(bw, bh, (g) => drawBoss(g, bw / 2 - 4, bh - BOSS_R - 14, BOSS_R, COL.purple, 'rage'));
		sprites.boss.flash = makeSprite(bw, bh, (g) => drawBoss(g, bw / 2 - 4, bh - BOSS_R - 14, BOSS_R, COL.white, 'flash'));
		sprites.bg = makeSprite(W, H, drawBackground);
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

	function resize() {
		const pad = 28;
		scale = Math.min((window.innerWidth - pad) / W, (window.innerHeight - pad) / H, 1.5);
		scale = Math.max(scale, 0.35);
		dpr = Math.min(window.devicePixelRatio || 1, 2);
		const cw = Math.round(W * scale), ch = Math.round(H * scale);
		canvas.style.width = cw + 'px';
		canvas.style.height = ch + 'px';
		canvas.width = Math.round(cw * dpr);
		canvas.height = Math.round(ch * dpr);
		buildSprites();
	}

	// ------------------------------------------------------------ pools
	const MAX_PARTS = 600;
	const parts = Array.from({ length: MAX_PARTS }, () => ({ alive: false }));
	let partCursor = 0;
	function spawnPart(x, y, vx, vy, life, size, color, grav = 600, shape = 0) {
		const p = parts[partCursor]; partCursor = (partCursor + 1) % MAX_PARTS;
		p.alive = true; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = life; p.max = life;
		p.size = size; p.color = color; p.grav = grav; p.shape = shape;
		p.rot = Math.random() * 6.28; p.vr = (Math.random() - 0.5) * 12;
	}

	const bullets = Array.from({ length: 40 }, () => ({ alive: false, trail: [] }));
	const rings = [];
	const texts = [];

	// ------------------------------------------------------------ état du jeu
	let level = store.get('sevux-level', 'medium');
	if (!DIFF[level]) level = 'medium';
	let best = parseInt(store.get('sevux-best', '0'), 10) || 0;

	const game = {
		state: 'menu', time: 0, score: 0, lives: 3, combo: 0, shots: 0, hits: 0,
		angle: 0, recoil: 0, cooldown: 0, shake: 0, flash: 0, flashColor: COL.white, freeze: 0,
		targets: [], boss: null, banner: null, endTimer: 0, dance: 0, clouds: [],
	};

	const input = { left: false, right: false, fire: false, pointerFire: false, pointerAim: false };

	function resetRound() {
		const d = DIFF[level];
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

	function initClouds() {
		game.clouds = Array.from({ length: 5 }, (_, i) => ({
			x: Math.random() * W, y: 60 + i * 85 + Math.random() * 30, w: 60 + Math.random() * 70, v: 6 + Math.random() * 10,
		}));
	}

	// ------------------------------------------------------------ effets
	function addShake(a) { game.shake = Math.max(game.shake, a); }
	function addFlash(a, c = COL.white) { game.flash = Math.max(game.flash, a); game.flashColor = c; }
	function setBanner(text, color, dur) { game.banner = { text, color, t: 0, dur }; }
	function popText(x, y, text, color = COL.ink, size = 22) { texts.push({ x, y, text, color, size, t: 0, dur: 0.9 }); }

	function explode(x, y, color, n = 22, power = 320) {
		for (let i = 0; i < n; i++) {
			const a = Math.random() * Math.PI * 2, s = power * (0.35 + Math.random() * 0.75);
			const c = i % 3 === 0 ? COL.ink : (i % 3 === 1 ? color : COL.white);
			spawnPart(x, y, Math.cos(a) * s, Math.sin(a) * s - 120, 0.5 + Math.random() * 0.5, 5 + Math.random() * 7, c, 700, i % 2);
		}
		rings.push({ x, y, r: 6, max: 70 + n, t: 0, dur: 0.35, color });
	}

	function confetti() {
		const colors = [COL.yellow, COL.pink, COL.mint, COL.blue, COL.coral];
		for (let i = 0; i < 180; i++) {
			spawnPart(Math.random() * W, -20 - Math.random() * 200, (Math.random() - 0.5) * 160, 80 + Math.random() * 200,
				2.5 + Math.random() * 1.5, 6 + Math.random() * 6, colors[i % colors.length], 220, i % 2);
		}
	}

	// ------------------------------------------------------------ actions
	function multiplier() { return Math.min(1 + Math.floor(game.combo / 3), 5); }

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
		const d = DIFF[level];
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

	function showEnd() {
		const won = game.state === 'won';
		if (game.score > best) { best = game.score; store.set('sevux-best', String(best)); }
		ui.endTitle.textContent = won ? 'VICTOIRE' : 'GAME OVER';
		ui.endSticker.textContent = won ? 'boss vaincu' : 'zone envahie';
		const accuracy = game.shots ? Math.round((game.hits / game.shots) * 100) : 0;
		ui.endScore.textContent = game.score;
		ui.endAcc.textContent = accuracy + '%';
		ui.endBest.textContent = best;
		resetScoreForm(game.score, accuracy, won);
		show(ui.end);
		game.state = 'over';
	}

	// ------------------------------------------------------------ boucle
	function update(dt) {
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
			if (game.endTimer <= 0) showEnd();
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
		const d = DIFF[level];
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

	// ------------------------------------------------------------ rendu
	function render() {
		const k = scale * dpr;
		ctx.setTransform(k, 0, 0, k, 0, 0);
		const s = game.shake;
		if (s > 0) ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
		ctx.drawImage(sprites.bg, 0, 0, W, H);

		drawClouds();
		drawTargets();
		drawBossSprite();
		drawBullets();
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
			ctx.roundRect ? ctx.roundRect(c.x - c.w / 2, c.y, c.w, 22, 11) : ctx.rect(c.x - c.w / 2, c.y, c.w, 22);
			ctx.fill();
		}
	}

	function drawTargets() {
		const fs = TARGET_R * 2 + 18;
		for (const t of game.targets) {
			if (!t.alive || t.y < -fs) continue;
			const mood = t.blink < 0 ? 'blink' : (t.y > DANGER_Y - 170 ? 'scared' : 'idle');
			const spr = sprites.faces[t.color][mood];
			ctx.save();
			ctx.translate(t.x, t.y);
			ctx.rotate(t.wob + (mood === 'scared' ? Math.sin(game.time * 40) * 0.06 : 0));
			ctx.drawImage(spr, -fs / 2 + 3, -fs / 2 + 3, fs, fs);
			ctx.restore();
		}
	}

	function drawBossSprite() {
		const boss = game.boss;
		if (!boss) return;
		const [bw, bh] = sprites.boss.size;
		const spr = boss.hitT > 0 ? sprites.boss.flash : (boss.rage ? sprites.boss.rage : sprites.boss.normal);
		const sq = 1 + Math.sin(boss.wob) * 0.04;
		ctx.save();
		ctx.translate(boss.x, boss.y);
		if (game.state === 'bossDying') ctx.translate((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10);
		ctx.rotate(Math.sin(boss.wob * 0.5) * 0.08);
		ctx.scale(sq, 2 - sq);
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
		if (game.state === 'lost' || game.state === 'over' && game.lives <= 0) return;
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
		const lives = DIFF[level].lives;
		box(W - 14 - (lives * 30 + 18), 14, lives * 30 + 18, 40, COL.white);
		for (let i = 0; i < lives; i++) heart(W - 14 - (lives * 30 + 18) + 24 + i * 30, 23, 22, i < game.lives);
		// progression
		if (game.boss) {
			const b = game.boss, bw = 240, bx = W / 2 - bw / 2;
			box(bx, 78, bw, 22, COL.white);
			ctx.fillStyle = b.rage ? COL.purple : COL.coral;
			ctx.fillRect(bx + 3, 81, Math.max(0, (bw - 6) * (b.hp / b.max)), 16);
			ctx.textAlign = 'center'; ctx.font = `11px ${FONT}`; ctx.fillStyle = COL.ink; ctx.fillText('BOSS', W / 2, 90);
		} else {
			const left = game.targets.filter((t) => t.alive).length;
			box(W / 2 - 60, 14, 120, 40, COL.mint);
			ctx.textAlign = 'center'; ctx.fillStyle = COL.ink;
			ctx.font = `10px ${FONT}`; ctx.fillText('CIBLES', W / 2, 26);
			ctx.font = `17px ${FONT}`; ctx.fillText(`${TARGET_COUNT - left}/${TARGET_COUNT}`, W / 2, 43);
		}
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

	// ------------------------------------------------------------ boucle principale
	let last = performance.now();
	let running = true;
	function frame(now) {
		const dt = Math.min((now - last) / 1000, 1 / 20);
		last = now;
		if (running && game.state !== 'paused') update(dt);
		render();
		requestAnimationFrame(frame);
	}

	// ------------------------------------------------------------ interface
	function show(el) { el.classList.remove('hidden'); }
	function hide(el) { el.classList.add('hidden'); }

	function selectLevel(l) {
		level = l; store.set('sevux-level', l);
		ui.levels.forEach((b) => { const on = b.dataset.level === l; b.classList.toggle('selected', on); b.setAttribute('aria-checked', String(on)); });
	}

	function start() {
		audio.init(); audio.play('click');
		hide(ui.menu); hide(ui.end); hide(ui.pause);
		resetRound();
		game.state = 'playing';
		canvas.focus && window.focus();
	}

	function toMenu() {
		hide(ui.end); hide(ui.pause);
		ui.bestMenu.textContent = best;
		game.state = 'menu'; game.boss = null; game.targets = []; game.banner = null;
		show(ui.menu);
		loadMenuBoard();
	}

	function togglePause() {
		if (game.state === 'paused') { game.state = game.prevState; hide(ui.pause); }
		else if (['playing', 'bossIntro', 'bossDying'].includes(game.state)) { game.prevState = game.state; game.state = 'paused'; show(ui.pause); }
	}

	ui.levels.forEach((b) => b.addEventListener('click', () => { audio.init(); audio.play('click'); selectLevel(b.dataset.level); }));
	ui.play.addEventListener('click', start);
	ui.restart.addEventListener('click', start);
	ui.toMenu.addEventListener('click', toMenu);
	ui.resume.addEventListener('click', togglePause);
	ui.quit.addEventListener('click', toMenu);
	ui.mute.addEventListener('click', () => { audio.init(); audio.toggle(); });
	ui.scoreForm.addEventListener('submit', submitScore);

	const isTyping = (e) => e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;

	const KEYS = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'fire', Space: 'fire', KeyW: 'fire' };
	window.addEventListener('keydown', (e) => {
		if (isTyping(e)) return;
		if (KEYS[e.code]) { input[KEYS[e.code]] = true; e.preventDefault(); }
		if (e.repeat) return;
		if (e.code === 'Enter') { if (game.state === 'menu' || game.state === 'over') start(); }
		if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
		if (e.code === 'KeyM') { audio.init(); audio.toggle(); }
	});
	window.addEventListener('keyup', (e) => { if (!isTyping(e) && KEYS[e.code]) input[KEYS[e.code]] = false; });

	function aimAt(e) {
		const r = canvas.getBoundingClientRect();
		const x = (e.clientX - r.left) / r.width * W, y = (e.clientY - r.top) / r.height * H;
		const a = Math.atan2(x - TURRET_X, TURRET_Y - y);
		game.angle = Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, a));
		input.pointerAim = true;
	}
	canvas.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse' || input.pointerFire) aimAt(e); });
	canvas.addEventListener('pointerdown', (e) => { audio.init(); aimAt(e); input.pointerFire = true; canvas.setPointerCapture(e.pointerId); });
	const stopFire = () => { input.pointerFire = false; };
	canvas.addEventListener('pointerup', stopFire);
	canvas.addEventListener('pointercancel', stopFire);

	window.addEventListener('blur', () => { input.left = input.right = input.fire = input.pointerFire = false; if (game.state !== 'paused') togglePause(); });
	document.addEventListener('visibilitychange', () => { running = !document.hidden; last = performance.now(); });

	let resizeRaf = 0;
	window.addEventListener('resize', () => { cancelAnimationFrame(resizeRaf); resizeRaf = requestAnimationFrame(resize); });

	// Point d'entrée de test, uniquement en local avec ?debug
	if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && new URLSearchParams(location.search).has('debug')) {
		window.__sevux = {
			end(score = 4200, won = true) {
				hide(ui.menu);
				game.score = score; game.shots = 40; game.hits = 25; game.lives = won ? 1 : 0;
				game.state = won ? 'won' : 'lost';
				showEnd();
			},
		};
	}

	// ------------------------------------------------------------ démarrage
	selectLevel(level);
	ui.bestMenu.textContent = best;
	loadMenuBoard();
	initClouds();
	resize();
	if (document.fonts && document.fonts.ready) document.fonts.ready.then(buildSprites);
	requestAnimationFrame(frame);
})();
