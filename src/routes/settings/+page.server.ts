import type { Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { saveAppSettings } from '$lib/server/queries';

const writeActions: Actions = {
	save: async ({ request }) => {
		const f = await request.formData();
		const theme = String(f.get('theme') ?? 'default');
		let widgets: Record<string, boolean> = {};
		let order: string[] = [];
		try {
			widgets = JSON.parse(String(f.get('widgets') ?? '{}')) as Record<string, boolean>;
			order = JSON.parse(String(f.get('order') ?? '[]')) as string[];
		} catch {
			return fail(400, { error: 'Invalid settings payload.' });
		}
		saveAppSettings({ theme, widgets, order });
		return { ok: true };
	}
};

// No server in the static snapshot → no actions (also required for prerender).
export const actions = (process.env.VITE_STATIC === 'true' ? undefined : writeActions) as Actions;
