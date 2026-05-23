<script lang="ts">
  import type { Beer, FilterMode, SortKey } from '../lib/types';
  import { buildRows } from '../lib/list';
  import BeerRow from './BeerRow.svelte';

  interface Props {
    beers: Beer[];
    onSelect: (id: string) => void;
  }

  const { beers, onSelect }: Props = $props();

  let search = $state('');
  let sort = $state<SortKey>('brewery');
  let filter = $state<FilterMode>('all');

  const rows = $derived(buildRows(beers, search, filter, sort));
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
      <label class="sort">
        <span class="label">Sort</span>
        <select bind:value={sort}>
          <option value="brewery">Brewery</option>
          <option value="name">Name</option>
          <option value="abv">ABV</option>
        </select>
      </label>

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
    <p class="empty">
      {#if search}
        No beers match "{search}".
      {:else}
        No beers to show.
      {/if}
    </p>
  {:else}
    <ul class="rows">
      {#each rows as vm (vm.beer.id)}
        <li><BeerRow {vm} {onSelect} /></li>
      {/each}
    </ul>
    <p class="count">
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
  .chip:hover {
    background: var(--color-accent-bg);
  }
  .chip:focus-within {
    outline: 2px solid var(--color-accent);
    outline-offset: 1px;
  }
  .chip.active {
    background: var(--color-accent);
    border-color: var(--color-accent);
    color: white;
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
