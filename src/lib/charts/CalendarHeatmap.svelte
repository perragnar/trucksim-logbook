<script lang="ts">
	// GitHub-style contribution grid: one square per day, columns = weeks.
	interface Day {
		date: string; // 'YYYY-MM-DD'
		count: number;
	}
	let {
		days = [],
		maxCount = 0,
		color = 'var(--accent)'
	}: { days?: Day[]; maxCount?: number; color?: string } = $props();

	const CELL = 12;
	const GAP = 3;
	const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

	// Local-midnight Date from a 'YYYY-MM-DD' key (avoids UTC off-by-one).
	const parse = (k: string) => {
		const [y, m, d] = k.split('-').map(Number);
		return new Date(y, m - 1, d);
	};
	const key = (dt: Date) =>
		`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;

	const grid = $derived.by(() => {
		if (!days.length) return null;
		const counts = new Map(days.map((d) => [d.date, d.count]));
		const first = parse(days[0].date);
		const last = parse(days[days.length - 1].date);
		// Pad to whole weeks: start on the Sunday on/before first, end Saturday on/after last.
		const start = new Date(first);
		start.setDate(start.getDate() - start.getDay());
		const end = new Date(last);
		end.setDate(end.getDate() + (6 - end.getDay()));

		const cells: { x: number; y: number; date: string; count: number; level: number }[] = [];
		const monthLabels: { x: number; label: string }[] = [];
		let week = 0;
		let lastMonth = -1;
		for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
			const dow = dt.getDay();
			if (dow === 0) week = Math.round((dt.getTime() - start.getTime()) / (7 * 86400000));
			const k = key(dt);
			const count = counts.get(k) ?? 0;
			const level = count === 0 ? 0 : Math.min(4, Math.ceil((count / Math.max(1, maxCount)) * 4));
			cells.push({ x: week * (CELL + GAP), y: dow * (CELL + GAP), date: k, count, level });
			if (dt.getMonth() !== lastMonth && dt.getDate() <= 7) {
				monthLabels.push({ x: week * (CELL + GAP), label: MONTHS[dt.getMonth()] });
				lastMonth = dt.getMonth();
			}
		}
		const weeks = week + 1;
		return {
			cells,
			monthLabels,
			width: weeks * (CELL + GAP),
			height: 7 * (CELL + GAP)
		};
	});

	const fillOpacity = [0, 0.28, 0.5, 0.72, 1];
</script>

{#if grid}
	<div class="cal">
		<svg
			viewBox="0 0 {grid.width} {grid.height + 16}"
			width={grid.width}
			height={grid.height + 16}
			role="img"
			aria-label="Delivery calendar"
		>
			{#each grid.monthLabels as m}
				<text x={m.x} y="9" class="mlabel">{m.label}</text>
			{/each}
			<g transform="translate(0,16)">
				{#each grid.cells as c}
					<rect
						x={c.x}
						y={c.y}
						width={CELL}
						height={CELL}
						rx="2.5"
						class="cell"
						fill={c.level === 0 ? 'var(--panel-2)' : color}
						fill-opacity={c.level === 0 ? 1 : fillOpacity[c.level]}
					>
						<title>{c.count} deliver{c.count === 1 ? 'y' : 'ies'} · {c.date}</title>
					</rect>
				{/each}
			</g>
		</svg>
		<div class="legend muted">
			Less
			{#each [0, 1, 2, 3, 4] as l}
				<span
					class="sw"
					style="background:{l === 0 ? 'var(--panel-2)' : color}; opacity:{l === 0 ? 1 : fillOpacity[l]}"
				></span>
			{/each}
			More
		</div>
	</div>
{:else}
	<p class="muted">No dated deliveries yet.</p>
{/if}

<style>
	.cal {
		overflow-x: auto;
	}
	svg {
		max-width: none;
	}
	.mlabel {
		font-size: 9px;
		fill: var(--muted);
	}
	.cell {
		stroke: var(--border);
		stroke-width: 0.5;
	}
	.legend {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 0.72rem;
		margin-top: 0.5rem;
	}
	.sw {
		width: 11px;
		height: 11px;
		border-radius: 2.5px;
		display: inline-block;
		border: 0.5px solid var(--border);
	}
</style>
