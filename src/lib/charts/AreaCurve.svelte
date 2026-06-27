<script lang="ts">
	import { formatDate } from '$lib/format';
	interface Point {
		t: number;
		value: number;
	}
	let {
		points = [],
		color = 'var(--accent)',
		label = '',
		format = (n: number) => n.toLocaleString()
	}: {
		points?: Point[];
		color?: string;
		label?: string;
		format?: (n: number) => string;
	} = $props();

	const W = 680;
	const H = 220;
	const padX = 8;
	const padTop = 22;
	const padBottom = 26;

	// Unique id so multiple gradients on one page don't collide.
	const uid = $props.id();

	const view = $derived.by(() => {
		const pts = points.filter((p) => Number.isFinite(p.value));
		if (pts.length < 2) return null;

		const xs = pts.map((p) => p.t);
		const ys = pts.map((p) => p.value);
		const minX = Math.min(...xs);
		const maxX = Math.max(...xs);
		const maxY = Math.max(...ys);
		const minY = Math.min(0, ...ys);

		const sx = (x: number) => padX + ((x - minX) / (maxX - minX || 1)) * (W - 2 * padX);
		const sy = (y: number) =>
			H - padBottom - ((y - minY) / (maxY - minY || 1)) * (H - padTop - padBottom);

		// Scale to screen space, merging points that share an x (keep the latest
		// value) so clustered timestamps don't create vertical jumps.
		const sp: { x: number; y: number }[] = [];
		for (const p of pts) {
			const x = sx(p.t);
			const y = sy(p.value);
			if (sp.length && Math.abs(x - sp[sp.length - 1].x) < 0.5) sp[sp.length - 1] = { x, y };
			else sp.push({ x, y });
		}
		if (sp.length < 2) return null;

		// Monotone cubic Hermite (Fritsch–Carlson): smooth but no overshoot/wiggle,
		// which is exactly what a monotonic cumulative series needs.
		const n = sp.length;
		const dx = new Array(n - 1);
		const slope = new Array(n - 1);
		for (let i = 0; i < n - 1; i++) {
			dx[i] = sp[i + 1].x - sp[i].x;
			slope[i] = (sp[i + 1].y - sp[i].y) / dx[i];
		}
		const m = new Array(n);
		m[0] = slope[0];
		m[n - 1] = slope[n - 2];
		for (let i = 1; i < n - 1; i++) {
			if (slope[i - 1] * slope[i] <= 0) m[i] = 0;
			else m[i] = (slope[i - 1] + slope[i]) / 2;
		}
		for (let i = 0; i < n - 1; i++) {
			if (slope[i] === 0) {
				m[i] = 0;
				m[i + 1] = 0;
				continue;
			}
			const a = m[i] / slope[i];
			const b = m[i + 1] / slope[i];
			const h = a * a + b * b;
			if (h > 9) {
				const t = 3 / Math.sqrt(h);
				m[i] = t * a * slope[i];
				m[i + 1] = t * b * slope[i];
			}
		}

		let d = `M ${sp[0].x},${sp[0].y}`;
		for (let i = 0; i < n - 1; i++) {
			const h = dx[i];
			const c1x = sp[i].x + h / 3;
			const c1y = sp[i].y + (m[i] * h) / 3;
			const c2x = sp[i + 1].x - h / 3;
			const c2y = sp[i + 1].y - (m[i + 1] * h) / 3;
			d += ` C ${c1x},${c1y} ${c2x},${c2y} ${sp[i + 1].x},${sp[i + 1].y}`;
		}
		const baseY = sy(minY);
		const area = `${d} L ${sp[sp.length - 1].x},${baseY} L ${sp[0].x},${baseY} Z`;

		return {
			line: d,
			area,
			last: sp[sp.length - 1],
			lastVal: ys[ys.length - 1],
			maxY,
			startDate: new Date(minX),
			endDate: new Date(maxX)
		};
	});

	const fmtDate = (d: Date) => formatDate(d);
</script>

<div class="chart">
	{#if label}<div class="muted lbl">{label}</div>{/if}
	{#if view}
		<svg viewBox="0 0 {W} {H}" width="100%" role="img" aria-label={label}>
			<defs>
				<linearGradient id="grad-{uid}" x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%" stop-color={color} stop-opacity="0.35" />
					<stop offset="100%" stop-color={color} stop-opacity="0" />
				</linearGradient>
			</defs>
			<path d={view.area} fill="url(#grad-{uid})" />
			<path d={view.line} fill="none" stroke={color} stroke-width="2.5" stroke-linejoin="round" />
			<circle cx={view.last.x} cy={view.last.y} r="4" fill={color} />
			<text x={view.last.x} y={view.last.y - 9} class="peak" text-anchor="end" fill={color}>
				{format(view.lastVal)}
			</text>
			<text x={padX} y={H - 6} class="axis">{fmtDate(view.startDate)}</text>
			<text x={W - padX} y={H - 6} class="axis" text-anchor="end">{fmtDate(view.endDate)}</text>
		</svg>
	{:else}
		<div class="empty muted">Not enough data yet.</div>
	{/if}
</div>

<style>
	.lbl {
		font-size: 0.8rem;
		margin-bottom: 0.25rem;
	}
	.peak {
		font-size: 13px;
		font-weight: 700;
	}
	.axis {
		font-size: 11px;
		fill: var(--muted);
	}
	.empty {
		font-size: 0.8rem;
		padding: 1rem 0;
	}
</style>
