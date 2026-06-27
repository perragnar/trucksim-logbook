<script lang="ts">
	let {
		items = [],
		color = 'var(--accent)',
		unit = ''
	}: { items?: { label: string; value: number }[]; color?: string; unit?: string } = $props();

	const max = $derived(Math.max(1, ...items.map((i) => i.value)));
</script>

<div class="barlist">
	{#each items as it}
		<div class="row">
			<div class="name" title={it.label}>{it.label}</div>
			<div class="track">
				<div class="fill" style="width:{(it.value / max) * 100}%; background:{color}"></div>
			</div>
			<div class="val">{it.value.toLocaleString()}{unit}</div>
		</div>
	{:else}
		<div class="muted">No data.</div>
	{/each}
</div>

<style>
	.barlist {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}
	.row {
		display: grid;
		grid-template-columns: 40% 1fr auto;
		align-items: center;
		gap: 0.6rem;
		font-size: 0.85rem;
	}
	.name {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.track {
		background: var(--panel-2);
		border-radius: 999px;
		height: 10px;
		overflow: hidden;
	}
	.fill {
		height: 100%;
		border-radius: 999px;
		min-width: 3px;
		transition: width 0.3s ease;
	}
	.val {
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}
</style>
