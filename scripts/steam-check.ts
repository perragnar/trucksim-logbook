/**
 * Probe the Steam Web API for ETS2/ATS so you can see exactly what it exposes.
 * Prints playtime, unlocked-achievement counts (with the schema size), and the
 * stat schema (the counters GetUserStatsForGame can return).
 * Usage: set STEAM_API_KEY + STEAM_ID in .env, then: npx tsx scripts/steam-check.ts
 */
import 'dotenv/config';
import { STEAM_APPS, steamConfigFromEnv } from '../src/lib/server/steam';

const { apiKey, steamId } = steamConfigFromEnv();
if (!apiKey || !steamId) {
	console.error('Set STEAM_API_KEY and STEAM_ID in .env first.');
	process.exit(1);
}

const BASE = 'https://api.steampowered.com';
const get = async (path: string, params: Record<string, string>) => {
	const url = new URL(BASE + path);
	url.searchParams.set('key', apiKey);
	for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
	const res = await fetch(url);
	if (!res.ok) throw new Error(`${path} → ${res.status}`);
	return res.json();
};

(async () => {
	// Playtime
	const owned = await get('/IPlayerService/GetOwnedGames/v1/', {
		steamid: steamId,
		include_appinfo: 'true',
		include_played_free_games: 'true'
	});
	const games = new Map<number, { name?: string; playtime_forever?: number; playtime_2weeks?: number }>(
		(owned?.response?.games ?? []).map((g: { appid: number }) => [g.appid, g])
	);

	for (const [game, appid] of Object.entries(STEAM_APPS)) {
		console.log(`\n=== ${game.toUpperCase()} (appid ${appid}) ===`);
		const g = games.get(appid);
		if (g) {
			console.log(`playtime: ${Math.round((g.playtime_forever ?? 0) / 60)} h total, ${Math.round((g.playtime_2weeks ?? 0) / 60)} h last 2 weeks`);
		} else {
			console.log('playtime: not in owned games (private profile or not owned)');
		}

		try {
			const ach = await get('/ISteamUserStats/GetPlayerAchievements/v1/', {
				steamid: steamId,
				appid: String(appid)
			});
			const items = ach?.playerstats?.achievements ?? [];
			const unlocked = items.filter((a: { achieved: number }) => a.achieved === 1).length;
			console.log(`achievements: ${unlocked}/${items.length} unlocked`);
		} catch (e) {
			console.log('achievements:', (e as Error).message);
		}

		try {
			const schema = await get('/ISteamUserStats/GetSchemaForGame/v2/', { appid: String(appid) });
			const stats = schema?.game?.availableGameStats?.stats ?? [];
			console.log(`stat schema: ${stats.length} stats`);
			console.log('  ' + stats.map((s: { name: string }) => s.name).slice(0, 40).join(', '));
		} catch (e) {
			console.log('stat schema:', (e as Error).message);
		}
	}
})();
