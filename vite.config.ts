import adapterNode from '@sveltejs/adapter-node';
import adapterStatic from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

// VITE_STATIC=true builds a prerendered, read-only snapshot (adapter-static) for
// hosts like Netlify. Otherwise the normal Node app is built (adapter-node).
const STATIC = process.env.VITE_STATIC === 'true';

export default defineConfig({
	define: {
		'import.meta.env.VITE_STATIC': JSON.stringify(STATIC ? 'true' : 'false')
	},
	server: process.env.PORT ? { port: Number(process.env.PORT) } : undefined,
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			adapter: STATIC
				? adapterStatic({ fallback: '200.html' })
				: adapterNode()
		})
	]
});
