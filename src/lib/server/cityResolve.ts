/**
 * Coordinate resolution for the route map. Two stores, merged here:
 *   1. `cityCoordsCache` DB table — everything geocoded (bulk script + sync backfill).
 *   2. `cityCoords.ts` — hand-curated overrides, which WIN over the geocoded values
 *      so a wrong/auto-placed city can always be corrected by hand.
 *
 * `routeMapData` calls `resolvedCoords(game)` instead of reading the static map
 * directly, so any city you've driven to resolves automatically.
 */
import { eq } from 'drizzle-orm';
import { db } from './db';
import { cityCoordsCache } from './db/schema';
import { cityCoords, type LatLng } from './cityCoords';
import { geocodeCity, sleep, GEOCODE_MIN_INTERVAL_MS, type GeoQuery } from './geocode';

/** Merged city→coord map for a game: geocoded cache, with curated overrides on top. */
export function resolvedCoords(game: 'ets2' | 'ats'): Record<string, LatLng> {
	const out: Record<string, LatLng> = {};
	const rows = db.select().from(cityCoordsCache).where(eq(cityCoordsCache.game, game)).all();
	for (const r of rows) {
		if (r.lat != null && r.lng != null) out[r.city] = { lat: r.lat, lng: r.lng };
	}
	Object.assign(out, cityCoords[game] ?? {}); // curated overrides win
	return out;
}

/** Cities we've already attempted for a game: curated keys + any cache row (incl. negative). */
export function attemptedCities(game: 'ets2' | 'ats'): Set<string> {
	const set = new Set<string>(Object.keys(cityCoords[game] ?? {}));
	for (const r of db
		.select({ city: cityCoordsCache.city })
		.from(cityCoordsCache)
		.where(eq(cityCoordsCache.game, game))
		.all())
		set.add(r.city);
	return set;
}

/** Insert or update one geocoded result (a null coord becomes a negative-cache row). */
export function upsertCityCoord(
	game: 'ets2' | 'ats',
	city: string,
	region: string | null,
	coord: LatLng | null,
	source: 'geocode' | 'bulk',
	now: number
) {
	db.insert(cityCoordsCache)
		.values({
			game,
			city,
			region,
			lat: coord?.lat ?? null,
			lng: coord?.lng ?? null,
			source,
			resolvedAt: now
		})
		.onConflictDoUpdate({
			target: [cityCoordsCache.game, cityCoordsCache.city],
			set: { region, lat: coord?.lat ?? null, lng: coord?.lng ?? null, source, resolvedAt: now }
		})
		.run();
}

/**
 * Geocode a batch of city targets sequentially (respecting the rate limit) and
 * cache each result. Skips anything already attempted unless `force`. Returns
 * how many were newly resolved vs. left unresolved. Never throws — geocoding is
 * best-effort and must not break a sync.
 */
export async function geocodeAndCache(
	targets: GeoQuery[],
	source: 'geocode' | 'bulk',
	now: number,
	opts: { force?: boolean; limit?: number; onProgress?: (msg: string) => void } = {}
): Promise<{ resolved: number; unresolved: number; skipped: number }> {
	const seen = new Set<string>();
	// Snapshot already-attempted cities per game once, so we don't re-query the DB per target.
	const attempted = new Map<'ets2' | 'ats', Set<string>>();
	const attemptedFor = (game: 'ets2' | 'ats') => {
		let set = attempted.get(game);
		if (!set) {
			set = attemptedCities(game);
			attempted.set(game, set);
		}
		return set;
	};
	let resolved = 0;
	let unresolved = 0;
	let skipped = 0;
	let processed = 0;

	for (const t of targets) {
		if (!t.city) continue;
		const dedupeKey = `${t.game}|${t.city}`;
		if (seen.has(dedupeKey)) continue;
		seen.add(dedupeKey);

		if (!opts.force && attemptedFor(t.game).has(t.city)) {
			skipped++;
			continue;
		}

		if (opts.limit != null && processed >= opts.limit) {
			skipped++;
			continue;
		}

		if (processed > 0) await sleep(GEOCODE_MIN_INTERVAL_MS);
		const coord = await geocodeCity(t);
		processed++;
		upsertCityCoord(t.game, t.city, t.region ?? null, coord, source, now);
		if (coord) resolved++;
		else unresolved++;
		opts.onProgress?.(
			`${coord ? '✓' : '·'} ${t.city}${t.region ? ` (${t.region})` : ''}${coord ? ` → ${coord.lat},${coord.lng}` : ' — not found'}`
		);
	}

	return { resolved, unresolved, skipped };
}
