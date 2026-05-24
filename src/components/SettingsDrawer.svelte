<script lang="ts">
  interface Props {
    showNotPresent: boolean;
    onClose: () => void;
    onToggleShowNotPresent: (next: boolean) => void;
  }

  const { showNotPresent, onClose, onToggleShowNotPresent }: Props = $props();

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }
</script>

<svelte:window onkeydown={onKeydown} />

<!--
  Drawer pattern: full-height panel sliding in from the right. Backdrop
  click dismisses. Same a11y pattern as the BeerDetail modal — Escape
  closes via the window listener, suppressing the a11y warnings we
  already suppress there.
-->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  class="backdrop"
  role="dialog"
  aria-modal="true"
  aria-labelledby="settings-title"
  onclick={onClose}
  tabindex="-1"
>
  <aside class="drawer" onclick={(e) => e.stopPropagation()}>
    <header>
      <h2 id="settings-title">Settings</h2>
      <button class="close" type="button" onclick={onClose} aria-label="Close settings">×</button>
    </header>

    <section class="group" aria-label="Display">
      <label class="toggle">
        <input
          type="checkbox"
          checked={showNotPresent}
          onchange={(e) => onToggleShowNotPresent((e.currentTarget as HTMLInputElement).checked)}
        />
        <span>
          <span class="toggle-label">Show not-present beers</span>
          <span class="toggle-desc">
            Beers you've marked as not at the festival are normally hidden from the list. Turn this
            on to see them again.
          </span>
        </span>
      </label>
    </section>

    <p class="footer-note">
      More settings will live here in future versions — theming, dataset selection, etc.
    </p>
  </aside>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    display: flex;
    justify-content: flex-end;
    z-index: 100;
  }

  .drawer {
    background: var(--color-surface);
    width: 100%;
    max-width: 22rem;
    height: 100%;
    overflow-y: auto;
    padding: 1.25rem 1.25rem 2rem;
    box-shadow: var(--shadow-md);
    -webkit-overflow-scrolling: touch;
    animation: slideIn 0.18s ease-out;
  }
  @keyframes slideIn {
    from {
      transform: translateX(20px);
      opacity: 0.4;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1rem;
    padding-bottom: 0.75rem;
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

  .group {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }

  .toggle {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.7rem;
    align-items: start;
    cursor: pointer;
  }
  .toggle input {
    width: 1.1rem;
    height: 1.1rem;
    margin-top: 0.2rem;
  }
  .toggle-label {
    display: block;
    font-weight: 500;
  }
  .toggle-desc {
    display: block;
    margin-top: 0.15rem;
    font-size: 0.85rem;
    color: var(--color-text-muted);
    line-height: 1.4;
  }

  .footer-note {
    margin: 0;
    padding-top: 1rem;
    border-top: 1px dashed var(--color-border);
    font-size: 0.8rem;
    color: var(--color-text-muted);
    line-height: 1.4;
  }
</style>
