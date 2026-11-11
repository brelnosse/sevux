// Sons synthétisés en direct avec la Web Audio API : aucun fichier audio.
import { store } from './config.js';
import { ui } from './dom.js';

export const audio = {
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
