import type { PageServerLoad } from './$types';
import {
	latestStatsByGame,
	statHistory,
	snapshotCount,
	jobAnalytics,
	regionCoverage,
	getProfileInfo,
	getSteamInfo,
	GAMES
} from '$lib/server/queries';
import euGeo from '$lib/server/geo/europe.json';
import usGeo from '$lib/server/geo/us.json';

const HEADLINE = [
	'jobs_accomplished',
	'total_distance',
	'total_mass_transported',
	'time_on_duty'
];

// WoT region spellings that differ from the Natural Earth / US geo names.
const REGION_ALIAS: Record<string, string> = {
	'Czech Republic': 'Czechia',
	Serbia: 'Republic of Serbia',
	'Türkiye': 'Turkey',
	Turkiye: 'Turkey',
	UK: 'United Kingdom',
	'Great Britain': 'United Kingdom',
	Macedonia: 'North Macedonia'
};

/** Pair a game's visited regions with its geo outline for the coverage choropleth. */
function buildCoverage(
	geo: { regions: { name: string; rings: number[][][] }[] },
	visited: { region: string; count: number }[]
) {
	const counts: Record<string, number> = {};
	for (const v of visited) counts[REGION_ALIAS[v.region] ?? v.region] = v.count;
	const matched = geo.regions.filter((r) => counts[r.name]).length;
	return {
		regions: geo.regions,
		visited: counts,
		count: matched,
		total: geo.regions.length
	};
}

export const load: PageServerLoad = async () => {
	const { snapshot, byGame } = latestStatsByGame();
	const cov = regionCoverage();
	return {
		coverage: {
			ats: buildCoverage(usGeo, cov.ats),
			ets2: buildCoverage(euGeo, cov.ets2)
		},
		snapshot,
		snapshots: snapshotCount(),
		profile: getProfileInfo(),
		steam: getSteamInfo(),
		games: GAMES,
		byGame,
		trends: {
			jobs: statHistory('jobs_accomplished', 'global'),
			distance: statHistory('total_distance', 'global'),
			mass: statHistory('total_mass_transported', 'global')
		},
		analytics: {
			all: jobAnalytics('all'),
			ets2: jobAnalytics('ets2'),
			ats: jobAnalytics('ats')
		},
		headline: HEADLINE
	};
};
