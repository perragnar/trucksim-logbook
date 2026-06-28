import { db } from './db';
import {
	snapshots,
	stats,
	jobs,
	favoriteRoutes,
	profileInfo,
	appSettings,
	steamInfo,
	type Stat
} from './db/schema';
import type { SteamProgress } from './steam';
import { desc, eq, and, asc } from 'drizzle-orm';
import type { Game } from './scraper/parse';
import { regionOf } from './scraper/parse';
import { regionCode } from './regionCodes';
import { resolvedCoords } from './cityResolve';
import type { LatLng } from './cityCoords';

export const GAMES: { key: Game; label: string }[] = [
	{ key: 'ets2', label: 'Euro Truck Simulator 2' },
	{ key: 'ats', label: 'American Truck Simulator' },
	{ key: 'global', label: 'Global' }
];

import type { ProfileMeta } from './scraper/parse';

/** Latest scraped profile identity, trucks and achievements (or null). */
export function getProfileInfo(): ProfileMeta | null {
	const row = db.select().from(profileInfo).where(eq(profileInfo.id, 1)).get();
	if (!row) return null;
	try {
		return JSON.parse(row.data) as ProfileMeta;
	} catch {
		return null;
	}
}

export function latestSnapshot() {
	return db.select().from(snapshots).orderBy(desc(snapshots.scrapedAt)).limit(1).get();
}

export function snapshotCount() {
	return db.select().from(snapshots).all().length;
}

/** Stats for the most recent snapshot, grouped by game (site order preserved). */
export function latestStatsByGame() {
	const snap = latestSnapshot();
	const byGame: Record<string, Stat[]> = {};
	if (!snap) return { snapshot: null, byGame };
	const rows = db
		.select()
		.from(stats)
		.where(eq(stats.snapshotId, snap.id))
		.orderBy(asc(stats.id))
		.all();
	for (const r of rows) (byGame[r.game] ??= []).push(r);
	return { snapshot: snap, byGame };
}

/** Time series of a single metric for charting: [{ t, value, raw }]. */
export function statHistory(key: string, game: Game) {
	return db
		.select({
			t: snapshots.scrapedAt,
			value: stats.valueNum,
			raw: stats.valueRaw
		})
		.from(stats)
		.innerJoin(snapshots, eq(stats.snapshotId, snapshots.id))
		.where(and(eq(stats.key, key), eq(stats.game, game)))
		.orderBy(asc(snapshots.scrapedAt))
		.all();
}

export function allSnapshots() {
	return db.select().from(snapshots).orderBy(desc(snapshots.scrapedAt)).all();
}

/**
 * One row per snapshot with selected global metrics inlined, for the Logs view.
 * Returns newest first.
 */
export function snapshotLog() {
	const snaps = allSnapshots();
	return snaps.map((snap) => {
		const rows = db
			.select({ key: stats.key, valueRaw: stats.valueRaw })
			.from(stats)
			.where(and(eq(stats.snapshotId, snap.id), eq(stats.game, 'global')))
			.all();
		const pick = (k: string) => rows.find((r) => r.key === k)?.valueRaw ?? '—';
		return {
			...snap,
			jobs: pick('jobs_accomplished'),
			distance: pick('total_distance'),
			mass: pick('total_mass_transported'),
			statCount: rows.length
		};
	});
}

export function allJobs() {
	return db.select().from(jobs).orderBy(desc(jobs.deliveredAt)).all();
}

/** Distance normalised to km (ATS reports miles), for combined charts. */
// Distances are stored normalised to km (see distanceToKm in the parser).
const jobKm = (j: { distanceKm: number | null }) => j.distanceKm ?? 0;

export type LabelValue = { label: string; value: number };
export type GameFilter = 'all' | 'ets2' | 'ats';

/** Parse a WoT job's stored raw JSON fields, or {} if missing/bad. */
function rawFields(raw: string | null): Record<string, string> {
	if (!raw) return {};
	try {
		return JSON.parse(raw) as Record<string, string>;
	} catch {
		return {};
	}
}

/** The US state (ATS) / country (ETS2) for each end of a job, from its raw fields. */
function jobRegions(raw: string | null): string[] {
	const f = rawFields(raw);
	return [regionOf(f['Origin']), regionOf(f['Destination'])].filter(Boolean);
}

/** Delivery duration in minutes from Taken → Completed, or null if not parseable. */
function jobDurationMin(raw: string | null): number | null {
	const f = rawFields(raw);
	const when = (s: unknown) => (typeof s === 'string' ? Date.parse(s.replace(/\s+at\s+/i, ' ')) : NaN);
	const a = when(f['Taken']);
	const b = when(f['Completed']);
	return Number.isFinite(a) && Number.isFinite(b) && b > a ? (b - a) / 60000 : null;
}

const COMPASS8 = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
/** Initial great-circle bearing a→b in degrees (0 = north, clockwise). */
function bearing(a: LatLng, b: LatLng): number {
	const toRad = (d: number) => (d * Math.PI) / 180;
	const φ1 = toRad(a.lat);
	const φ2 = toRad(b.lat);
	const Δλ = toRad(b.lng - a.lng);
	const y = Math.sin(Δλ) * Math.cos(φ2);
	const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
	return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
}

/** A cargo is "clean" if delivered with no damage. */
function isClean(raw: string | null): boolean {
	if (!raw) return true;
	let damage = '';
	try {
		damage = (JSON.parse(raw)['Cargo Damage'] ?? '').toString().trim();
	} catch {
		return true;
	}
	return damage === '' || /^none$/i.test(damage) || /^0([.,]0+)?\s*%?$/.test(damage);
}

/**
 * Aggregate analytics over the captured job log, for the dashboard widgets.
 * `game` filters the set. Distances are stored in km, so everything is in km.
 */
export function jobAnalytics(game: GameFilter = 'all') {
	const all = allJobs().filter((j) => game === 'all' || j.game === game);
	if (!all.length) return null;

	const unit = 'km';
	const dist = (j: (typeof all)[number]) => j.distanceKm ?? 0;

	const timed = all
		.filter((j) => j.deliveredAt != null)
		.sort((a, b) => (a.deliveredAt ?? 0) - (b.deliveredAt ?? 0));

	let cumJobs = 0;
	let cumDist = 0;
	const cumulative = timed.map((j) => {
		cumJobs += 1;
		cumDist += dist(j);
		return { t: j.deliveredAt as number, jobs: cumJobs, dist: Math.round(cumDist) };
	});

	const split: Record<string, { count: number; dist: number; mass: number }> = {};
	for (const j of all) {
		const s = (split[j.game] ??= { count: 0, dist: 0, mass: 0 });
		s.count += 1;
		s.dist += jobKm(j);
		s.mass += j.massT ?? 0;
	}

	const tally = (keyFn: (j: (typeof all)[number]) => string | null): LabelValue[] => {
		const m = new Map<string, number>();
		for (const j of all) {
			const k = keyFn(j);
			if (!k) continue;
			m.set(k, (m.get(k) ?? 0) + 1);
		}
		return [...m.entries()]
			.map(([label, value]) => ({ label, value }))
			.sort((a, b) => b.value - a.value);
	};

	const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const wd = new Array(7).fill(0);
	for (const j of timed) wd[new Date(j.deliveredAt as number).getDay()] += 1;
	const weekdays = [1, 2, 3, 4, 5, 6, 0].map((d) => ({ label: dayNames[d], value: wd[d] }));

	// Hour-of-day distribution (0 = midnight hour, 23 = 11pm hour).
	const hr = new Array(24).fill(0);
	for (const j of timed) hr[new Date(j.deliveredAt as number).getHours()] += 1;
	const byHour = hr.map((value, h) => ({ label: String(h).padStart(2, '0'), value }));

	// Clean-delivery rate.
	const cleanCount = all.filter((j) => isClean(j.raw)).length;
	const cleanRate = Math.round((cleanCount / all.length) * 100);

	// Haul-length mix — thresholds in km.
	const edges = [100, 300, 600];
	const haulLabels = [
		`< ${edges[0]} ${unit}`,
		`${edges[0]}–${edges[1]} ${unit}`,
		`${edges[1]}–${edges[2]} ${unit}`,
		`${edges[2]}+ ${unit}`
	];
	const haulCounts = [0, 0, 0, 0];
	for (const j of all) {
		const d = dist(j);
		const b = d < edges[0] ? 0 : d < edges[1] ? 1 : d < edges[2] ? 2 : 3;
		haulCounts[b] += 1;
	}
	const haul = haulLabels.map((label, i) => ({ label, value: haulCounts[i] }));

	const totalDist = Math.round(cumDist);
	const totalMass = Math.round(all.reduce((s, j) => s + (j.massT ?? 0), 0));

	// Compact summary of a job for the haul lists (Biggest / Latest).
	const summarize = (j: (typeof all)[number]) => {
		const f = rawFields(j.raw);
		return {
			game: j.game,
			from: j.fromCity,
			fromCode: regionCode(j.game, regionOf(f['Origin'])),
			to: j.toCity,
			toCode: regionCode(j.game, regionOf(f['Destination'])),
			cargo: j.cargo,
			dist: Math.round(dist(j)),
			mass: j.massT,
			when: j.deliveredAt
		};
	};

	// Biggest hauls — top 5 by distance.
	const biggest = [...all].sort((a, b) => dist(b) - dist(a)).slice(0, 5).map(summarize);

	// Latest hauls — most recent deliveries by completion time.
	const latest = all
		.filter((j) => j.deliveredAt != null)
		.sort((a, b) => (b.deliveredAt as number) - (a.deliveredAt as number))
		.slice(0, 5)
		.map(summarize);

	// Average delivery time, from each job's Taken → Completed timestamps.
	let durSum = 0;
	let durCount = 0;
	for (const j of all) {
		const m = jobDurationMin(j.raw);
		if (m != null) {
			durSum += m;
			durCount += 1;
		}
	}
	const avgDurationMin = durCount ? Math.round(durSum / durCount) : null;

	// Recent activity windows (relative to now).
	const now = Date.now();
	const DAY = 86_400_000;
	const windowAgg = (fromMs: number, toMs: number) => {
		let c = 0;
		let d = 0;
		for (const j of timed) {
			const t = j.deliveredAt as number;
			if (t >= fromMs && t < toMs) {
				c += 1;
				d += dist(j);
			}
		}
		return { count: c, dist: Math.round(d) };
	};
	const recent = {
		last7: windowAgg(now - 7 * DAY, now + 1),
		prev7: windowAgg(now - 14 * DAY, now - 7 * DAY),
		last30: windowAgg(now - 30 * DAY, now + 1)
	};

	// Per-game coordinate lookups, so we can place each job by its own game's map.
	const coordMaps: Record<string, Record<string, LatLng>> = {
		ets2: resolvedCoords('ets2'),
		ats: resolvedCoords('ats')
	};
	const coordOf = (g: string, city: string | null): LatLng | undefined =>
		city ? coordMaps[g]?.[city] : undefined;

	// Compass rose — 8-point distribution of travel bearings (origin → destination).
	const rose = new Array(8).fill(0);
	for (const j of all) {
		const a = coordOf(j.game, j.fromCity);
		const b = coordOf(j.game, j.toCity);
		if (!a || !b) continue;
		rose[Math.round(bearing(a, b) / 45) % 8] += 1;
	}
	const compass = COMPASS8.map((label, i) => ({ label, value: rose[i] }));

	// Geographic extremes — the corner cities of everywhere you've been.
	const pts: { city: string; lat: number; lng: number }[] = [];
	const seenCity = new Set<string>();
	for (const j of all)
		for (const city of [j.fromCity, j.toCity]) {
			const c = coordOf(j.game, city);
			if (!c || !city || seenCity.has(`${j.game}|${city}`)) continue;
			seenCity.add(`${j.game}|${city}`);
			pts.push({ city, lat: c.lat, lng: c.lng });
		}
	let geoExtremes = null;
	if (pts.length >= 2) {
		const by = (sel: (p: (typeof pts)[number]) => number, max: boolean) =>
			pts.reduce((best, p) => {
				const better = max ? sel(p) > sel(best) : sel(p) < sel(best);
				return better ? p : best;
			}, pts[0]);
		const north = by((p) => p.lat, true);
		const south = by((p) => p.lat, false);
		const east = by((p) => p.lng, true);
		const west = by((p) => p.lng, false);
		const meanLat = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
		const latSpanKm = Math.round((north.lat - south.lat) * 111);
		const lngSpanKm = Math.round((east.lng - west.lng) * 111 * Math.cos((meanLat * Math.PI) / 180));
		geoExtremes = { north, south, east, west, latSpanKm, lngSpanKm, cityCount: pts.length };
	}

	// Damage — clean streak (chronological) + which cargo gets damaged most.
	let curCleanStreak = 0;
	let longestCleanStreak = 0;
	let run = 0;
	for (const j of timed) {
		if (isClean(j.raw)) {
			run += 1;
			longestCleanStreak = Math.max(longestCleanStreak, run);
		} else run = 0;
	}
	curCleanStreak = run; // trailing run = current streak
	const damageMap = new Map<string, number>();
	for (const j of all)
		if (!isClean(j.raw) && j.cargo) damageMap.set(j.cargo, (damageMap.get(j.cargo) ?? 0) + 1);
	const damageByCargo = [...damageMap.entries()]
		.map(([label, value]) => ({ label, value }))
		.sort((a, b) => b.value - a.value)
		.slice(0, 6);

	// Calendar heatmap + day streaks (local dates).
	const pad = (n: number) => String(n).padStart(2, '0');
	const dayKey = (ms: number) => {
		const dt = new Date(ms);
		return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
	};
	const dayCounts = new Map<string, number>();
	for (const j of timed) {
		const k = dayKey(j.deliveredAt as number);
		dayCounts.set(k, (dayCounts.get(k) ?? 0) + 1);
	}
	const calDays = [...dayCounts.entries()]
		.map(([date, count]) => ({ date, count }))
		.sort((a, b) => a.date.localeCompare(b.date));
	const maxDayCount = calDays.reduce((m, d) => Math.max(m, d.count), 0);
	// Day-number (UTC midnight) of each active day, for consecutiveness.
	const dayNums = calDays.map((d) => Math.round(Date.parse(d.date) / DAY)).sort((a, b) => a - b);
	let longestDayStreak = 0;
	let r2 = 0;
	for (let i = 0; i < dayNums.length; i++) {
		r2 = i > 0 && dayNums[i] === dayNums[i - 1] + 1 ? r2 + 1 : 1;
		longestDayStreak = Math.max(longestDayStreak, r2);
	}
	// Current streak counts back from today (or yesterday).
	const todayNum = Math.round(Date.parse(dayKey(now)) / DAY);
	const activeSet = new Set(dayNums);
	let currentDayStreak = 0;
	let cursor = activeSet.has(todayNum) ? todayNum : todayNum - 1;
	while (activeSet.has(cursor)) {
		currentDayStreak += 1;
		cursor -= 1;
	}
	const calendar = {
		days: calDays,
		maxCount: maxDayCount,
		activeDays: calDays.length,
		currentDayStreak,
		longestDayStreak
	};

	return {
		game,
		unit,
		count: all.length,
		cumulative,
		split,
		topCargo: tally((j) => j.cargo).slice(0, 8),
		topDestinations: tally((j) => j.toCity).slice(0, 8),
		topRoutes: tally((j) => (j.fromCity && j.toCity ? `${j.fromCity} → ${j.toCity}` : null)).slice(0, 8),
		topPickup: tally((j) => j.fromCompany).slice(0, 8),
		topDelivery: tally((j) => j.toCompany).slice(0, 8),
		weekdays,
		byHour,
		haul,
		biggest,
		latest,
		recent,
		avgDurationMin,
		cleanRate,
		cleanCount,
		damagedCount: all.length - cleanCount,
		totalDist,
		totalMass,
		avgDist: Math.round(cumDist / all.length),
		longestDist: Math.round(Math.max(...all.map(dist))),
		compass,
		geoExtremes,
		damage: { currentCleanStreak: curCleanStreak, longestCleanStreak, byCargo: damageByCargo },
		calendar
	};
}

/**
 * Per-game region coverage: how many distinct US states (ATS) / countries (ETS2)
 * you've delivered in, with a visit count each. The page pairs this with the geo
 * region list to draw the coverage choropleth and a "12 / 48" stat.
 */
export function regionCoverage() {
	const out: Record<'ets2' | 'ats', Map<string, number>> = { ets2: new Map(), ats: new Map() };
	for (const j of allJobs()) {
		if (j.game !== 'ets2' && j.game !== 'ats') continue;
		for (const region of jobRegions(j.raw)) {
			const m = out[j.game];
			m.set(region, (m.get(region) ?? 0) + 1);
		}
	}
	const ser = (m: Map<string, number>) =>
		[...m.entries()].map(([region, count]) => ({ region, count })).sort((a, b) => b.count - a.count);
	return { ets2: ser(out.ets2), ats: ser(out.ats) };
}

/**
 * Build route-map data for a game: cities (with visit counts + coordinates) and
 * the edges between them (with frequency). Cities without known coordinates are
 * reported in `missing` so they can be flagged rather than silently dropped.
 */
export function routeMapData(game: 'ets2' | 'ats') {
	const coords = resolvedCoords(game);
	const jobs = allJobs().filter((j) => j.game === game);

	const unit = 'km';
	const visits = new Map<string, number>();
	const edges = new Map<string, { count: number; dist: number }>();
	const missing = new Set<string>();

	for (const j of jobs) {
		const from = j.fromCity;
		const to = j.toCity;
		for (const c of [from, to]) if (c && !coords[c]) missing.add(c);
		if (!from || !to || !coords[from] || !coords[to]) continue;
		visits.set(from, (visits.get(from) ?? 0) + 1);
		visits.set(to, (visits.get(to) ?? 0) + 1);
		const key = `${from}||${to}`;
		const e = edges.get(key) ?? { count: 0, dist: 0 };
		e.count += 1;
		e.dist += j.distanceKm ?? 0;
		edges.set(key, e);
	}

	const cities = [...visits].map(([name, count]) => ({
		name,
		visits: count,
		...coords[name]
	}));
	const edgeList = [...edges].map(([k, v]) => {
		const [from, to] = k.split('||');
		return { from, to, count: v.count, dist: Math.round(v.dist) };
	});

	return { cities, edges: edgeList, missing: [...missing], unit };
}

export function allFavorites() {
	return db.select().from(favoriteRoutes).orderBy(desc(favoriteRoutes.createdAt)).all();
}

export interface RouteInput {
	game?: string | null;
	fromCity: string;
	fromCompany?: string | null;
	toCity: string;
	toCompany?: string | null;
	cargo?: string | null;
	truck?: string | null;
	notes?: string | null;
	source?: string;
	jobId?: number | null;
}

export function addFavorite(input: RouteInput) {
	return db
		.insert(favoriteRoutes)
		.values({
			source: input.source ?? 'custom',
			jobId: input.jobId ?? null,
			game: input.game ?? null,
			fromCity: input.fromCity,
			fromCompany: input.fromCompany ?? null,
			toCity: input.toCity,
			toCompany: input.toCompany ?? null,
			cargo: input.cargo ?? null,
			truck: input.truck ?? null,
			notes: input.notes ?? null,
			createdAt: Date.now()
		})
		.returning({ id: favoriteRoutes.id })
		.get();
}

export function updateFavoriteNotes(id: number, notes: string | null) {
	db.update(favoriteRoutes).set({ notes }).where(eq(favoriteRoutes.id, id)).run();
}

export function deleteFavorite(id: number) {
	db.delete(favoriteRoutes).where(eq(favoriteRoutes.id, id)).run();
}

export function getSteamInfo(): SteamProgress | null {
	const row = db.select().from(steamInfo).where(eq(steamInfo.id, 1)).get();
	if (!row) return null;
	try {
		return JSON.parse(row.data) as SteamProgress;
	} catch {
		return null;
	}
}

export function saveSteamInfo(progress: SteamProgress) {
	const data = JSON.stringify(progress);
	db.insert(steamInfo)
		.values({ id: 1, data, updatedAt: progress.fetchedAt })
		.onConflictDoUpdate({ target: steamInfo.id, set: { data, updatedAt: progress.fetchedAt } })
		.run();
}

export interface AppSettings {
	theme: string;
	widgets: Record<string, boolean>;
	order: string[];
}

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
	if (!raw) return fallback;
	try {
		return JSON.parse(raw) as T;
	} catch {
		return fallback;
	}
}

export function getAppSettings(): AppSettings {
	const row = db.select().from(appSettings).where(eq(appSettings.id, 1)).get();
	return {
		theme: row?.theme ?? 'default',
		widgets: parseJson<Record<string, boolean>>(row?.widgets, {}),
		order: parseJson<string[]>(row?.widgetOrder, [])
	};
}

export function saveAppSettings(input: Partial<AppSettings>): AppSettings {
	const cur = getAppSettings();
	const next: AppSettings = {
		theme: input.theme ?? cur.theme,
		widgets: input.widgets ?? cur.widgets,
		order: input.order ?? cur.order
	};
	const now = Date.now();
	const values = {
		theme: next.theme,
		widgets: JSON.stringify(next.widgets),
		widgetOrder: JSON.stringify(next.order),
		updatedAt: now
	};
	db.insert(appSettings)
		.values({ id: 1, ...values })
		.onConflictDoUpdate({ target: appSettings.id, set: values })
		.run();
	return next;
}
