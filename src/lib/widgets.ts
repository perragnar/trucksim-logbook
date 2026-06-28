/**
 * Dashboard widget registry. Each entry is a toggleable, reorderable section on
 * the dashboard; the settings page lists them (drag to prioritise) and the
 * dashboard renders the enabled ones in the saved order. To add a new widget:
 * append an entry here and render its section inside the dashboard's `widget`
 * snippet, guarded by `widgetEnabled(settings.widgets, '<id>')`.
 */
export interface WidgetDef {
	id: string;
	title: string;
	description: string;
	/** Spans the full dashboard width (otherwise it sits in the multi-column grid). */
	wide?: boolean;
	/** Only has data for a single game (hidden on "All"). */
	perGame?: boolean;
}

export const WIDGETS: WidgetDef[] = [
	{ id: 'profile', title: 'Profile', description: 'Identity, avatar and achievement progress.', wide: true },
	{ id: 'current-jobs', title: 'Current jobs', description: 'In-progress contracts with a real-world countdown.', wide: true },
	{ id: 'current-rides', title: 'Current rides', description: 'Your current trucks and their specs.', wide: true },
	{ id: 'deliveries', title: 'Deliveries', description: 'Headline KPIs and cumulative distance/deliveries.', wide: true },
	{ id: 'playtime', title: 'Playtime', description: 'Hours played in ETS2 & ATS (from Steam).' },
	{ id: 'hour-of-day', title: 'When you drive', description: 'Deliveries by hour of day.' },
	{ id: 'activity-calendar', title: 'Activity calendar', description: 'Day-by-day heatmap and streaks.', wide: true },
	{ id: 'coverage', title: 'Region coverage', description: 'States / countries visited.', wide: true, perGame: true },
	{ id: 'geo-reach', title: 'Geographic reach', description: 'Northern/southern/eastern/western extremes.', wide: true, perGame: true },
	{ id: 'recent-activity', title: 'Recent activity', description: 'Last 7 / 30 day delivery counts.' },
	{ id: 'biggest-hauls', title: 'Biggest hauls', description: 'Your longest deliveries.' },
	{ id: 'latest-hauls', title: 'Latest hauls', description: 'Your most recent deliveries.', wide: true },
	{ id: 'game-split', title: 'Game split', description: 'ETS2 vs ATS delivery share (All view only).' },
	{ id: 'delivery-quality', title: 'Delivery quality', description: 'Clean vs damaged and clean streaks.' },
	{ id: 'damaged-cargo', title: 'Most-damaged cargo', description: 'Which cargo gets damaged most.' },
	{ id: 'travel-directions', title: 'Travel directions', description: 'Compass rose of route bearings.' },
	{ id: 'haul-mix', title: 'Haul-length mix', description: 'Short / medium / long haul breakdown.' },
	{ id: 'weekday', title: 'Deliveries by weekday', description: 'Which weekdays you drive most.' },
	{ id: 'top-cargo', title: 'Top cargo', description: 'Most-hauled cargo types.' },
	{ id: 'busiest-routes', title: 'Busiest routes', description: 'Your most-driven city pairs.' },
	{ id: 'top-destinations', title: 'Top destinations', description: 'Most-frequent drop-off cities.' },
	{ id: 'top-pickup', title: 'Top pickup companies', description: 'Most-frequent senders.' },
	{ id: 'top-delivery', title: 'Top delivery companies', description: 'Most-frequent recipients.' },
	{ id: 'game-stats', title: 'Per-game statistics', description: 'Headline WoT stats per game.', wide: true },
	{ id: 'achievements', title: 'World of Trucks achievements', description: 'Earned and locked WoT achievement badges.', wide: true },
	{ id: 'steam-achievements', title: 'Steam achievements', description: 'Steam achievements with real unlock dates.', wide: true },
	{ id: 'trends', title: 'Profile trends', description: 'Stat sparklines across syncs.', wide: true }
];

/** A widget is on unless explicitly disabled (so new widgets default to visible). */
export function widgetEnabled(widgets: Record<string, boolean> | undefined, id: string): boolean {
	return widgets?.[id] !== false;
}

/**
 * The widgets in saved priority order: known ids from `order` first (deduped),
 * then any widgets missing from it (e.g. newly added) appended in registry order.
 */
export function orderedWidgets(order: string[] | undefined): WidgetDef[] {
	const byId = new Map(WIDGETS.map((w) => [w.id, w]));
	const seen = new Set<string>();
	const out: WidgetDef[] = [];
	for (const id of order ?? []) {
		const w = byId.get(id);
		if (w && !seen.has(id)) {
			out.push(w);
			seen.add(id);
		}
	}
	for (const w of WIDGETS) if (!seen.has(w.id)) out.push(w);
	return out;
}
