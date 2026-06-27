<script lang="ts">
	import { formatDateTime } from '$lib/format';
	import { gameFilter } from '$lib/gameFilter.svelte';
	let { data } = $props();

	type Job = (typeof data.jobs)[number];
	type SortCol =
		| 'deliveredAt'
		| 'game'
		| 'fromCity'
		| 'toCity'
		| 'cargo'
		| 'cargoDamage'
		| 'distanceKm'
		| 'takenAt';

	let sortCol = $state<SortCol>('deliveredAt');
	let sortDir = $state<'asc' | 'desc'>('desc');

	// Numeric columns default to descending (biggest/newest first), text to ascending.
	const numericCols: SortCol[] = ['deliveredAt', 'takenAt', 'distanceKm', 'cargoDamage'];
	function toggleSort(col: SortCol) {
		if (sortCol === col) {
			sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		} else {
			sortCol = col;
			sortDir = numericCols.includes(col) ? 'desc' : 'asc';
		}
	}

	/** Cargo damage as a sortable number: unknown < none(0) < percentage. */
	const damageNum = (d: string | null) => {
		if (d == null || d === '') return -1;
		if (/^none$/i.test(d)) return 0;
		const n = parseFloat(d.replace(',', '.'));
		return Number.isFinite(n) ? n : 0;
	};

	const sortVal = (j: Job, col: SortCol): number | string => {
		switch (col) {
			case 'deliveredAt':
				return j.deliveredAt ?? 0;
			case 'takenAt':
				return j.takenAt ?? 0;
			case 'distanceKm':
				return j.distanceKm ?? 0;
			case 'cargoDamage':
				return damageNum(j.cargoDamage);
			case 'game':
				return j.game;
			case 'fromCity':
				return j.fromCity ?? '';
			case 'toCity':
				return j.toCity ?? '';
			case 'cargo':
				return j.cargo ?? '';
		}
	};

	const filtered = $derived(
		data.jobs.filter((j) => gameFilter.current === 'all' || j.game === gameFilter.current)
	);

	const sorted = $derived(
		[...filtered].sort((a, b) => {
			const va = sortVal(a, sortCol);
			const vb = sortVal(b, sortCol);
			const c =
				typeof va === 'number' && typeof vb === 'number'
					? va - vb
					: String(va).localeCompare(String(vb));
			return sortDir === 'asc' ? c : -c;
		})
	);

	// Game-specific summary for the current filter.
	const totalKm = $derived(filtered.reduce((s, j) => s + (j.distanceKm ?? 0), 0));
	const totalMass = $derived(filtered.reduce((s, j) => s + (j.massT ?? 0), 0));
	const damaged = $derived(filtered.filter((j) => damageNum(j.cargoDamage) > 0).length);

	// Pagination over the sorted/filtered rows.
	const PAGE_SIZES = [10, 25, 50, 100];
	let pageSize = $state(25);
	let page = $state(1);
	const pageCount = $derived(Math.max(1, Math.ceil(sorted.length / pageSize)));
	// Jump back to page 1 whenever the result set, ordering or page size changes.
	$effect(() => {
		void gameFilter.current;
		void sortCol;
		void sortDir;
		void pageSize;
		page = 1;
	});
	const paged = $derived(sorted.slice((page - 1) * pageSize, page * pageSize));
	const rangeStart = $derived(sorted.length === 0 ? 0 : (page - 1) * pageSize + 1);
	const rangeEnd = $derived(Math.min(page * pageSize, sorted.length));

	const fmt = (t: number | null) => formatDateTime(t);
	const dist = (km: number | null) => (km == null ? '—' : `${km.toLocaleString()} km`);
	const gameTag = $derived(gameFilter.current === 'all' ? '' : ` (${gameFilter.current.toUpperCase()})`);
</script>

{#snippet sortth(label: string, col: SortCol, cls = '')}
	<th class={cls}>
		<button type="button" class="sort" class:active={sortCol === col} onclick={() => toggleSort(col)}>
			<span>{label}</span>
			<span class="arr">{sortCol === col ? (sortDir === 'asc' ? '▲' : '▼') : ''}</span>
		</button>
	</th>
{/snippet}

<h1>Logs</h1>

<section class="panel">
	<h2>Job log <span class="muted">· {sorted.length} deliver{sorted.length === 1 ? 'y' : 'ies'}{gameTag}</span></h2>
	{#if data.jobs.length === 0}
		<p class="muted">
			No individual jobs captured yet. Per-job External Contract history comes from the
			logged-in “My Page” — add your credentials to <code>.env</code> and sync to populate this.
		</p>
	{:else}
		<p class="muted summary">
			{totalKm.toLocaleString()} km · {totalMass.toLocaleString()} t hauled · {damaged} with cargo
			damage
		</p>
		{#if sorted.length === 0}
			<p class="muted">No deliveries for this game filter.</p>
		{:else}
			<table>
				<thead>
					<tr>
						{@render sortth('Delivered', 'deliveredAt')}
						{@render sortth('Game', 'game')}
						{@render sortth('From', 'fromCity')}
						{@render sortth('To', 'toCity')}
						{@render sortth('Cargo', 'cargo')}
						{@render sortth('Damage', 'cargoDamage')}
						{@render sortth('Distance', 'distanceKm', 'num')}
						{@render sortth('Taken', 'takenAt')}
					</tr>
				</thead>
				<tbody>
					{#each paged as j (j.id)}
						<tr>
							<td class="nowrap">{j.deliveredAt ? fmt(j.deliveredAt) : '—'}</td>
							<td><span class="tag">{j.game}</span></td>
							<td>{j.fromCity ?? '—'}{#if j.fromCompany}<span class="muted"> · {j.fromCompany}</span>{/if}</td>
							<td>{j.toCity ?? '—'}{#if j.toCompany}<span class="muted"> · {j.toCompany}</span>{/if}</td>
							<td>{j.cargo ?? '—'}</td>
							<td><span class:dmg={damageNum(j.cargoDamage) > 0}>{j.cargoDamage ?? '—'}</span></td>
							<td class="num nowrap">{dist(j.distanceKm)}</td>
							<td class="nowrap muted">{j.takenAt ? fmt(j.takenAt) : '—'}</td>
						</tr>
					{/each}
				</tbody>
			</table>

			<div class="pager">
				<div class="muted">Showing {rangeStart}–{rangeEnd} of {sorted.length}</div>
				<div class="pagectrls">
					<span class="psize muted">
						Per page
						<select bind:value={pageSize} aria-label="Rows per page">
							{#each PAGE_SIZES as n}<option value={n}>{n}</option>{/each}
						</select>
					</span>
					<button class="btn-ghost btn-sm" disabled={page <= 1} onclick={() => (page -= 1)}
						>‹ Prev</button
					>
					<span class="muted">Page {page} / {pageCount}</span>
					<button class="btn-ghost btn-sm" disabled={page >= pageCount} onclick={() => (page += 1)}
						>Next ›</button
					>
				</div>
			</div>
		{/if}
	{/if}
</section>

<details class="panel synchistory">
	<summary>
		<h2>Sync history <span class="muted">· {data.log.length} snapshot{data.log.length === 1 ? '' : 's'}</span></h2>
	</summary>
	<p class="muted">Each row is a snapshot of your global stats at the time of a sync.</p>
	{#if data.log.length === 0}
		<p class="muted">No syncs yet.</p>
	{:else}
		<table>
			<thead>
				<tr>
					<th>When</th>
					<th>Jobs</th>
					<th>Distance</th>
					<th>Mass</th>
					<th>Session</th>
				</tr>
			</thead>
			<tbody>
				{#each data.log as row}
					<tr>
						<td class="nowrap">{fmt(row.scrapedAt)}</td>
						<td>{row.jobs}</td>
						<td>{row.distance}</td>
						<td>{row.mass}</td>
						<td>
							{#if row.authenticated}<span class="tag">logged in</span>{:else}<span class="muted"
									>public</span
								>{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</details>

<style>
	.summary {
		margin-top: -0.25rem;
		margin-bottom: 0.75rem;
		font-size: 0.9rem;
	}
	.nowrap {
		white-space: nowrap;
	}
	.num {
		text-align: right;
	}
	th.num .sort {
		flex-direction: row-reverse;
	}
	.sort {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		background: transparent;
		border: none;
		padding: 0;
		width: auto;
		color: var(--muted);
		font: inherit;
		font-weight: 500;
		cursor: pointer;
	}
	.sort:hover,
	.sort.active {
		color: var(--text);
	}
	.arr {
		font-size: 0.65em;
		min-width: 0.6em;
	}
	.dmg {
		color: var(--danger);
		font-weight: 600;
	}
	.pager {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-top: 0.85rem;
		flex-wrap: wrap;
		font-size: 0.9rem;
	}
	.pagectrls {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}
	.psize {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}
	.psize select {
		width: auto;
		padding: 0.25rem 0.5rem;
		font-size: 0.85rem;
	}
	.synchistory {
		margin-top: 1rem;
	}
	.synchistory summary {
		cursor: pointer;
		list-style-position: inside;
	}
	.synchistory summary h2 {
		display: inline;
	}
</style>
