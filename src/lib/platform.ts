/**
 * Tiny platform-detection helpers. Used sparingly — the app is mostly
 * platform-agnostic, but a couple of UI hints (e.g. iOS Add-to-Home-Screen)
 * make sense only on specific browsers.
 *
 * The detection logic is pure: each function takes an explicit env object
 * so the unit tests don't need a DOM. The default `currentEnv()` reads
 * from the global navigator + window when we're actually in a browser,
 * and returns an empty env otherwise so SSR / node test runs don't crash.
 */

export interface PlatformEnv {
  userAgent?: string;
  maxTouchPoints?: number;
  /** iOS Safari sets navigator.standalone === true when launched from Home Screen. */
  standalone?: boolean;
  /** Wrapper so tests can stub it without a real window. */
  matchMedia?: (query: string) => { matches: boolean };
}

function currentEnv(): PlatformEnv {
  if (typeof navigator === 'undefined') return {};
  const navAny = navigator as Navigator & { standalone?: boolean };
  return {
    userAgent: navigator.userAgent,
    maxTouchPoints: typeof navigator.maxTouchPoints === 'number' ? navigator.maxTouchPoints : 0,
    standalone: navAny.standalone,
    matchMedia:
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? (q) => window.matchMedia(q)
        : undefined,
  };
}

/**
 * True when the browser is iOS Safari (including iPadOS 13+ which
 * reports its UA as Mac but exposes touch points). Other iOS browsers
 * (Chrome, Firefox, Edge) all return false because the Share →
 * Add-to-Home-Screen flow we want to hint about is a Safari-shell
 * affordance.
 */
export function isIosSafari(env: PlatformEnv = currentEnv()): boolean {
  const ua = env.userAgent;
  if (!ua) return false;
  const isClassicIos = /iPad|iPhone|iPod/.test(ua);
  const maxTouch = env.maxTouchPoints ?? 0;
  const isIpadOs = /Macintosh/.test(ua) && maxTouch > 1;
  if (!isClassicIos && !isIpadOs) return false;
  // Chrome / Firefox / Edge on iOS ship their own UA tokens.
  return !/CriOS|FxiOS|EdgiOS/.test(ua);
}

/**
 * True when the page is being displayed as an installed PWA (standalone
 * window mode). When this is true, the user has already added the app
 * to their home screen and we don't need to nag.
 */
export function isStandalonePwa(env: PlatformEnv = currentEnv()): boolean {
  if (env.matchMedia?.('(display-mode: standalone)').matches) return true;
  return env.standalone === true;
}
