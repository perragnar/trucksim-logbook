<script lang="ts">
	interface City {
		name: string;
		lat: number;
		lng: number;
		visits: number;
	}
	interface Edge {
		from: string;
		to: string;
		count: number;
		dist: number;
	}
	let {
		cities = [],
		edges = [],
		outline = [],
		unit = 'km',
		color = 'var(--accent)'
	}: {
		cities?: City[];
		edges?: Edge[];
		outline?: number[][][];
		unit?: string;
		color?: string;
	} = $props();

	const W = 680;
	const pad = 38;
	const MARGIN = 0.55; // expand around the city bbox so surrounding land is visible

	const view = $derived.by(() => {
		if (cities.length < 1) return null;

		// Equirectangular projection with longitude squeezed by cos(meanLat) so the
		// shape isn't stretched horizontally at higher latitudes.
		const meanLat = cities.reduce((s, c) => s + c.lat, 0) / cities.length;
		const k = Math.cos((meanLat * Math.PI) / 180);
		const px = (lng: number, _lat: number) => lng * k;
		const py = (_lng: number, lat: number) => lat;

		const xs = cities.map((c) => px(c.lng, c.lat));
		const ys = cities.map((c) => py(c.lng, c.lat));
		let minX = Math.min(...xs);
		let maxX = Math.max(...xs);
		let minY = Math.min(...ys);
		let maxY = Math.max(...ys);
		// Add a margin around the cities so coastlines/borders show around them.
		const mx = (maxX - minX || 1) * MARGIN;
		const my = (maxY - minY || 1) * MARGIN;
		minX -= mx;
		maxX += mx;
		minY -= my;
		maxY += my;
		const spanX = maxX - minX || 1;
		const spanY = maxY - minY || 1;

		// Fit to width, then size the height to the region's aspect ratio (clamped),
		// so wide regions (USA) aren't padded with dead vertical space.
		const scale = (W - 2 * pad) / spanX;
		const contentH = spanY * scale;
		const H = Math.max(240, Math.min(560, contentH + 2 * pad));
		const offY = (H - contentH) / 2;
		const projX = (lng: number, lat: number) => pad + (px(lng, lat) - minX) * scale;
		const projY = (lng: number, lat: number) => H - (offY + (py(lng, lat) - minY) * scale); // flip Y
		const sx = (c: { lat: number; lng: number }) => projX(c.lng, c.lat);
		const sy = (c: { lat: number; lng: number }) => projY(c.lng, c.lat);

		// Project the geographic outline (rings of [lng,lat]) into one SVG path.
		const land = outline
			.map(
				(ring) =>
					'M' + ring.map(([lng, lat]) => `${projX(lng, lat).toFixed(1)},${projY(lng, lat).toFixed(1)}`).join('L') + 'Z'
			)
			.join(' ');

		const pos = new Map(cities.map((c) => [c.name, { x: sx(c), y: sy(c) }]));
		const maxVisits = Math.max(...cities.map((c) => c.visits));
		const maxCount = Math.max(...edges.map((e) => e.count), 1);

		const arcs = edges
			.map((e) => {
				const a = pos.get(e.from);
				const b = pos.get(e.to);
				if (!a || !b) return null;
				// Gentle arc: control point offset perpendicular to the chord.
				const cmx = (a.x + b.x) / 2;
				const cmy = (a.y + b.y) / 2;
				const dx = b.x - a.x;
				const dy = b.y - a.y;
				const len = Math.hypot(dx, dy) || 1;
				const cx = cmx - (dy / len) * len * 0.15;
				const cy = cmy + (dx / len) * len * 0.15;
				return {
					d: `M ${a.x},${a.y} Q ${cx},${cy} ${b.x},${b.y}`,
					opacity: 0.2 + 0.6 * (e.count / maxCount),
					edge: e
				};
			})
			.filter(Boolean) as { d: string; opacity: number; edge: Edge }[];

		const dots = cities.map((c) => {
			const p = pos.get(c.name)!;
			return { ...c, x: p.x, y: p.y, r: 3 + 5 * Math.sqrt(c.visits / maxVisits) };
		});

		return { arcs, dots, H, land };
	});

	// Hover tooltip — positioned in the wrapper's pixel space.
	let wrapEl = $state<HTMLDivElement>();
	let tip = $state<{ x: number; y: number; title: string; sub: string } | null>(null);

	function show(e: PointerEvent, title: string, sub: string) {
		if (!wrapEl) return;
		const r = wrapEl.getBoundingClientRect();
		tip = { x: e.clientX - r.left, y: e.clientY - r.top, title, sub };
	}
	const hide = () => (tip = null);

	const fmt = (n: number) => n.toLocaleString();
</script>

{#if view}
	<div class="mapwrap" bind:this={wrapEl}>
		<svg viewBox="0 0 {W} {view.H}" width="100%" role="img" aria-label="Route map">
			{#if view.land}
				<path d={view.land} class="land" fill-rule="evenodd" />
			{/if}
			{#each view.arcs as arc}
				<path d={arc.d} fill="none" stroke={color} stroke-width="1.5" stroke-opacity={arc.opacity} />
			{/each}
			<!-- Wide invisible hit paths for easy hovering of thin routes. -->
			{#each view.arcs as arc}
				<path
					d={arc.d}
					fill="none"
					stroke="transparent"
					stroke-width="12"
					class="hit"
					role="presentation"
					onpointerenter={(e) =>
						show(
							e,
							`${arc.edge.from} → ${arc.edge.to}`,
							`${arc.edge.count} trip${arc.edge.count === 1 ? '' : 's'} · ${fmt(arc.edge.dist)} ${unit} total`
						)}
					onpointermove={(e) =>
						show(
							e,
							`${arc.edge.from} → ${arc.edge.to}`,
							`${arc.edge.count} trip${arc.edge.count === 1 ? '' : 's'} · ${fmt(arc.edge.dist)} ${unit} total`
						)}
					onpointerleave={hide}
				/>
			{/each}
			{#each view.dots as c}
				<circle
					cx={c.x}
					cy={c.y}
					r={c.r}
					fill={color}
					fill-opacity="0.9"
					class="hit"
					role="presentation"
					onpointerenter={(e) =>
						show(e, c.name, `${c.visits} visit${c.visits === 1 ? '' : 's'}`)}
					onpointermove={(e) => show(e, c.name, `${c.visits} visit${c.visits === 1 ? '' : 's'}`)}
					onpointerleave={hide}
				/>
				<text x={c.x} y={c.y - c.r - 3} text-anchor="middle" class="city">{c.name}</text>
			{/each}
		</svg>
		{#if tip}
			<div class="tip" style="left:{tip.x}px; top:{tip.y}px">
				<div class="tip-title">{tip.title}</div>
				<div class="tip-sub">{tip.sub}</div>
			</div>
		{/if}
	</div>
{:else}
	<div class="empty muted">No mappable routes for this game yet.</div>
{/if}

<style>
	.mapwrap {
		position: relative;
	}
	.land {
		fill: var(--panel-2);
		stroke: var(--border);
		stroke-width: 1;
		stroke-linejoin: round;
	}
	.city {
		font-size: 10px;
		fill: var(--muted);
		pointer-events: none;
	}
	.hit {
		cursor: pointer;
	}
	.tip {
		position: absolute;
		transform: translate(-50%, calc(-100% - 10px));
		background: var(--bg);
		border: 1px solid var(--accent);
		border-radius: 8px;
		padding: 0.4rem 0.6rem;
		pointer-events: none;
		white-space: nowrap;
		z-index: 5;
		box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
	}
	.tip-title {
		font-size: 0.85rem;
		font-weight: 700;
	}
	.tip-sub {
		font-size: 0.78rem;
		color: var(--muted);
	}
	.empty {
		font-size: 0.85rem;
		padding: 1rem 0;
	}
</style>
