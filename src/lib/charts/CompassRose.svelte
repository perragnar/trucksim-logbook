<script lang="ts">
	// 8-point polar histogram of travel bearings. items in N,NE,E,SE,S,SW,W,NW order.
	let {
		items = [],
		color = 'var(--accent)'
	}: { items?: { label: string; value: number }[]; color?: string } = $props();

	const SIZE = 220;
	const C = SIZE / 2;
	const R = 88; // max wedge radius
	const max = $derived(Math.max(1, ...items.map((i) => i.value)));

	// Compass angle (0 = N, clockwise) → screen point at radius r.
	const pt = (angleDeg: number, r: number) => {
		const a = ((angleDeg - 90) * Math.PI) / 180; // -90: put North at top
		return [C + r * Math.cos(a), C + r * Math.sin(a)];
	};

	const wedges = $derived(
		items.map((it, i) => {
			const center = i * 45;
			const r = (it.value / max) * R;
			const [x1, y1] = pt(center - 20, r);
			const [x2, y2] = pt(center + 20, r);
			const [lx, ly] = pt(center, R + 14);
			return {
				d: `M ${C} ${C} L ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)} Z`,
				label: it.label,
				value: it.value,
				lx,
				ly
			};
		})
	);
	const rings = [0.25, 0.5, 0.75, 1];
</script>

{#if items.some((i) => i.value > 0)}
	<svg viewBox="0 0 {SIZE} {SIZE}" width="100%" role="img" aria-label="Travel bearings compass">
		{#each rings as g}
			<circle cx={C} cy={C} r={R * g} class="grid" />
		{/each}
		{#each wedges as w}
			{#if w.value > 0}
				<path d={w.d} fill={color} fill-opacity="0.7" stroke={color} stroke-width="1">
					<title>{w.label}: {w.value} trip{w.value === 1 ? '' : 's'}</title>
				</path>
			{/if}
		{/each}
		{#each wedges as w}
			<text x={w.lx} y={w.ly} class="dir" class:strong={w.label === 'N'}>{w.label}</text>
		{/each}
	</svg>
{:else}
	<p class="muted">Not enough mapped routes to compute bearings.</p>
{/if}

<style>
	.grid {
		fill: none;
		stroke: var(--border);
		stroke-width: 1;
	}
	.dir {
		font-size: 11px;
		fill: var(--muted);
		text-anchor: middle;
		dominant-baseline: middle;
	}
	.dir.strong {
		fill: var(--text);
		font-weight: 700;
	}
</style>
