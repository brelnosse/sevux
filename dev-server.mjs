// Serveur local : sert public/ et une API /api/scores en mémoire (même logique qu'en production).
// Usage : npm run dev  (PORT=5055 par défaut)
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleRequest } from './lib/leaderboard.mjs';

const ROOT = resolve(fileURLToPath(new URL('./public/', import.meta.url)));
const PORT = Number(process.env.PORT) || 5055;
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

// Mêmes en-têtes qu'en production (netlify.toml), pour repérer en local ce que la CSP bloquerait.
const SECURITY_HEADERS = {
	'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'",
	'X-Content-Type-Options': 'nosniff',
};

const memory = new Map();
const store = {
	get: async (key) => (memory.has(key) ? structuredClone(memory.get(key)) : null),
	set: async (key, value) => { memory.set(key, structuredClone(value)); },
};

createServer(async (req, res) => {
	const url = new URL(req.url, `http://${req.headers.host}`);
	if (url.pathname === '/api/scores') {
		const chunks = [];
		for await (const chunk of req) chunks.push(chunk);
		const request = new Request(url, {
			method: req.method,
			headers: req.headers,
			body: ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? undefined : Buffer.concat(chunks),
		});
		const response = await handleRequest(request, { store, clientId: req.socket.remoteAddress });
		res.writeHead(response.status, Object.fromEntries(response.headers));
		res.end(Buffer.from(await response.arrayBuffer()));
		return;
	}
	let requested = 'index.html';
	try { requested = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname); } catch { /* URL mal encodée */ }
	const path = normalize(join(ROOT, requested));
	const file = path.startsWith(ROOT + sep) ? path : join(ROOT, 'index.html');
	try {
		const data = await readFile(file);
		res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', ...SECURITY_HEADERS });
		res.end(data);
	} catch {
		res.writeHead(200, { 'Content-Type': TYPES['.html'] });
		res.end(await readFile(join(ROOT, 'index.html')));
	}
}).listen(PORT, () => console.log(`SEVUX en local : http://localhost:${PORT}`));
