import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';
import {
	allFavorites,
	allJobs,
	addFavorite,
	deleteFavorite,
	updateFavoriteNotes
} from '$lib/server/queries';

export const load: PageServerLoad = async () => {
	return {
		favorites: allFavorites(),
		jobs: allJobs()
	};
};

const writeActions: Actions = {
	add: async ({ request }) => {
		const f = await request.formData();
		const fromCity = String(f.get('fromCity') ?? '').trim();
		const toCity = String(f.get('toCity') ?? '').trim();
		if (!fromCity || !toCity) {
			return fail(400, { error: 'From city and To city are required.' });
		}
		const str = (k: string) => {
			const v = String(f.get(k) ?? '').trim();
			return v === '' ? null : v;
		};
		const jobIdRaw = str('jobId');
		addFavorite({
			fromCity,
			toCity,
			fromCompany: str('fromCompany'),
			toCompany: str('toCompany'),
			cargo: str('cargo'),
			truck: str('truck'),
			notes: str('notes'),
			game: str('game'),
			source: jobIdRaw ? 'job' : 'custom',
			jobId: jobIdRaw ? Number(jobIdRaw) : null
		});
		return { added: true };
	},

	notes: async ({ request }) => {
		const f = await request.formData();
		const id = Number(f.get('id'));
		if (!Number.isFinite(id)) return fail(400, { error: 'Invalid route.' });
		const notes = String(f.get('notes') ?? '').trim();
		updateFavoriteNotes(id, notes === '' ? null : notes);
		return { notesSaved: id };
	},

	delete: async ({ request }) => {
		const f = await request.formData();
		const id = Number(f.get('id'));
		if (Number.isFinite(id)) deleteFavorite(id);
		return { deleted: true };
	}
};

// The static snapshot has no server, so it exposes no form actions (which also
// lets these pages prerender — pages with actions can't be prerendered).
export const actions = (process.env.VITE_STATIC === 'true' ? undefined : writeActions) as Actions;
