// Logique du classement, indépendante du stockage (testable en local).

export const MAX_ENTRIES = 100;
export const MAX_SCORE = 40000; // largement au-dessus du score maximal atteignable (~21 000)
export const LEVELS = ['easy', 'medium', 'hard'];

const NAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N} _.\-]{1,15}$/u;

export function sanitizeName(raw) {
	if (typeof raw !== 'string') return null;
	const name = raw.normalize('NFC').replace(/\s+/g, ' ').trim();
	return NAME_PATTERN.test(name) ? name : null;
}

/** Valide le corps d'une requête POST et renvoie une entrée propre. */
export function validateEntry(body) {
	if (!body || typeof body !== 'object') return { ok: false, error: 'Requête invalide.' };
	const name = sanitizeName(body.name);
	if (!name) return { ok: false, error: 'Pseudo : 2 à 16 caractères (lettres, chiffres, espace, _ . -).' };
	const score = Number(body.score);
	if (!Number.isInteger(score) || score <= 0 || score > MAX_SCORE) return { ok: false, error: 'Score invalide.' };
	const level = LEVELS.includes(body.level) ? body.level : null;
	if (!level) return { ok: false, error: 'Difficulté invalide.' };
	const accuracy = Math.max(0, Math.min(100, Math.round(Number(body.accuracy) || 0)));
	return {
		ok: true,
		entry: { name, score, level, accuracy, won: body.won === true, date: new Date().toISOString() },
	};
}

const sameName = (a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }) === 0;
const byScore = (a, b) => b.score - a.score || a.date.localeCompare(b.date);

/**
 * Insère une entrée : un seul score par pseudo (le meilleur est conservé),
 * liste triée et tronquée. Renvoie la nouvelle liste et le rang du pseudo (ou null).
 */
export function insertEntry(list, entry) {
	const entries = Array.isArray(list) ? list.slice() : [];
	const existing = entries.findIndex((e) => sameName(e.name, entry.name));
	if (existing === -1) entries.push(entry);
	else if (entry.score > entries[existing].score) entries[existing] = entry;
	entries.sort(byScore);
	const next = entries.slice(0, MAX_ENTRIES);
	const index = next.findIndex((e) => sameName(e.name, entry.name));
	return { list: next, rank: index === -1 ? null : index + 1, improved: existing === -1 || entry.score > (list[existing]?.score ?? 0) };
}

export function publicTop(list, limit = 10) {
	return (Array.isArray(list) ? list : []).slice(0, limit).map(({ name, score, level, won, accuracy, date }) => ({
		name, score, level, won, accuracy, date,
	}));
}

export function clampLimit(raw, fallback = 10) {
	const n = parseInt(raw, 10);
	return Number.isFinite(n) ? Math.max(1, Math.min(50, n)) : fallback;
}

export async function hashKey(value, salt = '') {
	const data = new TextEncoder().encode(`${salt}:${value}`);
	const digest = await crypto.subtle.digest('SHA-256', data);
	return Array.from(new Uint8Array(digest).slice(0, 12), (b) => b.toString(16).padStart(2, '0')).join('');
}

export const RATE_LIMIT_MS = 15000;

/**
 * Traite une requête HTTP avec un « store » minimal { get(key), set(key, value) } (JSON).
 * Partagé entre la Netlify Function et le serveur de développement.
 */
export async function handleRequest(req, { store, clientId = 'unknown', salt = '' }) {
	const headers = {
		'Access-Control-Allow-Origin': '*',
		'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type',
		'Content-Type': 'application/json; charset=utf-8',
	};
	const json = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), { status, headers: { ...headers, ...extra } });

	if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });

	if (req.method === 'GET') {
		const limit = clampLimit(new URL(req.url).searchParams.get('limit'));
		const list = (await store.get('top')) ?? [];
		return json({ entries: publicTop(list, limit), total: list.length }, 200, { 'Cache-Control': 'public, max-age=10' });
	}

	if (req.method === 'POST') {
		const text = await req.text();
		if (text.length > 1000) return json({ error: 'Requête trop volumineuse.' }, 413);
		let body;
		try { body = JSON.parse(text); } catch { return json({ error: 'JSON invalide.' }, 400); }
		const result = validateEntry(body);
		if (!result.ok) return json({ error: result.error }, 400);

		const rateKey = `rate/${await hashKey(clientId, salt)}`;
		const last = await store.get(rateKey);
		if (last && Date.now() - last.t < RATE_LIMIT_MS) return json({ error: 'Doucement ! Réessaie dans quelques secondes.' }, 429);
		await store.set(rateKey, { t: Date.now() });

		const list = (await store.get('top')) ?? [];
		const { list: next, rank, improved } = insertEntry(list, result.entry);
		if (improved) await store.set('top', next);
		return json({ rank, improved, entries: publicTop(next, 10), total: next.length }, 201);
	}

	return json({ error: 'Méthode non autorisée.' }, 405, { Allow: 'GET, POST, OPTIONS' });
}
