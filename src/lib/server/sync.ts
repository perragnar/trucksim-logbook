import { db } from './db';
import { snapshots, stats, jobs, profileInfo } from './db/schema';
import { scrape, configFromEnv, type WotConfig } from './scraper/wot';
import { regionOf } from './scraper/parse';
import { geocodeAndCache } from './cityResolve';
import { fetchSteamProgress } from './steam';
import { saveSteamInfo } from './queries';
import type { GeoQuery } from './geocode';
import { sql } from 'drizzle-orm';

/** Max cities to geocode per sync, so a big first import can't stall the request. */
const GEOCODE_PER_SYNC = 25;

export interface SyncOutcome {
	snapshotId: number;
	authenticated: boolean;
	statCount: number;
	jobsScraped: number;
	newJobs: number;
	jobsCapped: boolean;
	/** True when this sync may have missed older jobs that rolled off the site. */
	coverageGap: boolean;
	coverageNote: string | null;
	/** New cities geocoded onto the route map during this sync. */
	citiesGeocoded: number;
	scrapedAt: number;
}

/**
 * Scrape World of Trucks and persist a new snapshot + its stat rows.
 * Shared by the HTTP sync endpoint and the CLI scraper.
 */
export async function runSync(cfg: WotConfig = configFromEnv()): Promise<SyncOutcome> {
	const result = await scrape(cfg);

	const inserted = db
		.insert(snapshots)
		.values({
			scrapedAt: result.scrapedAt,
			profileId: result.profileId,
			authenticated: result.authenticated
		})
		.returning({ id: snapshots.id })
		.get();

	if (result.stats.length) {
		db.insert(stats)
			.values(
				result.stats.map((s) => ({
					snapshotId: inserted.id,
					game: s.game,
					key: s.key,
					label: s.label,
					valueRaw: s.valueRaw,
					valueNum: s.valueNum
				}))
			)
			.run();
	}

	// Upsert the single profile-info row (identity, trucks, achievements).
	db.insert(profileInfo)
		.values({
			id: 1,
			profileId: result.profileId,
			data: JSON.stringify(result.profile),
			updatedAt: result.scrapedAt
		})
		.onConflictDoUpdate({
			target: profileInfo.id,
			set: { profileId: result.profileId, data: JSON.stringify(result.profile), updatedAt: result.scrapedAt }
		})
		.run();

	// How many jobs we already had — used to tell a first-load apart from a gap.
	const priorJobs = db.select({ c: sql<number>`count(*)` }).from(jobs).get()?.c ?? 0;

	// Upsert jobs, deduping on externalId. Count how many were genuinely new.
	let newJobs = 0;
	if (result.jobs.length) {
		const now = Date.now();
		for (const j of result.jobs) {
			const res = db
				.insert(jobs)
				.values({
					externalId: j.externalId,
					game: j.game,
					deliveredAt: j.deliveredAt,
					fromCity: j.fromCity,
					fromCompany: j.fromCompany,
					toCity: j.toCity,
					toCompany: j.toCompany,
					cargo: j.cargo,
					distanceKm: j.distanceKm,
					massT: j.massT,
					takenAt: j.takenAt,
					cargoDamage: j.cargoDamage,
					raw: j.raw,
					firstSeenAt: now
				})
				.onConflictDoNothing({ target: jobs.externalId })
				.run();
			if (res.changes > 0) newJobs++;
		}
	}

	// Backfill route-map coordinates for any newly-seen cities. The region (US
	// state / country) lives in the raw Origin/Destination, stripped from the
	// city columns — recover it here to disambiguate the geocode. Best-effort and
	// bounded so it can't stall the sync; the rest get caught next sync / by build:cities.
	let citiesGeocoded = 0;
	try {
		const targets: GeoQuery[] = [];
		for (const j of result.jobs) {
			const fields = (() => {
				try {
					return JSON.parse(j.raw ?? '{}') as Record<string, string>;
				} catch {
					return {};
				}
			})();
			if (j.fromCity) targets.push({ game: j.game, city: j.fromCity, region: regionOf(fields['Origin']) });
			if (j.toCity) targets.push({ game: j.game, city: j.toCity, region: regionOf(fields['Destination']) });
		}
		const res = await geocodeAndCache(targets, 'geocode', Date.now(), { limit: GEOCODE_PER_SYNC });
		citiesGeocoded = res.resolved;
	} catch {
		// never let geocoding break a sync
	}

	// Best-effort Steam playtime fetch (optional, never breaks a sync).
	try {
		const steam = await fetchSteamProgress();
		if (steam) saveSteamInfo(steam);
	} catch {
		// ignore Steam errors (bad key, private profile, network)
	}

	// Coverage gap: the Log Book was full (capped at ~50) AND none of the scraped
	// jobs overlapped what we already had. With no overlap we can't prove we caught
	// every delivery since last time — older ones may have rolled off unseen.
	const jobsScraped = result.jobs.length;
	const overlap = jobsScraped - newJobs;
	const coverageGap = result.jobsCapped && jobsScraped > 0 && overlap === 0;
	const coverageNote = !coverageGap
		? null
		: priorJobs === 0
			? `First sync captured the latest ${jobsScraped} deliveries — any earlier ones aren't retrievable, since the Log Book only shows the most recent ~50.`
			: `All ${jobsScraped} deliveries in this sync were new with no overlap with stored data — you may have completed more than ~50 jobs since the last sync, so some could have rolled off unseen. Sync more often to avoid gaps.`;

	return {
		snapshotId: inserted.id,
		authenticated: result.authenticated,
		statCount: result.stats.length,
		jobsScraped,
		newJobs,
		jobsCapped: result.jobsCapped,
		coverageGap,
		coverageNote,
		citiesGeocoded,
		scrapedAt: result.scrapedAt
	};
}
