/**
 * Deploy the prerendered `build/` folder to Netlify via the REST API — no
 * netlify-cli (which drags in sharp and won't install here). Uses the file-
 * digest method: hash every file, let Netlify say which are new, upload those.
 *
 * Needs in .env:
 *   NETLIFY_AUTH_TOKEN  — Netlify → User settings → Applications → personal access token
 *   NETLIFY_SITE_ID     — your site → Site configuration → Site details → "Site ID"
 *
 * Usage: npx tsx scripts/deploy.ts   (or `npm run deploy`)
 */
import 'dotenv/config';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const TOKEN = process.env.NETLIFY_AUTH_TOKEN;
const SITE = process.env.NETLIFY_SITE_ID;
const DIR = 'build';
const API = 'https://api.netlify.com/api/v1';

if (!TOKEN || !SITE) {
	console.error(
		'Missing NETLIFY_AUTH_TOKEN and/or NETLIFY_SITE_ID in .env — see .env.example for how to get them.'
	);
	process.exit(1);
}

function walk(dir: string, out: string[] = []): string[] {
	for (const name of readdirSync(dir)) {
		const p = join(dir, name);
		if (statSync(p).isDirectory()) walk(p, out);
		else out.push(p);
	}
	return out;
}

const auth = { Authorization: `Bearer ${TOKEN}` };

(async () => {
	// 1. Hash every file in build/ → manifest { "/path": sha1 }.
	const files: Record<string, string> = {};
	const bySha = new Map<string, string>();
	for (const p of walk(DIR)) {
		const rel = '/' + relative(DIR, p).split(sep).join('/');
		const sha = createHash('sha1').update(readFileSync(p)).digest('hex');
		files[rel] = sha;
		bySha.set(sha, p);
	}
	const total = Object.keys(files).length;

	// 2. Create a production deploy; Netlify replies with which hashes it needs.
	const created = await fetch(`${API}/sites/${SITE}/deploys`, {
		method: 'POST',
		headers: { ...auth, 'Content-Type': 'application/json' },
		body: JSON.stringify({ files })
	});
	const deploy = (await created.json()) as { id?: string; required?: string[]; ssl_url?: string; error?: string };
	if (!created.ok || !deploy.id) {
		console.error(`Netlify deploy create failed (${created.status}):`, deploy);
		process.exit(1);
	}

	// 3. Upload only the files Netlify doesn't already have.
	const required = deploy.required ?? [];
	console.log(`Uploading ${required.length} of ${total} files…`);
	for (const sha of required) {
		const p = bySha.get(sha);
		if (!p) continue;
		const rel = '/' + relative(DIR, p).split(sep).join('/');
		const put = await fetch(`${API}/deploys/${deploy.id}/files${encodeURI(rel)}`, {
			method: 'PUT',
			headers: { ...auth, 'Content-Type': 'application/octet-stream' },
			body: readFileSync(p)
		});
		if (!put.ok) {
			console.error(`Upload failed for ${rel} (${put.status}):`, await put.text());
			process.exit(1);
		}
	}

	console.log(`✔ Deployed to ${deploy.ssl_url ?? 'your Netlify site'}`);
})();
