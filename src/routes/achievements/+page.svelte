<script lang="ts">
	import { browser } from '$app/environment';
	import { formatDate, formatDateTime } from '$lib/format';
	import GameFlag from '$lib/components/GameFlag.svelte';
	import { gameFilter } from '$lib/gameFilter.svelte';

	let { data } = $props();

	const gameLabel: Record<string, string> = { ets2: 'ETS2', ats: 'ATS' };
	const gameColor: Record<string, string> = { ets2: 'var(--ets2)', ats: 'var(--ats)' };

	type Game = NonNullable<typeof data.steam>['achievements'][number];
	type Ach = Game['items'][number];

	// Achievements per game, filtered by the shared header toggle.
	const games = $derived(
		(data.steam?.achievements ?? []).filter(
			(g) => gameFilter.current === 'all' || g.game === gameFilter.current
		)
	);

	// Completed first (newest unlock first); then locked, easiest (most common) first.
	const completed = (g: Game) =>
		g.items.filter((i) => i.unlocked).sort((a, b) => (b.unlockedAt ?? 0) - (a.unlockedAt ?? 0));
	const locked = (g: Game) =>
		g.items
			.filter((i) => !i.unlocked)
			.sort((a, b) => (b.globalPercent ?? -1) - (a.globalPercent ?? -1));

	const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

	// Tracked achievements ("want to do / doing"), pinned to the top of each game.
	// Stored per-browser in localStorage so it also works on the published snapshot.
	const TRACK_KEY = 'trucksim-tracked-achievements';
	const HIDE_KEY = 'trucksim-hide-completed-ach';
	let tracked = $state<Set<string>>(new Set());
	let hideCompleted = $state(false);
	let trackLoaded = false;
	$effect(() => {
		if (!browser || trackLoaded) return;
		trackLoaded = true;
		try {
			const raw = localStorage.getItem(TRACK_KEY);
			if (raw) tracked = new Set(JSON.parse(raw) as string[]);
		} catch {
			// ignore malformed storage
		}
		hideCompleted = localStorage.getItem(HIDE_KEY) === '1';
	});
	function setHideCompleted(v: boolean) {
		hideCompleted = v;
		if (browser) localStorage.setItem(HIDE_KEY, v ? '1' : '0');
	}
	const idOf = (game: string, ac: Ach) => `${game}:${ac.name}`;
	function toggleTrack(id: string) {
		const next = new Set(tracked);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		tracked = next;
		if (browser) localStorage.setItem(TRACK_KEY, JSON.stringify([...next]));
	}
	// Tracked, uncompleted first, then by rarity (most common ≈ closest).
	const tracking = (g: Game) =>
		g.items
			.filter((i) => tracked.has(idOf(g.game, i)))
			.sort(
				(a, b) => Number(a.unlocked) - Number(b.unlocked) || (b.globalPercent ?? -1) - (a.globalPercent ?? -1)
			);
</script>

<svelte:head><title>Achievements · TruckSim Logbook</title></svelte:head>

<div class="pagehead">
	<h1>Achievements</h1>
	<label class="hidetoggle">
		<input
			type="checkbox"
			checked={hideCompleted}
			onchange={(e) => setHideCompleted(e.currentTarget.checked)}
		/>
		Hide completed
	</label>
</div>

{#if !games.length}
	<section class="panel">
		<p class="muted">
			No Steam achievements to show. Set <code>STEAM_API_KEY</code> and
			<code>STEAM_ID</code> and sync, and make sure your Steam achievement list is public.
		</p>
	</section>
{:else}
	{#each games as g (g.game)}
		{@const trackedList = tracking(g)}
		{@const done = completed(g).filter((i) => !tracked.has(idOf(g.game, i)))}
		{@const todo = locked(g).filter((i) => !tracked.has(idOf(g.game, i)))}
		<section class="panel gamesec">
			<header class="gh">
				<h2 style="color:{gameColor[g.game]}">
					<GameFlag game={g.game} height="1em" />
					{gameLabel[g.game] ?? g.game}
				</h2>
				<div class="prog">
					<span class="count">{g.earned}<span class="muted">/{g.total}</span></span>
					<span class="muted pctlbl">{pct(g.earned, g.total)}%</span>
				</div>
			</header>
			<div class="pbar"><div class="pfill" style="width:{pct(g.earned, g.total)}%"></div></div>

			{#snippet row(ac: Ach)}
				{@const id = idOf(g.game, ac)}
				<details class="ach" class:done={ac.unlocked}>
					<summary>
						<span class="chev" aria-hidden="true">›</span>
						{#if ac.unlocked ? ac.icon : (ac.iconGray ?? ac.icon)}
							<img class="ico" src={ac.unlocked ? ac.icon : (ac.iconGray ?? ac.icon)} alt="" loading="lazy" />
						{:else}
							<span class="ico placeholder" aria-hidden="true">{ac.unlocked ? '🏆' : '🔒'}</span>
						{/if}
						<span class="name">
							<span class="title">
								{ac.name}
								{#if ac.hidden && !ac.unlocked}<span class="tag hidden">Hidden</span>{/if}
							</span>
							{#if !ac.unlocked && ac.progressCurrent != null && ac.progressMax}
								{@const p = Math.min(100, Math.round((ac.progressCurrent / ac.progressMax) * 100))}
								<span class="minibar" title="{ac.progressCurrent.toLocaleString()}/{ac.progressMax.toLocaleString()} · {p}%">
									<span class="minifill" style="width:{p}%"></span>
								</span>
							{/if}
						</span>
						<span class="meta">
							{#if ac.globalPercent != null}<span class="rar muted">{ac.globalPercent.toFixed(1)}%</span>{/if}
							{#if ac.unlocked}
								<span class="on">✓ {formatDate(ac.unlockedAt)}</span>
							{:else if ac.progressCurrent != null && ac.progressMax}
								<span class="proglbl">{ac.progressCurrent.toLocaleString()}/{ac.progressMax.toLocaleString()}</span>
							{:else}
								<span class="off muted">Locked</span>
							{/if}
						</span>
						<button
							class="track"
							class:on={tracked.has(id)}
							title={tracked.has(id) ? 'Untrack' : 'Track this achievement'}
							aria-label={tracked.has(id) ? 'Untrack achievement' : 'Track achievement'}
							aria-pressed={tracked.has(id)}
							onclick={(e) => {
								e.preventDefault();
								e.stopPropagation();
								toggleTrack(id);
							}}
						>
							{tracked.has(id) ? '★' : '☆'}
						</button>
					</summary>
					<div class="body">
						{#if ac.description}
							<p class="desc">{ac.description}</p>
						{:else if ac.hidden && !ac.unlocked}
							<p class="desc muted">Hidden achievement — unlock it to reveal the details.</p>
						{/if}
						<div class="facts">
							{#if ac.globalPercent != null}
								<span class="fact muted">🌍 {ac.globalPercent.toFixed(1)}% of players have this</span>
							{/if}
							{#if ac.unlocked && ac.unlockedAt}
								<span class="fact">🏆 Unlocked {formatDateTime(ac.unlockedAt)}</span>
							{/if}
						</div>
					</div>
				</details>
			{/snippet}

			{#if trackedList.length}
				<h3 class="grouph tracking">📌 Tracking <span class="muted">· {trackedList.length}</span></h3>
				<div class="achlist tracklist">{#each trackedList as ac (ac.name)}{@render row(ac)}{/each}</div>
			{/if}

			{#if !hideCompleted}
				<h3 class="grouph">Completed <span class="muted">· {done.length}</span></h3>
				{#if done.length}
					<div class="achlist">{#each done as ac (ac.name)}{@render row(ac)}{/each}</div>
				{:else}
					<p class="muted empty">Nothing unlocked yet.</p>
				{/if}
			{/if}

			<h3 class="grouph">Uncompleted <span class="muted">· {todo.length}</span></h3>
			{#if todo.length}
				<div class="achlist">{#each todo as ac (ac.name)}{@render row(ac)}{/each}</div>
			{:else}
				<p class="muted empty">All done here — nice! 🎉</p>
			{/if}
		</section>
	{/each}
{/if}

<style>
	.pagehead {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
		margin-bottom: 1rem;
	}
	.pagehead h1 {
		margin: 0;
	}
	.hidetoggle {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		font-size: 0.9rem;
		color: var(--muted);
		cursor: pointer;
		user-select: none;
	}
	.hidetoggle input {
		width: auto;
		accent-color: var(--accent);
		cursor: pointer;
	}
	.gamesec + .gamesec {
		margin-top: 1rem;
	}
	.gh {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
	}
	.gh h2 {
		margin: 0;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.prog {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
	}
	.count {
		font-size: 1.25rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}
	.count .muted {
		font-weight: 400;
		font-size: 0.95rem;
	}
	.pctlbl {
		font-size: 0.9rem;
	}
	.pbar {
		background: var(--panel-2);
		border: 1px solid var(--accent);
		border-radius: 999px;
		height: 12px;
		padding: 1px;
		overflow: hidden;
		margin: 0.6rem 0 0.25rem;
	}
	.pfill {
		height: 100%;
		background: var(--accent);
		border-radius: 999px;
	}
	.grouph {
		font-size: 1rem;
		margin: 1.25rem 0 0.5rem;
	}
	.empty {
		font-size: 0.9rem;
		margin: 0.25rem 0 0;
	}
	.achlist {
		display: flex;
		flex-direction: column;
		border: 1px solid var(--border);
		border-radius: 10px;
		overflow: hidden;
	}
	.ach + .ach {
		border-top: 1px solid var(--border);
	}
	.ach summary {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		padding: 0.55rem 0.75rem;
		cursor: pointer;
		list-style: none;
		user-select: none;
	}
	.ach summary::-webkit-details-marker {
		display: none;
	}
	.ach summary:hover {
		background: var(--panel-2);
	}
	.chev {
		color: var(--muted);
		font-size: 1.1rem;
		line-height: 1;
		transition: transform 0.15s ease;
		flex-shrink: 0;
	}
	.ach[open] .chev {
		transform: rotate(90deg);
	}
	.ico {
		width: 32px;
		height: 32px;
		border-radius: 6px;
		flex-shrink: 0;
	}
	.ico.placeholder {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: var(--panel-2);
		font-size: 1rem;
	}
	.ach:not(.done) .ico {
		filter: grayscale(1);
		opacity: 0.65;
	}
	.name {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}
	.title {
		font-weight: 600;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.ach:not(.done) .title {
		font-weight: 500;
		color: var(--muted);
	}
	.minibar {
		width: 100%;
		max-width: 240px;
		height: 9px;
		background: var(--panel-2);
		border: 1px solid var(--accent-2);
		border-radius: 999px;
		padding: 1px;
		overflow: hidden;
	}
	.minifill {
		display: block;
		height: 100%;
		background: var(--accent-2);
		border-radius: 999px;
	}
	.tag.hidden {
		font-size: 0.68rem;
		padding: 0.05rem 0.4rem;
	}
	.meta {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-shrink: 0;
		font-size: 0.82rem;
		white-space: nowrap;
	}
	.track {
		flex-shrink: 0;
		background: none;
		border: none;
		cursor: pointer;
		font-size: 1.1rem;
		line-height: 1;
		padding: 0.15rem;
		color: var(--muted);
		border-radius: 6px;
	}
	.track:hover {
		color: var(--accent);
		background: var(--panel-2);
	}
	.track.on {
		color: var(--accent);
	}
	.grouph.tracking {
		margin-top: 0.5rem;
	}
	.tracklist {
		border-color: var(--accent);
	}
	.rar {
		font-variant-numeric: tabular-nums;
	}
	.on {
		color: var(--global);
	}
	.proglbl {
		color: var(--accent-2);
		font-variant-numeric: tabular-nums;
		font-weight: 600;
	}
	.body {
		padding: 0 0.75rem 0.8rem 2.4rem;
	}
	.desc {
		margin: 0 0 0.5rem;
		font-size: 0.9rem;
	}
	.facts {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem 1rem;
		font-size: 0.82rem;
	}

	@media (max-width: 640px) {
		.ach summary {
			flex-wrap: wrap;
		}
		.name {
			flex-basis: calc(100% - 3rem);
		}
		.meta {
			margin-left: 2.4rem;
		}
		.body {
			padding-left: 0.75rem;
		}
	}
</style>
