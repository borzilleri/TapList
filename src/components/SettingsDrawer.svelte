<script lang="ts">
  import { focusTrap } from '../lib/focusTrap';
  import { lockBodyScroll } from '../lib/scrollLock';
  import { isIosSafari, isStandalonePwa } from '../lib/platform';
  import type { ThemePreference } from '../lib/types';

  // Captured on mount (rather than as a $derived) because the UA / standalone
  // signals don't change across the lifetime of the drawer — and we don't
  // want them recomputing on every render.
  const showIosInstallHint = isIosSafari() && !isStandalonePwa();

  interface Props {
    showNotPresent: boolean;
    theme: ThemePreference;
    onClose: () => void;
    onToggleShowNotPresent: (next: boolean) => void;
    onSetTheme: (next: ThemePreference) => void;
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
    theme,
    onClose,
    onToggleShowNotPresent,
    onSetTheme,
    onExport,
    onImportFile,
    importStatus = null,
  }: Props = $props();

  // Emoji picks: sun for light, crescent moon for dark, half-illuminated
  // moon for system (it splits between the two, hinting at "follows
  // whatever's outside"). aria-hidden on the icon means screen readers
  // announce only the label.
  const themeOptions: ReadonlyArray<{ value: ThemePreference; label: string; icon: string }> = [
    { value: 'light', label: 'Light', icon: '☀️' },
    { value: 'dark', label: 'Dark', icon: '🌙' },
    { value: 'system', label: 'System', icon: '🌗' },
  ];

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
      <div class="theme-field">
        <span class="field-label">Theme</span>
        <div class="theme-segmented" role="radiogroup" aria-label="Theme">
          {#each themeOptions as opt (opt.value)}
            <label class="theme-option" class:active={theme === opt.value}>
              <input
                type="radio"
                name="theme"
                value={opt.value}
                checked={theme === opt.value}
                onchange={() => onSetTheme(opt.value)}
              />
              <span class="theme-icon" aria-hidden="true">{opt.icon}</span>
              <span class="theme-label">{opt.label}</span>
            </label>
          {/each}
        </div>
        <span class="field-hint">
          System follows your device. Light or Dark overrides regardless of device settings.
        </span>
      </div>

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

  .theme-field {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .field-label {
    font-weight: 500;
    font-size: 0.95rem;
  }
  .field-hint {
    font-size: 0.8rem;
    color: var(--color-text-muted);
    line-height: 1.4;
  }

  .theme-segmented {
    display: flex;
    gap: 0;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: var(--color-surface);
    overflow: hidden;
  }
  .theme-option {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    position: relative;
    padding: 0.5rem 0.4rem;
    font-size: 0.9rem;
    cursor: pointer;
    user-select: none;
    border-right: 1px solid var(--color-border);
    min-height: 40px;
  }
  .theme-icon {
    font-size: 1rem;
    line-height: 1;
    /* Vertically nudge so the emoji baseline lines up with the label
       — most platforms render moon/sun glyphs slightly above the line. */
    transform: translateY(-0.05em);
  }
  .theme-label {
    line-height: 1;
  }
  .theme-option:last-child {
    border-right: none;
  }
  .theme-option input {
    /* Hide the native radio; the label itself is the visible affordance. */
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }
  @media (hover: hover) {
    .theme-option:hover {
      background: var(--color-accent-bg);
    }
  }
  .theme-option:focus-within {
    outline: 2px solid var(--color-accent);
    outline-offset: -2px;
    z-index: 1;
  }
  .theme-option.active {
    background: var(--color-accent);
    color: var(--color-on-accent);
    font-weight: 600;
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
</style>
