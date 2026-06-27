import type { LayoutServerLoad } from './$types';
import { getAppSettings } from '$lib/server/queries';

// In the static snapshot build (VITE_STATIC=true) every page is prerendered to
// HTML; the normal Node build leaves this false so data stays dynamic.
export const prerender = process.env.VITE_STATIC === 'true';

export const load: LayoutServerLoad = async () => {
	return { settings: getAppSettings() };
};
