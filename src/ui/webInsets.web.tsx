import { ReactNode, useMemo } from 'react';
import { EdgeInsets, SafeAreaInsetsContext } from 'react-native-safe-area-context';

/**
 * Safe-area insets for the browser preview, where there are none.
 *
 * `react-native-safe-area-context` reads `env(safe-area-inset-*)` on web, which
 * a desktop browser answers with zero however small you make the window — and
 * no device-emulation mode can fake it, because `env()` is not settable. Left
 * alone, the whole app would sit 24pt higher than it does on a phone and the
 * floating nav would drop onto the gesture bar, which is the one thing a layout
 * preview must not get wrong.
 *
 * The seam is already there: the library's web `SafeAreaView` takes its numbers
 * from `useSafeAreaInsets()`, so one provider nested inside the app's own
 * `SafeAreaProvider` corrects `Screen` and `SliderNav` at once, and neither has
 * to know this exists.
 *
 * Sizes come from the URL — `?top=46&bottom=24` — so a frame can be re-shaped
 * without touching the source, which is what makes previewing a handset other
 * than the default one a matter of changing the address.
 *
 * The defaults are the CMF Phone 1's, because that is the phone this app is
 * judged on. They were measured rather than guessed, and the method is worth
 * keeping: render a screen in the browser with `?top=0&bottom=0`, screencap the
 * same screen on the device, and difference the position of one mark in each —
 * the back arrow for the top, the nav dock for the bottom, since neither moves
 * with content. Two screens agreed on the bottom and bracketed the top at 44
 * and 48, the spread being antialiasing at 2.625x rather than disagreement.
 *
 * The top is a display cutout, not a status bar: this app hides the bar, and
 * hiding it does not fill in the hole the camera sits in.
 */
const DEFAULTS: EdgeInsets = { top: 46, right: 0, bottom: 24, left: 0 };

function inset(param: string, fallback: number): number {
  const raw = new URLSearchParams(window.location.search).get(param);
  if (raw === null) return fallback;

  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

export function WebInsets({ children }: { children: ReactNode }) {
  // Read once: changing the query string reloads the page anyway.
  const insets = useMemo<EdgeInsets>(
    () => ({
      ...DEFAULTS,
      top: inset('top', DEFAULTS.top),
      bottom: inset('bottom', DEFAULTS.bottom),
    }),
    []
  );

  return (
    <SafeAreaInsetsContext.Provider value={insets}>
      {children}
    </SafeAreaInsetsContext.Provider>
  );
}
