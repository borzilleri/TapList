/**
 * Tests for the dialogs controller. Focused on the promise contract; the
 * actual modal UX is exercised by the e2e suite.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { dialogs } from './dialogs.svelte';

afterEach(() => {
  dialogs._reset();
});

describe('dialogs.confirm', () => {
  it('returns a pending promise and exposes the options on .current', () => {
    const p = dialogs.confirm({ title: 'Test' });
    expect(dialogs.current).not.toBeNull();
    expect(dialogs.current!.options.title).toBe('Test');
    // Promise hasn't resolved yet.
    let settled = false;
    p.then(() => (settled = true));
    expect(settled).toBe(false);
  });

  it('respond(true) resolves the promise with true and clears the slot', async () => {
    const p = dialogs.confirm({ title: 'Test' });
    dialogs.respond(true);
    await expect(p).resolves.toBe(true);
    expect(dialogs.current).toBeNull();
  });

  it('respond(false) resolves with false', async () => {
    const p = dialogs.confirm({ title: 'Test' });
    dialogs.respond(false);
    await expect(p).resolves.toBe(false);
  });

  it('a second confirm while one is open cancels the first with false', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const first = dialogs.confirm({ title: 'First' });
    const second = dialogs.confirm({ title: 'Second' });
    expect(dialogs.current!.options.title).toBe('Second');
    dialogs.respond(true);
    await expect(first).resolves.toBe(false);
    await expect(second).resolves.toBe(true);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('respond is a no-op when no dialog is open', () => {
    expect(() => dialogs.respond(true)).not.toThrow();
    expect(dialogs.current).toBeNull();
  });
});
