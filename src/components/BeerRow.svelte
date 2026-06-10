<script lang="ts">
  import type { BeerRowVM } from '../lib/list';

  interface Props {
    vm: BeerRowVM;
    onSelect: (id: string) => void;
    onToggleToTry: (id: string) => void;
  }

  const { vm, onSelect, onToggleToTry }: Props = $props();

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

  const hasNotes = $derived(vm.state.notes.length > 0);
  const isAdhoc = $derived(vm.state.adhoc !== undefined);

  // The to-try button doubles as the visual indicator. Its `aria-pressed` and
  // label tell the user what tapping will do, given the current state.
  const starLabel = $derived(
    vm.state.status === 'toTry'
      ? `Remove ${vm.beer.name} from your to-try list`
      : `Add ${vm.beer.name} to your to-try list`,
  );
</script>

<article
  class="row"
  class:tried={vm.state.status === 'tried'}
  class:not-present={vm.state.notPresent}
>
  <button class="main" type="button" onclick={() => onSelect(vm.beer.id)}>
    <header class="primary">
      <span class="name">{vm.beer.name}</span>
      {#if isAdhoc}
        <span class="adhoc-badge" aria-label="User-added beer" title="User-added beer">Ad-hoc</span>
      {/if}
      <span class="status-icons" aria-hidden="false">
        <!--
          'tried' and 'not-present' both live in the right-hand cell when
          active (replacing the to-try star). Showing them here too would
          be redundant.
        -->
        {#if vm.state.opinion === 'liked'}
          <span class="icon liked" aria-label="Liked" title="Liked">👍</span>
        {/if}
        {#if vm.state.opinion === 'disliked'}
          <span class="icon disliked" aria-label="Disliked" title="Disliked">👎</span>
        {/if}
        {#if hasNotes}
          <span class="icon has-notes" aria-label="Has notes" title="Has notes">📝</span>
        {/if}
      </span>
    </header>
    <p class="brewery">{vm.beer.brewery}</p>
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
    {#if vm.beer.description}
      <p class="description">{vm.beer.description}</p>
    {/if}
  </button>
  {#if vm.state.notPresent}
    <!--
      A not-present beer can't be queued, tried, opinioned, or noted (the
      cascade rule clears those when marking not-present). The right cell
      shows the 🚫 indicator instead of a toggle to signal the beer is
      effectively inert from the list view — the only way to "do" anything
      with it is to open the detail view and unmark it as not-present.
    -->
    <div
      class="not-present-cell"
      role="img"
      aria-label="Not at the festival"
      title="Not at the festival"
    >
      <span aria-hidden="true">🚫</span>
    </div>
  {:else if vm.state.status === 'tried'}
    <!--
      Once a beer is tried, the right-hand cell becomes a non-interactive
      "tried" indicator. The star toggle no longer makes sense (the user has
      already moved past wanting to try this), so it's replaced rather than
      hidden — keeps the row layout stable.
    -->
    <div class="tried-cell" role="img" aria-label="Tried" title="Tried">
      <span aria-hidden="true">✓</span>
    </div>
  {:else}
    <button
      class="star"
      type="button"
      aria-label={starLabel}
      title={starLabel}
      aria-pressed={vm.state.status === 'toTry'}
      onclick={() => onToggleToTry(vm.beer.id)}
    >
      <span aria-hidden="true">{vm.state.status === 'toTry' ? '★' : '☆'}</span>
    </button>
  {/if}
</article>

<style>
  .row {
    display: flex;
    align-items: stretch;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    box-shadow: var(--shadow-sm);
    overflow: hidden; /* contain child focus rings within the radius */
  }
  .row.tried {
    border-color: color-mix(in oklab, var(--color-accent) 35%, var(--color-border));
  }
  .row.not-present {
    opacity: 0.55;
  }

  .main {
    flex: 1 1 auto;
    min-width: 0; /* allow flex children to truncate if needed */
    background: transparent;
    border: none;
    text-align: left;
    padding: 0.75rem 0.75rem 0.75rem 1rem;
    cursor: pointer;
    transition: background 0.1s ease;
  }
  @media (hover: hover) {
    .main:hover {
      background: var(--color-accent-bg);
    }
  }
  .main:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: -2px;
  }

  .primary {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.25rem 0.5rem;
    margin: 0;
  }
  .name {
    font-weight: 600;
    font-size: 1.05rem;
  }
  .row.not-present .name {
    text-decoration: line-through;
    text-decoration-color: var(--color-text-muted);
  }

  .adhoc-badge {
    display: inline-flex;
    align-items: center;
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 0.05rem 0.4rem;
    border-radius: 999px;
    background: var(--color-accent-bg);
    color: var(--color-accent);
    line-height: 1.4;
  }

  .status-icons {
    display: inline-flex;
    gap: 0.35rem;
    align-items: center;
    margin-left: auto;
  }
  .icon {
    font-size: 0.95rem;
    line-height: 1;
  }
  .icon.has-notes {
    color: var(--color-text-muted);
  }

  .brewery {
    margin: 0.1rem 0 0;
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

  /*
   * Full description, shown inline only on wider screens (tablet/desktop),
   * where there's room to read it without opening the detail modal. On small
   * screens it stays hidden and the modal remains the way to read it.
   */
  .description {
    display: none;
  }
  @media (min-width: 768px) {
    .snippet {
      /* The full description is shown below; the search excerpt would duplicate it. */
      display: none;
    }
    .description {
      display: block;
      margin: 0.5rem 0 0;
      font-size: 0.9rem;
      line-height: 1.5;
      color: var(--color-text);
      white-space: pre-line;
    }
  }

  .star {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-left: 1px solid var(--color-border);
    width: 3rem; /* > 44px tap target on mobile */
    font-size: 1.55rem;
    line-height: 1;
    color: var(--color-text-muted);
    cursor: pointer;
    transition:
      background 0.1s ease,
      color 0.1s ease;
  }
  @media (hover: hover) {
    .star:hover {
      background: var(--color-accent-bg);
      color: var(--color-accent);
    }
  }
  .star:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: -2px;
  }
  .star[aria-pressed='true'] {
    color: var(--color-accent);
  }

  /*
   * Non-interactive siblings of .star — same dimensions so the row layout
   * stays stable when a beer transitions into tried or not-present. No
   * hover/focus styles; no cursor change; user-select disabled so the
   * glyph can't be highlighted by accident.
   */
  .tried-cell,
  .not-present-cell {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-left: 1px solid var(--color-border);
    width: 3rem;
    font-size: 1.55rem;
    line-height: 1;
    user-select: none;
  }
  .tried-cell {
    color: var(--color-accent);
    font-weight: 700;
  }
  .not-present-cell {
    /* The emoji is full-color on its own — no tint needed. Slight size
       bump keeps it visually weighted similar to the unicode glyphs. */
    font-size: 1.4rem;
  }
</style>
