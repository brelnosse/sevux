import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeName, validateEntry, insertEntry, handleRequest, MAX_ENTRIES } from './leaderboard.mjs';

const memoryStore = () => {
	const m = new Map();
	return { get: async (k) => m.get(k) ?? null, set: async (k, v) => { m.set(k, v); } };
};
const post = (body) => new Request('http://x/api/scores', { method: 'POST', body: JSON.stringify(body) });

test('sanitizeName accepte les pseudos simples et refuse le reste', () => {
	assert.equal(sanitizeName('  Brel   N  '), 'Brel N');
	assert.equal(sanitizeName('Éloïse_42'), 'Éloïse_42');
	assert.equal(sanitizeName('a'), null);
	assert.equal(sanitizeName('<script>'), null);
	assert.equal(sanitizeName('x'.repeat(17)), null);
	assert.equal(sanitizeName(42), null);
});

test('validateEntry borne le score et la difficulté', () => {
	assert.equal(validateEntry({ name: 'Bob', score: 0, level: 'easy' }).ok, false);
	assert.equal(validateEntry({ name: 'Bob', score: 999999, level: 'easy' }).ok, false);
	assert.equal(validateEntry({ name: 'Bob', score: 120.5, level: 'easy' }).ok, false);
	assert.equal(validateEntry({ name: 'Bob', score: 1200, level: 'nightmare' }).ok, false);
	const ok = validateEntry({ name: 'Bob', score: 1200, level: 'hard', accuracy: 250, won: true });
	assert.equal(ok.ok, true);
	assert.equal(ok.entry.accuracy, 100);
});

test('insertEntry garde le meilleur score par pseudo (insensible à la casse)', () => {
	let { list, rank } = insertEntry([], { name: 'Ana', score: 500, date: '2026-01-01' });
	assert.equal(rank, 1);
	({ list } = insertEntry(list, { name: 'Zed', score: 900, date: '2026-01-02' }));
	({ list, rank } = insertEntry(list, { name: 'ANA', score: 300, date: '2026-01-03' }));
	assert.equal(list.length, 2);
	assert.equal(list[1].score, 500);
	assert.equal(rank, 2);
	({ list, rank } = insertEntry(list, { name: 'ana', score: 1000, date: '2026-01-04' }));
	assert.equal(rank, 1);
	assert.equal(list.length, 2);
});

test('insertEntry tronque la liste', () => {
	let list = [];
	for (let i = 0; i < MAX_ENTRIES + 5; i++) ({ list } = insertEntry(list, { name: `p${i}x`, score: i + 1, date: '2026-01-01' }));
	assert.equal(list.length, MAX_ENTRIES);
	assert.equal(list[0].score, MAX_ENTRIES + 5);
});

test('handleRequest : POST, limite de débit puis GET', async () => {
	const store = memoryStore();
	const first = await handleRequest(post({ name: 'Brel', score: 4200, level: 'medium', accuracy: 61, won: true }), { store, clientId: '1.2.3.4' });
	assert.equal(first.status, 201);
	assert.equal((await first.json()).rank, 1);
	const again = await handleRequest(post({ name: 'Brel', score: 5000, level: 'medium' }), { store, clientId: '1.2.3.4' });
	assert.equal(again.status, 429);
	const bad = await handleRequest(post({ name: '!', score: 10, level: 'easy' }), { store, clientId: '5.6.7.8' });
	assert.equal(bad.status, 400);
	const get = await handleRequest(new Request('http://x/api/scores?limit=5'), { store });
	const data = await get.json();
	assert.equal(get.headers.get('access-control-allow-origin'), '*');
	assert.deepEqual(data.entries.map((e) => e.name), ['Brel']);
});
