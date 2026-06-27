import 'dotenv/config';
import * as cheerio from 'cheerio';
import { Session, sleep } from './http';
import {
	parseProfileStats,
	parseJobLog,
	parseProfileMeta,
	isSignInPage,
	type ParsedStat,
	type ParsedJob,
	type ProfileMeta
} from './parse';

export interface ScrapeResult {
	profileId: string;
	authenticated: boolean;
	stats: ParsedStat[];
	profile: ProfileMeta;
	jobs: ParsedJob[];
	jobsCapped: boolean;
	scrapedAt: number;
}

export interface WotConfig {
	login?: string;
	password?: string;
	profileId: string;
}

export function configFromEnv(): WotConfig {
	return {
		login: process.env.WOT_LOGIN || undefined,
		password: process.env.WOT_PASSWORD || undefined,
		profileId: process.env.WOT_PROFILE_ID || ''
	};
}

/**
 * Log in to World of Trucks. The form lives at /en/sign_in and carries a
 * Rails `authenticity_token` (CSRF) hidden field that must be echoed back.
 * Returns true if the resulting session is authenticated.
 */
async function login(session: Session, user: string, password: string): Promise<boolean> {
	const { html } = await session.getText('/en/sign_in');
	const $ = cheerio.load(html);
	const token = $('form.login-form input[name="authenticity_token"]').attr('value');
	if (!token) throw new Error('Could not find authenticity_token on /en/sign_in');

	const body = new URLSearchParams({
		authenticity_token: token,
		login: user,
		password
	});

	const res = await session.request('/en/sign_in', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			Origin: 'https://www.worldoftrucks.com',
			Referer: 'https://www.worldoftrucks.com/en/sign_in'
		},
		body: body.toString()
	});
	await res.text();

	// "My Page" (/en/profile) only renders the profile when authenticated;
	// otherwise it falls back to the sign-in form.
	const check = await session.getText('/en/profile');
	return !isSignInPage(check.html) && !check.finalUrl.includes('sign_in');
}

/**
 * Run a full scrape: public statistics always, plus a login attempt when
 * credentials are supplied (which unlocks any private "My Page" data).
 */
export async function scrape(cfg: WotConfig): Promise<ScrapeResult> {
	if (!cfg.profileId) throw new Error('WOT_PROFILE_ID is not set');

	const session = new Session();
	let authenticated = false;

	if (cfg.login && cfg.password) {
		authenticated = await login(session, cfg.login, cfg.password);
		await sleep(500); // be polite between requests
	}

	const { html } = await session.getText(`/en/profile/${cfg.profileId}`);
	const stats = parseProfileStats(html);
	const profile = parseProfileMeta(html);

	// Per-job Log Book is only available when logged in.
	let jobs: ParsedJob[] = [];
	if (authenticated) {
		await sleep(500);
		const log = await session.getText(`/en/jobs/${cfg.profileId}`);
		jobs = parseJobLog(log.html);
	}

	// Turn each current job's relative "time left" into an absolute deadline so the
	// dashboard can count down between syncs.
	const scrapedAt = Date.now();
	for (const cj of profile.currentJobs) {
		cj.deadline = cj.timeLeftMin != null ? scrapedAt + cj.timeLeftMin * 60_000 : null;
	}

	return {
		profileId: cfg.profileId,
		authenticated,
		stats,
		profile,
		jobs,
		// The Log Book shows only the most recent ~50 deliveries; hitting that count
		// means older jobs may exist beyond what this scrape can see.
		jobsCapped: jobs.length >= 50,
		scrapedAt
	};
}
