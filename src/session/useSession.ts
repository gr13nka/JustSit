import { useKeepAwake } from 'expo-keep-awake';
import { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';

import { prepareBells, ringBell } from './bells';
import { cancelScheduled, scheduleSessionEnd } from './notifications';

/** How often the display refreshes. The clock itself is not driven by this. */
const TICK_MS = 250;

type UseSessionArgs = {
  /** Epoch ms the sitting began, or null when nothing is running. */
  startedAt: number | null;
  durationMs: number;
  /** Fired exactly once, when the full length has elapsed. */
  onComplete: () => void;
};

/**
 * Owns everything about a sitting in progress: the clock, the screen, the bell,
 * and the backgrounded-app safety net.
 *
 * The clock is derived from wall time on every tick and on every return to the
 * foreground — never accumulated by counting ticks. JavaScript timers stop when
 * the app is backgrounded, so a counted-down timer silently loses exactly the
 * time the user spent away, which is the one bug that would make the whole app
 * untrustworthy.
 */
export function useSession({ startedAt, durationMs, onComplete }: UseSessionArgs) {
  const [remainingMs, setRemainingMs] = useState(durationMs);

  const completed = useRef(false);
  const scheduledId = useRef<string | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useKeepAwake();

  useEffect(() => {
    void prepareBells();
  }, []);

  useEffect(() => {
    if (startedAt === null) {
      completed.current = false;
      setRemainingMs(durationMs);
      return;
    }

    const endsAt = startedAt + durationMs;
    let cancelled = false;

    const finish = () => {
      if (completed.current) return;
      completed.current = true;

      // If we got here with the app in the foreground, the pending notification
      // would only duplicate the bell we are about to ring.
      if (AppState.currentState === 'active') {
        void cancelScheduled(scheduledId.current);
        scheduledId.current = null;
        ringBell('out');
      }

      onCompleteRef.current();
    };

    const check = () => {
      if (cancelled) return;
      const remaining = Math.max(0, endsAt - Date.now());
      setRemainingMs(remaining);
      if (remaining === 0) finish();
    };

    const onAppStateChange = (next: AppStateStatus) => {
      if (completed.current) return;

      if (next === 'active') {
        // Back in the foreground: drop the safety net and resync to wall time,
        // which may reveal the sitting finished while we were away.
        void cancelScheduled(scheduledId.current);
        scheduledId.current = null;
        check();
      } else {
        // Leaving the foreground: JS is about to stop, so hand the ending over
        // to a scheduled notification.
        void scheduleSessionEnd(endsAt).then((id) => {
          if (!cancelled && !completed.current) scheduledId.current = id;
          else void cancelScheduled(id);
        });
      }
    };

    check();
    const ticker = setInterval(check, TICK_MS);
    const subscription = AppState.addEventListener('change', onAppStateChange);

    return () => {
      cancelled = true;
      clearInterval(ticker);
      subscription.remove();
      void cancelScheduled(scheduledId.current);
      scheduledId.current = null;
    };
  }, [startedAt, durationMs]);

  return { remainingMs };
}
