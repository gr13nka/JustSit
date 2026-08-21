import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { space } from '../theme/tokens';
import { countdown } from './countdown';
import { Text } from './Text';

/**
 * How often the count catches up with the clock.
 *
 * The same 250ms `useSession` ticks at, and for the same reason: the number is
 * derived from `Date.now()`, so this decides only how soon the screen agrees
 * with it, never what it says.
 */
const TICK_MS = 250;

/**
 * The two answers.
 *
 * They are the control's own words rather than props. A confirmation that could
 * be made to answer "Delete" and "Keep" would be a kit of parts to assemble at
 * each call site; this is one thing, and the caller's job is to write the
 * question rather than to re-decide what a yes looks like.
 */
const YES = 'Yes';
const NO = 'No';

/**
 * The app's one confirmation: a tap, a question, and a few seconds before the
 * answer will take.
 *
 * Nothing here has ever shown a dialog — leaving a sitting early asks nothing,
 * and rubbing a note out is how a note is thrown away — so the question is
 * asked *in place*, in the row the action was standing in. Nothing is covered
 * and nothing is dismissed; the card simply says something else for as long as
 * it is being asked.
 *
 * The guard is the wait rather than the gesture. This was a press-and-hold
 * first, which is a better mark on paper and does not survive contact with a
 * scroll view: a `Pressable` inside a `ScrollView` hands the touch to the
 * scroll responder on the smallest drift of a finger, so the hold quietly never
 * completed on a phone while working perfectly under a mouse. A tap cannot be
 * taken away like that, and what stops a tap being an accident is that the
 * second tap has to wait — three seconds is far longer than a slip, and short
 * enough that somebody who means it is not being made to prove anything.
 *
 * The count is drawn because a word that refuses to be pressed and says nothing
 * about why is a broken button. `inkFaint` while it waits and `danger` once it
 * is live carries the same thing in colour, which is what makes it legible
 * without reading the number.
 */
export function TimedConfirm({
  label,
  question,
  onConfirm,
  delaySeconds = 3,
}: {
  /** The action at rest, in the imperative — "Reset". Drawn in `danger`. */
  label: string;
  /** What is asked once it is tapped. One line, in the app's voice. */
  question: string;
  onConfirm: () => void;
  /** How long "Yes" refuses. Long enough to be a guard, short enough to wait out. */
  delaySeconds?: number;
}) {
  const [armedAt, setArmedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);

  /**
   * Both clocks are set in the same handler, because the first armed frame is
   * drawn before any effect runs: a `now` left behind would put the whole epoch
   * in the label for a frame, and a screenshot is faster than a frame.
   */
  const arm = () => {
    const at = Date.now();
    setArmedAt(at);
    setNow(at);
  };

  const rest = () => setArmedAt(null);

  useEffect(() => {
    if (armedAt === null) return;

    const endsAt = armedAt + delaySeconds * 1000;
    const ticker = setInterval(() => {
      const at = Date.now();
      setNow(at);
      // Nothing about the question changes once the wait is over, and a
      // settled screen has no business re-rendering four times a second for
      // as long as it is left standing there.
      if (at >= endsAt) clearInterval(ticker);
    }, TICK_MS);

    return () => clearInterval(ticker);
  }, [armedAt, delaySeconds]);

  /*
   * Leaving the screen puts the question away. The tabs stay mounted, so
   * without this a question asked and walked away from would still be standing
   * there — possibly with its wait long since over — the next time the tab came
   * back, which is the one state a guard like this must never be found in.
   */
  useFocusEffect(useCallback(() => () => setArmedAt(null), []));

  if (armedAt === null) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={arm}
        hitSlop={space.sm}
        style={({ pressed }) => [styles.root, pressed && styles.pressed]}>
        <Text variant="caption" color="danger">
          {label}
        </Text>
      </Pressable>
    );
  }

  const { live, secondsLeft, label: yes } = countdown(YES, armedAt, now, delaySeconds);

  return (
    <View style={styles.root}>
      <Text variant="body">{question}</Text>

      <View style={styles.answers}>
        <Pressable
          accessibilityRole="button"
          // Spelt out rather than left as "Yes · 2", which a screen reader
          // would read as a word and a stray number.
          accessibilityLabel={live ? YES : `${YES}, in ${secondsLeft} seconds`}
          accessibilityState={{ disabled: !live }}
          disabled={!live}
          onPress={() => {
            // Put back to rest before the work, so the control is not left
            // standing armed behind a screen that has just changed underneath
            // it.
            rest();
            onConfirm();
          }}
          hitSlop={space.sm}
          style={({ pressed }) => [pressed && styles.pressed]}>
          <Text variant="caption" color={live ? 'danger' : 'inkFaint'}>
            {yes}
          </Text>
        </Pressable>

        {/* Always live, and in ink rather than the quieter caption colour: the
            way out of a question must never be the harder of the two to find. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={NO}
          onPress={rest}
          hitSlop={space.sm}
          style={({ pressed }) => [pressed && styles.pressed]}>
          <Text variant="caption" color="ink">
            {NO}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  /**
   * One root for both states, so the question opens where the action stood.
   *
   * More air above than a card's own gap gives: the one irreversible word in
   * the app is kept a distance from whatever is above it, on the same argument
   * that puts the note screen's `delete` at the foot of the page.
   */
  root: {
    alignSelf: 'flex-start',
    marginTop: space.sm,
    gap: space.xs,
  },
  /** Two answers to one question, far enough apart not to be tapped by mistake. */
  answers: {
    flexDirection: 'row',
    gap: space.lg,
  },
  /** Ink settling, the same as everywhere else. */
  pressed: {
    opacity: 0.6,
  },
});
