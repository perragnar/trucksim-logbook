import type { Handle } from '@sveltejs/kit';
import { getAppSettings } from '$lib/server/queries';

// Apply the saved accent theme to <html> during SSR so there's no flash of the
// default palette on first paint (mode-watcher handles light/dark the same way).
export const handle: Handle = async ({ event, resolve }) => {
	const theme = getAppSettings().theme;
	return resolve(event, {
		transformPageChunk: ({ html }) =>
			html.replace('<html lang="en">', `<html lang="en" data-accent="${theme}">`)
	});
};
