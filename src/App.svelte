<script lang="ts">
  import type { Beer, Dataset } from './lib/types';
  import { loadActiveDataset } from './lib/data';
  import BeerList from './components/BeerList.svelte';
  import BeerDetail from './components/BeerDetail.svelte';
  import FreshnessIndicator from './components/FreshnessIndicator.svelte';

  // Async load state for the catalog/dataset fetch. Using a Promise here so
  // we can let Svelte's {#await} block handle the loading/error UX uniformly.
  let loadPromise = $state(loadActiveDataset());

  let selectedBeerId = $state<string | null>(null);

  function findBeer(dataset: Dataset, id: string): Beer | undefined {
    return dataset.beers.find((b) => b.id === id);
  }

  function retry() {
    loadPromise = loadActiveDataset();
  }
</script>

<header class="app-header">
  <h1>TapList</h1>
  {#await loadPromise then result}
    {#if result.dataset.festival}
      <p class="subtitle">{result.dataset.festival}</p>
    {/if}
    <FreshnessIndicator updatedAt={result.dataset.updatedAt} />
  {/await}
</header>

<main>
  {#await loadPromise}
    <p class="status">Loading the beer list…</p>
  {:then result}
    <BeerList beers={result.dataset.beers} onSelect={(id) => (selectedBeerId = id)} />
    {#if selectedBeerId}
      {@const beer = findBeer(result.dataset, selectedBeerId)}
      {#if beer}
        <BeerDetail {beer} onClose={() => (selectedBeerId = null)} />
      {/if}
    {/if}
  {:catch error}
    <div class="status error" role="alert">
      <h2>Couldn't load the beer list</h2>
      <p>{error instanceof Error ? error.message : String(error)}</p>
      <p>
        The first time you open TapList, you need to be online so we can fetch the dataset. After
        that, it'll work offline.
      </p>
      <button type="button" onclick={retry}>Retry</button>
    </div>
  {/await}
</main>

<style>
  .app-header {
    text-align: center;
    padding: 1rem 0.75rem 0.5rem;
    border-bottom: 1px solid var(--color-border);
    background: var(--color-surface);
  }
  h1 {
    margin: 0;
    font-size: 1.5rem;
    letter-spacing: -0.01em;
  }
  .subtitle {
    margin: 0.15rem 0 0.25rem;
    color: var(--color-text-muted);
    font-size: 0.95rem;
  }

  .status {
    text-align: center;
    padding: 2rem 1rem;
    color: var(--color-text-muted);
  }
  .status.error {
    max-width: 480px;
    margin: 0 auto;
    color: var(--color-text);
  }
  .status.error h2 {
    margin-top: 0;
  }
  .status.error button {
    margin-top: 0.5rem;
    padding: 0.5rem 1rem;
    border-radius: var(--radius);
    border: 1px solid var(--color-accent);
    background: var(--color-accent);
    color: white;
    font-size: 1rem;
  }
</style>
