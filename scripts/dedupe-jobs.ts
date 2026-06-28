/**
 * One-off cleanup: collapse duplicate job rows created by the old, unstable
 * externalId (which baked in the completion date and the raw km/mi unit, so a
 * single delivery could land as several rows). See parse.ts `jobKey`.
 *
 * For each group of rows sharing the new stable key it keeps the richest row,
 * merges any fields the keeper is missing from its twins, deletes the rest, and
 * rewrites every surviving row's external_id to the new key so the next sync
 * dedupes against it instead of inserting fresh copies.
 *
 *   npx tsx scripts/dedupe-jobs.ts --dry   # preview, change nothing
 *   npx tsx scripts/dedupe-jobs.ts         # apply
 */
import 'dotenv/config';
import { eq, inArray } from 'drizzle-orm';
import { db, schema } from '../src/lib/server/db';
import { jobKey } from '../src/lib/server/scraper/parse';

const { jobs } = schema;
type Job = typeof jobs.$inferSelect;

const DRY = process.argv.includes('--dry');

// More complete rows win; a row with the delivery timestamp is the canonical one.
const score = (j: Job) =>
	(j.deliveredAt != null ? 8 : 0) +
	(j.takenAt != null ? 4 : 0) +
	(j.cargoDamage != null ? 2 : 0) +
	(j.massT != null ? 1 : 0) +
	(j.revenue != null ? 1 : 0) +
	(j.fromCompany != null ? 1 : 0) +
	(j.toCompany != null ? 1 : 0);

const coalesce = <T>(...vals: (T | null | undefined)[]): T | null =>
	(vals.find((v) => v != null) ?? null) as T | null;

const all = db.select().from(jobs).all();

const groups = new Map<string, Job[]>();
for (const j of all) {
	const k = jobKey(j);
	const g = groups.get(k);
	if (g) g.push(j);
	else groups.set(k, [j]);
}

let dupeGroups = 0;
let toDelete = 0;
let toRekey = 0;

const apply = () => {
	for (const [key, rows] of groups) {
		// Richest first; tie-break to the earliest-seen, then lowest id.
		rows.sort(
			(a, b) => score(b) - score(a) || a.firstSeenAt - b.firstSeenAt || a.id - b.id
		);
		const keep = rows[0];
		const dupes = rows.slice(1);

		const patch = {
			externalId: key,
			deliveredAt: coalesce(keep.deliveredAt, ...dupes.map((d) => d.deliveredAt)),
			takenAt: coalesce(keep.takenAt, ...dupes.map((d) => d.takenAt)),
			cargoDamage: coalesce(keep.cargoDamage, ...dupes.map((d) => d.cargoDamage)),
			massT: coalesce(keep.massT, ...dupes.map((d) => d.massT)),
			revenue: coalesce(keep.revenue, ...dupes.map((d) => d.revenue)),
			fromCompany: coalesce(keep.fromCompany, ...dupes.map((d) => d.fromCompany)),
			toCompany: coalesce(keep.toCompany, ...dupes.map((d) => d.toCompany)),
			distanceKm: coalesce(keep.distanceKm, ...dupes.map((d) => d.distanceKm)),
			firstSeenAt: Math.min(keep.firstSeenAt, ...dupes.map((d) => d.firstSeenAt))
		};

		if (dupes.length) {
			dupeGroups++;
			toDelete += dupes.length;
			console.log(
				`• ${key}  →  keep #${keep.id}, drop ${dupes.map((d) => '#' + d.id).join(', ')}`
			);
			if (!DRY) db.delete(jobs).where(inArray(jobs.id, dupes.map((d) => d.id))).run();
		}
		if (keep.externalId !== key) toRekey++;
		if (!DRY) db.update(jobs).set(patch).where(eq(jobs.id, keep.id)).run();
	}
};

if (DRY) {
	apply();
} else {
	db.transaction(() => apply());
}

console.log(
	`\n${DRY ? '[dry run] ' : ''}${all.length} rows → ${groups.size} unique deliveries; ` +
		`${dupeGroups} group(s) had duplicates, ${toDelete} row(s) ${DRY ? 'would be' : ''} deleted, ` +
		`${toRekey} survivor(s) re-keyed to the stable format.`
);
process.exit(0);
