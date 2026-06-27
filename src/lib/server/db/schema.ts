import { sqliteTable, integer, text, real, index, unique } from 'drizzle-orm/sqlite-core';

/**
 * A scrape run. Each run produces one snapshot, which fans out into many
 * `stat` rows (one per game x metric). Keeping a row per run lets the
 * dashboard plot any metric over time.
 */
export const snapshots = sqliteTable('snapshots', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	scrapedAt: integer('scraped_at').notNull(), // unix ms
	profileId: text('profile_id').notNull(),
	authenticated: integer('authenticated', { mode: 'boolean' }).notNull().default(false)
});

/**
 * A single statistic value within a snapshot.
 * game: 'ets2' | 'ats' | 'global'. key: machine slug (e.g. 'jobs_accomplished').
 * valueNum is the parsed numeric value (km, tons, minutes, count) for charting;
 * valueRaw is the original text as shown on the site.
 */
export const stats = sqliteTable(
	'stats',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		snapshotId: integer('snapshot_id')
			.notNull()
			.references(() => snapshots.id, { onDelete: 'cascade' }),
		game: text('game').notNull(),
		key: text('key').notNull(),
		label: text('label').notNull(),
		valueRaw: text('value_raw').notNull(),
		valueNum: real('value_num')
	},
	(t) => [index('stats_snapshot_idx').on(t.snapshotId), index('stats_key_idx').on(t.key, t.game)]
);

/**
 * A delivered job / external contract from the logged-in "My Page" logbook.
 * externalId dedupes across scrapes. Only populated when credentials are set
 * and the logbook is reachable.
 */
export const jobs = sqliteTable(
	'jobs',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		externalId: text('external_id'),
		game: text('game').notNull(),
		deliveredAt: integer('delivered_at'), // unix ms, if known
		fromCity: text('from_city'),
		fromCompany: text('from_company'),
		toCity: text('to_city'),
		toCompany: text('to_company'),
		cargo: text('cargo'),
		distanceKm: real('distance_km'),
		massT: real('mass_t'),
		takenAt: integer('taken_at'), // unix ms pickup time ("Taken"), if known
		cargoDamage: text('cargo_damage'), // e.g. "None", "5 %"
		revenue: real('revenue'),
		raw: text('raw'), // original HTML/text fragment for debugging
		firstSeenAt: integer('first_seen_at').notNull()
	},
	(t) => [unique('jobs_external_uq').on(t.externalId), index('jobs_game_idx').on(t.game)]
);

/**
 * Favorite routes. Either saved from a logged job (source='job', jobId set)
 * or hand-entered (source='custom').
 */
export const favoriteRoutes = sqliteTable('favorite_routes', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	source: text('source').notNull().default('custom'), // 'custom' | 'job'
	jobId: integer('job_id').references(() => jobs.id, { onDelete: 'set null' }),
	game: text('game'),
	fromCity: text('from_city').notNull(),
	fromCompany: text('from_company'),
	toCity: text('to_city').notNull(),
	toCompany: text('to_company'),
	cargo: text('cargo'),
	truck: text('truck'),
	notes: text('notes'),
	createdAt: integer('created_at').notNull()
});

/**
 * Latest profile identity, current trucks and achievements, kept as a single
 * upserted row (id = 1). Stored as JSON since it's display-only current state.
 */
export const profileInfo = sqliteTable('profile_info', {
	id: integer('id').primaryKey(),
	profileId: text('profile_id').notNull(),
	data: text('data').notNull(),
	updatedAt: integer('updated_at').notNull()
});

/**
 * Geocoded real-world coordinates for cities seen in the job log, keyed by
 * (game, city). Populated two ways: the `build:cities` bulk script and the
 * on-demand backfill during sync. A row with null lat/lng is a NEGATIVE cache
 * — the geocoder couldn't place that name — so we don't re-query it every sync.
 * The hand-curated `cityCoords.ts` map overrides anything here (see cityResolve).
 */
export const cityCoordsCache = sqliteTable(
	'city_coords',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		game: text('game').notNull(), // 'ets2' | 'ats'
		city: text('city').notNull(), // exact scraped name, region stripped
		region: text('region'), // US state (ATS) / country (ETS2) used to disambiguate
		lat: real('lat'), // null = geocoded but not found (negative cache)
		lng: real('lng'),
		source: text('source').notNull().default('geocode'), // 'geocode' | 'bulk'
		resolvedAt: integer('resolved_at').notNull()
	},
	(t) => [unique('city_coords_uq').on(t.game, t.city)]
);

/**
 * App-wide settings, kept as a single upserted row (id = 1). `theme` is the
 * accent preset; `widgets` is a JSON map of widget-id → enabled.
 */
export const appSettings = sqliteTable('app_settings', {
	id: integer('id').primaryKey(),
	theme: text('theme').notNull().default('default'),
	widgets: text('widgets'), // JSON: Record<string, boolean>
	widgetOrder: text('widget_order'), // JSON: string[] of widget ids in priority order
	updatedAt: integer('updated_at').notNull()
});

/** Latest Steam playtime, single upserted row (id = 1). Stored as JSON. */
export const steamInfo = sqliteTable('steam_info', {
	id: integer('id').primaryKey(),
	data: text('data').notNull(),
	updatedAt: integer('updated_at').notNull()
});

export type Snapshot = typeof snapshots.$inferSelect;
export type Stat = typeof stats.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type FavoriteRoute = typeof favoriteRoutes.$inferSelect;
export type CityCoordRow = typeof cityCoordsCache.$inferSelect;
