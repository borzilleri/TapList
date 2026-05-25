<script lang="ts">
  import { focusTrap } from '../lib/focusTrap';
  import { lockBodyScroll } from '../lib/scrollLock';
  import { isIosSafari, isStandalonePwa } from '../lib/platform';

  // Captured on mount (rather than as a $derived) because the UA / standalone
  // signals don't change across the lifetime of the drawer — and we don't
  // want them recomputing on every render.
  const showIosInstallHint = isIosSafari() && !isStandalonePwa();

  interface Props {
    showNotPresent: boolean;
    onClose: () => void;
    onToggleShowNotPresent: (next: boolean) => void;
    onExport: () => void;
    onImportFile: (file: File) => void;
    /**
     * Last import outcome. When set, rendered as a status line under the
     * Import button. Cleared when the drawer opens again from scratch.
     */
    importStatus?: string | null;
  }

  const {
    showNotPresent,
    onClose,
    onToggleShowNotPresent,
    onExport,
    onImportFile,
    importStatus = null,
  }: Props = $props();

  let fileInput: HTMLInputElement | undefined = $state();

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }

  function onFileChange(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (file) onImportFile(file);
    // Reset so picking the same file again re-fires the change event.
    input.value = '';
  }
</script>

<svelte:window onkeydown={onKeydown} />

<!--
  Drawer pattern: full-height panel sliding in from the right. Backdrop
  click dismisses (checks `e.target === e.currentTarget` so taps inside
  the drawer don't bubble up). Escape closes via the window listener.
-->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
  class="backdrop"
  role="dialog"
  aria-modal="true"
  aria-labelledby="settings-title"
  onclick={(e) => {
    if (e.target === e.currentTarget) onClose();
  }}
  tabindex="-1"
  use:lockBodyScroll
>
  <aside class="drawer" use:focusTrap>
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

    <section class="group" aria-label="Backup">
      <h3 class="group-title">Backup</h3>
      <p class="group-desc">
        Move your flags, ratings, and notes between devices via CSV. The export includes only the
        beers you've actually touched.
      </p>
      <div class="action-row">
        <button type="button" class="action-btn" onclick={onExport}>Export to CSV</button>
        <button type="button" class="action-btn" onclick={() => fileInput?.click()}>
          Import from CSV…
        </button>
        <!--
          Hidden native file input. We trigger it programmatically from the
          Import button so we control the styling of the visible control.
        -->
        <input
          bind:this={fileInput}
          type="file"
          accept=".csv,text/csv"
          class="file-input-hidden"
          onchange={onFileChange}
        />
      </div>
      {#if importStatus}
        <p class="import-status" role="status">{importStatus}</p>
      {/if}
      <p class="warning">
        Importing <strong>replaces</strong> all your current ratings, flags, and notes. You'll be asked
        to confirm.
      </p>
    </section>

    {#if showIosInstallHint}
      <section class="group" aria-label="Install">
        <h3 class="group-title">Install</h3>
        <p class="group-desc">
          Add TapList to your Home Screen for full-screen use and offline access at the festival.
        </p>
        <ol class="install-steps">
          <li>
            Tap the <strong>Share</strong> button
            <span class="ios-share" aria-hidden="true">⎋</span>
            at the bottom of Safari.
          </li>
          <li>Scroll down and tap <strong>Add to Home Screen</strong>.</li>
          <li>Confirm the name and tap <strong>Add</strong>.</li>
        </ol>
      </section>
    {/if}

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
  }
  /* Only animate the slide-in when the user hasn't asked for reduced motion. */
  @media (prefers-reduced-motion: no-preference) {
    .drawer {
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

  .group-title {
    margin: 0 0 0.4rem;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .group-desc {
    margin: 0 0 0.7rem;
    font-size: 0.85rem;
    color: var(--color-text-muted);
    line-height: 1.4;
  }

  .action-row {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .action-btn {
    padding: 0.6rem 0.75rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    font-size: 0.95rem;
    cursor: pointer;
    min-height: 44px;
    text-align: center;
  }
  @media (hover: hover) {
    .action-btn:hover {
      background: var(--color-accent-bg);
    }
  }
  .action-btn:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 1px;
  }
  .file-input-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    border: 0;
  }

  .import-status {
    margin: 0.5rem 0 0;
    padding: 0.5rem 0.75rem;
    background: var(--color-accent-bg);
    border-radius: var(--radius);
    font-size: 0.85rem;
    color: var(--color-text);
    line-height: 1.4;
  }

  .warning {
    margin: 0.6rem 0 0;
    font-size: 0.78rem;
    color: var(--color-text-muted);
    line-height: 1.4;
  }

  .install-steps {
    margin: 0;
    padding-left: 1.25rem;
    font-size: 0.9rem;
    line-height: 1.6;
    color: var(--color-text);
  }
  .install-steps li {
    margin-bottom: 0.25rem;
  }
  .install-steps li:last-child {
    margin-bottom: 0;
  }
  .install-steps strong {
    font-weight: 600;
  }
  .ios-share {
    display: inline-block;
    transform: translateY(-0.05em);
    /* The Unicode ⎋ glyph approximates iOS's Share icon (box + arrow). It
       reads consistently across platforms even though it's not the real
       SF Symbol Apple ships. */
    color: var(--color-accent);
    font-weight: 700;
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
