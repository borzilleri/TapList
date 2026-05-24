<script lang="ts">
  import { NOTES_MAX_LENGTH, type Beer, type BeerStatus, type Opinion } from '../lib/types';
  import type { UserStore } from '../lib/userStore.svelte';

  interface Props {
    beer: Beer;
    store: UserStore;
    onClose: () => void;
  }

  const { beer, store, onClose }: Props = $props();

  // Per-beer state — reactive via the store getter.
  const state = $derived(store.get(beer.id));

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }

  // Status buttons are radio-like: tapping the active one clears it.
  function setStatus(next: BeerStatus) {
    store.setStatus(beer.id, state.status === next ? null : next);
  }

  function setOpinion(next: Opinion) {
    store.setOpinion(beer.id, state.opinion === next ? null : next);
  }

  function onNotesInput(e: Event) {
    const target = e.currentTarget as HTMLTextAreaElement;
    // Hard cap: the maxlength attribute should prevent this, but defend
    // against paste-then-edit edge cases.
    if (target.value.length > NOTES_MAX_LENGTH) {
      target.value = target.value.slice(0, NOTES_MAX_LENGTH);
    }
    store.setNotes(beer.id, target.value);
  }

  function toggleNotPresent() {
    store.setNotPresent(beer.id, !state.notPresent);
  }

  const notesRemaining = $derived(NOTES_MAX_LENGTH - state.notes.length);
</script>

<svelte:window onkeydown={onKeydown} />

<!--
  Click the backdrop to dismiss. The backdrop is intentionally interactive
  (click-to-close is a standard modal pattern); the keyboard equivalent is
  Escape, handled at the window level above.
-->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  class="backdrop"
  role="dialog"
  aria-modal="true"
  aria-labelledby="detail-title"
  onclick={onClose}
  tabindex="-1"
>
  <div class="panel" role="document" onclick={(e) => e.stopPropagation()}>
    <header>
      <h2 id="detail-title">{beer.name}</h2>
      <button class="close" type="button" onclick={onClose} aria-label="Close">×</button>
    </header>

    <p class="brewery">{beer.brewery}</p>

    <dl class="meta">
      {#if beer.abv !== null}
        <div>
          <dt>ABV</dt>
          <dd>{beer.abv.toFixed(1)}%</dd>
        </div>
      {/if}
      {#if beer.style}
        <div>
          <dt>Style</dt>
          <dd>{beer.style}</dd>
        </div>
      {/if}
      {#if beer.location}
        <div>
          <dt>Location</dt>
          <dd>{beer.location}</dd>
        </div>
      {/if}
    </dl>

    {#if beer.description}
      <p class="description">{beer.description}</p>
    {/if}

    <section class="actions" aria-label="Your notes on this beer">
      <div class="action-group" role="group" aria-label="Status">
        <button
          type="button"
          class="action toTry"
          class:active={state.status === 'toTry'}
          aria-pressed={state.status === 'toTry'}
          onclick={() => setStatus('toTry')}
        >
          <span class="icon" aria-hidden="true">★</span> To try
        </button>
        <button
          type="button"
          class="action tried"
          class:active={state.status === 'tried'}
          aria-pressed={state.status === 'tried'}
          onclick={() => setStatus('tried')}
        >
          <span class="icon" aria-hidden="true">✓</span> Tried
        </button>
      </div>

      <div class="action-group" role="group" aria-label="Opinion">
        <button
          type="button"
          class="action liked"
          class:active={state.opinion === 'liked'}
          aria-pressed={state.opinion === 'liked'}
          onclick={() => setOpinion('liked')}
        >
          <span class="icon" aria-hidden="true">👍</span> Liked
        </button>
        <button
          type="button"
          class="action disliked"
          class:active={state.opinion === 'disliked'}
          aria-pressed={state.opinion === 'disliked'}
          onclick={() => setOpinion('disliked')}
        >
          <span class="icon" aria-hidden="true">👎</span> Disliked
        </button>
      </div>

      <label class="notes">
        <span class="notes-label">
          <span>Notes</span>
          <span class="counter" class:near-limit={notesRemaining <= 20}>
            {notesRemaining}
          </span>
        </span>
        <textarea
          value={state.notes}
          oninput={onNotesInput}
          maxlength={NOTES_MAX_LENGTH}
          rows="3"
          placeholder="Citrusy, paired well with the smoked cheese…"
          autocomplete="off"
          spellcheck="true"
        ></textarea>
      </label>

      <label class="not-present-toggle">
        <input type="checkbox" checked={state.notPresent} onchange={toggleNotPresent} />
        <span>Not at the festival (hide from default views)</span>
      </label>
    </section>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    z-index: 100;
    padding: 0;
  }
  @media (min-width: 600px) {
    .backdrop {
      align-items: center;
      padding: 2rem;
    }
  }

  .panel {
    background: var(--color-surface);
    border-radius: var(--radius) var(--radius) 0 0;
    width: 100%;
    max-width: 560px;
    max-height: 90vh;
    overflow-y: auto;
    padding: 1.25rem 1.25rem 2rem;
    box-shadow: var(--shadow-md);
    -webkit-overflow-scrolling: touch;
  }
  @media (min-width: 600px) {
    .panel {
      border-radius: var(--radius);
    }
  }

  header {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    margin-bottom: 0.25rem;
  }
  h2 {
    margin: 0;
    font-size: 1.35rem;
    flex: 1;
  }
  .close {
    background: transparent;
    border: none;
    font-size: 2rem;
    line-height: 1;
    padding: 0 0.25rem;
    color: var(--color-text-muted);
  }
  .close:hover,
  .close:focus-visible {
    color: var(--color-text);
    outline: none;
  }
  .close:focus-visible {
    outline: 2px solid var(--color-accent);
    border-radius: 4px;
  }

  .brewery {
    margin: 0 0 1rem;
    color: var(--color-text-muted);
    font-size: 1rem;
  }

  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1.5rem;
    margin: 0 0 1rem;
  }
  .meta div {
    display: flex;
    flex-direction: column;
  }
  .meta dt {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted);
  }
  .meta dd {
    margin: 0;
    font-size: 1rem;
    font-weight: 500;
  }

  .description {
    margin: 1rem 0;
    line-height: 1.55;
    white-space: pre-line;
  }

  .actions {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
    margin-top: 1.25rem;
    padding-top: 1rem;
    border-top: 1px solid var(--color-border);
  }

  .action-group {
    display: flex;
    gap: 0.5rem;
  }
  .action {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    padding: 0.65rem 0.5rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    font-size: 0.95rem;
    cursor: pointer;
    min-height: 44px;
  }
  .action:hover {
    background: var(--color-accent-bg);
  }
  .action:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 1px;
  }
  .action.active {
    background: var(--color-accent);
    border-color: var(--color-accent);
    color: white;
  }
  .action .icon {
    font-size: 1.1rem;
    line-height: 1;
  }

  .notes {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
  .notes-label {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font-size: 0.85rem;
    color: var(--color-text-muted);
  }
  .counter {
    font-variant-numeric: tabular-nums;
  }
  .counter.near-limit {
    color: var(--color-accent);
    font-weight: 600;
  }
  .notes textarea {
    width: 100%;
    padding: 0.6rem 0.75rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: var(--color-surface);
    font: inherit;
    line-height: 1.4;
    resize: vertical;
    min-height: 4.5rem;
  }
  .notes textarea:focus {
    outline: 2px solid var(--color-accent);
    outline-offset: -1px;
  }

  .not-present-toggle {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    font-size: 0.9rem;
    color: var(--color-text-muted);
    cursor: pointer;
  }
  .not-present-toggle input {
    width: 1.1rem;
    height: 1.1rem;
  }
</style>
