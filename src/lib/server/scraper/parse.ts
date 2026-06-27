import * as cheerio from 'cheerio';
import { BASE } from './http';

export type Game = 'ets2' | 'ats' | 'global';

export interface ParsedStat {
	game: Game;
	key: string;
	label: string;
	valueRaw: string;
	valueNum: number | null;
}

const slug = (label: string) =>
	label
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '');

/**
 * Turn a displayed stat value into a number for charting.
 * Handles: "1,548 t", "453 km", "52 h 2 min", "85 h", "129".
 * Time values are normalised to minutes.
 */
export function parseStatValue(raw: string): number | null {
	const text = raw.trim();
	if (!text) return null;

	const timeMatch = text.match(/(\d[\d,]*)\s*h(?:\s*(\d+)\s*min)?/i);
	if (timeMatch) {
		const h = Number(timeMatch[1].replace(/,/g, ''));
		const m = timeMatch[2] ? Number(timeMatch[2]) : 0;
		return h * 60 + m;
	}
	const minOnly = text.match(/^(\d+)\s*min$/i);
	if (minOnly) return Number(minOnly[1]);

	const num = text.replace(/[^\d.,-]/g, '').replace(/,/g, '');
	if (num === '' || num === '-') return null;
	const n = Number(num);
	return Number.isFinite(n) ? n : null;
}

/** Map a column header title to a Game key. */
function gameFromTitle(title: string): Game | null {
	const t = title.toLowerCase();
	if (t.includes('euro truck')) return 'ets2';
	if (t.includes('american truck')) return 'ats';
	if (t.includes('global')) return 'global';
	return null;
}

/**
 * Parse the `.job-stats-detail` table from a WoT profile page.
 * Layout: a header row of `.title` cells [label, ETS2, ATS, Global], then
 * data rows of `.name` + three `.value` cells.
 */
export function parseProfileStats(html: string): ParsedStat[] {
	const $ = cheerio.load(html);
	const detail = $('.job-stats-detail');
	if (!detail.length) return [];

	const rows = detail.find('.row');
	if (rows.length < 2) return [];

	// Column order from the header row (skip the first "Job Statistics" cell).
	const headerCells = rows.eq(0).find('.title');
	const columns: Game[] = [];
	headerCells.each((i, el) => {
		if (i === 0) return; // label column
		const g = gameFromTitle($(el).clone().children().remove().end().text());
		if (g) columns.push(g);
	});

	const out: ParsedStat[] = [];
	rows.slice(1).each((_, row) => {
		const $row = $(row);
		const label = $row.find('.name').first().text().trim();
		if (!label) return;
		const key = slug(label);
		$row.find('.value').each((i, cell) => {
			const game = columns[i];
			if (!game) return;
			const valueRaw = $(cell).text().trim();
			out.push({ game, key, label, valueRaw, valueNum: parseStatValue(valueRaw) });
		});
	});
	return out;
}

export interface ParsedJob {
	externalId: string;
	game: 'ets2' | 'ats';
	cargo: string | null;
	fromCity: string | null;
	fromCompany: string | null;
	toCity: string | null;
	toCompany: string | null;
	distanceKm: number | null;
	massT: number | null;
	deliveredAt: number | null;
	takenAt: number | null;
	cargoDamage: string | null;
	raw: string;
}

const stripCountry = (s: string | undefined) =>
	s ? s.replace(/\s*\([^)]*\)\s*$/, '').trim() || null : null;

// The Origin/Destination parenthetical is a US state for ATS, a country for ETS2.
const US_STATES = new Set([
	'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut',
	'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
	'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan',
	'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire',
	'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
	'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
	'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia',
	'Wisconsin', 'Wyoming', 'District of Columbia'
]);
/** The "(Region)" parenthetical from an Origin/Destination string: a US state (ATS) or country (ETS2). */
export const regionOf = (s: string | undefined) => s?.match(/\(([^)]+)\)\s*$/)?.[1]?.trim() ?? '';

/**
 * Game from the Origin/Destination region. ATS shows a US state in parentheses,
 * ETS2 a country — this is reliable, unlike the distance unit, which follows the
 * player's WoT display preference (km/mi) and can differ between jobs.
 */
export function gameFromRegions(origin: string | undefined, dest: string | undefined): 'ets2' | 'ats' {
	return US_STATES.has(regionOf(origin)) || US_STATES.has(regionOf(dest)) ? 'ats' : 'ets2';
}

/** Distance string ("417 mi" / "148 km") normalised to whole km. */
export function distanceToKm(raw: string): number | null {
	const n = parseStatValue(raw);
	if (n == null) return null;
	return /\bmi\b/i.test(raw) ? Math.round(n * 1.60934) : n;
}

/** Parse a "June 12, 2026 at 7:50 PM" timestamp to unix ms. */
export function parseWotDate(s: string | undefined): number | null {
	if (!s) return null;
	const t = Date.parse(s.replace(/\s+at\s+/i, ' '));
	return Number.isNaN(t) ? null : t;
}

/**
 * Parse the authenticated Log Book page (`/en/jobs/<id>`). Each `.job` carries a
 * `.modal` with a label/value "Contract Details" table that holds the richest data.
 * Game comes from the origin/destination region; distance is normalised to km.
 * There is no job id in the markup, so a stable composite key is synthesised.
 */
export function parseJobLog(html: string): ParsedJob[] {
	const $ = cheerio.load(html);
	const out: ParsedJob[] = [];

	$('.job-history .job').each((_, el) => {
		const $job = $(el);
		const fields: Record<string, string> = {};
		$job.find('.job-info .modal .description .row').each((_, row) => {
			const left = $(row).find('.left').text().trim();
			const right = $(row).find('.right').text().trim();
			if (left) fields[left] = right;
		});

		const distanceRaw = fields['Distance'] ?? $job.find('.distance').clone().children().remove().end().text().trim();
		const game = gameFromRegions(fields['Origin'], fields['Destination']);

		const cargo = fields['Cargo'] || $job.find('> .title').text().trim() || null;
		const fromCity = stripCountry(fields['Origin']);
		const toCity = stripCountry(fields['Destination']);
		const fromCompany = fields['Sender'] || null;
		const toCompany = fields['Recipient'] || null;
		const completedRaw = fields['Completed'];

		out.push({
			externalId: `${completedRaw ?? ''}|${cargo ?? ''}|${fromCity ?? ''}->${toCity ?? ''}|${distanceRaw}`,
			game,
			cargo,
			fromCity,
			fromCompany,
			toCity,
			toCompany,
			distanceKm: distanceToKm(distanceRaw),
			massT: parseStatValue(fields['Mass'] ?? ''),
			deliveredAt: parseWotDate(completedRaw),
			takenAt: parseWotDate(fields['Taken']),
			cargoDamage: fields['Cargo Damage'] || null,
			raw: JSON.stringify(fields)
		});
	});

	return out;
}

export interface TruckInfo {
	game: Game;
	name: string;
	imageUrl: string | null;
	link: string | null;
	specs: Record<string, string>;
	plate: string | null;
	plateFrontUrl: string | null;
	plateRearUrl: string | null;
}

export interface AchievementInfo {
	name: string;
	image: string | null;
	level: string | null;
	unlocked: boolean;
	description: string | null;
	achievedOn: string | null;
	progress: string | null;
}

/** An in-progress contract from the profile's "Current jobs" section. */
export interface CurrentJob {
	game: Game;
	cargo: string | null;
	fromCity: string | null;
	toCity: string | null;
	fromCompany: string | null;
	toCompany: string | null;
	distanceKm: number | null;
	massT: number | null;
	/** Real-world minutes left at scrape time (external contracts only). */
	timeLeftMin: number | null;
	/** As shown by WoT, e.g. "17 h 20 min". */
	timeLeftText: string | null;
	/** Absolute deadline (unix ms), stamped at scrape time so the UI can count down. */
	deadline: number | null;
	isExternalContract: boolean;
}

export interface ProfileMeta {
	username: string | null;
	avatarUrl: string | null;
	country: string | null;
	flagUrl: string | null;
	trucks: TruckInfo[];
	currentJobs: CurrentJob[];
	achievements: {
		earned: number;
		total: number;
		percent: number;
		items: AchievementInfo[];
	};
}

/** Game from the "American/European contract" block heading. */
function gameFromContractType(h2: string): Game | null {
	const t = h2.toLowerCase();
	if (t.includes('american')) return 'ats';
	if (t.includes('european')) return 'ets2';
	return null;
}

/** "17:20" (h:mm) → minutes. */
function parseClockMin(s: string): number | null {
	const m = s.trim().match(/^(\d+):(\d{2})$/);
	return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** Parse the profile's "Current jobs" section (active/in-progress contracts). */
function parseCurrentJobs($: cheerio.CheerioAPI): CurrentJob[] {
	const out: CurrentJob[] = [];
	$('.current-jobs .block').each((_, block) => {
		const $block = $(block);
		const typeGame = gameFromContractType($block.children('h2').first().text());
		$block.find('.job').each((_, el) => {
			const $job = $(el);
			const fields: Record<string, string> = {};
			$job.find('.modal .description .row').each((_, row) => {
				const left = $(row).find('.left').text().trim();
				const right = $(row).find('.right').text().trim();
				if (left) fields[left] = right;
			});

			const companies = $job.find('.box .company');
			const boxCity = (i: number) => $(companies[i]).find('.city').text().trim() || null;
			const boxName = (i: number) => $(companies[i]).find('.name').text().trim() || null;

			const origin = fields['Origin'];
			const dest = fields['Destination'];
			const distanceRaw = fields['Distance'] ?? $job.find('.distance').first().text().trim();
			const timeLeftText = fields['Time left'] || null;
			const timeLeftMin =
				(timeLeftText ? parseStatValue(timeLeftText) : null) ??
				parseClockMin($job.find('.time .value').first().text());

			out.push({
				game: (origin || dest ? gameFromRegions(origin, dest) : null) ?? typeGame ?? 'global',
				cargo: fields['Cargo'] || $job.children('.title').first().text().trim() || null,
				fromCity: stripCountry(origin) ?? boxCity(0),
				toCity: stripCountry(dest) ?? boxCity(1),
				fromCompany: fields['Sender'] || boxName(0),
				toCompany: fields['Recipient'] || boxName(1),
				distanceKm: distanceToKm(distanceRaw),
				massT: parseStatValue(fields['Mass'] ?? ''),
				timeLeftMin,
				timeLeftText,
				deadline: null,
				isExternalContract: timeLeftMin != null
			});
		});
	});
	return out;
}

const abs = (src: string | undefined) =>
	!src ? null : src.startsWith('http') ? src : BASE + src;

/** Parse the profile identity, current trucks and achievements from a profile page. */
export function parseProfileMeta(html: string): ProfileMeta {
	const $ = cheerio.load(html);
	const frame = $('.profile-frame');

	const username = frame.find('h2 a').first().text().trim() || null;
	const avatarUrl = abs(frame.find('.avatar-area img').attr('src'));
	const flagImg = frame.find('h2 img').first();
	const country = flagImg.attr('title') || flagImg.attr('alt') || null;
	const flagUrl = abs(flagImg.attr('src'));

	const trucks: TruckInfo[] = [];
	$('.profile-trucks .gallery-item').each((_, el) => {
		const $t = $(el);
		const game = gameFromTitle($t.find('.game').text()) ?? 'global';
		const specs: Record<string, string> = {};
		let plate: string | null = null;
		let plateFrontUrl: string | null = null;
		let plateRearUrl: string | null = null;
		$t.find('.info .row').each((_, row) => {
			const title = $(row).find('.title').text().trim();
			const plates = $(row).find('.value.plates img');
			if (plates.length) {
				plateFrontUrl = abs(plates.eq(0).attr('src'));
				plateRearUrl = abs(plates.eq(1).attr('src'));
				const seg = plates.eq(0).attr('src')?.split('/').pop();
				plate = seg ?? null;
				return;
			}
			const value = $(row).find('.value').text().trim();
			if (title && value) specs[title] = value;
		});
		trucks.push({
			game,
			name: $t.find('.meta-box .name').text().trim(),
			imageUrl: abs($t.find('.truck img').attr('src')),
			link: abs($t.find('a').attr('href')),
			specs,
			plate,
			plateFrontUrl,
			plateRearUrl
		});
	});

	const items: AchievementInfo[] = [];
	$('.achievements .achievement').each((_, el) => {
		const $a = $(el);
		const img = $a.find('.image img').first();
		const unlocked = !$a.find('.image').first().hasClass('locked');
		// Unlocked achievements describe themselves in `.modal`; locked ones in
		// `.tooltip` (which also carries a "Progress: X/Y" line).
		let box = $a.find(unlocked ? '.modal' : '.tooltip');
		if (!box.length) box = $a.find('.modal, .tooltip').first();

		const descEl = box.find('.description');
		descEl.find('br').replaceWith(' ');
		let full = descEl
			.text()
			.replace(/\s+/g, ' ')
			.replace(/This is a multi-achievement.*$/i, '')
			.trim();

		// Pull out "Progress: 56/500" (locked) and "Achieved on:<date>" (unlocked).
		let progress: string | null = null;
		const pm = full.match(/Progress:\s*([\d,]+\s*\/\s*[\d,]+)/i);
		if (pm) {
			progress = pm[1].replace(/\s+/g, '');
			full = full.replace(/Progress:.*$/i, '').trim();
		}
		let achievedOn: string | null = null;
		const onMatch = full.match(/Achieved on:?\s*(.+)$/i);
		if (onMatch) {
			achievedOn = onMatch[1].trim();
			full = full.slice(0, onMatch.index).trim();
		}

		items.push({
			// Unlocked modal has .title="Achievement unlocked" + .name=<real name>;
			// locked tooltip has only .title=<real name>. Prefer .name.
			name:
				box.find('.name').first().text().trim() ||
				box.find('.title').first().text().trim() ||
				img.attr('alt') ||
				'',
			image: abs(img.attr('src')),
			level: $a.find('.level span').first().text().trim() || null,
			unlocked,
			description: full || null,
			achievedOn,
			progress
		});
	});
	const progressText = $('.achievements .progress .left').text();
	const m = progressText.match(/(\d+)\s*\/\s*(\d+)/);
	const earned = m ? Number(m[1]) : items.filter((i) => i.unlocked).length;
	const total = m ? Number(m[2]) : items.length;
	const percent = Number($('.achievements .progress .right').text().replace('%', '')) || 0;

	return {
		username,
		avatarUrl,
		country,
		flagUrl,
		trucks,
		currentJobs: parseCurrentJobs($),
		achievements: { earned, total, percent, items }
	};
}

/** True if the given HTML is the logged-out sign-in page rather than real content. */
export function isSignInPage(html: string): boolean {
	const $ = cheerio.load(html);
	return $('form.login-form').length > 0;
}
