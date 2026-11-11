// Classement en ligne : lecture du top, envoi du score et affichage (textContent uniquement, jamais innerHTML).
import { store, settings } from './config.js';
import { ui } from './dom.js';
import { audio } from './audio.js';

const API = window.SEVUX_API || '/api/scores';
const LEVEL_LABEL = { easy: 'Facile', medium: 'Normal', hard: 'Difficile' };
const NAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N} _.\-]{1,15}$/u;
const sameName = (a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }) === 0;

const api = {
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

export async function loadMenuBoard() {
	try {
		const data = await api.top(5);
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

export async function submitScore(e) {
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
		const data = await api.submit({ name, ...lastResult });
		lastResult.sent = true;
		store.set('sevux-pseudo', name);
		ui.pseudo.disabled = true;
		setFormMessage(data.improved ? `Bien joué ${name}, tu es #${data.rank} !` : `Ton meilleur score reste #${data.rank}.`, 'ok');
		renderBoard(ui.endBoard, data.entries, name);
		audio.play('combo');
		// prévient le site qui intègre le jeu (le portfolio) pour qu'il recharge son classement
		if (window.parent !== window) window.parent.postMessage({ type: 'sevux:score', rank: data.rank }, '*');
	} catch (err) {
		ui.saveScore.disabled = false;
		setFormMessage(err.status ? err.message : 'Classement indisponible pour le moment.', 'error');
	}
}

export function resetScoreForm(score, accuracy, won) {
	lastResult = score > 0 ? { score, level: settings.level, accuracy, won, sent: false } : null;
	ui.scoreForm.hidden = !lastResult;
	ui.pseudo.disabled = false;
	ui.pseudo.value = store.get('sevux-pseudo', '');
	ui.saveScore.disabled = false;
	ui.endBoard.hidden = true;
	setFormMessage('');
}
