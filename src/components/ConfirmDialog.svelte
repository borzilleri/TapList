<script lang="ts">
  import { dialogs } from '../lib/dialogs.svelte';
  import { focusTrap } from '../lib/focusTrap';
  import { lockBodyScroll } from '../lib/scrollLock';

  // Reactive read of the singleton. When `current` becomes non-null, this
  // component's {#if} branch mounts and the dialog appears.
  const current = $derived(dialogs.current);

  // Escape handling uses a CAPTURE-phase window listener rather than the
  // declarative `<svelte:window onkeydown>` (which registers in bubble
  // phase). Why: confirm dialogs are typically stacked on top of another
  // modal (BeerDetail's delete-ad-hoc flow, SettingsDrawer's import-
  // replace flow), and those parents have their own bubble-phase Escape
  // listeners. If both bubble handlers run in the same keystroke, a
  // single Escape would close BOTH the confirm dialog AND the modal
  // underneath. Capture phase always fires first, and
  // stopImmediatePropagation blocks the bubble-phase listeners from
  // ever seeing the event — so the parent modal stays open.
  $effect(() => {
    if (!current) return;
    function handler(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      dialogs.respond(false);
    }
    window.addEventListener('keydown', handler, { capture: true });
    return () => window.removeEventListener('keydown', handler, { capture: true });
  });
</script>

{#if current}
  {@const opts = current.options}
  <!--
    Backdrop click dismisses (e.target === e.currentTarget so taps inside
    the panel don't trigger it — same pattern as the other modals).
  -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="backdrop"
    role="dialog"
    aria-modal="true"
    aria-labelledby="confirm-title"
    aria-describedby={opts.message ? 'confirm-message' : undefined}
    onclick={(e) => {
      if (e.target === e.currentTarget) dialogs.respond(false);
    }}
    tabindex="-1"
    use:lockBodyScroll
  >
    <div class="panel" use:focusTrap>
      <h2 id="confirm-title">{opts.title}</h2>
      {#if opts.message}
        <p id="confirm-message" class="message">{opts.message}</p>
      {/if}
      <div class="actions">
        <!--
          Order matters for keyboard ergonomics. On danger=true the cancel
          button is rendered first so it takes initial focus from the
          focus-trap — an accidental Enter on the modal won't trigger
          destructive action. For non-danger confirms we put Confirm first
          so Enter does the obvious thing.
        -->
        {#if opts.danger}
          <button type="button" class="cancel" onclick={() => dialogs.respond(false)}>
            {opts.cancelLabel ?? 'Cancel'}
          </button>
          <button type="button" class="confirm danger" onclick={() => dialogs.respond(true)}>
            {opts.confirmLabel ?? 'Confirm'}
          </button>
        {:else}
          <button type="button" class="confirm" onclick={() => dialogs.respond(true)}>
            {opts.confirmLabel ?? 'Confirm'}
          </button>
          <button type="button" class="cancel" onclick={() => dialogs.respond(false)}>
            {opts.cancelLabel ?? 'Cancel'}
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 300; /* above other modals — confirm should always be on top */
    padding: 1rem;
  }

  .panel {
    background: var(--color-surface);
    border-radius: var(--radius);
    max-width: 24rem;
    width: 100%;
    padding: 1.25rem 1.25rem 1rem;
    box-shadow: var(--shadow-md);
  }
  @media (prefers-reduced-motion: no-preference) {
    .panel {
      animation: confirm-in 0.15s ease-out;
    }
    @keyframes confirm-in {
      from {
        opacity: 0;
        transform: scale(0.96);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }
  }

  h2 {
    margin: 0 0 0.5rem;
    font-size: 1.1rem;
    line-height: 1.3;
  }
  .message {
    margin: 0;
    color: var(--color-text-muted);
    line-height: 1.5;
    font-size: 0.95rem;
  }

  .actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 1.25rem;
    /*
     * Right-align in row layouts but pile vertically on the narrowest
     * mobile widths where label length might cause overflow. Confirm
     * stays on the right (or bottom) — the visually "primary" position.
     */
    justify-content: flex-end;
    flex-wrap: wrap;
  }
  .actions button {
    flex: 1 1 auto;
    min-width: 6rem;
    padding: 0.55rem 0.9rem;
    border-radius: var(--radius);
    font-size: 0.95rem;
    min-height: 44px;
    cursor: pointer;
  }
  .cancel {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    color: var(--color-text);
  }
  @media (hover: hover) {
    .cancel:hover {
      background: var(--color-accent-bg);
    }
  }
  .cancel:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 1px;
  }

  .confirm {
    background: var(--color-accent);
    border: 1px solid var(--color-accent);
    color: var(--color-on-accent);
  }
  .confirm:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }
  .confirm.danger {
    /*
     * Destructive variant: a desaturated rust-red derived from the accent
     * so it still reads as part of the brand palette. We construct it with
     * color-mix so light/dark schemes both work without a second variable.
     */
    background: color-mix(in oklab, var(--color-accent) 35%, #c0392b);
    border-color: color-mix(in oklab, var(--color-accent) 35%, #c0392b);
    color: #ffffff;
  }
  .confirm.danger:focus-visible {
    outline: 2px solid color-mix(in oklab, var(--color-accent) 35%, #c0392b);
    outline-offset: 2px;
  }
</style>
