<script lang="ts">
	// 24-hour radial histogram (clock dial): midnight at top, clockwise. Each
	// spoke's length = deliveries in that hour. items must be hours 0..23 in order.
	let {
		items = [],
		color = 'var(--accent)'
	}: { items?: { label: string; value: number }[]; color?: string } = $props();

	const SIZE = 220; // includes padding so the hour labels never clip
	const C = SIZE / 2;
	const R0 = 34; // inner radius (empty hub for the peak label)
	const RMAX = 84; // outer radius at the busiest hour
	const RLABEL = 100; // hour tick labels

	const max = $derived(Math.max(1, ...items.map((i) => i.value)));
	const total = $derived(items.reduce((s, i) => s + i.value, 0));
	const peakHour = $derived(
		items.length ? items.reduce((bi, it, i, arr) => (it.value > arr[bi].value ? i : bi), 0) : 0
	);

	// hour → screen point (0 at top, clockwise like a 24h clock).
	const pt = (hour: number, r: number) => {
		const a = ((hour * 15 - 90) * Math.PI) / 180;
		return [C + r * Math.cos(a), C + r * Math.sin(a)] as const;
	};

	const bars = $derived(
		items.map((it, i) => {
			const len = (it.value / max) * (RMAX - R0);
			const [x1, y1] = pt(i, R0);
			const [x2, y2] = pt(i, R0 + len);
			return { x1, y1, x2, y2, value: it.value, hour: i };
		})
	);

	const ticks = [0, 6, 12, 18];
	const pad2 = (n: number) => String(n).padStart(2, '0');
</script>

{#if total > 0}
	<svg viewBox="0 0 {SIZE} {SIZE}" width="100%" role="img" aria-label="Deliveries by hour of day">
		<circle cx={C} cy={C} r={RMAX} class="grid" />
		<circle cx={C} cy={C} r={(R0 + RMAX) / 2} class="grid faint" />
		<circle cx={C} cy={C} r={R0} class="grid" />
		{#each bars as b}
			{#if b.value > 0}
				<line
					x1={b.x1}
					y1={b.y1}
					x2={b.x2}
					y2={b.y2}
					stroke={color}
					stroke-width="6"
					stroke-linecap="round"
					opacity={0.5 + 0.5 * (b.value / max)}
				>
					<title>{pad2(b.hour)}:00 — {b.value} deliver{b.value === 1 ? 'y' : 'ies'}</title>
				</line>
			{/if}
		{/each}
		{#each ticks as h}
			{@const [tx, ty] = pt(h, RLABEL)}
			<text x={tx} y={ty} class="tick" class:strong={h === 0}>{pad2(h)}</text>
		{/each}
		<text x={C} y={C - 3} class="peakv">{pad2(peakHour)}:00</text>
		<text x={C} y={C + 10} class="peakl">peak hour</text>
	</svg>
{:else}
	<p class="muted">No deliveries recorded yet.</p>
{/if}

<style>
	.grid {
		fill: none;
		stroke: var(--border);
		stroke-width: 1;
	}
	.grid.faint {
		opacity: 0.5;
	}
	.tick {
		font-size: 11px;
		fill: var(--muted);
		text-anchor: middle;
		dominant-baseline: middle;
	}
	.tick.strong {
		fill: var(--text);
		font-weight: 700;
	}
	.peakv {
		font-size: 15px;
		font-weight: 700;
		fill: var(--text);
		text-anchor: middle;
		dominant-baseline: middle;
	}
	.peakl {
		font-size: 8px;
		fill: var(--muted);
		text-anchor: middle;
		dominant-baseline: middle;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
</style>
