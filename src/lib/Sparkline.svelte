<script lang="ts">
	interface Point {
		t: number;
		value: number | null;
	}
	let {
		points = [],
		color = '#f0922b',
		width = 260,
		height = 56
	}: { points?: Point[]; color?: string; width?: number; height?: number } = $props();

	const pad = 4;
	const clean = $derived(points.filter((p) => p.value != null) as { t: number; value: number }[]);

	const path = $derived.by(() => {
		if (clean.length < 2) return '';
		const xs = clean.map((p) => p.t);
		const ys = clean.map((p) => p.value);
		const minX = Math.min(...xs),
			maxX = Math.max(...xs);
		const minY = Math.min(...ys),
			maxY = Math.max(...ys);
		const sx = (x: number) =>
			pad + ((x - minX) / (maxX - minX || 1)) * (width - 2 * pad);
		const sy = (y: number) =>
			height - pad - ((y - minY) / (maxY - minY || 1)) * (height - 2 * pad);
		return clean.map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(p.t)},${sy(p.value)}`).join(' ');
	});
</script>

{#if clean.length >= 2}
	<svg {width} {height} viewBox="0 0 {width} {height}" preserveAspectRatio="none">
		<path d={path} fill="none" stroke={color} stroke-width="2" stroke-linejoin="round" />
	</svg>
{:else}
	<div class="empty muted">Not enough history yet — sync again later to see trends.</div>
{/if}

<style>
	.empty {
		font-size: 0.8rem;
		padding: 0.5rem 0;
	}
</style>
