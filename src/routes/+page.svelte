<script lang="ts">
	import Sparkline from '$lib/Sparkline.svelte';
	import AreaCurve from '$lib/charts/AreaCurve.svelte';
	import BarList from '$lib/charts/BarList.svelte';
	import Donut from '$lib/charts/Donut.svelte';
	import Bars from '$lib/charts/Bars.svelte';
	import CalendarHeatmap from '$lib/charts/CalendarHeatmap.svelte';
	import CompassRose from '$lib/charts/CompassRose.svelte';
	import CoverageMap from '$lib/charts/CoverageMap.svelte';
	import HourClock from '$lib/charts/HourClock.svelte';
	import { formatDateTime } from '$lib/format';
	import GameFlag from '$lib/components/GameFlag.svelte';
	import { gameFilter } from '$lib/gameFilter.svelte';
	import { widgetEnabled, orderedWidgets } from '$lib/widgets';
	let { data } = $props();

	const enabled = (id: string) => widgetEnabled(data.settings.widgets, id);
	const ordered = $derived(orderedWidgets(data.settings.order));

	const gameColor: Record<string, string> = {
		ets2: 'var(--ets2)',
		ats: 'var(--ats)',
		global: 'var(--global)'
	};
	const gameLabel: Record<string, string> = { ets2: 'ETS2', ats: 'ATS', global: 'Global' };
	const SPEC_ORDER = ['Performance', 'Cabin', 'Chassis', 'Engine', 'Gearbox', 'Shifting', 'Torque'];

	function headlineStat(game: string, key: string) {
		return (data.byGame[game] ?? []).find((s) => s.key === key);
	}

	const lastSync = $derived(data.snapshot ? formatDateTime(data.snapshot.scrapedAt) : null);

	// Header game filter applied to the profile widgets.
	const matchesGame = (g: string) => gameFilter.current === 'all' || g === gameFilter.current;
	const trucks = $derived((data.profile?.trucks ?? []).filter((t) => matchesGame(t.game)));

	// Steam playtime (optional), filtered by the header game toggle. Round each
	// game to whole hours and sum those, so Total always equals the parts shown.
	const steamRows = $derived(
		(data.steam?.games ?? [])
			.filter((g) => matchesGame(g.game))
			.map((g) => ({
				game: g.game,
				hrs: Math.round(g.playtimeForeverMin / 60),
				recentHrs: Math.round(g.playtime2weeksMin / 60)
			}))
	);
	const totalHrs = $derived(steamRows.reduce((s, r) => s + r.hrs, 0));
	const recent2wHrs = $derived(steamRows.reduce((s, r) => s + r.recentHrs, 0));

	// Steam achievements per game, filtered by the header toggle.
	const steamAch = $derived((data.steam?.achievements ?? []).filter((s) => matchesGame(s.game)));
	type AchItem = NonNullable<typeof data.steam>['achievements'][number]['items'][number];

	// Current (in-progress) contracts, with a live real-world countdown.
	const currentJobs = $derived((data.profile?.currentJobs ?? []).filter((j) => matchesGame(j.game)));
	let now = $state(Date.now());
	$effect(() => {
		if (!currentJobs.some((j) => j.deadline)) return;
		const id = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(id);
	});
	const pad2 = (n: number) => String(n).padStart(2, '0');
	function timeLeft(deadline: number | null) {
		if (!deadline) return null;
		const ms = deadline - now;
		const expired = ms <= 0;
		const s = Math.max(0, Math.floor(ms / 1000));
		const dd = Math.floor(s / 86400);
		const h = Math.floor((s % 86400) / 3600);
		const m = Math.floor((s % 3600) / 60);
		const text =
			dd > 0 ? `${dd}d ${h}h ${m}m` : h > 0 ? `${h}h ${pad2(m)}m` : `${m}m ${pad2(s % 60)}s`;
		return { text, expired, urgent: !expired && ms < 2 * 3600 * 1000 };
	}

	// Delivery analytics driven by the shared header game filter.
	const a = $derived(data.analytics[gameFilter.current]);
	const d = (n: number) => `${n.toLocaleString()} ${a?.unit ?? 'km'}`;
	const dur = (min: number | null) =>
		min == null ? '—' : min >= 60 ? `${Math.floor(min / 60)}h ${min % 60}m` : `${min} min`;

	const splitSegments = $derived(
		a
			? Object.entries(a.split).map(([g, v]) => ({
					label: g.toUpperCase(),
					value: v.count,
					color: g === 'ats' ? '#f0922b' : '#4fb0c6'
				}))
			: []
	);
	const recent = $derived(a?.recent);
	const delta7 = $derived(recent ? recent.last7.count - recent.prev7.count : 0);

	const qualitySegments = $derived(
		a
			? [
					{ label: 'Clean', value: a.cleanCount, color: 'var(--global)' },
					{ label: 'Damaged', value: a.damagedCount, color: 'var(--danger)' }
				]
			: []
	);

	// Haul-length buckets, coloured cool → warm as distance grows. Uses the fixed
	// game-palette vars (not the theme-tinted --accent) so all four stay distinct.
	const HAUL_COLORS = ['var(--ets2)', 'var(--global)', 'var(--ats)', 'var(--danger)'];
	const haulSegments = $derived(
		a ? a.haul.map((h, i) => ({ ...h, color: HAUL_COLORS[i % HAUL_COLORS.length] })) : []
	);

	// Coverage maps are per-game only (ATS = states, ETS2 = countries); hidden in "All".
	const coverageViews = $derived(
		(gameFilter.current === 'all' ? [] : ([gameFilter.current] as ('ats' | 'ets2')[]))
			.map((g) => ({
				game: g,
				label: g === 'ats' ? 'States' : 'Countries',
				color: gameColor[g],
				...data.coverage[g]
			}))
			.filter((c) => c.regions.length && c.count > 0)
	);
</script>

<div class="head">
	<h1>Dashboard</h1>
	<span class="muted">
		{#if lastSync}
			{data.snapshots} snapshot{data.snapshots === 1 ? '' : 's'} · last synced {lastSync}
			{#if data.snapshot?.authenticated}<span class="tag">logged in</span>{/if}
		{:else}
			No data yet
		{/if}
	</span>
</div>

<div class="dashgrid">
	{#each ordered as w (w.id)}
		{#if enabled(w.id)}{@render widget(w.id, w.wide ?? false)}{/if}
	{/each}
</div>

{#if !data.snapshot}
	<div class="panel nosnap">
		<p>No snapshots yet. Hit <strong>Sync now</strong> above to pull your World of Trucks stats.</p>
	</div>
{/if}

{#snippet widget(id: string, wide: boolean)}
	{#if id === 'profile'}
		{#if data.profile}
			{@const p = data.profile}
			<section class="panel profilecard" class:wide>
				{#if p.avatarUrl}<img class="avatar" src={p.avatarUrl} alt={p.username} />{/if}
				<div class="ident">
					<div class="pname">
						{p.username}
						{#if p.flagUrl}<img class="flag" src={p.flagUrl} alt={p.country} title={p.country} />{/if}
					</div>
					<div class="muted">{p.country ?? ''}</div>
				</div>
			</section>
		{/if}
	{:else if id === 'current-jobs'}
		{#if data.profile && currentJobs.length}
			<section class="panel" class:wide>
				<h2>Current jobs</h2>
				<div class="curjobs">
					{#each currentJobs as j}
						{@const tl = timeLeft(j.deadline)}
						<div class="curjob">
							<div class="cjhead">
								<div class="cjcargo">{j.cargo ?? 'Contract'}</div>
								<GameFlag game={j.game} height="1em" />
							</div>
							<div class="cjroute">
								<strong>{j.fromCity ?? '—'}</strong>{#if j.fromCompany}<span class="muted">
										· {j.fromCompany}</span
									>{/if}
								<span class="arrow">→</span>
								<strong>{j.toCity ?? '—'}</strong>{#if j.toCompany}<span class="muted">
										· {j.toCompany}</span
									>{/if}
							</div>
							<div class="cjmeta muted">
								{#if j.distanceKm != null}{j.distanceKm.toLocaleString()} km{/if}{#if j.massT != null}
									· {j.massT} t{/if}
							</div>
							{#if tl}
								<div class="cjtime" class:urgent={tl.urgent} class:expired={tl.expired}>
									<span class="cjclock">{tl.expired ? 'Overdue' : tl.text}</span>
									<span class="cjlabel muted">{tl.expired ? 'deadline passed' : 'real-world time left'}</span>
								</div>
							{:else}
								<div class="cjtime"><span class="cjlabel muted">No deadline</span></div>
							{/if}
						</div>
					{/each}
				</div>
			</section>
		{/if}
	{:else if id === 'current-rides'}
		{#if data.profile && trucks.length}
			<section class="panel" class:wide>
				<h2>Current rides</h2>
				<div class="trucks">
					{#each trucks as t}
						<div class="truckcard">
							{#if t.imageUrl}
								<a href={t.link} target="_blank" rel="noopener">
									<img class="truckphoto" src={t.imageUrl} alt={t.name} />
								</a>
							{/if}
							<div class="trow">
								<div class="tname">{t.name}</div>
								<GameFlag game={t.game} height="1em" />
							</div>
							{#if t.plateFrontUrl}
								<img class="plate" src={t.plateFrontUrl} alt={t.plate} referrerpolicy="no-referrer" />
							{/if}
							<table class="specs">
								<tbody>
									{#each SPEC_ORDER as key}
										{#if t.specs[key]}
											<tr><td class="muted">{key}</td><td>{t.specs[key]}</td></tr>
										{/if}
									{/each}
								</tbody>
							</table>
						</div>
					{/each}
				</div>
			</section>
		{/if}
	{:else if id === 'deliveries'}
		{#if data.snapshot && data.analytics.all}
			<section class="panel" class:wide>
				<h2>Deliveries</h2>
				{#if a}
					<div class="kpis">
						<div class="kpi"><div class="v">{a.count}</div><div class="muted lbl">Deliveries</div></div>
						<div class="kpi"><div class="v">{d(a.totalDist)}</div><div class="muted lbl">Distance driven</div></div>
						<div class="kpi"><div class="v">{a.totalMass.toLocaleString()} t</div><div class="muted lbl">Mass hauled</div></div>
						<div class="kpi"><div class="v">{d(a.avgDist)}</div><div class="muted lbl">Avg / job</div></div>
						<div class="kpi"><div class="v">{d(a.longestDist)}</div><div class="muted lbl">Longest job</div></div>
						<div class="kpi"><div class="v">{a.cleanRate}%</div><div class="muted lbl">Damage-free</div></div>
						<div class="kpi"><div class="v">{dur(a.avgDurationMin)}</div><div class="muted lbl">Avg time / job</div></div>
					</div>
					<div class="curves">
						<AreaCurve
							label="Cumulative distance"
							points={a.cumulative.map((c) => ({ t: c.t, value: c.dist }))}
							color="var(--accent)"
							format={d}
						/>
						<AreaCurve
							label="Cumulative deliveries"
							points={a.cumulative.map((c) => ({ t: c.t, value: c.jobs }))}
							color="var(--accent-2)"
						/>
					</div>
				{:else}
					<p class="muted">No deliveries recorded for this game yet.</p>
				{/if}
			</section>
		{/if}
	{:else if id === 'playtime'}
		{#if steamRows.length}
			<section class="panel" class:wide>
				<h3>Playtime <span class="muted">· Steam</span></h3>
				<div class="kpis">
					<div class="kpi"><div class="v">{totalHrs.toLocaleString()} h</div><div class="muted lbl">Total</div></div>
					{#each steamRows as r}
						<div class="kpi"><div class="v">{r.hrs.toLocaleString()} h</div><div class="muted lbl">{gameLabel[r.game]}</div></div>
					{/each}
					{#if recent2wHrs > 0}
						<div class="kpi"><div class="v">{recent2wHrs.toLocaleString()} h</div><div class="muted lbl">Last 2 weeks</div></div>
					{/if}
				</div>
			</section>
		{/if}
	{:else if id === 'hour-of-day'}
		{#if data.snapshot && a}
			<section class="panel" class:wide>
				<h3>When you drive <span class="muted">(by hour)</span></h3>
				<HourClock items={a.byHour} color="var(--accent-2)" />
			</section>
		{/if}
	{:else if id === 'activity-calendar'}
		{#if data.snapshot && a}
			<section class="panel" class:wide>
				<h3>
					Activity calendar
					<span class="muted">· {a.calendar.activeDays} active days</span>
				</h3>
				<div class="streaks">
					<div class="streak">
						<div class="sv">{a.calendar.currentDayStreak}</div>
						<div class="muted lbl">Current day streak 🔥</div>
					</div>
					<div class="streak">
						<div class="sv">{a.calendar.longestDayStreak}</div>
						<div class="muted lbl">Longest day streak</div>
					</div>
					<div class="streak">
						<div class="sv">{a.calendar.maxCount}</div>
						<div class="muted lbl">Busiest day (deliveries)</div>
					</div>
				</div>
				<CalendarHeatmap days={a.calendar.days} maxCount={a.calendar.maxCount} color="var(--accent)" />
			</section>
		{/if}
	{:else if id === 'coverage'}
		{#if data.snapshot && a && coverageViews.length}
			<section class="panel" class:wide>
				<h3>Where you've been <span class="muted">· region coverage</span></h3>
				<div class="coverage">
					{#each coverageViews as c}
						<div class="covcard">
							<div class="covhead">
								<span class="covcount" style="color:{c.color}">{c.count}</span>
								<span class="muted">{c.label.toLowerCase()} visited</span>
							</div>
							<CoverageMap regions={c.regions} visited={c.visited} color={c.color} />
						</div>
					{/each}
				</div>
			</section>
		{/if}
	{:else if id === 'geo-reach'}
		{#if data.snapshot && a && a.geoExtremes && gameFilter.current !== 'all'}
			{@const g = a.geoExtremes}
			<section class="panel" class:wide>
				<h3>Geographic reach <span class="muted">· {g.cityCount} cities mapped</span></h3>
				<div class="extremes">
					<div class="ex"><span class="exdir">▲ N</span><b>{g.north.city}</b><span class="muted">{g.north.lat.toFixed(1)}°</span></div>
					<div class="ex"><span class="exdir">▼ S</span><b>{g.south.city}</b><span class="muted">{g.south.lat.toFixed(1)}°</span></div>
					<div class="ex"><span class="exdir">▶ E</span><b>{g.east.city}</b><span class="muted">{g.east.lng.toFixed(1)}°</span></div>
					<div class="ex"><span class="exdir">◀ W</span><b>{g.west.city}</b><span class="muted">{g.west.lng.toFixed(1)}°</span></div>
				</div>
				<div class="ra2 muted">
					You range <strong>{d(g.latSpanKm)}</strong> north–south and
					<strong>{d(g.lngSpanKm)}</strong> east–west.
				</div>
			</section>
		{/if}
	{:else if id === 'recent-activity'}
		{#if data.snapshot && a && recent}
			<section class="panel" class:wide>
				<h3>Recent activity</h3>
				<div class="ra">
					<div class="ranum">{recent.last7.count}</div>
					<div class="muted">deliveries · last 7 days</div>
					<div class="radist">{d(recent.last7.dist)}</div>
					<div class="delta" class:up={delta7 > 0} class:down={delta7 < 0}>
						{#if delta7 > 0}▲ {delta7} more{:else if delta7 < 0}▼ {-delta7} fewer{:else}— same{/if}
						<span class="muted">vs previous 7 days</span>
					</div>
				</div>
				<div class="ra2 muted">
					Last 30 days: <strong>{recent.last30.count}</strong> deliveries · {d(recent.last30.dist)}
				</div>
			</section>
		{/if}
	{:else if id === 'biggest-hauls'}
		{#if data.snapshot && a}
			<section class="panel" class:wide>
				<h3>Biggest hauls</h3>
				<table class="biggest">
					<tbody>
						{#each a.biggest as b, i}
							<tr>
								<td class="rank">{i + 1}</td>
								<td>
									<div>
										{#if gameFilter.current === 'all'}<GameFlag game={b.game} height="0.9em" />{' '}{/if}<span class="place">{b.from}{#if b.fromCode}{' '}<span class="muted">({b.fromCode})</span>{/if}</span> →
										<span class="place">{b.to}{#if b.toCode}{' '}<span class="muted">({b.toCode})</span>{/if}</span>
									</div>
									{#if b.cargo}<div class="muted small">{b.cargo}</div>{/if}
								</td>
								<td class="num">{d(b.dist)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</section>
		{/if}
	{:else if id === 'latest-hauls'}
		{#if data.snapshot && a}
			<section class="panel" class:wide>
				<h3>Latest hauls</h3>
				<table class="latesthauls">
					<thead>
						<tr>
							<th>Delivered</th>
							<th>Route</th>
							<th>Cargo</th>
							<th class="num">Distance</th>
						</tr>
					</thead>
					<tbody>
						{#each a.latest as b}
							<tr>
								<td class="when">{b.when ? formatDateTime(b.when) : '—'}</td>
								<td class="route">
									{#if gameFilter.current === 'all'}<GameFlag game={b.game} height="0.9em" />{' '}{/if}<span class="place">{b.from}{#if b.fromCode}{' '}<span class="muted">({b.fromCode})</span>{/if}</span> →
									<span class="place">{b.to}{#if b.toCode}{' '}<span class="muted">({b.toCode})</span>{/if}</span>
								</td>
								<td class="cargo muted">{b.cargo ?? '—'}</td>
								<td class="num">{d(b.dist)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</section>
		{/if}
	{:else if id === 'game-split'}
		{#if data.snapshot && a && gameFilter.current === 'all'}
			<section class="panel" class:wide>
				<h3>Game split</h3>
				<Donut segments={splitSegments} centerLabel="jobs" />
			</section>
		{/if}
	{:else if id === 'delivery-quality'}
		{#if data.snapshot && a}
			<section class="panel" class:wide>
				<h3>Delivery quality</h3>
				<Donut segments={qualitySegments} centerLabel="jobs" />
				<div class="dmgstreak">
					<span><b class="ok">{a.damage.currentCleanStreak}</b> <span class="muted">clean now</span></span>
					<span><b>{a.damage.longestCleanStreak}</b> <span class="muted">best streak</span></span>
				</div>
			</section>
		{/if}
	{:else if id === 'damaged-cargo'}
		{#if data.snapshot && a && a.damage.byCargo.length}
			<section class="panel" class:wide>
				<h3>Most-damaged cargo</h3>
				<BarList items={a.damage.byCargo} color="var(--danger)" />
			</section>
		{/if}
	{:else if id === 'travel-directions'}
		{#if data.snapshot && a}
			<section class="panel" class:wide>
				<h3>Travel directions <span class="muted">· bearings</span></h3>
				<CompassRose items={a.compass} color="var(--accent)" />
			</section>
		{/if}
	{:else if id === 'haul-mix'}
		{#if data.snapshot && a}
			<section class="panel" class:wide>
				<h3>Haul-length mix</h3>
				<Donut segments={haulSegments} centerLabel="jobs" />
			</section>
		{/if}
	{:else if id === 'weekday'}
		{#if data.snapshot && a}
			<section class="panel weekday-widget" class:wide>
				<h3>Deliveries by weekday</h3>
				<Bars items={a.weekdays} color="var(--ets2)" />
			</section>
		{/if}
	{:else if id === 'top-cargo'}
		{#if data.snapshot && a}
			<section class="panel" class:wide>
				<h3>Top cargo</h3>
				<BarList items={a.topCargo} color="var(--accent)" />
			</section>
		{/if}
	{:else if id === 'busiest-routes'}
		{#if data.snapshot && a}
			<section class="panel" class:wide>
				<h3>Busiest routes</h3>
				<BarList items={a.topRoutes} color="var(--global)" />
			</section>
		{/if}
	{:else if id === 'top-destinations'}
		{#if data.snapshot && a}
			<section class="panel" class:wide>
				<h3>Top destinations</h3>
				<BarList items={a.topDestinations} color="var(--ets2)" />
			</section>
		{/if}
	{:else if id === 'top-pickup'}
		{#if data.snapshot && a}
			<section class="panel" class:wide>
				<h3>Top pickup companies</h3>
				<BarList items={a.topPickup} color="var(--ats)" />
			</section>
		{/if}
	{:else if id === 'top-delivery'}
		{#if data.snapshot && a}
			<section class="panel" class:wide>
				<h3>Top delivery companies</h3>
				<BarList items={a.topDelivery} color="var(--accent-2)" />
			</section>
		{/if}
	{:else if id === 'game-stats'}
		{#if data.snapshot}
			{#each data.games as g}
				{@const rows = data.byGame[g.key] ?? []}
				{#if rows.length}
					<section class="panel game" class:wide>
						<h2 style="color:{gameColor[g.key]}">{g.label}</h2>
						<div class="cards">
							{#each data.headline as key}
								{@const s = headlineStat(g.key, key)}
								{#if s}
									<div class="card">
										<div class="value">{s.valueRaw}</div>
										<div class="muted lbl">{s.label}</div>
									</div>
								{/if}
							{/each}
						</div>
						<details>
							<summary class="muted">All statistics ({rows.length})</summary>
							<table>
								<tbody>
									{#each rows as s}
										<tr>
											<td class="muted">{s.label}</td>
											<td>{s.valueRaw}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</details>
					</section>
				{/if}
			{/each}
		{/if}
	{:else if id === 'achievements'}
		{#if data.profile && data.profile.achievements.items.length}
			{@const ach = data.profile.achievements}
			<section class="panel" class:wide>
				<h2>World of Trucks achievements <span class="muted">· {ach.earned}/{ach.total} earned ({ach.percent}%)</span></h2>
				<div class="pbar wide"><div class="pfill" style="width:{ach.percent}%"></div></div>
				<div class="badges">
					{#each ach.items as ac}
						<div class="badge" class:locked={!ac.unlocked}>
							{#if ac.image}<img src={ac.image} alt={ac.name} />{/if}
							{#if ac.level && ac.unlocked}<span class="lvl">{ac.level}</span>{/if}
							<div class="bname">{ac.name}</div>
							{#if !ac.unlocked && ac.progress}
								{@const cur = Number(ac.progress.split('/')[0].replace(/,/g, ''))}
								{@const tot = Number(ac.progress.split('/')[1].replace(/,/g, ''))}
								{#if tot}
									<div class="bprog" title={ac.progress}>
										<div class="bprogfill" style="width:{Math.min(100, (cur / tot) * 100)}%"></div>
									</div>
									<div class="bprognum">{ac.progress}</div>
								{/if}
							{/if}
							<div class="atip">
								<div class="atip-head">
									{ac.name}
									{#if ac.level && ac.unlocked}<span class="atip-lvl">Lv {ac.level}</span>{/if}
								</div>
								<div class="atip-status" class:on={ac.unlocked}>
									{ac.unlocked ? '✓ Unlocked' : '🔒 Locked'}
								</div>
								{#if ac.description}<div class="atip-desc">{ac.description}</div>{/if}
								{#if ac.progress}
									{@const cur = Number(ac.progress.split('/')[0].replace(/,/g, ''))}
									{@const tot = Number(ac.progress.split('/')[1].replace(/,/g, ''))}
									<div class="atip-prog">
										<div class="atip-progrow">
											<span>Progress</span><span>{ac.progress}</span>
										</div>
										<div class="pbar">
											<div class="pfill" style="width:{tot ? Math.min(100, (cur / tot) * 100) : 0}%"></div>
										</div>
									</div>
								{/if}
								{#if ac.achievedOn}<div class="atip-on">🏆 Achieved {formatDateTime(ac.achievedOn, ac.achievedOn)}</div>{/if}
							</div>
						</div>
					{/each}
				</div>
			</section>
		{/if}
	{:else if id === 'steam-achievements'}
		{#if steamAch.length}
			<section class="panel" class:wide>
				<h2>Steam achievements</h2>
				{#each steamAch as sa}
					{@const unlocked = sa.items
						.filter((i) => i.unlocked)
						.sort((x, y) => (y.unlockedAt ?? 0) - (x.unlockedAt ?? 0))}
					{@const locked = sa.items.filter((i) => !i.unlocked)}
					<div class="steamgame">
						<h3 style="color:{gameColor[sa.game]}">
							{gameLabel[sa.game]}
							<span class="muted">· {sa.earned}/{sa.total} ({Math.round(sa.total ? (sa.earned / sa.total) * 100 : 0)}%)</span>
						</h3>
						<div class="pbar wide">
							<div class="pfill" style="width:{sa.total ? (sa.earned / sa.total) * 100 : 0}%"></div>
						</div>
						{#if unlocked.length}
							<div class="badges">
								{#each unlocked as ac}{@render achBadge(ac)}{/each}
							</div>
						{/if}
						{#if locked.length}
							<details class="locktoggle">
								<summary class="muted">Show {locked.length} locked</summary>
								<div class="badges lockedgrid">
									{#each locked as ac}{@render achBadge(ac)}{/each}
								</div>
							</details>
						{/if}
					</div>
				{/each}
			</section>
		{/if}
	{:else if id === 'trends'}
		{#if data.snapshot}
			<section class="panel" class:wide>
				<h2>Profile trends over syncs</h2>
				<div class="trends">
					<div>
						<div class="muted lbl">Jobs accomplished</div>
						<Sparkline points={data.trends.jobs} color="var(--global)" />
					</div>
					<div>
						<div class="muted lbl">Total distance</div>
						<Sparkline points={data.trends.distance} color="var(--accent-2)" />
					</div>
					<div>
						<div class="muted lbl">Total mass transported</div>
						<Sparkline points={data.trends.mass} color="var(--accent)" />
					</div>
				</div>
			</section>
		{/if}
	{/if}
{/snippet}

{#snippet achBadge(ac: AchItem)}
	<div class="badge" class:locked={!ac.unlocked}>
		{#if ac.icon}<img src={ac.icon} alt={ac.name} loading="lazy" />{/if}
		{#if ac.unlocked && ac.globalPercent != null && ac.globalPercent < 10}
			<span class="rarity">{ac.globalPercent.toFixed(1)}%</span>
		{/if}
		<div class="bname">{ac.name}</div>
		{#if !ac.unlocked && ac.progressCurrent != null && ac.progressMax}
			<div class="bprog" title="{ac.progressCurrent.toLocaleString()}/{ac.progressMax.toLocaleString()}">
				<div class="bprogfill" style="width:{Math.min(100, (ac.progressCurrent / ac.progressMax) * 100)}%"></div>
			</div>
			<div class="bprognum">{ac.progressCurrent.toLocaleString()}/{ac.progressMax.toLocaleString()}</div>
		{/if}
		<div class="atip">
			<div class="atip-head">
				{ac.name}
				{#if ac.hidden}<span class="atip-lvl">Hidden</span>{/if}
			</div>
			<div class="atip-status" class:on={ac.unlocked}>
				{ac.unlocked ? '✓ Unlocked' : '🔒 Locked'}
			</div>
			{#if ac.description}<div class="atip-desc">{ac.description}</div>{/if}
			{#if ac.globalPercent != null}
				<div class="atip-rarity muted">{ac.globalPercent.toFixed(1)}% of players have this</div>
			{/if}
			{#if ac.unlocked && ac.unlockedAt}
				<div class="atip-on">🏆 Achieved {formatDateTime(ac.unlockedAt)}</div>
			{/if}
		</div>
	</div>
{/snippet}

<style>
	.head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
		margin-bottom: 1rem;
	}
	.head h1 {
		margin: 0;
	}
	h2,
	h3 {
		margin-top: 0;
		margin-bottom: 1rem;
	}

	/* Ordered widget grid: wide widgets span the full row, others flow in columns. */
	.dashgrid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		gap: 1rem;
		align-items: stretch;
	}
	.dashgrid > :global(section.panel) {
		margin: 0;
		min-width: 0;
	}
	.dashgrid > :global(section.panel.wide) {
		grid-column: 1 / -1;
	}
	.nosnap {
		margin-top: 1rem;
	}
	.steamgame + .steamgame {
		margin-top: 1.5rem;
	}
	.locktoggle {
		margin-top: 0.85rem;
	}
	.lockedgrid {
		margin-top: 0.75rem;
	}
	.rarity {
		position: absolute;
		top: 4px;
		right: 5px;
		font-size: 0.58rem;
		font-weight: 700;
		color: var(--accent);
		background: color-mix(in srgb, var(--bg) 75%, transparent);
		border-radius: 4px;
		padding: 0 0.2rem;
	}
	.weekday-widget {
		display: flex;
		flex-direction: column;
	}
	.weekday-widget :global(.bars) {
		margin-top: auto;
	}

	.curjobs {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
		gap: 0.85rem;
	}
	.curjob {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		padding: 0.85rem 0.95rem;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: var(--panel-2);
	}
	.cjhead {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.cjcargo {
		font-weight: 600;
	}
	.cjroute {
		font-size: 0.92rem;
	}
	.cjroute .arrow {
		color: var(--muted);
		margin: 0 0.2rem;
	}
	.cjmeta {
		font-size: 0.82rem;
	}
	.cjtime {
		margin-top: 0.25rem;
		padding-top: 0.5rem;
		border-top: 1px solid var(--border);
		display: flex;
		flex-direction: column;
	}
	.cjclock {
		font-size: 1.35rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		color: var(--accent-2);
	}
	.cjtime.urgent .cjclock {
		color: var(--accent);
	}
	.cjtime.expired .cjclock {
		color: var(--danger);
	}
	.cjlabel {
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}
	.kpis {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
		gap: 0.75rem;
		margin-bottom: 1.25rem;
	}
	.kpi {
		background: var(--panel-2);
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 0.8rem 1rem;
	}
	.kpi .v {
		font-size: 1.35rem;
		font-weight: 700;
	}
	.curves {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.5rem;
	}
	.streaks {
		display: flex;
		gap: 1.5rem;
		flex-wrap: wrap;
		margin-bottom: 1rem;
	}
	.streak .sv {
		font-size: 1.6rem;
		font-weight: 800;
		line-height: 1;
	}
	.coverage {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
		gap: 1.25rem;
	}
	.covhead {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}
	.covcount {
		font-size: 1.6rem;
		font-weight: 800;
	}
	.extremes {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 0.75rem;
	}
	.ex {
		background: var(--panel-2);
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 0.7rem 0.9rem;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}
	.exdir {
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--accent);
		letter-spacing: 0.03em;
	}
	.dmgstreak {
		display: flex;
		justify-content: space-around;
		gap: 0.75rem;
		margin-top: 0.75rem;
		padding-top: 0.75rem;
		border-top: 1px solid var(--border);
		font-size: 0.95rem;
	}
	.dmgstreak b {
		font-size: 1.15rem;
	}
	.dmgstreak .ok {
		color: var(--global);
	}
	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 0.75rem;
	}
	.card {
		background: var(--panel-2);
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 0.9rem 1rem;
	}
	.value {
		font-size: 1.5rem;
		font-weight: 700;
	}
	.lbl {
		font-size: 0.8rem;
	}
	details {
		margin-top: 1rem;
	}
	summary {
		cursor: pointer;
		font-size: 0.85rem;
	}
	.trends {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: 1.25rem;
	}

	/* Profile card */
	.profilecard {
		display: flex;
		align-items: center;
		gap: 1.25rem;
		flex-wrap: wrap;
	}
	.avatar {
		width: 72px;
		height: 72px;
		border-radius: 50%;
		object-fit: cover;
		border: 2px solid var(--border);
	}
	.ident {
		flex: 1;
		min-width: 140px;
	}
	.pname {
		font-size: 1.4rem;
		font-weight: 700;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.flag {
		height: 18px;
		border-radius: 2px;
	}
	.pbar {
		background: var(--panel-2);
		border: 1px solid var(--accent);
		border-radius: 999px;
		height: 12px;
		padding: 1px;
		overflow: hidden;
		margin-top: 0.35rem;
	}
	.pbar.wide {
		margin-bottom: 1rem;
	}
	.pfill {
		height: 100%;
		background: var(--accent);
		border-radius: 999px;
	}

	/* Trucks */
	.trucks {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 1rem;
	}
	.truckcard {
		background: var(--panel-2);
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 0.75rem;
	}
	.truckphoto {
		width: 100%;
		aspect-ratio: 16 / 9;
		object-fit: cover;
		border-radius: 8px;
		display: block;
	}
	.trow {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin: 0.6rem 0;
	}
	.tname {
		font-size: 1.1rem;
		font-weight: 700;
	}
	.plate {
		height: 34px;
		border-radius: 3px;
		margin-bottom: 0.6rem;
	}
	.specs td {
		padding: 0.2rem 0.5rem 0.2rem 0;
		border: none;
		font-size: 0.85rem;
	}

	/* Recent activity */
	.ranum {
		font-size: 2.2rem;
		font-weight: 800;
		line-height: 1;
	}
	.radist {
		font-size: 1rem;
		margin-top: 0.2rem;
	}
	.delta {
		margin-top: 0.5rem;
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--muted);
	}
	.delta.up {
		color: var(--global);
	}
	.delta.down {
		color: var(--danger);
	}
	.delta .muted {
		font-weight: 400;
	}
	.ra2 {
		margin-top: 0.85rem;
		padding-top: 0.75rem;
		border-top: 1px solid var(--border);
		font-size: 0.9rem;
	}

	/* Biggest hauls */
	.biggest td {
		border: none;
		padding: 0.3rem 0.4rem;
		vertical-align: top;
	}
	/* Keep a city and its country/state code together; only break at the arrow. */
	.biggest .place {
		white-space: nowrap;
	}
	.biggest .rank {
		color: var(--muted);
		font-weight: 700;
		width: 1.5rem;
	}
	.biggest .num {
		text-align: right;
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}
	.biggest .small {
		font-size: 0.78rem;
	}

	/* Latest hauls */
	.latesthauls {
		width: 100%;
		border-collapse: collapse;
	}
	.latesthauls th {
		text-align: left;
		font-weight: 600;
		color: var(--muted);
		font-size: 0.8rem;
		padding: 0.35rem 0.5rem;
		border-bottom: 1px solid var(--border);
	}
	.latesthauls td {
		padding: 0.45rem 0.5rem;
		border-bottom: 1px solid var(--border);
		vertical-align: top;
	}
	.latesthauls tbody tr:last-child td {
		border-bottom: none;
	}
	.latesthauls .place {
		white-space: nowrap;
	}
	.latesthauls .when {
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}
	.latesthauls th.num,
	.latesthauls td.num {
		text-align: right;
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}

	/* Achievements */
	.badges {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
		gap: 0.75rem;
	}
	.badge {
		position: relative;
		text-align: center;
		padding: 0.5rem;
		border-radius: 8px;
		background: var(--panel-2);
		border: 1px solid var(--border);
	}
	.badge img {
		display: block;
		margin: 0 auto;
		width: 48px;
		height: 48px;
		object-fit: contain;
	}
	.badge.locked img {
		filter: grayscale(1) brightness(0.5);
		opacity: 0.55;
	}
	.badge .lvl {
		position: absolute;
		top: 4px;
		right: 8px;
		background: var(--accent);
		color: var(--on-accent);
		font-size: 0.7rem;
		font-weight: 700;
		border-radius: 999px;
		padding: 0 0.35rem;
	}
	.bname {
		font-size: 0.7rem;
		color: var(--muted);
		margin-top: 0.25rem;
		line-height: 1.2;
	}
	/* Small progress bar under an in-progress achievement card. */
	.bprog {
		width: 90%;
		max-width: 90px;
		height: 9px;
		margin: 0.4rem auto 0;
		background: color-mix(in srgb, var(--accent-2) 25%, transparent);
		border: 1px solid var(--accent-2);
		border-radius: 999px;
		padding: 1px;
		overflow: hidden;
	}
	.bprogfill {
		height: 100%;
		background: var(--accent-2);
		border-radius: 999px;
	}
	.bprognum {
		font-size: 0.62rem;
		color: var(--muted);
		text-align: center;
		margin-top: 0.15rem;
		font-variant-numeric: tabular-nums;
	}
	.atip {
		position: absolute;
		bottom: calc(100% + 8px);
		left: 50%;
		transform: translateX(-50%);
		width: 210px;
		background: var(--bg);
		border: 1px solid var(--accent);
		border-radius: 8px;
		padding: 0.5rem 0.6rem;
		text-align: left;
		opacity: 0;
		visibility: hidden;
		transition: opacity 0.12s ease;
		pointer-events: none;
		z-index: 30;
		box-shadow: 0 6px 18px rgba(0, 0, 0, 0.45);
	}
	.badge:hover .atip {
		opacity: 1;
		visibility: visible;
	}
	.atip-head {
		font-weight: 700;
		font-size: 0.82rem;
		display: flex;
		justify-content: space-between;
		gap: 0.4rem;
		align-items: baseline;
	}
	.atip-lvl {
		color: var(--accent);
		font-size: 0.72rem;
		white-space: nowrap;
	}
	.atip-status {
		font-size: 0.72rem;
		color: var(--muted);
		margin: 0.15rem 0 0.3rem;
	}
	.atip-status.on {
		color: var(--global);
	}
	.atip-desc {
		font-size: 0.75rem;
		color: var(--text);
		line-height: 1.35;
	}
	.atip-on {
		margin-top: 0.4rem;
		padding-top: 0.35rem;
		border-top: 1px solid var(--border);
		font-size: 0.72rem;
		font-style: italic;
		color: var(--accent);
	}
	.atip-prog {
		margin-top: 0.45rem;
	}
	.atip-rarity {
		margin-top: 0.3rem;
		font-size: 0.72rem;
	}
	.atip-progrow {
		display: flex;
		justify-content: space-between;
		font-size: 0.72rem;
		color: var(--muted);
		margin-bottom: 0.2rem;
	}
	@media (max-width: 640px) {
		.curves {
			grid-template-columns: 1fr;
		}
		/* Latest hauls: reflow each row into a compact 2×2 card. */
		.latesthauls thead {
			display: none;
		}
		.latesthauls,
		.latesthauls tbody {
			display: block;
		}
		.latesthauls tr {
			display: grid;
			grid-template-columns: 1fr auto;
			grid-template-areas:
				'route dist'
				'when cargo';
			gap: 0.1rem 0.75rem;
			align-items: baseline;
			padding: 0.55rem 0;
			border-bottom: 1px solid var(--border);
		}
		.latesthauls tbody tr:last-child {
			border-bottom: none;
		}
		.latesthauls td {
			display: block;
			border: none;
			padding: 0;
		}
		.latesthauls td.route {
			grid-area: route;
		}
		.latesthauls td.num {
			grid-area: dist;
		}
		.latesthauls td.when {
			grid-area: when;
			font-size: 0.78rem;
		}
		.latesthauls td.cargo {
			grid-area: cargo;
			font-size: 0.78rem;
			text-align: right;
		}
	}
</style>
