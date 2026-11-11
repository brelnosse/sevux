/*  SEVUX — Défends la zone
 *  Point d'entrée : boucle requestAnimationFrame, interface (menus, pause, fin) et contrôles.
 *  Canvas 2D, sprites pré-rendus, pools d'objets et sons synthétisés : aucun asset à télécharger.
 */
import { W, H, TURRET_X, TURRET_Y, MAX_ANGLE, store, settings } from './config.js';
import { canvas, ui, show, hide } from './dom.js';
import { audio } from './audio.js';
import { resize, buildSprites } from './sprites.js';
import { game, input, resetRound, initClouds } from './state.js';
import { update, hooks } from './logic.js';
import { render } from './render.js';
import { loadMenuBoard, submitScore, resetScoreForm } from './leaderboard.js';

// ------------------------------------------------------------ écran de fin
function showEnd() {
	const won = game.state === 'won';
	if (game.score > settings.best) { settings.best = game.score; store.set('sevux-best', String(settings.best)); }
	ui.endTitle.textContent = won ? 'VICTOIRE' : 'GAME OVER';
	ui.endSticker.textContent = won ? 'boss vaincu' : 'zone envahie';
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
const KEYS = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'fire', Space: 'fire', KeyW: 'fire' };

window.addEventListener('keydown', (e) => {
	if (isTyping(e)) return;
	if (KEYS[e.code]) { input[KEYS[e.code]] = true; e.preventDefault(); }
	if (e.repeat) return;
	if (e.code === 'Enter' && (game.state === 'menu' || game.state === 'over')) start();
	if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
	if (e.code === 'KeyM') { audio.init(); audio.toggle(); }
});
window.addEventListener('keyup', (e) => { if (!isTyping(e) && KEYS[e.code]) input[KEYS[e.code]] = false; });

// ------------------------------------------------------------ souris / tactile
function aimAt(e) {
	const r = canvas.getBoundingClientRect();
	const x = (e.clientX - r.left) / r.width * W, y = (e.clientY - r.top) / r.height * H;
	game.angle = Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, Math.atan2(x - TURRET_X, TURRET_Y - y)));
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
selectLevel(settings.level);
ui.bestMenu.textContent = settings.best;
loadMenuBoard();
initClouds();
resize();
if (document.fonts && document.fonts.ready) document.fonts.ready.then(buildSprites);
requestAnimationFrame(frame);
