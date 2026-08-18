import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

/**
 * All local notifications. There are exactly two kinds, and neither is a
 * growth mechanic:
 *
 *   - the session-end bell, as a safety net for when the app is backgrounded
 *   - one daily reminder, off until the user sets a time
 *
 * There is deliberately no evening "you haven't sat yet" nudge. The garden is
 * meant to be somewhere you go to feel calm, not a source of low-grade anxiety.
 *
 * ---
 *
 * expo-notifications is loaded lazily, and on Android in Expo Go it is not
 * loaded at all.
 *
 * Push support was pulled from Expo Go in SDK 53, and the module now throws the
 * moment it is imported there. A throw at module scope takes down every route
 * that transitively imports it — which is the whole app, stuck on the splash.
 * Wrapping the require in try/catch is not sufficient: the module also reports
 * the failure through React Native's global error handler, so a caught throw
 * still raises a full-screen error overlay. The only reliable fix is not to
 * require it.
 *
 * Web is excluded too, for a different reason: none of this can work in a
 * browser, and the web build exists only to look at layout at screen shapes we
 * don't own. Loading the module there would buy nothing and cost a permission
 * prompt.
 *
 * The trade is explicit: in Expo Go on Android and in the browser, reminders and
 * the backgrounded-session safety net quietly do nothing. Everything else — the
 * sitting, the bell, the garden, progression — works normally. In a development
 * build, all of it works.
 */

type NotificationsModule = typeof import('expo-notifications');

/** Expo Go, as opposed to a development or production build. */
const IN_EXPO_GO =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

const UNSUPPORTED =
  (IN_EXPO_GO && Platform.OS === 'android') || Platform.OS === 'web';

/** undefined = not tried yet, null = tried and unavailable. */
let cached: NotificationsModule | null | undefined;

function load(): NotificationsModule | null {
  if (cached !== undefined) return cached;

  if (UNSUPPORTED) {
    console.warn(
      '[justsit] Reminders and the backgrounded-session bell are disabled in ' +
        'this runtime. Use a development build for them.'
    );
    cached = null;
    return cached;
  }

  try {
    cached = require('expo-notifications') as NotificationsModule;
  } catch (error) {
    console.warn('[justsit] Notifications unavailable in this runtime.', error);
    cached = null;
  }

  return cached;
}

const SESSION_CHANNEL = 'session';
const REMINDER_CHANNEL = 'reminder';

/** Fixed id, so setting a new reminder time replaces rather than accumulates. */
export const DAILY_REMINDER_ID = 'justsit-daily-reminder';

/** True when notifications actually work here. Drives what the UI offers. */
export function notificationsAvailable(): boolean {
  return load() !== null;
}

export function configureNotificationHandler(): void {
  const N = load();
  if (!N) return;

  N.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function ensureChannels(): Promise<void> {
  const N = load();
  if (!N || Platform.OS !== 'android') return;

  await N.setNotificationChannelAsync(SESSION_CHANNEL, {
    name: 'Session bell',
    importance: N.AndroidImportance.HIGH,
  });
  await N.setNotificationChannelAsync(REMINDER_CHANNEL, {
    name: 'Daily reminder',
    importance: N.AndroidImportance.DEFAULT,
  });
}

export async function requestPermission(): Promise<boolean> {
  const N = load();
  if (!N) return false;

  const existing = await N.getPermissionsAsync();
  if (existing.granted) return true;

  const requested = await N.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: false, allowSound: true },
  });
  return requested.granted;
}

/**
 * The safety net for a sitting that ends while the app is backgrounded.
 *
 * When the app is in the foreground this is cancelled and the real bell plays
 * instead — see `useSession`. That keeps it to exactly one sound either way,
 * rather than a bell and a notification chime landing together.
 */
export async function scheduleSessionEnd(endsAt: number): Promise<string | null> {
  const N = load();
  if (!N) return null;

  const seconds = Math.round((endsAt - Date.now()) / 1000);
  if (seconds <= 0) return null;

  return N.scheduleNotificationAsync({
    content: {
      title: 'Your sitting is complete.',
      body: 'Take a moment before you get up.',
      sound: true,
    },
    trigger: {
      type: N.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds,
      channelId: SESSION_CHANNEL,
    },
  });
}

export async function cancelScheduled(id: string | null): Promise<void> {
  const N = load();
  if (!N || !id) return;

  // Already fired or already cancelled is a fine outcome, not an error.
  await N.cancelScheduledNotificationAsync(id).catch(() => {});
}

/**
 * Sets or clears the daily reminder. `hhmm` is local 24h time, e.g. "07:30".
 *
 * The wording stays quiet on purpose — an invitation, never a threat about a
 * streak. An app about attention should not be competing for it.
 */
export async function setDailyReminder(hhmm: string | null): Promise<void> {
  const N = load();
  if (!N) return;

  await cancelScheduled(DAILY_REMINDER_ID);
  if (!hhmm) return;

  const [hour, minute] = hhmm.split(':').map(Number);

  await N.scheduleNotificationAsync({
    identifier: DAILY_REMINDER_ID,
    content: {
      title: 'A few minutes?',
      body: 'Your cushion is where you left it.',
    },
    trigger: {
      type: N.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
      channelId: REMINDER_CHANNEL,
    },
  });
}
