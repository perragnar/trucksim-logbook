import 'dotenv/config';

/** Steam app ids for the two games. */
export const STEAM_APPS = { ets2: 227300, ats: 270880 } as const;
export type SteamGame = keyof typeof STEAM_APPS;

export interface SteamConfig {
	apiKey?: string;
	steamId?: string;
}

export function steamConfigFromEnv(): SteamConfig {
	return {
		apiKey: process.env.STEAM_API_KEY || undefined,
		steamId: process.env.STEAM_ID || undefined
	};
}

export interface SteamGamePlay {
	game: SteamGame;
	name: string;
	playtimeForeverMin: number;
	playtime2weeksMin: number;
	lastPlayed: number | null; // unix ms
}

export interface SteamAchievement {
	name: string;
	description: string | null;
	icon: string | null; // unlocked icon URL
	iconGray: string | null; // locked icon URL
	unlocked: boolean;
	unlockedAt: number | null; // unix ms
	globalPercent: number | null; // % of all players who have it (rarity)
	hidden: boolean; // hidden/secret achievement
	progressCurrent: number | null; // player's current value toward the goal, if tracked
	progressMax: number | null; // goal target, parsed from the description ("at least N")
}

export interface SteamGameAchievements {
	game: SteamGame;
	earned: number;
	total: number;
	items: SteamAchievement[];
}

export interface SteamProgress {
	games: SteamGamePlay[];
	achievements: SteamGameAchievements[];
	fetchedAt: number;
}

const BASE = 'https://api.steampowered.com';

// Steam's Web API doesn't expose an achievement's progress target, so we derive
// it from the description. Add an entry here (keyed by Steam apiname) for any the
// heuristic below gets wrong.
const PROGRESS_MAX_OVERRIDE: Record<string, number> = {};

/**
 * Best-effort progress goal for an achievement, from its description.
 *  1. an explicit override, else
 *  2. "… at least N …" (the strongest signal), else
 *  3. the smallest number ≥ the player's current progress — the tighter bound is
 *     almost always what the "-progress" counter is tracking (e.g. "250 tons on
 *     5 consecutive jobs" with progress 3 → 5, not 250).
 */
function parseTarget(desc: string | null, apiname: string, current: number | null): number | null {
	if (apiname in PROGRESS_MAX_OVERRIDE) return PROGRESS_MAX_OVERRIDE[apiname];
	if (!desc) return null;

	const atLeast = desc.match(/at least\s+([\d,]+)/i);
	if (atLeast) {
		const n = Number(atLeast[1].replace(/,/g, ''));
		if (Number.isFinite(n) && n > 1) return n;
	}

	const nums = [...desc.matchAll(/(\d[\d,]*)/g)]
		.map((m) => Number(m[1].replace(/,/g, '')))
		.filter((n) => Number.isFinite(n) && n > 1);
	if (!nums.length) return null;
	const cur = current ?? 0;
	const atOrAbove = nums.filter((n) => n >= cur).sort((a, b) => a - b);
	return atOrAbove.length ? atOrAbove[0] : Math.max(...nums);
}

async function api(path: string, cfg: SteamConfig, params: Record<string, string>) {
	const url = new URL(BASE + path);
	url.searchParams.set('key', cfg.apiKey!);
	for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
	const res = await fetch(url);
	if (!res.ok) throw new Error(`${path} → ${res.status}`);
	return res.json();
}

async function fetchPlaytime(cfg: SteamConfig): Promise<SteamGamePlay[]> {
	const data = (await api('/IPlayerService/GetOwnedGames/v1/', cfg, {
		steamid: cfg.steamId!,
		include_appinfo: 'true',
		include_played_free_games: 'true',
		format: 'json'
	})) as {
		response?: {
			games?: {
				appid: number;
				name?: string;
				playtime_forever?: number;
				playtime_2weeks?: number;
				rtime_last_played?: number;
			}[];
		};
	};
	const byApp = new Map((data.response?.games ?? []).map((g) => [g.appid, g]));
	const games: SteamGamePlay[] = [];
	for (const game of Object.keys(STEAM_APPS) as SteamGame[]) {
		const g = byApp.get(STEAM_APPS[game]);
		if (!g) continue;
		games.push({
			game,
			name: g.name ?? game.toUpperCase(),
			playtimeForeverMin: g.playtime_forever ?? 0,
			playtime2weeksMin: g.playtime_2weeks ?? 0,
			lastPlayed: g.rtime_last_played ? g.rtime_last_played * 1000 : null
		});
	}
	return games;
}

/** Best-effort per game; skips a game whose achievements aren't public (403). */
async function fetchAchievements(cfg: SteamConfig): Promise<SteamGameAchievements[]> {
	const out: SteamGameAchievements[] = [];
	for (const game of Object.keys(STEAM_APPS) as SteamGame[]) {
		const appid = String(STEAM_APPS[game]);
		try {
			const player = (await api('/ISteamUserStats/GetPlayerAchievements/v1/', cfg, {
				steamid: cfg.steamId!,
				appid,
				l: 'english'
			})) as {
				playerstats?: {
					success?: boolean;
					achievements?: {
						apiname: string;
						achieved: number;
						unlocktime?: number;
						name?: string;
						description?: string;
					}[];
				};
			};
			const pAch = player.playerstats?.achievements ?? [];
			if (!player.playerstats?.success || !pAch.length) continue;

			// Schema gives display names + icon URLs + hidden flag (best-effort), plus
			// the stat list — a "<apiname>-progress" stat marks a progress-tracked
			// achievement (present even when the player's value is still 0).
			let schema = new Map<string, { displayName?: string; description?: string; icon?: string; icongray?: string; hidden?: number }>();
			const progressStats = new Set<string>();
			try {
				const s = (await api('/ISteamUserStats/GetSchemaForGame/v2/', cfg, { appid, l: 'english' })) as {
					game?: {
						availableGameStats?: {
							achievements?: { name: string; displayName?: string; description?: string; icon?: string; icongray?: string; hidden?: number }[];
							stats?: { name: string }[];
						};
					};
				};
				schema = new Map((s.game?.availableGameStats?.achievements ?? []).map((a) => [a.name, a]));
				for (const st of s.game?.availableGameStats?.stats ?? []) {
					if (st.name.endsWith('-progress')) progressStats.add(st.name);
				}
			} catch {
				// icons/names optional
			}

			// Global rarity — % of all players who own each achievement (public endpoint).
			let pct = new Map<string, number>();
			try {
				const gp = (await api('/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2/', cfg, {
					gameid: appid
				})) as { achievementpercentages?: { achievements?: { name: string; percent: number | string }[] } };
				pct = new Map(
					(gp.achievementpercentages?.achievements ?? []).map((a) => [a.name, Number(a.percent)])
				);
			} catch {
				// rarity optional
			}

			// Per-achievement progress — GetUserStatsForGame exposes a
			// "<apiname>-progress" stat holding the player's current value.
			let prog = new Map<string, number>();
			try {
				const us = (await api('/ISteamUserStats/GetUserStatsForGame/v2/', cfg, {
					appid,
					steamid: cfg.steamId!
				})) as { playerstats?: { stats?: { name: string; value: number }[] } };
				prog = new Map((us.playerstats?.stats ?? []).map((s) => [s.name, s.value]));
			} catch {
				// progress optional
			}

			const items: SteamAchievement[] = pAch.map((a) => {
				const sa = schema.get(a.apiname);
				const description = sa?.description || a.description || null;
				// Progress-tracked achievements are known from the schema; the player
				// value is omitted while still at its 0 default, so fall back to 0.
				const statName = `${a.apiname}-progress`;
				const cur = progressStats.has(statName) ? (prog.get(statName) ?? 0) : null;
				const max = cur != null ? parseTarget(description, a.apiname, cur) : null;
				return {
					name: sa?.displayName || a.name || a.apiname,
					description,
					icon: sa?.icon || null,
					iconGray: sa?.icongray || null,
					unlocked: a.achieved === 1,
					unlockedAt: a.achieved === 1 && a.unlocktime ? a.unlocktime * 1000 : null,
					globalPercent: pct.get(a.apiname) ?? null,
					hidden: sa?.hidden === 1,
					progressCurrent: cur ?? null,
					progressMax: max
				};
			});
			out.push({ game, earned: items.filter((i) => i.unlocked).length, total: items.length, items });
		} catch {
			// 403 (achievements not public) or other — skip this game
		}
	}
	return out;
}

/**
 * Fetch ETS2/ATS playtime + achievements from the Steam Web API. Returns null
 * when Steam isn't configured. Playtime needs "Game details" public;
 * achievements additionally need the achievements list public.
 */
export async function fetchSteamProgress(
	cfg: SteamConfig = steamConfigFromEnv()
): Promise<SteamProgress | null> {
	if (!cfg.apiKey || !cfg.steamId) return null;
	const games = await fetchPlaytime(cfg);
	const achievements = await fetchAchievements(cfg);
	return { games, achievements, fetchedAt: Date.now() };
}
