import type { PageServerLoad } from './$types';
import { snapshotLog, allJobs } from '$lib/server/queries';

export const load: PageServerLoad = async () => {
	return {
		log: snapshotLog(),
		jobs: allJobs()
	};
};
