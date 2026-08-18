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
 * Sizes come from the URL — `?top=24&bottom=24` — so a frame can be re-shaped
 * without touching the source. The defaults are an ordinary Android phone with
 * gesture navigation. If a particular handset differs, read its real insets and
 * pass them; that is what the parameters are for.
 */
const DEFAULTS: EdgeInsets = { top: 24, right: 0, bottom: 24, left: 0 };

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
