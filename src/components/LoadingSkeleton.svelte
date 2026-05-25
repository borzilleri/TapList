<script lang="ts">
  interface Props {
    /** Number of skeleton rows to render. Defaults to 6 — fills most phones. */
    count?: number;
  }

  const { count = 6 }: Props = $props();
  const rows = $derived(Array.from({ length: count }, (_, i) => i));
</script>

<!--
  Card-shaped skeleton list shown while the dataset is loading. Mirrors the
  rough proportions of a real BeerRow (name, brewery, secondary meta line)
  so the layout doesn't shift when the real list mounts.

  Marked aria-hidden so screen readers ignore the cosmetic placeholders —
  the {#await} loading message in the parent (`role="status"`) is what
  announces "Loading the beer list…" to assistive tech.
-->
<ul class="skeleton-list" aria-hidden="true">
  {#each rows as i (i)}
    <li class="skeleton-row">
      <div class="skeleton-main">
        <span class="skeleton-bar name"></span>
        <span class="skeleton-bar brewery"></span>
        <span class="skeleton-bar meta"></span>
      </div>
      <div class="skeleton-star"></div>
    </li>
  {/each}
</ul>

<style>
  .skeleton-list {
    list-style: none;
    margin: 0;
    padding: 0.75rem;
    max-width: 720px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .skeleton-row {
    display: flex;
    align-items: stretch;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    box-shadow: var(--shadow-sm);
    overflow: hidden;
  }

  .skeleton-main {
    flex: 1 1 auto;
    padding: 0.75rem 0.75rem 0.75rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .skeleton-star {
    flex: 0 0 auto;
    border-left: 1px solid var(--color-border);
    width: 3rem;
  }

  .skeleton-bar {
    display: block;
    height: 0.85rem;
    border-radius: 4px;
    background: var(--color-border);
  }
  .skeleton-bar.name {
    width: 60%;
    height: 1rem;
  }
  .skeleton-bar.brewery {
    width: 40%;
  }
  .skeleton-bar.meta {
    width: 70%;
    height: 0.7rem;
  }

  /*
   * Subtle shimmer to signal "still loading" without being loud. Gated on
   * prefers-reduced-motion so users who opted out get a static skeleton.
   */
  @media (prefers-reduced-motion: no-preference) {
    .skeleton-bar {
      background: linear-gradient(
        90deg,
        var(--color-border) 0%,
        color-mix(in oklab, var(--color-border) 50%, var(--color-surface)) 50%,
        var(--color-border) 100%
      );
      background-size: 200% 100%;
      animation: skeleton-shimmer 1.4s ease-in-out infinite;
    }
    @keyframes skeleton-shimmer {
      0% {
        background-position: 100% 0;
      }
      100% {
        background-position: -100% 0;
      }
    }
  }
</style>
