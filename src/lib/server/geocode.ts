/**
 * Real-world geocoding for the cities that appear in the job log, via the public
 * OpenStreetMap Nominatim service. ETS2 / ATS city names are real places, so a
 * name + region lookup resolves almost all of them. The region (US state for
 * ATS, country for ETS2) is the disambiguator that keeps the Springfields apart.
 *
 * Nominatim usage policy: max 1 request/second and a meaningful User-Agent. The
 * callers (sync backfill, build:cities) drive the loop and must `await sleep`
 * between calls — see GEOCODE_MIN_INTERVAL_MS.
 */
import type { LatLng } from './cityCoords';

export const GEOCODE_MIN_INTERVAL_MS = 1100;

const ENDPOINT = 'https://nominatim.openstreetmap.org/search';
// Nominatim requires an identifying UA; let it be overridable but default to the app.
const USER_AGENT =
	process.env.GEOCODER_UA ?? 'trucksim-logbook/1.0 (https://github.com/, personal use)';

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export interface GeoQuery {
	city: string;
	region?: string; // US state (ats) or country (ets2)
	game: 'ets2' | 'ats';
}

/**
 * Resolve one city to coordinates. Returns null when the service has no match
 * (caller should negative-cache that so it isn't retried every sync).
 */
export async function geocodeCity({ city, region, game }: GeoQuery): Promise<LatLng | null> {
	if (!city) return null;
	const params = new URLSearchParams({ format: 'json', limit: '1', city });
	if (game === 'ats') {
		params.set('country', 'USA');
		if (region) params.set('state', region);
	} else if (region) {
		params.set('country', region);
	}

	let res: Response;
	try {
		res = await fetch(`${ENDPOINT}?${params}`, {
			headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en' }
		});
	} catch {
		return null; // network blip — treat as "not resolved", don't crash the sync
	}
	if (!res.ok) return null;

	const hits = (await res.json()) as Array<{ lat: string; lon: string }>;
	const hit = hits[0];
	if (!hit) return null;
	const lat = Number(hit.lat);
	const lng = Number(hit.lon);
	if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
	return { lat: Math.round(lat * 100) / 100, lng: Math.round(lng * 100) / 100 };
}
