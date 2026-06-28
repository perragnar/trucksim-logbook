import { json, type RequestHandler } from '@sveltejs/kit';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

// Server-only mutation; can't exist in the static snapshot build.
export const prerender = false;

// Builds are heavy and write to build/ — never let two run at once (e.g. a
// double-click or a second tab). Module-scoped, so it's shared across requests.
let publishing = false;

const opts = {
	cwd: process.cwd(),
	env: process.env,
	maxBuffer: 64 * 1024 * 1024
} as const;

/**
 * POST /api/publish — snapshot the current local DB to static HTML and deploy it
 * to Netlify. This is `build:static` + `deploy` (no scrape): use "Sync now"
 * first to refresh the data, then publish to push it live.
 */
export const POST: RequestHandler = async () => {
	if (publishing) {
		return json({ ok: false, error: 'A publish is already in progress.' }, { status: 409 });
	}
	publishing = true;
	try {
		// 1. Prerender the current data into build/.
		await run('npm', ['run', 'build:static'], opts);
		// 2. Upload build/ to Netlify (file-digest deploy).
		const { stdout } = await run('npm', ['run', 'deploy'], opts);
		const url = stdout.match(/Deployed to (\S+)/)?.[1] ?? null;
		return json({ ok: true, url });
	} catch (err) {
		const e = err as { stderr?: string; message?: string };
		const msg = (e.stderr || e.message || 'Publish failed').trim();
		console.error('publish failed', msg);
		// Keep the toast readable — the tail usually holds the actual error.
		return json({ ok: false, error: msg.slice(-400) }, { status: 500 });
	} finally {
		publishing = false;
	}
};
