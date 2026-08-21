/**
 * The arithmetic behind a confirmation that has to wait.
 *
 * Pure and in a file of its own on the `field.ts` precedent, because what is
 * worth checking here is a *boundary* — the exact moment the confirming word
 * stops being a count and becomes a button — and a boundary is checked without
 * a renderer or it is not checked at all.
 *
 * What is left is read off the wall clock rather than counted down a tick at a
 * time. That is `useSession`'s arrangement at a much smaller scale, and it buys
 * the same thing: the number on the screen is the number of seconds actually
 * left, so how often the screen is refreshed is a display choice and nothing
 * depends on a timer having fired the right number of times.
 */

export type Countdown = {
  /** Whole seconds still to wait. Zero once the wait is over. */
  secondsLeft: number;
  /** Whether the action may be taken yet. */
  live: boolean;
  /** What the action reads: the word, carrying the count while there is one. */
  label: string;
};

/**
 * Where a wait that began at `armedAt` stands at `now`.
 *
 * Rounded *up*, so the final second of the wait reads "1" rather than "0". A
 * control counting nothing while still refusing to be pressed looks broken,
 * and the whole job of the count is to say that the refusal is temporary.
 */
export function countdown(
  word: string,
  armedAt: number,
  now: number,
  delaySeconds: number
): Countdown {
  const secondsLeft = Math.max(
    0,
    Math.ceil((armedAt + delaySeconds * 1000 - now) / 1000)
  );

  return {
    secondsLeft,
    live: secondsLeft === 0,
    label: secondsLeft === 0 ? word : `${word} · ${secondsLeft}`,
  };
}
