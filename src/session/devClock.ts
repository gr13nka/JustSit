/**
 * What developer mode does to a sitting's clock — and, just as importantly,
 * what it leaves alone.
 *
 * Everything interesting about this app is on the far side of twenty minutes:
 * the bell, the completion screen, the trio of offers a long sitting earns, the
 * stage the app might propose afterwards. Sitting through one to look at the
 * next screen is not a way to work, and it is not a thing the release build's
 * `__DEV__` shortcuts could ever help with either.
 *
 * So developer mode shortens exactly one thing: how long the clock runs. A
 * sitting is still *recorded* at the length the user chose, which is what keeps
 * the far side honest — a five-second sitting that filed itself as five seconds
 * would grow the three commons of a very short sit and nothing that depends on
 * length could be tried at all.
 *
 * Pure and importing nothing, which is what lets it be checked without a device
 * and what keeps it out of the file that requires `expo-keep-awake`.
 */

/**
 * Long enough to hear the bell in and see the ring breathe, short enough that
 * nobody is waiting. Not a setting: a knob here would be one more thing to
 * leave in the wrong place.
 */
export const DEV_CLOCK_MS = 5_000;

/**
 * How long the clock runs, given the length the user asked for.
 *
 * The two lengths are separated here rather than at the call site so that the
 * distinction has a name. `useSession` is handed this; `recordCompletedSession`
 * is handed the chosen duration; nothing else needs to know they can differ.
 */
export function sittingClockMs(durationMs: number, devMode: boolean): number {
  return devMode ? DEV_CLOCK_MS : durationMs;
}
