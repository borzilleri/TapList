<script lang="ts">
  import type { PwaState } from '../lib/pwa.svelte';

  interface Props {
    pwa: PwaState;
  }

  const { pwa }: Props = $props();
</script>

{#if pwa.needRefresh}
  <div class="banner" role="status" aria-live="polite">
    <span class="message">A new version of TapList is available.</span>
    <button type="button" class="primary" onclick={() => pwa.applyUpdate()}>Reload</button>
  </div>
{:else if pwa.offlineReady}
  <!--
    Single-shot toast confirming the app is installed and primed for offline
    use. Dismissable; doesn't come back on subsequent loads unless a new SW
    activates a fresh precache.
  -->
  <div class="banner offline-ready" role="status" aria-live="polite">
    <span class="message">
      <span aria-hidden="true">📶</span> Ready to use offline.
    </span>
    <button
      type="button"
      class="dismiss"
      onclick={() => pwa.dismissOfflineReady()}
      aria-label="Dismiss"
    >
      ×
    </button>
  </div>
{/if}

<style>
  .banner {
    position: fixed;
    left: 50%;
    bottom: max(1rem, env(safe-area-inset-bottom, 1rem));
    transform: translateX(-50%);
    z-index: 200;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    max-width: calc(100vw - 1.5rem);
    padding: 0.65rem 0.65rem 0.65rem 1rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    box-shadow: var(--shadow-md);
    font-size: 0.9rem;
  }
  /* Only animate the slide-up when the user hasn't asked for reduced motion. */
  @media (prefers-reduced-motion: no-preference) {
    .banner {
      animation: pwa-slide-up 0.18s ease-out;
    }
    @keyframes pwa-slide-up {
      from {
        opacity: 0;
        transform: translate(-50%, 8px);
      }
      to {
        opacity: 1;
        transform: translate(-50%, 0);
      }
    }
  }

  .message {
    flex: 1;
    line-height: 1.4;
  }

  .primary {
    flex: 0 0 auto;
    padding: 0.4rem 0.8rem;
    background: var(--color-accent);
    color: var(--color-on-accent);
    border: 1px solid var(--color-accent);
    border-radius: var(--radius);
    font-size: 0.9rem;
    cursor: pointer;
    min-height: 36px;
  }
  .primary:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }

  .dismiss {
    flex: 0 0 auto;
    background: transparent;
    border: none;
    font-size: 1.4rem;
    line-height: 1;
    padding: 0 0.4rem;
    color: var(--color-text-muted);
    cursor: pointer;
  }
  @media (hover: hover) {
    .dismiss:hover {
      color: var(--color-text);
    }
  }
  .dismiss:focus-visible {
    color: var(--color-text);
    outline: 2px solid var(--color-accent);
    border-radius: 4px;
  }
</style>
