import { useEffect, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';

import { dayKey } from '../domain/stats';

/**
 * Which day the app is currently open on, as an instant inside it.
 *
 * The welcome screen comes once a day, and "the app was opened" is not a moment
 * the app can read back off anything — so somebody has to hold the clock while
 * the tabs are up. A launch is one answer and a return to the foreground is the
 * other: a phone left open overnight is opened again in the morning without
 * ever being launched, and a day that turned while it sat on the table is still
 * a new day.
 *
 * It answers with the previous instant untouched when the day has *not* turned,
 * which is the whole reason it is written this way. Returning a fresh
 * `Date.now()` on every foreground would give the tab tree a new value to
 * re-render against every time the user glanced at anything else on their
 * phone, for a question whose answer had not changed.
 *
 * **It cannot pull anybody out of a sitting, and that is the load-bearing
 * part.** The tabs layout stays mounted underneath a pushed `session/` route,
 * so a foreground return across 04:00 does re-run this and does re-render the
 * layout — and a `<Redirect>` appearing there would, on the face of it, throw
 * away a sitting that is still running, since an abandoned sitting is never
 * recorded. It does not, and the guarantee is the library's rather than ours:
 * `expo-router`'s `Redirect` wraps its `router.replace` in `useFocusEffect`
 * (`node_modules/expo-router/build/link/Redirect.js`), so one rendered from a
 * covered layout mounts and navigates nowhere. It fires when the tabs are
 * focused again, which is after the sitting has ended.
 *
 * One consequence of that is accepted rather than worked around: a sitting run
 * across 04:00 lands back on the tabs on a new logical day, so the greeting
 * turns up just after it. That is correct — it is a new day — and a special
 * case suppressing it would be the app deciding the morning had already been
 * had.
 */
export function useOpenedDay(): number {
  const [openedAt, setOpenedAt] = useState(() => Date.now());

  useEffect(() => {
    const refresh = () =>
      setOpenedAt((prev) => (dayKey(prev) === dayKey(Date.now()) ? prev : Date.now()));

    const subscription = AppState.addEventListener(
      'change',
      (next: AppStateStatus) => {
        if (next === 'active') refresh();
      }
    );

    return () => subscription.remove();
  }, []);

  return openedAt;
}
