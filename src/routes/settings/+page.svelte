<script lang="ts">
	import { untrack } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { setMode, userPrefersMode } from 'mode-watcher';
	import { Switch } from '$lib/components/ui/switch';
	import * as ToggleGroup from '$lib/components/ui/toggle-group';
	import GripVerticalIcon from '@lucide/svelte/icons/grip-vertical';
	import { WIDGETS, widgetEnabled, orderedWidgets } from '$lib/widgets';

	let { data } = $props();

	type Mode = 'light' | 'dark' | 'system';
	const MODES: { v: Mode; label: string }[] = [
		{ v: 'light', label: 'Light' },
		{ v: 'dark', label: 'Dark' },
		{ v: 'system', label: 'System' }
	];

	const THEMES = [
		{ id: 'default', label: 'Default', accent: '#f0922b' },
		{ id: 'forest', label: 'Forest', accent: '#51cf66' },
		{ id: 'royal', label: 'Royal', accent: '#8b85ff' },
		{ id: 'crimson', label: 'Crimson', accent: '#ff6b6b' },
		{ id: 'blue', label: 'Blue', accent: '#60a5fa' },
		{ id: 'yellow', label: 'Yellow', accent: '#fde047' }
	];

	let theme = $state(untrack(() => data.settings.theme));
	let widgets = $state<Record<string, boolean>>(
		untrack(() => Object.fromEntries(WIDGETS.map((w) => [w.id, widgetEnabled(data.settings.widgets, w.id)])))
	);
	let order = $state<string[]>(untrack(() => orderedWidgets(data.settings.order).map((w) => w.id)));

	const byId = new Map(WIDGETS.map((w) => [w.id, w]));
	const orderedDefs = $derived(order.map((id) => byId.get(id)).filter((w) => w !== undefined));

	// Drag-and-drop reordering of the widget list.
	let dragId = $state<string | null>(null);
	function onDragStart(e: DragEvent, id: string) {
		dragId = id;
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('text/plain', id);
		}
	}
	function onDragOver(e: DragEvent, overId: string) {
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
		if (!dragId || dragId === overId) return;
		const from = order.indexOf(dragId);
		const to = order.indexOf(overId);
		if (from === -1 || to === -1) return;
		const next = [...order];
		next.splice(from, 1);
		next.splice(to, 0, dragId);
		order = next;
	}
	function endDrag() {
		if (!dragId) return;
		dragId = null;
		persist();
	}

	const STATIC = import.meta.env.VITE_STATIC === 'true';

	async function persist() {
		if (STATIC) return; // no server to save to in the published snapshot
		const body = new FormData();
		body.set('theme', theme);
		body.set('widgets', JSON.stringify(widgets));
		body.set('order', JSON.stringify(order));
		const res = await fetch('?/save', { method: 'POST', body });
		if (res.ok) {
			document.documentElement.dataset.accent = theme;
			await invalidateAll();
			toast.success('Settings saved');
		} else {
			toast.error('Could not save settings');
		}
	}

	function pickTheme(id: string) {
		theme = id;
		persist();
	}
	function toggleWidget(id: string, value: boolean) {
		widgets[id] = value;
		persist();
	}
	function setAll(value: boolean) {
		for (const w of WIDGETS) widgets[w.id] = value;
		persist();
	}
	const enabledCount = $derived(WIDGETS.filter((w) => widgets[w.id]).length);
</script>

<h1>Settings</h1>

<section class="panel">
	<h2>Appearance</h2>

	<div class="field">
		<div class="flabel">Mode</div>
		<ToggleGroup.Root
			type="single"
			variant="outline"
			size="sm"
			value={userPrefersMode.current}
			onValueChange={(v) => {
				if (v) setMode(v as Mode);
			}}
			aria-label="Color mode"
		>
			{#each MODES as m}
				<ToggleGroup.Item value={m.v}>{m.label}</ToggleGroup.Item>
			{/each}
		</ToggleGroup.Root>
		<p class="muted hint">Light / dark follows this browser; “System” tracks your OS setting.</p>
	</div>

	<div class="field">
		<div class="flabel">Theme</div>
		<div class="themes">
			{#each THEMES as t}
				<button
					type="button"
					class="swatch"
					class:active={theme === t.id}
					onclick={() => pickTheme(t.id)}
				>
					<span class="dot" style="background:{t.accent}"></span>
					{t.label}
				</button>
			{/each}
		</div>
	</div>
</section>

<section class="panel widgets-panel">
	<div class="whead">
		<h2>Dashboard widgets <span class="muted">· {enabledCount}/{WIDGETS.length} on</span></h2>
		<div class="wactions">
			<button class="btn-ghost btn-sm" onclick={() => setAll(true)}>Enable all</button>
			<button class="btn-ghost btn-sm" onclick={() => setAll(false)}>Disable all</button>
		</div>
	</div>
	<p class="muted">Choose which sections show on the dashboard, and drag to set their order.</p>
	<ul class="wlist">
		{#each orderedDefs as w (w.id)}
			<li
				class:dragging={dragId === w.id}
				draggable="true"
				ondragstart={(e) => onDragStart(e, w.id)}
				ondragover={(e) => onDragOver(e, w.id)}
				ondrop={(e) => {
					e.preventDefault();
					endDrag();
				}}
				ondragend={endDrag}
			>
				<span class="handle" aria-hidden="true"><GripVerticalIcon class="size-4" /></span>
				<div class="winfo">
					<div class="wtitle">{w.title}{#if w.perGame}<span class="tag">per-game</span>{/if}</div>
					<div class="muted wdesc">{w.description}</div>
				</div>
				<Switch
					checked={widgets[w.id]}
					onCheckedChange={(v) => toggleWidget(w.id, v)}
					aria-label={w.title}
				/>
			</li>
		{/each}
	</ul>
</section>

<style>
	section.panel {
		margin-top: 1rem;
	}
	h2 {
		margin-top: 0;
	}
	.field {
		margin-top: 1rem;
	}
	.flabel {
		font-weight: 600;
		margin-bottom: 0.5rem;
	}
	.hint {
		margin: 0.5rem 0 0;
		font-size: 0.85rem;
	}
	.themes {
		display: flex;
		gap: 0.6rem;
		flex-wrap: wrap;
	}
	.swatch {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.85rem;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: var(--panel-2);
		color: var(--text);
		cursor: pointer;
		font-size: 0.9rem;
		font-weight: 600;
	}
	.swatch.active {
		border-color: var(--accent);
		box-shadow: 0 0 0 1px var(--accent) inset;
	}
	.swatch .dot {
		width: 16px;
		height: 16px;
		border-radius: 50%;
		display: inline-block;
	}
	.whead {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
	}
	.wactions {
		display: flex;
		gap: 0.5rem;
	}
	.wlist {
		list-style: none;
		margin: 0.75rem 0 0;
		padding: 0;
	}
	.wlist li {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.7rem 0.5rem;
		border-bottom: 1px solid var(--border);
		border-radius: 8px;
	}
	.wlist li:last-child {
		border-bottom: none;
	}
	.wlist li.dragging {
		opacity: 0.5;
		background: var(--panel-2);
	}
	.handle {
		color: var(--muted);
		cursor: grab;
		display: flex;
		flex-shrink: 0;
	}
	.handle:active {
		cursor: grabbing;
	}
	.winfo {
		flex: 1;
		min-width: 0;
	}
	.wtitle {
		font-weight: 600;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.wdesc {
		font-size: 0.85rem;
		margin-top: 0.1rem;
	}
</style>
