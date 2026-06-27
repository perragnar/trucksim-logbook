/**
 * Bulk-geocode city coordinates into the `city_coords` cache so the route map is
 * pre-populated offline. Run once (and after new map DLC):
 *   npm run build:cities          # geocode anything not already cached
 *   npm run build:cities -- --force   # re-geocode everything (refresh)
 *
 * Sources, in order: every distinct city already in your job log (exact scraped
 * names, region recovered from the raw Origin/Destination), then the canonical
 * ATS + ETS2 seed lists in cityLists.ts. The on-demand backfill during sync
 * keeps the cache filled going forward; hand-curated cityCoords.ts overrides it.
 *
 * Geocoding respects Nominatim's 1 req/sec policy, so a full run takes a few minutes.
 */
import 'dotenv/config';
import { db } from '../src/lib/server/db';
import { jobs } from '../src/lib/server/db/schema';
import { regionOf } from '../src/lib/server/scraper/parse';
import { geocodeAndCache } from '../src/lib/server/cityResolve';
import type { GeoQuery } from '../src/lib/server/geocode';
import { ALL_SEEDS } from './cityLists';

const force = process.argv.includes('--force');

// 1. Cities from the actual job log — guaranteed to match scraped names exactly.
const targets: GeoQuery[] = [];
for (const j of db.select().from(jobs).all()) {
	const game = j.game as 'ets2' | 'ats';
	if (game !== 'ets2' && game !== 'ats') continue;
	let fields: Record<string, string> = {};
	try {
		fields = JSON.parse(j.raw ?? '{}');
	} catch {
		/* ignore malformed raw */
	}
	if (j.fromCity) targets.push({ game, city: j.fromCity, region: regionOf(fields['Origin']) });
	if (j.toCity) targets.push({ game, city: j.toCity, region: regionOf(fields['Destination']) });
}
const fromJobs = targets.length;

// 2. Canonical seed lists per game.
for (const { game, seeds } of ALL_SEEDS) {
	for (const s of seeds) targets.push({ game, city: s.city, region: s.region });
}

console.log(
	`Geocoding up to ${targets.length} targets (${fromJobs} from job log, ${targets.length - fromJobs} from seed lists)` +
		`${force ? ' [--force: refreshing all]' : ''}…`
);

const res = await geocodeAndCache(targets, 'bulk', Date.now(), {
	force,
	onProgress: (msg) => console.log('  ' + msg)
});

console.log(
	`\nDone: ${res.resolved} resolved, ${res.unresolved} not found (negative-cached), ${res.skipped} skipped (already cached).`
);
process.exit(0);
