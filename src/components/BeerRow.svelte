<script lang="ts">
  import type { BeerRowVM } from '../lib/list';

  interface Props {
    vm: BeerRowVM;
    onSelect: (id: string) => void;
  }

  const { vm, onSelect }: Props = $props();

  // Split the snippet around the highlight range so we can wrap the match in <mark>.
  // Falls back to null when there's no snippet to render.
  const snippetParts = $derived.by(() => {
    if (!vm.descriptionSnippet || !vm.highlightRange) return null;
    const { start, end } = vm.highlightRange;
    return {
      before: vm.descriptionSnippet.slice(0, start),
      match: vm.descriptionSnippet.slice(start, end),
      after: vm.descriptionSnippet.slice(end),
    };
  });
</script>

<button class="row" type="button" onclick={() => onSelect(vm.beer.id)}>
  <div class="primary">
    <span class="name">{vm.beer.name}</span>
    <span class="brewery">{vm.beer.brewery}</span>
  </div>
  <div class="secondary">
    {#if vm.beer.abv !== null}
      <span class="abv">{vm.beer.abv.toFixed(1)}%</span>
    {/if}
    {#if vm.beer.style}
      <span class="style">{vm.beer.style}</span>
    {/if}
    {#if vm.beer.location}
      <span class="location">{vm.beer.location}</span>
    {/if}
  </div>
  {#if snippetParts}
    <p class="snippet">
      {snippetParts.before}<mark>{snippetParts.match}</mark>{snippetParts.after}
    </p>
  {/if}
</button>

<style>
  .row {
    display: block;
    width: 100%;
    text-align: left;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: 0.75rem 1rem;
    box-shadow: var(--shadow-sm);
    transition: background 0.1s ease;
  }
  .row:hover,
  .row:focus-visible {
    background: var(--color-accent-bg);
    outline: none;
  }
  .row:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }

  .primary {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 0.75rem;
    align-items: baseline;
  }
  .name {
    font-weight: 600;
    font-size: 1.05rem;
  }
  .brewery {
    color: var(--color-text-muted);
    font-size: 0.95rem;
  }

  .secondary {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 0.75rem;
    margin-top: 0.25rem;
    font-size: 0.85rem;
    color: var(--color-text-muted);
  }
  .abv {
    font-variant-numeric: tabular-nums;
    font-weight: 500;
    color: var(--color-accent);
  }

  .snippet {
    margin: 0.5rem 0 0;
    font-size: 0.85rem;
    color: var(--color-text-muted);
    line-height: 1.35;
  }
</style>
