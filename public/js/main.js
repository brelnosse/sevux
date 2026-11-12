/*  SEVUX — Défends la zone
 *  Point d'entrée : boucle requestAnimationFrame, interface (menus, pause, fin) et contrôles.
 *  Canvas 2D, sprites pré-rendus, pools d'objets et sons synthétisés : aucun asset à télécharger.
 */
import { W, H, TURRET_X, TURRET_Y, MAX_ANGLE, WAVES, store, settings } from './config.js';
import { canvas, ui, show, hide } from './dom.js';
import { audio } from './audio.js';
import { resize, buildSprites } from './sprites.js';
import { game, input, hostiles, resetRound, initClouds } from './state.js';
import { update, hooks, queueFire } from './logic.js';
import { render } from './render.js';
import { loadMenuBoard, submitScore, resetScoreForm } from './leaderboard.js';

// ------------------------------------------------------------ écran de fin
function showEnd() {
	const won = game.state === 'won';
	if (game.score > settings.best) { settings.best = game.score; store.set('sevux-best', String(settings.best)); }
	ui.endTitle.textContent = won ? 'VICTOIRE' : 'GAME OVER';
	ui.endSticker.textContent = won ? 'boss final vaincu' : `zone envahie · vague ${game.wave + 1}/${WAVES.length}`;
	const accuracy = game.shots ? Math.round((game.hits / game.shots) * 100) : 0;
	ui.endScore.textContent = game.score;
	ui.endAcc.textContent = accuracy + '%';
	ui.endBest.textContent = settings.best;
	resetScoreForm(game.score, accuracy, won);
	show(ui.end);
	game.state = 'over';
}
hooks.onEnd = showEnd;

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
function selectLevel(l) {
	settings.level = l; store.set('sevux-level', l);
	ui.levels.forEach((b) => { const on = b.dataset.level === l; b.classList.toggle('selected', on); b.setAttribute('aria-checked', String(on)); });
}

function start() {
	audio.init(); audio.play('click');
	hide(ui.menu); hide(ui.end); hide(ui.pause);
	resetRound();
	game.state = 'playing';
	window.focus();
}

function toMenu() {
	hide(ui.end); hide(ui.pause);
	ui.bestMenu.textContent = settings.best;
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

// ------------------------------------------------------------ clavier
const isTyping = (e) => e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
const AIM_KEYS = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
const FIRE_KEYS = ['ArrowUp', 'Space', 'KeyW'];
const inGame = () => ['playing', 'bossIntro', 'bossDying'].includes(game.state);

window.addEventListener('keydown', (e) => {
	if (isTyping(e)) return;
	if (AIM_KEYS[e.code]) { input[AIM_KEYS[e.code]] = true; e.preventDefault(); }
	if (FIRE_KEYS.includes(e.code)) e.preventDefault();
	// coup par coup : maintenir la touche ne tire pas en rafale (répétition clavier ignorée)
	if (e.repeat) return;
	if (FIRE_KEYS.includes(e.code) && inGame()) queueFire();
	if (e.code === 'Enter' && (game.state === 'menu' || game.state === 'over')) start();
	if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
	if (e.code === 'KeyM') { audio.init(); audio.toggle(); }
});
window.addEventListener('keyup', (e) => { if (!isTyping(e) && AIM_KEYS[e.code]) input[AIM_KEYS[e.code]] = false; });

// ------------------------------------------------------------ souris / tactile
function aimAt(e) {
	const r = canvas.getBoundingClientRect();
	const x = (e.clientX - r.left) / r.width * W, y = (e.clientY - r.top) / r.height * H;
	game.angle = Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, Math.atan2(x - TURRET_X, TURRET_Y - y)));
	input.pointerAim = true;
}
let pointerDown = false;
canvas.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse' || pointerDown) aimAt(e); });
canvas.addEventListener('pointerdown', (e) => {
	audio.init(); aimAt(e); pointerDown = true; canvas.setPointerCapture(e.pointerId);
	if (inGame()) queueFire(); // un clic ou un toucher = un tir
});
const release = () => { pointerDown = false; };
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);

window.addEventListener('blur', () => { input.left = input.right = false; pointerDown = false; if (game.state !== 'paused') togglePause(); });
document.addEventListener('visibilitychange', () => { running = !document.hidden; last = performance.now(); });

let resizeRaf = 0;
window.addEventListener('resize', () => { cancelAnimationFrame(resizeRaf); resizeRaf = requestAnimationFrame(resize); });

// Point d'entrée de test, uniquement en local avec ?debug
if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && new URLSearchParams(location.search).has('debug')) {
	window.__sevux = {
		state: () => ({ state: game.state, wave: game.wave + 1, left: game.targets.filter((t) => t.alive).length, boss: game.boss && { kind: game.boss.kind, hp: game.boss.hp, r: game.boss.r }, lives: game.lives, score: game.score, shots: game.shots, hostiles: hostiles.length, shooters: game.targets.filter((t) => t.alive && t.shoots).map((t) => [Math.round(t.y), +t.fireT.toFixed(2)]) }),
		clearWave() { game.targets.forEach((t) => { t.alive = false; }); },
		tick(seconds = 1) { for (let t = 0; t < seconds; t += 1 / 60) update(1 / 60); render(); return this.state(); },
		weakenBoss() { if (game.boss) game.boss.hp = 1; },
		killBoss() { if (game.boss) { game.boss.hp = 0; game.boss.entering = false; game.boss.dying = 0.01; game.state = 'bossDying'; } },
		end(score = 4200, won = true) {
			hide(ui.menu);
			game.score = score; game.shots = 40; game.hits = 25; game.lives = won ? 1 : 0;
			game.state = won ? 'won' : 'lost';
			showEnd();
		},
	};
}

// ------------------------------------------------------------ démarrage
selectLevel(settings.level);
ui.bestMenu.textContent = settings.best;
loadMenuBoard();
initClouds();
resize();
if (document.fonts && document.fonts.ready) document.fonts.ready.then(buildSprites);
requestAnimationFrame(frame);
