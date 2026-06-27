/**
 * CLI scraper — run a one-off sync and persist a snapshot.
 *   npm run scrape
 * Suitable for cron, e.g. every 6 hours:
 *   0 *\/6 * * *  cd /path/to/trucksim && npm run scrape >> data/scrape.log 2>&1
 */
import 'dotenv/config';
import { runSync } from '../src/lib/server/sync';

const out = await runSync();
console.log(
	`[${new Date(out.scrapedAt).toISOString()}] snapshot #${out.snapshotId} ` +
		`saved ${out.statCount} stats, ${out.newJobs} new jobs, ${out.citiesGeocoded} cities mapped ` +
		`(authenticated=${out.authenticated}${out.jobsCapped ? ', log book capped at 50' : ''})`
);
if (out.coverageNote) console.warn(`⚠️  ${out.coverageNote}`);
process.exit(0);
