import type { PageServerLoad } from './$types';
import { snapshotLog, allJobs, jobCodes } from '$lib/server/queries';

export const load: PageServerLoad = async () => {
	return {
		log: snapshotLog(),
		jobs: allJobs().map((j) => ({ ...j, ...jobCodes(j) }))
	};
};
