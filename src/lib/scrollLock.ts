/**
 * Body-scroll lock Svelte action for modal overlays.
 *
 * When an overlay mounts, the document behind it should stop scrolling so
 * the user only interacts with the overlay. Without this, mobile users can
 * accidentally scroll the list while filling out a form, and on screens
 * shorter than the overlay the duelling scroll regions are confusing.
 *
 * Strategy:
 *   - Toggle `position: fixed` on <body> (with `top: -scrollY`) while
 *     locked. This stops scroll on iOS Safari, which ignores plain
 *     `overflow: hidden` on <body> for native momentum scroll. Plain
 *     `overflow: hidden` would work on every other browser, but the
 *     position-fixed trick covers everyone.
 *   - Restore the saved scroll position on unlock so the page doesn't
 *     jump to the top.
 *   - Counter-based, so nested/overlapping overlays Just Work: the lock
 *     stays on until the last overlay unmounts.
 *
 * Usage:
 *   <div class="backdrop" use:lockBodyScroll>...</div>
 */

let lockCount = 0;
let savedScrollY = 0;
let savedBodyStyle: Partial<CSSStyleDeclaration> = {};

function applyLock(): void {
  savedScrollY = window.scrollY;
  const body = document.body;
  // Remember the inline styles so we can restore them precisely (don't blow
  // away other inline styles the host page may have set).
  savedBodyStyle = {
    position: body.style.position,
    top: body.style.top,
    left: body.style.left,
    right: body.style.right,
    width: body.style.width,
    overflow: body.style.overflow,
  };
  body.style.position = 'fixed';
  body.style.top = `-${savedScrollY}px`;
  body.style.left = '0';
  body.style.right = '0';
  body.style.width = '100%';
  // Belt-and-suspenders for non-iOS browsers that respect overflow on body.
  body.style.overflow = 'hidden';
}

function releaseLock(): void {
  const body = document.body;
  body.style.position = savedBodyStyle.position ?? '';
  body.style.top = savedBodyStyle.top ?? '';
  body.style.left = savedBodyStyle.left ?? '';
  body.style.right = savedBodyStyle.right ?? '';
  body.style.width = savedBodyStyle.width ?? '';
  body.style.overflow = savedBodyStyle.overflow ?? '';
  // Force a synchronous layout pass before scrolling. Without this, some
  // browsers haven't recomputed the page height after removing the
  // position-fixed body and scrollTo silently no-ops.
  void body.offsetHeight;
  window.scrollTo(0, savedScrollY);
}

export function lockBodyScroll(_node: HTMLElement) {
  if (typeof document === 'undefined') return { destroy() {} };
  if (lockCount === 0) applyLock();
  lockCount++;
  return {
    destroy() {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount === 0) releaseLock();
    },
  };
}
