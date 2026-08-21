import { useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';

import { setDailyReminder } from './notifications';

/**
 * Keeps a set reminder's wording from going stale.
 *
 * A DAILY trigger repeats the content it was given when it was scheduled, so a
 * reminder set once and never touched again reads out the same sentence every
 * morning for a year — which is exactly what the rotation exists to avoid. The
 * only fix is to schedule it again, and the honest moment to do that is every
 * return to the foreground: `reminderBody` picks by the day, so a reschedule is
 * a no-op on a day already scheduled for and a new line on any other.
 *
 * The consequence is worth stating, because it is a real limit and not a bug:
 * the line you get is the one chosen the last time you opened the app, not the
 * one for the morning it arrives. Go a fortnight without opening it and you get
 * a fortnight of the same sentence. That is the correct trade — the alternative
 * is fourteen separate scheduled notifications, which is an app queueing up
 * fourteen chances to nag you.
 *
 * It never cancels. Turning the reminder on and off stays with the screen that
 * offers it, because that is also what has to ask permission first — so a null
 * here means "nothing to keep fresh", never "clear it". Setting a time is
 * therefore scheduled twice, by the screen and again by this; both write the
 * same fixed id with the same line, so the second is a replace and not a
 * second reminder.
 *
 * Called from the root layout, in an effect. `notifications.ts` must not be
 * touched during module evaluation: in Expo Go on Android the require throws
 * and takes the whole route tree down with it.
 */
export function useReminderRotation(reminderAt: string | null): void {
  useEffect(() => {
    if (!reminderAt) return;

    /**
     * Swallowed on purpose. Permission can be taken away in system settings
     * long after it was granted, and scheduling then rejects — on every return
     * to the foreground, which is an unhandled rejection a day. There is
     * nothing to say about it here either: the reminder is set from the You
     * screen, which is where permission is asked for and the only place that
     * could do anything about the answer.
     */
    const refresh = () => setDailyReminder(reminderAt).catch(() => {});

    // Once now — this is also the launch that follows a day the app was not
    // opened — and again on every return.
    void refresh();

    const subscription = AppState.addEventListener(
      'change',
      (next: AppStateStatus) => {
        if (next === 'active') void refresh();
      }
    );

    return () => subscription.remove();
  }, [reminderAt]);
}
