/**
 * Regenerate the map outline data in src/lib/server/geo/ from public Natural
 * Earth / Leaflet GeoJSON. Run when you want to refresh or widen the regions:
 *   npm run build:geo
 *
 * Output per file:
 *   { rings: [number,number][][],            // flat list of all exterior rings (RouteMap background)
 *     regions: [{ name, rings }] }            // per-state / per-country, for the coverage choropleth
 * Coordinates are [lng,lat] rounded to 2 decimals. The RouteMap / CoverageMap
 * project these with the same transform as the city dots, so they line up.
 */
import { writeFileSync, mkdirSync } from 'node:fs';

type Ring = [number, number][];
const round = (n: number) => Math.round(n * 100) / 100;

async function fetchJson(url: string) {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`${res.status} fetching ${url}`);
	return res.json();
}

// Exterior rings only (skip holes), rounded + consecutive-dedup, min 4 points.
function ringsOf(geom: any): Ring[] {
	const polys =
		geom.type === 'Polygon' ? [geom.coordinates] : geom.type === 'MultiPolygon' ? geom.coordinates : [];
	const out: Ring[] = [];
	for (const poly of polys) {
		const r: Ring = [];
		let prev = '';
		for (const [lng, lat] of poly[0]) {
			const p: [number, number] = [round(lng), round(lat)];
			const key = p[0] + ',' + p[1];
			if (key !== prev) {
				r.push(p);
				prev = key;
			}
		}
		if (r.length >= 4) out.push(r);
	}
	return out;
}

const inBox = (lng: number, lat: number, b: number[]) =>
	lng >= b[0] && lng <= b[1] && lat >= b[2] && lat <= b[3];
function featureInBox(f: any, box: number[]): boolean {
	const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
	for (const poly of polys) for (const [lng, lat] of poly[0]) if (inBox(lng, lat, box)) return true;
	return false;
}

interface Region {
	name: string;
	rings: Ring[];
}
// Bundle a set of named features into { rings (flat), regions } and write it.
function writeGeo(path: string, named: { name: string; geometry: any }[]) {
	const regions: Region[] = named
		.map((f) => ({ name: f.name, rings: ringsOf(f.geometry) }))
		.filter((r) => r.name && r.rings.length);
	const rings: Ring[] = regions.flatMap((r) => r.rings);
	writeFileSync(path, JSON.stringify({ rings, regions }));
	return regions.length;
}

mkdirSync('src/lib/server/geo', { recursive: true });

// US states (already lon/lat). properties.name = state name.
const us = await fetchJson(
	'https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json'
);
const usCount = writeGeo(
	'src/lib/server/geo/us.json',
	us.features.map((f: any) => ({ name: f.properties?.name, geometry: f.geometry }))
);

// Europe from world countries, filtered to a bounding box. ADMIN = country name.
const world = await fetchJson(
	'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson'
);
const euBox = [-15, 40, 34, 72]; // [minLng, maxLng, minLat, maxLat]
const euCount = writeGeo(
	'src/lib/server/geo/europe.json',
	world.features
		.filter((f: any) => featureInBox(f, euBox))
		.map((f: any) => ({ name: f.properties?.ADMIN ?? f.properties?.NAME, geometry: f.geometry }))
);

console.log(`US states: ${usCount}, Europe countries: ${euCount}`);
