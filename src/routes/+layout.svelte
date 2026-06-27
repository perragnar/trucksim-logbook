<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import { browser } from '$app/environment';
	import { invalidateAll } from '$app/navigation';
	import { ModeWatcher } from 'mode-watcher';
	import { toast } from 'svelte-sonner';
	import { Toaster } from '$lib/components/ui/sonner';
	import { Button } from '$lib/components/ui/button';
	import * as ToggleGroup from '$lib/components/ui/toggle-group';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import { gameFilter, GAME_FILTERS, GAME_FILTER_KEY, type GameFilter } from '$lib/gameFilter.svelte';

	let { children, data } = $props();

	// True in the prerendered read-only snapshot build (no server for writes).
	const STATIC = import.meta.env.VITE_STATIC === 'true';

	// Keep the accent theme on <html> in sync after settings change (SSR sets it
	// initially via hooks.server.ts to avoid a flash).
	$effect(() => {
		if (browser && data.settings?.theme) document.documentElement.dataset.accent = data.settings.theme;
	});

	// Load the persisted game filter once after hydration, then keep it in sync.
	// Read `gameFilter.current` on every run so the effect stays subscribed to it.
	let filterLoaded = false;
	$effect(() => {
		const cur = gameFilter.current;
		if (!browser) return;
		if (!filterLoaded) {
			filterLoaded = true;
			const v = localStorage.getItem(GAME_FILTER_KEY);
			if ((v === 'all' || v === 'ets2' || v === 'ats') && v !== cur) gameFilter.current = v;
			return;
		}
		localStorage.setItem(GAME_FILTER_KEY, cur);
	});

	const wide = $derived(page.url.pathname === '/logs');
	let syncing = $state(false);

	const nav = [
		{ href: '/', label: 'Dashboard' },
		{ href: '/map', label: 'Map' },
		{ href: '/logs', label: 'Logs' },
		{ href: '/routes', label: 'Routes' }
	];

	async function sync() {
		syncing = true;
		const run = (async () => {
			const res = await fetch('/api/sync', { method: 'POST' });
			const data = await res.json();
			if (!data.ok) throw new Error(data.error || 'Sync failed');
			await invalidateAll();
			return data;
		})();

		toast.promise(run, {
			loading: 'Syncing with World of Trucks…',
			success: (data) => {
				if (data.coverageNote) toast.warning(data.coverageNote, { duration: 12000 });
				const jobs = data.authenticated
					? `, ${data.newJobs} new job${data.newJobs === 1 ? '' : 's'}`
					: '';
				return `Synced ${data.statCount} stats${jobs}${data.authenticated ? ' (logged in)' : ''}`;
			},
			error: (e: unknown) => `Sync failed: ${(e as Error).message}`
		});

		try {
			await run;
		} catch {
			// surfaced via the toast above
		} finally {
			syncing = false;
		}
	}
</script>

<svelte:head><title>TruckSim Logbook</title></svelte:head>

<ModeWatcher />

<header>
	<div class="wrap bar">
		<a class="brand" href="/">🚚 TruckSim Logbook</a>
		<nav>
			{#each nav as n}
				<a class:active={page.url.pathname === n.href} href={n.href}>{n.label}</a>
			{/each}
		</nav>
		<div class="sync">
			<ToggleGroup.Root
				type="single"
				variant="outline"
				size="sm"
				value={gameFilter.current}
				onValueChange={(v) => {
					if (v) gameFilter.current = v as GameFilter;
				}}
				aria-label="Game filter"
			>
				{#each GAME_FILTERS as f}
					<ToggleGroup.Item value={f.key}>
						{#if f.flag}<img class="flag" src="https://flagcdn.com/{f.flag}.svg" alt="" aria-hidden="true" />{/if}{f.label}
					</ToggleGroup.Item>
				{/each}
			</ToggleGroup.Root>
			{#if !STATIC}
				<Button
					href="/settings"
					variant="outline"
					size="icon"
					aria-label="Settings"
					data-active={page.url.pathname === '/settings' ? '' : undefined}
				>
					<SettingsIcon class="size-[1.1rem]" />
				</Button>
				<Button onclick={sync} disabled={syncing}>
					{syncing ? 'Syncing…' : 'Sync now'}
				</Button>
			{/if}
		</div>
	</div>
</header>

<Toaster richColors closeButton position="bottom-right" />

<main class="wrap" class:wide>
	{@render children()}
</main>

<style>
	header {
		position: sticky;
		top: 0;
		z-index: 50;
		background: color-mix(in srgb, var(--panel) 92%, transparent);
		backdrop-filter: blur(8px);
		border-bottom: 1px solid var(--border);
	}
	:global(main.wrap.wide) {
		max-width: 1500px;
	}
	.bar {
		display: flex;
		align-items: center;
		gap: 1.5rem;
		padding-top: 0.85rem;
		padding-bottom: 0.85rem;
	}
	.brand {
		font-weight: 700;
		font-size: 1.1rem;
		color: var(--text);
		text-decoration: none;
	}
	nav {
		display: flex;
		gap: 1.1rem;
		flex: 1;
	}
	nav a {
		color: var(--muted);
		text-decoration: none;
		font-size: 0.95rem;
	}
	nav a.active,
	nav a:hover {
		color: var(--accent);
	}
	.sync {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}
	.sync :global(a[data-active]) {
		border-color: var(--accent);
		color: var(--accent);
	}
	.flag {
		height: 0.85em;
		width: auto;
		border-radius: 2px;
		display: block;
		flex-shrink: 0;
	}
</style>
