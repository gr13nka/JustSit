import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * What a gesture feels like under the thumb, named by the event rather than by
 * the channel.
 *
 * Callers say what happened — a card was picked up, a threshold was crossed, a
 * card landed — and nothing outside this file knows which platform API answers,
 * or that the two platforms answer differently, or that one of them declines.
 * That split is the whole reason the file exists: `src/session/notifications.ts`
 * decides platform support in one place for the same reason, and a call site
 * that had to ask would be a call site that could forget.
 *
 * It is deliberately not a general vocabulary. Three events, one gesture, and
 * the app's touch feedback everywhere else is still an opacity change and one
 * point of travel. A fourth name here would be a second way of answering a
 * touch.
 *
 * **This does not breach "one bell in, one out, nothing between".** That rule
 * is about sound, and it exists so that nothing interrupts a sitting audibly.
 * These are answers to something the user did with their own thumb, in the same
 * class as a button settling under a press — not something the app initiated.
 * What would breach it is a haptic the app started on its own: the bell
 * buzzing, the timer ticking. There is none here, and there should not be one.
 */
export type Feeling =
  /** A card has been taken hold of, before it has been asked to go anywhere. */
  | 'pickup'
  /** It has crossed the distance at which letting go would let it leave. */
  | 'tick'
  /** It has arrived — landed back on the page, or gone. */
  | 'drop';

/**
 * Android is asked in its own words, and it matters which.
 *
 * `impactAsync` is backed by the `Vibrator` API there, which Expo's own docs
 * advise against for haptics and which needs the `VIBRATE` permission.
 * `performAndroidHapticsAsync` is the platform's real haptics engine, needs no
 * permission, and — the part that decided it — has constants that already mean
 * what these three events mean. A gesture starting and ending are not
 * approximations of `Light` and `Medium`; they are the same sentence.
 */
const ANDROID: Record<Feeling, Haptics.AndroidHaptics> = {
  pickup: Haptics.AndroidHaptics.Gesture_Start,
  tick: Haptics.AndroidHaptics.Clock_Tick,
  drop: Haptics.AndroidHaptics.Gesture_End,
};

/**
 * iOS has no gesture constants, so it is asked for the weights instead.
 *
 * `selectionAsync` for the tick is the right word rather than a compromise: it
 * is the platform's own "a selection changed", and crossing a threshold is
 * exactly that. `NotificationFeedbackType.Success` would be the wrong word for
 * the drop whatever it felt like — a success notification is a congratulation,
 * and this app does not make those.
 */
function ios(feeling: Feeling): Promise<void> {
  if (feeling === 'tick') return Haptics.selectionAsync();
  return Haptics.impactAsync(
    feeling === 'pickup'
      ? Haptics.ImpactFeedbackStyle.Light
      : Haptics.ImpactFeedbackStyle.Medium,
  );
}

/**
 * Answer a touch, or don't.
 *
 * Fire-and-forget by contract. Nothing waits on a haptic and nothing branches
 * on whether one arrived: a phone with the engine turned off, or a browser, is
 * a phone that feels nothing, which is a fair thing for it to be. The rejection
 * is swallowed for that reason rather than out of tidiness — every one of these
 * runs mid-gesture, and an unhandled promise from a device that declined would
 * be a red screen over a card somebody is holding.
 */
export function feel(feeling: Feeling): void {
  if (Platform.OS === 'web') return;

  const answer =
    Platform.OS === 'android'
      ? Haptics.performAndroidHapticsAsync(ANDROID[feeling])
      : ios(feeling);

  answer.catch(() => {
    // A device with no haptics engine, or one that has been asked to be still.
  });
}
