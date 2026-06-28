<script lang="ts">
	// A small flag standing in for the game: EU for ETS2, US for ATS.
	let { game, height = '0.85em' }: { game: string; height?: string } = $props();

	const FLAG: Record<string, string> = { ets2: 'eu', ats: 'us' };
	const LABEL: Record<string, string> = { ets2: 'ETS2', ats: 'ATS' };
</script>

{#if FLAG[game]}
	<img
		class="gameflag"
		src="https://flagcdn.com/{FLAG[game]}.svg"
		alt={LABEL[game]}
		title={LABEL[game]}
		style="height:{height}"
	/>
{/if}

<style>
	.gameflag {
		width: auto;
		border-radius: 2px;
		display: inline-block;
		vertical-align: -0.1em;
		box-shadow: 0 0 0 1px color-mix(in srgb, var(--border) 70%, transparent);
		flex-shrink: 0;
	}
</style>
