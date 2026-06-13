<script lang="ts">
  import { focusTrap } from '../lib/focusTrap';
  import { lockBodyScroll } from '../lib/scrollLock';

  interface Props {
    mapUrl: string;
    onClose: () => void;
  }

  const { mapUrl, onClose }: Props = $props();

  // Tracks whether the image failed to load. The realistic failure is the
  // festival-floor offline case where the map was never cached (the app
  // pre-warms it on dataset load, so this should be rare) — surface a hint
  // rather than a broken-image icon.
  let failed = $state(false);

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }
</script>

<svelte:window onkeydown={onKeydown} />

<!--
  Centered modal showing the venue map. Backdrop click dismisses (guards on
  e.target === e.currentTarget so taps on the image don't bubble out). Escape
  closes via the window listener. The image is a same-document sub-resource,
  so the service worker can serve it from cache offline.
-->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
  class="backdrop"
  role="dialog"
  aria-modal="true"
  aria-labelledby="map-title"
  onclick={(e) => {
    if (e.target === e.currentTarget) onClose();
  }}
  tabindex="-1"
  use:lockBodyScroll
>
  <div class="panel" use:focusTrap>
    <header>
      <h2 id="map-title">Venue map</h2>
      <button class="close" type="button" onclick={onClose} aria-label="Close map">×</button>
    </header>
    <div class="body">
      {#if failed}
        <p class="error" role="alert">
          The map isn't available offline yet. Reconnect once to download it, then it'll be
          available at the festival.
        </p>
      {:else}
        <img src={mapUrl} alt="Venue map" onerror={() => (failed = true)} />
      {/if}
    </div>
  </div>
</div>

<style>
  /* Mobile-first: the viewer takes over the whole screen to maximize the
     visible map. The centered, bounded dialog is layered on at ≥600px below. */
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    z-index: 100;
  }
  @media (min-width: 600px) {
    .backdrop {
      padding: 1rem;
    }
  }

  .panel {
    background: var(--color-surface);
    box-shadow: var(--shadow-md);
    width: 100%;
    height: 100vh;
    height: 100dvh;
    max-width: none;
    border-radius: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  @media (min-width: 600px) {
    .panel {
      max-width: 60rem;
      height: 100%;
      max-height: 100%;
      border-radius: var(--radius);
    }
  }
  @media (prefers-reduced-motion: no-preference) {
    .panel {
      animation: zoomIn 0.18s ease-out;
    }
    @keyframes zoomIn {
      from {
        transform: scale(0.97);
        opacity: 0.4;
      }
      to {
        transform: scale(1);
        opacity: 1;
      }
    }
  }

  header {
    display: flex;
    align-items: center;
    gap: 1rem;
    /* Keep the header (and its close button) clear of the notch when the
       viewer is full-screen on a phone. */
    padding: max(0.75rem, env(safe-area-inset-top, 0.75rem)) 1rem 0.75rem;
    border-bottom: 1px solid var(--color-border);
  }
  h2 {
    margin: 0;
    font-size: 1.2rem;
    flex: 1;
  }
  .close {
    background: transparent;
    border: none;
    font-size: 1.8rem;
    line-height: 1;
    padding: 0 0.25rem;
    color: var(--color-text-muted);
    cursor: pointer;
  }
  @media (hover: hover) {
    .close:hover {
      color: var(--color-text);
    }
  }
  .close:focus-visible {
    color: var(--color-text);
    outline: 2px solid var(--color-accent);
    border-radius: 4px;
  }

  .body {
    /* Mobile: a scroll/pan viewport for the full-size map. `safe center`
       centers it when it fits but falls back to start-alignment when it
       overflows, so the top/left edges stay reachable while panning. Desktop
       switches to a flex line below (the map is contained there). */
    flex: 1;
    min-height: 0;
    overflow: auto;
    -webkit-overflow-scrolling: touch;
    padding: 0.75rem;
    display: grid;
    place-content: safe center;
  }
  .body img {
    /* Mobile-first: render at full natural resolution and let the user pan on
       both axes. Bounded to fit (contain) only at the desktop breakpoint. */
    display: block;
    width: auto;
    height: auto;
    max-width: none;
    max-height: none;
  }
  @media (min-width: 600px) {
    /* The panel has a definite height here, so a flex line gives the image a
       definite box to resolve `max-height: 100%` against — it fits fully,
       centered, with no overflow (and thus no scrolling). */
    .body {
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .body img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }
  }
  .error {
    margin: 1.5rem 0.5rem;
    font-size: 0.95rem;
    color: var(--color-text-muted);
    line-height: 1.5;
    text-align: center;
  }
</style>
