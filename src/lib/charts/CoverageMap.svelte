<script lang="ts">
	// Choropleth: shade the states/countries you've delivered in, grey out the rest.
	interface Region {
		name: string;
		rings: number[][][]; // rings of [lng,lat]
	}
	let {
		regions = [],
		visited = {},
		color = 'var(--accent)'
	}: { regions?: Region[]; visited?: Record<string, number>; color?: string } = $props();

	const W = 680;
	const pad = 12;

	const maxVisit = $derived(Math.max(1, ...Object.values(visited)));

	const view = $derived.by(() => {
		const all = regions.flatMap((r) => r.rings.flat());
		if (!all.length) return null;
		const meanLat = all.reduce((s, p) => s + p[1], 0) / all.length;
		const k = Math.cos((meanLat * Math.PI) / 180);
		const xs = all.map((p) => p[0] * k);
		const ys = all.map((p) => p[1]);
		const minX = Math.min(...xs);
		const maxX = Math.max(...xs);
		const minY = Math.min(...ys);
		const maxY = Math.max(...ys);
		const spanX = maxX - minX || 1;
		const spanY = maxY - minY || 1;
		const scale = (W - 2 * pad) / spanX;
		const H = spanY * scale + 2 * pad;
		const projX = (lng: number) => pad + (lng * k - minX) * scale;
		const projY = (lat: number) => H - (pad + (lat - minY) * scale);

		const shapes = regions
			.map((r) => {
				const count = visited[r.name] ?? 0;
				const d = r.rings
					.map(
						(ring) =>
							'M' +
							ring.map(([lng, lat]) => `${projX(lng).toFixed(1)},${projY(lat).toFixed(1)}`).join('L') +
							'Z'
					)
					.join(' ');
				return {
					d,
					name: r.name,
					count,
					opacity: count ? 0.35 + 0.6 * (count / maxVisit) : 0
				};
			})
			.sort((a, b) => a.count - b.count); // draw visited last (on top of borders)
		return { shapes, H };
	});
</script>

{#if view}
	<svg viewBox="0 0 {W} {view.H}" width="100%" role="img" aria-label="Coverage map">
		{#each view.shapes as s}
			<path
				d={s.d}
				class="region"
				class:visited={s.count > 0}
				fill={s.count > 0 ? color : 'var(--panel-2)'}
				fill-opacity={s.count > 0 ? s.opacity : 1}
			>
				<title>{s.name}{s.count ? ` · ${s.count} deliver${s.count === 1 ? 'y' : 'ies'}` : ' · not visited'}</title>
			</path>
		{/each}
	</svg>
{:else}
	<p class="muted">No region data.</p>
{/if}

<style>
	.region {
		stroke: var(--border);
		stroke-width: 0.6;
		stroke-linejoin: round;
	}
	.region.visited {
		stroke: var(--bg);
		stroke-width: 0.8;
	}
</style>
