<script lang="ts">
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';
	import { gameFilter } from '$lib/gameFilter.svelte';
	let { data, form } = $props();
	// Read-only published snapshot: no server, so hide all the write controls.
	const STATIC = import.meta.env.VITE_STATIC === 'true';
	const dist = (km: number | null) => (km == null ? '—' : `${km.toLocaleString()} km`);
	const jobs = $derived(
		data.jobs.filter((j) => gameFilter.current === 'all' || j.game === gameFilter.current)
	);
</script>

<h1>Routes</h1>

{#if !STATIC}
<section class="panel">
	<h2>Add a route</h2>
	{#if form?.error}<p class="err">{form.error}</p>{/if}
	{#if form?.added}<p class="ok">Route saved.</p>{/if}

	<form method="POST" action="?/add" use:enhance class="grid form">
		<div class="row2">
			<div>
				<label for="fromCity">From city *</label>
				<input id="fromCity" name="fromCity" required />
			</div>
			<div>
				<label for="fromCompany">From company</label>
				<input id="fromCompany" name="fromCompany" />
			</div>
		</div>
		<div class="row2">
			<div>
				<label for="toCity">To city *</label>
				<input id="toCity" name="toCity" required />
			</div>
			<div>
				<label for="toCompany">To company</label>
				<input id="toCompany" name="toCompany" />
			</div>
		</div>
		<div class="row3">
			<div>
				<label for="game">Game</label>
				<select id="game" name="game">
					<option value="">—</option>
					<option value="ets2">Euro Truck Simulator 2</option>
					<option value="ats">American Truck Simulator</option>
				</select>
			</div>
			<div>
				<label for="cargo">Cargo</label>
				<input id="cargo" name="cargo" />
			</div>
			<div>
				<label for="truck">Truck</label>
				<input id="truck" name="truck" />
			</div>
		</div>
		<div>
			<label for="notes">Notes</label>
			<textarea id="notes" name="notes" rows="2"></textarea>
		</div>
		<div>
			<button class="btn" type="submit">Save route</button>
		</div>
	</form>
</section>
{/if}

{#if !STATIC && jobs.length}
	<section class="panel" style="margin-top:1rem">
		<h2>From your Log Book</h2>
		<p class="muted">One-click save any delivery as a favorite route.</p>
		<div class="joblist">
			<table>
				<thead>
					<tr>
						<th>Route</th>
						<th>Cargo</th>
						<th>Distance</th>
						<th></th>
					</tr>
				</thead>
				<tbody>
					{#each jobs as j}
						<tr>
							<td>
								<strong>{j.fromCity}</strong> → <strong>{j.toCity}</strong>
								<span class="tag">{j.game}</span>
							</td>
							<td>{j.cargo ?? '—'}</td>
							<td>{dist(j.distanceKm)}</td>
							<td>
								<form method="POST" action="?/add" use:enhance>
									<input type="hidden" name="jobId" value={j.id} />
									<input type="hidden" name="game" value={j.game} />
									<input type="hidden" name="fromCity" value={j.fromCity ?? ''} />
									<input type="hidden" name="fromCompany" value={j.fromCompany ?? ''} />
									<input type="hidden" name="toCity" value={j.toCity ?? ''} />
									<input type="hidden" name="toCompany" value={j.toCompany ?? ''} />
									<input type="hidden" name="cargo" value={j.cargo ?? ''} />
									<button class="btn-ghost btn-sm" type="submit">★ Save</button>
								</form>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>
{/if}

<section class="panel" style="margin-top:1rem">
	<h2>Saved routes ({data.favorites.length})</h2>
	{#if data.favorites.length === 0}
		<p class="muted">No favorite routes yet.</p>
	{:else}
		<table>
			<thead>
				<tr>
					<th>Route</th>
					<th>Cargo</th>
					<th>Truck</th>
					<th>Game</th>
					<th>Notes</th>
					{#if !STATIC}<th></th>{/if}
				</tr>
			</thead>
			<tbody>
				{#each data.favorites as r}
					<tr>
						<td>
							<strong>{r.fromCity}</strong>{#if r.fromCompany}<span class="muted"> ({r.fromCompany})</span
								>{/if}
							→ <strong>{r.toCity}</strong>{#if r.toCompany}<span class="muted">
									({r.toCompany})</span
								>{/if}
						</td>
						<td>{r.cargo ?? '—'}</td>
						<td>{r.truck ?? '—'}</td>
						<td>{r.game ?? '—'}</td>
						{#if STATIC}
							<td class="muted">{r.notes ?? ''}</td>
						{:else}
							<td>
								<form
									method="POST"
									action="?/notes"
									class="noteform"
									use:enhance={() =>
										async ({ update }) => {
											await update({ reset: false });
											toast.success('Notes saved');
										}}
								>
									<input type="hidden" name="id" value={r.id} />
									<input name="notes" value={r.notes ?? ''} placeholder="Add notes…" />
									<button class="btn-ghost btn-sm" type="submit">Save</button>
								</form>
							</td>
							<td>
								<form method="POST" action="?/delete" use:enhance>
									<input type="hidden" name="id" value={r.id} />
									<button class="btn-danger" type="submit">Delete</button>
								</form>
							</td>
						{/if}
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</section>

<style>
	.form .row2 {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
	}
	.form .row3 {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		gap: 0.75rem;
	}
	.joblist {
		max-height: 360px;
		overflow-y: auto;
	}
	.noteform {
		display: flex;
		gap: 0.4rem;
		align-items: center;
	}
	.noteform input {
		font-size: 0.85rem;
		padding: 0.3rem 0.5rem;
		min-width: 8rem;
	}
	.noteform button {
		flex-shrink: 0;
	}
	.err {
		color: var(--danger);
	}
	.ok {
		color: var(--global);
	}
</style>
