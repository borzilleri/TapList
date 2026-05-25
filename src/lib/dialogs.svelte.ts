/**
 * Singleton confirm-dialog controller.
 *
 * Provides a promise-based API that mirrors the readability of native
 * `confirm()` while letting us style the dialog and handle focus/scroll
 * properly:
 *
 *   if (await dialogs.confirm({ title: 'Delete this beer?', danger: true })) {
 *     ...
 *   }
 *
 * One <ConfirmDialog /> mounted at the root reads `dialogs.current` and
 * renders the modal whenever it's set. `respond(true/false)` resolves
 * the awaiting promise and clears the slot.
 *
 * Single-slot: if a second `confirm()` arrives while one is open, the
 * earlier promise resolves to `false` (cancelled) and the new one
 * replaces it. In practice the UI shouldn't let two run in parallel,
 * but defending against it keeps the contract clean.
 */

export interface ConfirmOptions {
  title: string;
  /** Optional supporting copy beneath the title. */
  message?: string;
  /** Defaults to "Confirm". */
  confirmLabel?: string;
  /** Defaults to "Cancel". */
  cancelLabel?: string;
  /**
   * When true, the confirm button is rendered in a destructive style and
   * cancel takes initial focus instead of confirm (so an accidental Enter
   * doesn't trigger the dangerous path).
   */
  danger?: boolean;
}

interface Pending {
  options: ConfirmOptions;
  resolve: (ok: boolean) => void;
}

class DialogsController {
  current = $state<Pending | null>(null);

  /**
   * Show a confirm dialog. Resolves to true if the user confirmed, false
   * for cancel / Escape / backdrop dismiss.
   */
  confirm(options: ConfirmOptions): Promise<boolean> {
    if (this.current) {
      // Replace the in-flight dialog. The earlier caller gets `false`.
      console.warn(
        'dialogs.confirm called while another dialog was open; cancelling the older one',
      );
      this.current.resolve(false);
    }
    return new Promise<boolean>((resolve) => {
      this.current = { options, resolve };
    });
  }

  /** Resolve the current dialog. No-op if none is open. */
  respond(ok: boolean): void {
    if (!this.current) return;
    const pending = this.current;
    this.current = null;
    pending.resolve(ok);
  }

  /** Test-only reset; not used in app code. */
  _reset(): void {
    if (this.current) this.current.resolve(false);
    this.current = null;
  }
}

export const dialogs = new DialogsController();

// Expose the singleton on window for e2e tests + interactive debugging.
// This is intentional — no UI affordance opens a dialog programmatically,
// so the suite (and devtools) need a back door. The reference is tiny and
// has no security implications.
if (typeof window !== 'undefined') {
  (window as unknown as { __taplistDialogs: DialogsController }).__taplistDialogs = dialogs;
}
