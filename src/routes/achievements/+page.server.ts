import type { PageServerLoad } from './$types';
import { getSteamInfo } from '$lib/server/queries';

export const load: PageServerLoad = async () => {
	return { steam: getSteamInfo() };
};
