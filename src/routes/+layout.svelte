<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import { browser } from '$app/environment';
	import { invalidateAll } from '$app/navigation';
	import { ModeWatcher } from 'mode-watcher';
	import { toast } from 'svelte-sonner';
	import { Toaster } from '$lib/components/ui/sonner';
	import { Button } from '$lib/components/ui/button';
	import { ButtonGroup } from '$lib/components/ui/button-group';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import MenuIcon from '@lucide/svelte/icons/menu';
	import XIcon from '@lucide/svelte/icons/x';
	import { gameFilter, GAME_FILTERS, GAME_FILTER_KEY, type GameFilter } from '$lib/gameFilter.svelte';

	let { children, data } = $props();

	// Mobile nav menu (hamburger) open state.
	let menuOpen = $state(false);

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
	let publishing = $state(false);
	// Sync writes the DB; Publish reads it to build a snapshot — never overlap them.
	const busy = $derived(syncing || publishing);

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

	async function publish() {
		publishing = true;
		const run = (async () => {
			const res = await fetch('/api/publish', { method: 'POST' });
			const data = await res.json();
			if (!data.ok) throw new Error(data.error || 'Publish failed');
			return data;
		})();

		toast.promise(run, {
			loading: 'Building snapshot & deploying to Netlify…',
			success: (data) => (data.url ? `Published to ${data.url}` : 'Published the snapshot'),
			error: (e: unknown) => `Publish failed: ${(e as Error).message}`,
			duration: 8000
		});

		try {
			await run;
		} catch {
			// surfaced via the toast above
		} finally {
			publishing = false;
		}
	}
</script>

<svelte:head><title>TruckSim Logbook</title></svelte:head>

<ModeWatcher />

<header>
	<div class="wrap bar" class:menuopen={menuOpen}>
		<a class="brand" href="/" onclick={() => (menuOpen = false)}
			>🚚<span class="brandtext">TruckSim Logbook</span></a
		>
		<nav>
			{#each nav as n}
				<a
					class:active={page.url.pathname === n.href}
					href={n.href}
					onclick={() => (menuOpen = false)}>{n.label}</a
				>
			{/each}
		</nav>
		<div class="gametoggle">
			<ButtonGroup aria-label="Game filter">
				{#each GAME_FILTERS as f}
					<Button
						variant="outline"
						class={gameFilter.current === f.key ? 'gt-active' : ''}
						aria-pressed={gameFilter.current === f.key}
						onclick={() => (gameFilter.current = f.key)}
					>
						{#if f.flag}<img class="flag" src="https://flagcdn.com/{f.flag}.svg" alt="" aria-hidden="true" />{/if}{f.label}
					</Button>
				{/each}
			</ButtonGroup>
		</div>
		{#if !STATIC}
			<div class="actions">
				<Button
					href="/settings"
					variant="outline"
					size="icon"
					aria-label="Settings"
					data-active={page.url.pathname === '/settings' ? '' : undefined}
					onclick={() => (menuOpen = false)}
				>
					<SettingsIcon class="size-[1.1rem]" />
					<span class="cog-label">Settings</span>
				</Button>
				<ButtonGroup aria-label="Sync and publish">
					<Button onclick={sync} disabled={busy}>
						{syncing ? 'Syncing…' : 'Sync now'}
					</Button>
					<Button variant="outline" onclick={publish} disabled={busy}>
						{publishing ? 'Publishing…' : 'Publish'}
					</Button>
				</ButtonGroup>
			</div>
		{/if}
		<button
			class="menubtn"
			aria-label="Menu"
			aria-expanded={menuOpen}
			onclick={() => (menuOpen = !menuOpen)}
		>
			{#if menuOpen}<XIcon class="size-5" />{:else}<MenuIcon class="size-5" />{/if}
		</button>
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
		gap: 1.25rem;
		padding-top: 0.85rem;
		padding-bottom: 0.85rem;
	}
	.brand {
		font-weight: 700;
		font-size: 1.1rem;
		color: var(--text);
		text-decoration: none;
		white-space: nowrap;
	}
	.brandtext {
		margin-left: 0.45rem;
	}
	/* The hamburger button only appears on phones. */
	.menubtn {
		display: none;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		flex-shrink: 0;
		background: transparent;
		border: 1px solid var(--border);
		border-radius: 8px;
		color: var(--text);
		cursor: pointer;
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
	.gametoggle {
		display: flex;
	}
	/* Round only the outer ends of the segmented switcher; inner dividers stay square. */
	.gametoggle :global([data-slot='button-group'] > :first-child) {
		border-radius: 8px 0 0 8px;
	}
	.gametoggle :global([data-slot='button-group'] > :last-child) {
		border-radius: 0 8px 8px 0;
	}
	.gametoggle :global(.gt-active) {
		background: var(--accent);
		border-color: var(--accent);
		color: var(--on-accent);
	}
	.actions {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}
	.actions :global(a[data-active]) {
		border-color: var(--accent);
		color: var(--accent);
	}
	/* "Settings" label on the cog only shows in the mobile menu. */
	.cog-label {
		display: none;
	}
	.flag {
		height: 0.85em;
		width: auto;
		border-radius: 2px;
		display: block;
		flex-shrink: 0;
	}

	/* Phones: brand shrinks to just the truck; the game switcher + hamburger stay
	   in the top bar; nav and actions drop down when the menu is open. */
	@media (max-width: 720px) {
		.bar {
			flex-wrap: wrap;
			gap: 0.6rem;
		}
		.brandtext {
			display: none;
		}
		.brand {
			font-size: 1.35rem;
		}
		.menubtn {
			display: inline-flex;
			order: 3;
		}
		.gametoggle {
			order: 2;
			margin-left: auto;
		}
		nav,
		.actions {
			display: none;
			flex-basis: 100%;
		}
		nav {
			order: 4;
		}
		.actions {
			order: 5;
		}
		.bar.menuopen nav {
			display: flex;
			flex-direction: column;
			gap: 0.1rem;
			padding-top: 0.6rem;
			margin-top: 0.2rem;
			border-top: 1px solid var(--border);
		}
		.bar.menuopen nav a {
			padding: 0.55rem 0.25rem;
			font-size: 1.05rem;
		}
		.bar.menuopen .actions {
			display: flex;
		}
		/* Cog shows its "Settings" label in the menu. */
		.cog-label {
			display: inline;
		}
		.actions :global(a[aria-label='Settings']) {
			width: auto;
			gap: 0.45rem;
			padding-left: 0.65rem;
			padding-right: 0.8rem;
		}
	}
</style>
