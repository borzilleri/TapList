<script lang="ts">
  import type { Beer } from '../lib/types';

  interface Props {
    beer: Beer;
    onClose: () => void;
  }

  const { beer, onClose }: Props = $props();

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }
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
    margin: 1rem 0 0;
    line-height: 1.55;
    white-space: pre-line;
  }
</style>
