<script lang="ts">
  import type { Beer, FilterMode, SortDirection, SortKey } from '../lib/types';
  import type { UserStore } from '../lib/userStore.svelte';
  import { buildRows, mergeBeers } from '../lib/list';
  import BeerRow from './BeerRow.svelte';

  interface Props {
    beers: Beer[];
    store: UserStore;
    showNotPresent: boolean;
    onSelect: (id: string) => void;
  }

  const { beers, store, showNotPresent, onSelect }: Props = $props();

  let search = $state('');
  let sort = $state<SortKey>('brewery');
  let sortDirection = $state<SortDirection>('asc');
  let filter = $state<FilterMode>('all');

  // Combine dataset beers with the user's ad-hoc additions so both flow
  // through the same search/sort/filter pipeline.
  const combined = $derived(mergeBeers(beers, store.all));

  const rows = $derived(
    buildRows(combined, store.all, {
      search,
      filter,
      sort,
      direction: sortDirection,
      showNotPresent,
    }),
  );

  function onToggleToTry(beerId: string) {
    store.toggleToTry(beerId);
  }

  // Reset direction to ascending whenever the user picks a different sort key.
  // This matches the conventional spreadsheet pattern and avoids stale "desc"
  // states bleeding across keys.
  function selectSort(next: SortKey) {
    if (sort !== next) {
      sort = next;
      sortDirection = 'asc';
    }
  }

  function toggleDirection() {
    sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
  }

  // Per-key labels for the direction button, so the tooltip describes what
  // the button will do — clearer than a generic "Reverse sort".
  const directionLabel = $derived.by(() => {
    const next = sortDirection === 'asc' ? 'descending' : 'ascending';
    if (sort === 'abv') {
      return `Sort ${sortDirection === 'asc' ? 'high to low' : 'low to high'}`;
    }
    return `Sort ${next} (${sortDirection === 'asc' ? 'Z–A' : 'A–Z'})`;
  });
</script>

<section class="list-view">
  <div class="controls">
    <label class="search">
      <span class="sr-only">Search</span>
      <input
        type="search"
        placeholder="Search name, brewery, style, or notes…"
        bind:value={search}
        autocomplete="off"
        autocorrect="off"
        autocapitalize="off"
        spellcheck="false"
      />
    </label>

    <div class="control-row">
      <div class="sort">
        <label>
          <span class="label">Sort</span>
          <select
            value={sort}
            onchange={(e) => selectSort((e.currentTarget as HTMLSelectElement).value as SortKey)}
          >
            <option value="brewery">Brewery</option>
            <option value="name">Name</option>
            <option value="abv">ABV</option>
          </select>
        </label>
        <button
          type="button"
          class="direction"
          onclick={toggleDirection}
          aria-label={directionLabel}
          title={directionLabel}
          aria-pressed={sortDirection === 'desc'}
        >
          {sortDirection === 'asc' ? '↑' : '↓'}
        </button>
      </div>

      <div class="filter" role="radiogroup" aria-label="Filter">
        {#each [{ value: 'all', label: 'All' }, { value: 'toTry', label: 'To try' }, { value: 'tried', label: 'Tried' }, { value: 'notTried', label: 'Not tried' }] as opt}
          <label class="chip" class:active={filter === opt.value}>
            <input
              type="radio"
              name="filter"
              value={opt.value}
              checked={filter === opt.value}
              onchange={() => (filter = opt.value as FilterMode)}
            />
            <span>{opt.label}</span>
          </label>
        {/each}
      </div>
    </div>
  </div>

  {#if rows.length === 0}
    <p class="empty" role="status" aria-live="polite">
      {#if search}
        No beers match "{search}".
      {:else}
        No beers to show.
      {/if}
    </p>
  {:else}
    <ul class="rows">
      {#each rows as vm (vm.beer.id)}
        <li><BeerRow {vm} {onSelect} {onToggleToTry} /></li>
      {/each}
    </ul>
    <!--
      Announces when the result count changes (filter / search / sort tweaks
      that change visibility). aria-live="polite" so it doesn't interrupt
      whatever the user was just doing.
    -->
    <p class="count" role="status" aria-live="polite">
      Showing {rows.length} of {beers.length}
    </p>
  {/if}
</section>

<style>
  .list-view {
    padding: 0.75rem;
    max-width: 720px;
    margin: 0 auto;
  }

  .controls {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    position: sticky;
    top: 0;
    background: var(--color-bg);
    padding: 0.75rem 0;
    margin: -0.75rem 0 0.5rem;
    z-index: 10;
  }

  .search {
    display: block;
  }
  .search input {
    width: 100%;
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    border-radius: var(--radius);
    padding: 0.6rem 0.75rem;
    font-size: 1rem;
    /* iOS Safari: prevent zoom on focus */
    -webkit-appearance: none;
    appearance: none;
  }
  .search input:focus {
    outline: 2px solid var(--color-accent);
    outline-offset: -1px;
  }

  .control-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1rem;
    align-items: center;
  }

  .sort {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }
  .sort label {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .sort .label {
    font-size: 0.85rem;
    color: var(--color-text-muted);
  }
  .sort select {
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    border-radius: var(--radius);
    padding: 0.35rem 0.5rem;
    font-size: 0.9rem;
  }
  .sort .direction {
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    border-radius: var(--radius);
    padding: 0.35rem 0.55rem;
    font-size: 0.95rem;
    line-height: 1;
    min-width: 2rem;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }
  @media (hover: hover) {
    .sort .direction:hover {
      background: var(--color-accent-bg);
    }
  }
  .sort .direction:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 1px;
  }
  .sort .direction[aria-pressed='true'] {
    background: var(--color-accent);
    border-color: var(--color-accent);
    color: var(--color-on-accent);
  }

  .filter {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    padding: 0.3rem 0.7rem;
    border: 1px solid var(--color-border);
    border-radius: 999px;
    background: var(--color-surface);
    font-size: 0.85rem;
    cursor: pointer;
    user-select: none;
  }
  .chip input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }
  @media (hover: hover) {
    .chip:hover {
      background: var(--color-accent-bg);
    }
  }
  .chip:focus-within {
    outline: 2px solid var(--color-accent);
    outline-offset: 1px;
  }
  .chip.active {
    background: var(--color-accent);
    border-color: var(--color-accent);
    color: var(--color-on-accent);
  }

  .rows {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .empty {
    text-align: center;
    color: var(--color-text-muted);
    padding: 2rem 1rem;
  }

  .count {
    text-align: center;
    color: var(--color-text-muted);
    font-size: 0.85rem;
    margin: 1rem 0 0;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
