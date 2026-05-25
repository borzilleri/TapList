/**
 * Tests for platform detection. The helpers accept an explicit env
 * object so we can exercise the logic without a DOM.
 */

import { describe, expect, it } from 'vitest';
import { isIosSafari, isStandalonePwa, type PlatformEnv } from './platform';

const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 ' +
  '(KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const IPAD_UA =
  'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 ' +
  '(KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const IPADOS_DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 ' +
  '(KHTML, like Gecko) Version/17.4 Safari/605.1.15';
const MAC_SAFARI_UA = IPADOS_DESKTOP_UA;
const CHROME_IOS_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 ' +
  '(KHTML, like Gecko) CriOS/124.0.6367.83 Mobile/15E148 Safari/604.1';
const FIREFOX_IOS_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 ' +
  '(KHTML, like Gecko) FxiOS/125.0 Mobile/15E148 Safari/605.1.15';
const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';

describe('isIosSafari', () => {
  it('returns true for iPhone Safari', () => {
    expect(isIosSafari({ userAgent: IPHONE_UA })).toBe(true);
  });

  it('returns true for iPad Safari (classic UA)', () => {
    expect(isIosSafari({ userAgent: IPAD_UA })).toBe(true);
  });

  it('returns true for iPadOS 13+ pretending to be Mac (touch points > 1)', () => {
    expect(isIosSafari({ userAgent: IPADOS_DESKTOP_UA, maxTouchPoints: 5 })).toBe(true);
  });

  it('returns false for desktop Safari on Mac (no touch points)', () => {
    expect(isIosSafari({ userAgent: MAC_SAFARI_UA, maxTouchPoints: 0 })).toBe(false);
  });

  it('returns false for Chrome on iOS (CriOS token)', () => {
    expect(isIosSafari({ userAgent: CHROME_IOS_UA })).toBe(false);
  });

  it('returns false for Firefox on iOS (FxiOS token)', () => {
    expect(isIosSafari({ userAgent: FIREFOX_IOS_UA })).toBe(false);
  });

  it('returns false for Android Chrome', () => {
    expect(isIosSafari({ userAgent: ANDROID_UA })).toBe(false);
  });

  it('returns false when no user agent is available (SSR / node)', () => {
    expect(isIosSafari({})).toBe(false);
  });
});

describe('isStandalonePwa', () => {
  function mm(matches: boolean): PlatformEnv['matchMedia'] {
    return () => ({ matches });
  }

  it('returns true when matchMedia reports display-mode: standalone', () => {
    expect(isStandalonePwa({ matchMedia: mm(true) })).toBe(true);
  });

  it('returns true when navigator.standalone is true (iOS Home Screen)', () => {
    expect(isStandalonePwa({ standalone: true, matchMedia: mm(false) })).toBe(true);
  });

  it('returns false in a regular browser tab', () => {
    expect(isStandalonePwa({ standalone: false, matchMedia: mm(false) })).toBe(false);
  });

  it('returns false when both signals are absent (SSR / node)', () => {
    expect(isStandalonePwa({})).toBe(false);
  });
});
