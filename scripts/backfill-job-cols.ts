/**
 * One-off backfill: populate jobs.taken_at and jobs.cargo_damage for rows
 * scraped before those columns existed, by re-reading each job's `raw` JSON.
 * Safe to re-run. Usage: npx tsx scripts/backfill-job-cols.ts
 */
import Database from 'better-sqlite3';
import { parseWotDate } from '../src/lib/server/scraper/parse';

const url = process.env.DATABASE_URL ?? './data/trucksim.db';
const db = new Database(url);

const rows = db.prepare('SELECT id, raw FROM jobs WHERE raw IS NOT NULL').all() as {
	id: number;
	raw: string;
}[];
const upd = db.prepare('UPDATE jobs SET taken_at = ?, cargo_damage = ? WHERE id = ?');

let updated = 0;
for (const r of rows) {
	let f: Record<string, string>;
	try {
		f = JSON.parse(r.raw);
	} catch {
		continue;
	}
	upd.run(parseWotDate(f['Taken']), f['Cargo Damage'] || null, r.id);
	updated++;
}

console.log(`backfilled ${updated} / ${rows.length} job rows`);
db.close();
