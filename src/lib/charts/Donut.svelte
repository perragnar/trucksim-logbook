<script lang="ts">
	let {
		segments = [],
		centerLabel = ''
	}: { segments?: { label: string; value: number; color: string }[]; centerLabel?: string } =
		$props();

	const total = $derived(segments.reduce((s, x) => s + x.value, 0));
	const R = 60;
	const C = 2 * Math.PI * R;

	const arcs = $derived.by(() => {
		let offset = 0;
		return segments.map((s) => {
			const frac = total ? s.value / total : 0;
			const arc = { ...s, dash: frac * C, gap: C - frac * C, offset: -offset * C, frac };
			offset += frac;
			return arc;
		});
	});
</script>

<div class="donut">
	<svg viewBox="0 0 160 160" width="150" height="150">
		<g transform="rotate(-90 80 80)">
			<circle cx="80" cy="80" r={R} fill="none" stroke="var(--panel-2)" stroke-width="18" />
			{#each arcs as a}
				<circle
					cx="80"
					cy="80"
					r={R}
					fill="none"
					stroke={a.color}
					stroke-width="18"
					stroke-dasharray="{a.dash} {a.gap}"
					stroke-dashoffset={a.offset}
				/>
			{/each}
		</g>
		<text x="80" y="76" text-anchor="middle" class="total">{total.toLocaleString()}</text>
		<text x="80" y="94" text-anchor="middle" class="cap">{centerLabel}</text>
	</svg>
	<div class="legend">
		{#each arcs as a}
			<div class="leg">
				<span class="dot" style="background:{a.color}"></span>
				<span class="name">{a.label}</span>
				<span class="muted">{Math.round(a.frac * 100)}%</span>
			</div>
		{/each}
	</div>
</div>

<style>
	.donut {
		display: flex;
		align-items: center;
		gap: 1.25rem;
		flex-wrap: wrap;
	}
	.total {
		font-size: 26px;
		font-weight: 700;
		fill: var(--text);
	}
	.cap {
		font-size: 11px;
		fill: var(--muted);
	}
	.legend {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.leg {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.85rem;
	}
	.dot {
		width: 10px;
		height: 10px;
		border-radius: 3px;
	}
	.name {
		min-width: 70px;
	}
</style>
