// Références vers les éléments de la page.

const $ = (id) => document.getElementById(id);

export const canvas = $('game');
export const ctx = canvas.getContext('2d', { alpha: false });

export const ui = {
	menu: $('menu'), pause: $('pause'), end: $('end'),
	play: $('play'), resume: $('resume'), quit: $('quit'), restart: $('restart'), toMenu: $('toMenu'),
	mute: $('mute'), levels: document.querySelectorAll('.level'),
	bestMenu: $('bestMenu'), endTitle: $('endTitle'), endSticker: $('endSticker'),
	endScore: $('endScore'), endAcc: $('endAcc'), endBest: $('endBest'),
	scoreForm: $('scoreForm'), pseudo: $('pseudo'), saveScore: $('saveScore'), formMsg: $('formMsg'),
	endBoard: $('endBoard'), menuBoard: $('menuBoard'), menuBoardWrap: $('menuBoardWrap'),
};

export function show(el) { el.classList.remove('hidden'); }
export function hide(el) { el.classList.add('hidden'); }
