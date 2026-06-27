/**
 * App-wide game filter (All / ETS2 / ATS), shown as a toggle in the header and
 * read by the dashboard and logs pages. Kept as a single shared rune so every
 * page reacts to the same selection. Persistence is wired up in +layout.svelte
 * (after hydration, to avoid an SSR mismatch).
 */
export type GameFilter = 'all' | 'ets2' | 'ats';

// `flag` is a country/region code rendered as a flag image (flagcdn.com).
export const GAME_FILTERS: { key: GameFilter; label: string; flag?: string }[] = [
	{ key: 'all', label: 'All' },
	{ key: 'ets2', label: 'ETS2', flag: 'eu' },
	{ key: 'ats', label: 'ATS', flag: 'us' }
];

export const GAME_FILTER_KEY = 'trucksim-game-filter';

class GameFilterState {
	current = $state<GameFilter>('all');
}

export const gameFilter = new GameFilterState();
