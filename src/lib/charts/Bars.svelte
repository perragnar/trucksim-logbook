<script lang="ts">
	let {
		items = [],
		color = 'var(--accent-2)',
		gap = '0.5rem',
		showValues = true,
		labelEvery = 1,
		height = '160px'
	}: {
		items?: { label: string; value: number }[];
		color?: string;
		/** Gap between bars (CSS length). Use a small value for many bars. */
		gap?: string;
		/** Show the value label above each bar (turn off when bars are thin). */
		showValues?: boolean;
		/** Only render the axis label every Nth bar (1 = all). */
		labelEvery?: number;
		height?: string;
	} = $props();

	const max = $derived(Math.max(1, ...items.map((i) => i.value)));
</script>

<div class="bars" style="gap:{gap}; height:{height}">
	{#each items as it, i}
		<div class="col">
			<div class="barwrap">
				<div
					class="bar"
					style="height:{(it.value / max) * 100}%; background:{color}"
					title="{it.label}: {it.value}"
				>
					{#if showValues && it.value > 0}<span class="n">{it.value}</span>{/if}
				</div>
			</div>
			<div class="lbl">{i % labelEvery === 0 ? it.label : ''}</div>
		</div>
	{/each}
</div>

<style>
	.bars {
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: 1fr;
		align-items: end;
	}
	.col {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-width: 0;
	}
	.barwrap {
		flex: 1;
		display: flex;
		align-items: flex-end;
	}
	.bar {
		width: 100%;
		border-radius: 5px 5px 0 0;
		min-height: 2px;
		position: relative;
		transition: height 0.3s ease;
	}
	.n {
		position: absolute;
		top: -1.1rem;
		left: 0;
		right: 0;
		text-align: center;
		font-size: 0.72rem;
		color: var(--muted);
	}
	.lbl {
		text-align: center;
		font-size: 0.72rem;
		color: var(--muted);
		padding-top: 0.3rem;
		white-space: nowrap;
	}
</style>
