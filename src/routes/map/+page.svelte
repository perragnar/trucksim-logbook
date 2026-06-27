<script lang="ts">
	import RouteMap from '$lib/charts/RouteMap.svelte';
	import { gameFilter } from '$lib/gameFilter.svelte';
	let { data } = $props();

	const games = [
		{ key: 'ets2', label: 'Euro Truck Simulator 2', color: 'var(--ets2)' },
		{ key: 'ats', label: 'American Truck Simulator', color: 'var(--ats)' }
	] as const;

	const shownGames = $derived(
		games.filter((g) => gameFilter.current === 'all' || gameFilter.current === g.key)
	);
</script>

<h1>Route map</h1>
<p class="muted">
	Your delivery network per game — dots are cities (sized by visits), lines are routes (brighter
	= more trips). Hover for details.
</p>

{#each shownGames as g}
	{@const m = data.maps[g.key]}
	{#if m && m.cities.length}
		<section class="panel">
			<h2 style="color:{g.color}">
				{g.label}
				<span class="muted">· {m.cities.length} cities · {m.edges.length} routes</span>
				{#if m.missing.length}<span class="muted">· {m.missing.length} not mapped</span>{/if}
			</h2>
			<RouteMap cities={m.cities} edges={m.edges} outline={m.outline} unit={m.unit} color={g.color} />
		</section>
	{/if}
{/each}

<style>
	section.panel {
		margin-top: 1rem;
	}
	h2 {
		margin-top: 0;
	}
</style>
