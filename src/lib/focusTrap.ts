/**
 * Focus-trap Svelte action for modal overlays.
 *
 * On mount:
 *   1. Remembers the element that was focused before the modal opened.
 *   2. Focuses the first focusable element inside the trap (or the
 *      container itself if there's nothing focusable yet).
 *   3. Watches the document for Tab / Shift+Tab and cycles focus within
 *      the container instead of letting it escape to the page behind.
 *
 * On destroy: restores focus to the previously-focused element so keyboard
 * users land where they came from when the modal closes.
 *
 * Usage:
 *   <div use:focusTrap>...</div>
 *
 * The action is opt-in (only modal/dialog roots use it). Other components
 * keep their default tab behavior.
 */

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'button:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  'audio[controls]',
  'video[controls]',
  '[contenteditable]:not([contenteditable="false"])',
].join(',');

function getFocusable(container: HTMLElement): HTMLElement[] {
  const nodes = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
  // Filter out elements that are visually hidden or have an inert ancestor.
  return Array.from(nodes).filter((el) => {
    if (el.hasAttribute('inert')) return false;
    if (el.closest('[inert]')) return false;
    const style = window.getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none') return false;
    return el.offsetParent !== null || style.position === 'fixed';
  });
}

export function focusTrap(node: HTMLElement) {
  const previouslyFocused = document.activeElement as HTMLElement | null;

  // Defer the initial focus to a microtask: components mount their children
  // synchronously, but element offsetParent / visibility queries are reliable
  // only once the browser has run a layout pass.
  queueMicrotask(() => {
    const focusable = getFocusable(node);
    // `preventScroll: true` avoids the browser auto-scrolling the focused
    // element into view, which would fight the scroll-lock action (and on
    // mobile would visibly jump the page just as the modal animates in).
    if (focusable.length > 0) {
      focusable[0].focus({ preventScroll: true });
    } else {
      // Fallback so screen readers still announce the dialog title.
      node.setAttribute('tabindex', '-1');
      node.focus({ preventScroll: true });
    }
  });

  function onKeydown(e: KeyboardEvent) {
    if (e.key !== 'Tab') return;
    const focusable = getFocusable(node);
    if (focusable.length === 0) {
      // Nothing to tab to — swallow the event so focus can't escape the modal.
      e.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement as HTMLElement | null;
    if (e.shiftKey) {
      // Shift+Tab on the first element wraps to the last.
      if (active === first || !node.contains(active)) {
        e.preventDefault();
        last.focus({ preventScroll: true });
      }
    } else {
      // Tab on the last element wraps to the first.
      if (active === last || !node.contains(active)) {
        e.preventDefault();
        first.focus({ preventScroll: true });
      }
    }
  }

  document.addEventListener('keydown', onKeydown, true);

  return {
    destroy() {
      document.removeEventListener('keydown', onKeydown, true);
      // Restore focus only if the trap had taken it; respect the user's
      // current focus if they've already moved on (e.g. a programmatic
      // .focus() during teardown).
      if (previouslyFocused && document.body.contains(previouslyFocused)) {
        previouslyFocused.focus({ preventScroll: true });
      }
    },
  };
}
