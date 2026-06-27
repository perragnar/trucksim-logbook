import type { PageServerLoad } from './$types';
import { routeMapData } from '$lib/server/queries';
import euGeo from '$lib/server/geo/europe.json';
import usGeo from '$lib/server/geo/us.json';

export const load: PageServerLoad = async () => {
	return {
		maps: {
			ets2: { ...routeMapData('ets2'), outline: euGeo.rings },
			ats: { ...routeMapData('ats'), outline: usGeo.rings }
		}
	};
};
