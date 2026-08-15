/**
 * Refresh only the Steam data (playtime + achievements + per-achievement
 * progress) into the DB, without a full World of Trucks scrape.
 * Usage: npm run steam:sync
 */
import 'dotenv/config';
import { fetchSteamProgress } from '../src/lib/server/steam';
import { saveSteamInfo } from '../src/lib/server/queries';

const progress = await fetchSteamProgress();
if (!progress) {
	console.error('Steam not configured — set STEAM_API_KEY and STEAM_ID in .env.');
	process.exit(1);
}
saveSteamInfo(progress);

const total = progress.achievements.reduce((s, g) => s + g.items.length, 0);
const withGoal = progress.achievements.reduce(
	(s, g) => s + g.items.filter((i) => i.progressMax != null).length,
	0
);
console.log(
	`Saved Steam data: ${progress.achievements.map((g) => `${g.game} ${g.earned}/${g.total}`).join(', ')} · ` +
		`${withGoal}/${total} achievements have a parsed progress goal.`
);
process.exit(0);
