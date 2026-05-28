/**
 * Tests for the festival URL helpers. Both functions are pure, so we can
 * exercise them with literal strings instead of touching `window`.
 */

import { describe, expect, it } from 'vitest';
import { readFestivalId, urlWithFestivalId, FESTIVAL_PARAM } from './url';

describe('readFestivalId', () => {
  it('returns null for an empty search string', () => {
    expect(readFestivalId('')).toBe(null);
  });

  it('returns null when the param is absent', () => {
    expect(readFestivalId('?other=1')).toBe(null);
  });

  it('returns null when the param is present but empty', () => {
    expect(readFestivalId('?festivalId=')).toBe(null);
  });

  it('returns null when the param is whitespace-only', () => {
    expect(readFestivalId('?festivalId=%20%20')).toBe(null);
  });

  it('returns the value when valid', () => {
    expect(readFestivalId('?festivalId=wbf-2026')).toBe('wbf-2026');
  });

  it('trims surrounding whitespace', () => {
    expect(readFestivalId('?festivalId=%20wbf-2026%20')).toBe('wbf-2026');
  });

  it('coexists with other params', () => {
    expect(readFestivalId('?other=1&festivalId=wbf-2026&extra=2')).toBe('wbf-2026');
  });

  it('tolerates a bare search string (no leading ?)', () => {
    expect(readFestivalId('festivalId=wbf-2026')).toBe('wbf-2026');
  });

  it('exports the canonical param name', () => {
    // Regression guard: changing the param name is a breaking change.
    expect(FESTIVAL_PARAM).toBe('festivalId');
  });
});

describe('urlWithFestivalId', () => {
  it('adds the param to a URL that lacks one', () => {
    expect(urlWithFestivalId('https://taplist.rampant.io/', 'wbf-2026')).toBe(
      'https://taplist.rampant.io/?festivalId=wbf-2026',
    );
  });

  it('replaces the param if already present', () => {
    expect(urlWithFestivalId('https://taplist.rampant.io/?festivalId=old', 'wbf-2026')).toBe(
      'https://taplist.rampant.io/?festivalId=wbf-2026',
    );
  });

  it('preserves other query parameters', () => {
    const result = urlWithFestivalId('https://taplist.rampant.io/?other=1&extra=2', 'wbf-2026');
    const parsed = new URL(result);
    expect(parsed.searchParams.get('festivalId')).toBe('wbf-2026');
    expect(parsed.searchParams.get('other')).toBe('1');
    expect(parsed.searchParams.get('extra')).toBe('2');
  });

  it('preserves the URL hash', () => {
    expect(urlWithFestivalId('https://taplist.rampant.io/#section', 'wbf-2026')).toBe(
      'https://taplist.rampant.io/?festivalId=wbf-2026#section',
    );
  });

  it('is idempotent — same input + id returns equivalent output', () => {
    const once = urlWithFestivalId('https://taplist.rampant.io/', 'wbf-2026');
    const twice = urlWithFestivalId(once, 'wbf-2026');
    expect(twice).toBe(once);
  });
});
