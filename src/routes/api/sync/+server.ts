import { json, type RequestHandler } from '@sveltejs/kit';
import { runSync } from '$lib/server/sync';

// This is a server-only mutation; it can't exist in the static snapshot build.
export const prerender = false;

/** POST /api/sync — scrape World of Trucks now and store a snapshot. */
export const POST: RequestHandler = async () => {
	try {
		const out = await runSync();
		return json({ ok: true, ...out });
	} catch (err) {
		console.error('sync failed', err);
		return json({ ok: false, error: (err as Error).message }, { status: 500 });
	}
};
