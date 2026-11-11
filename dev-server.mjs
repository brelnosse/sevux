// Serveur local : sert public/ et une API /api/scores en mémoire (même logique qu'en production).
// Usage : npm run dev  (PORT=5055 par défaut)
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleRequest } from './lib/leaderboard.mjs';

const ROOT = resolve(fileURLToPath(new URL('./public/', import.meta.url)));
const PORT = Number(process.env.PORT) || 5055;
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

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
	const path = normalize(join(ROOT, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname)));
	const file = path.startsWith(ROOT) ? path : join(ROOT, 'index.html');
	try {
		const data = await readFile(file);
		res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
		res.end(data);
	} catch {
		res.writeHead(200, { 'Content-Type': TYPES['.html'] });
		res.end(await readFile(join(ROOT, 'index.html')));
	}
}).listen(PORT, () => console.log(`SEVUX en local : http://localhost:${PORT}`));
