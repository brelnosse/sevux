import { getStore } from '@netlify/blobs';
import { handleRequest } from '../../lib/leaderboard.mjs';

// API du classement : GET /api/scores?limit=10 · POST /api/scores { name, score, level, accuracy, won }
export default async (req, context) => {
	const blobs = getStore({ name: 'sevux-leaderboard', consistency: 'strong' });
	const store = {
		get: (key) => blobs.get(key, { type: 'json' }),
		set: (key, value) => blobs.setJSON(key, value),
	};
	return handleRequest(req, {
		store,
		clientId: context.ip ?? req.headers.get('x-nf-client-connection-ip') ?? 'unknown',
		salt: process.env.SCORES_SALT ?? 'sevux',
	});
};

export const config = { path: '/api/scores' };
