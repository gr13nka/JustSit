import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';

import { stageAt } from '../../src/domain/stages';
import { space } from '../../src/theme/tokens';
import { useColor } from '../../src/theme/useColor';
import { useProgress, useSettings } from '../../src/store';
import { Button } from '../../src/ui/Button';
import { DurationDial } from '../../src/ui/DurationDial';
import { ArrowLeft } from '../../src/ui/icons';
import { usePressSettle } from '../../src/ui/motion';
import { Screen } from '../../src/ui/Screen';
import { TimerRing } from '../../src/ui/TimerRing';

/** The ring's plant before a sitting. The one that grows is chosen at the end. */
const PREVIEW_PLANT = 'grass';

/**
 * Opened by touching the garden's next dot, which is why it is a screen rather
 * than a tab: a sitting starts from the place it will show up, and there is no
 * timer to visit for its own sake.
 *
 * Which dot that is does not travel with the sitting. A garden fills in order,
 * so the answer is worked out from the garden at the moment the sitting
 * finishes — the dot the screen was opened from is a fact about now, not a
 * promise about then.
 */
export default function StartScreen() {
  const progress = useProgress();
  const settings = useSettings();
  const stage = stageAt(progress.stage);

  // The stage proposes; a previous explicit choice, if there is one, wins.
  const [durationMs, setDurationMs] = useState(
    settings.lastDurationMs ?? stage.suggestedMs
  );

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.header}>
        <BackArrow onPress={() => router.back()} />
      </View>

      {/*
        The ring has the free height to itself and sits in the middle of it. It
        used to share a centred group with the clock and the button, which on a
        tall phone put all three near the top and left the foot of the screen
        empty.
      */}
      <View style={styles.middle}>
        <TimerRing plant={PREVIEW_PLANT} />
      </View>

      {/*
        Drawn, because this is where a hand commits to something. The pen goes
        on exactly that and nothing else — starting a sitting here, starting
        altogether in onboarding, taking a plant on the completion screen,
        agreeing to fill a bed on the ask — and what rations it is the verb
        rather than a count: "Choose a time" is a setting and "Not now" is a way
        out, so neither gets it. Two drawn buttons are never on one screen.

        It sits above the dial rather than inside the centred block, so "how
        long" and "go" are next to each other at the foot of the screen, where a
        thumb is.
      */}
      <Button
        label="Meditate"
        variant="wobbly"
        onPress={() =>
          router.push({
            pathname: '/session/tip',
            params: { durationMs: String(durationMs) },
          })
        }
        style={styles.start}
      />

      <DurationDial valueMs={durationMs} onChange={setDurationMs} />
    </Screen>
  );
}

/**
 * The way back, drawn rather than written.
 *
 * "Back" was the only word on this screen doing a job an arrow does better, and
 * the kit sanctions hand-drawn arrows for exactly this. The label survives in
 * `accessibilityLabel`, where it is still the word.
 */
function BackArrow({ onPress }: { onPress: () => void }) {
  const color = useColor();
  const { onPressIn, onPressOut, settleStyle } = usePressSettle();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      hitSlop={space.md}
      style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
      <Animated.View style={settleStyle}>
        <ArrowLeft color={color.inkSoft} size={BACK_SIZE} />
      </Animated.View>
    </Pressable>
  );
}

/** Big enough to read as a drawing, small enough not to be the first thing seen. */
const BACK_SIZE = 26;

const styles = StyleSheet.create({
  header: {
    alignItems: 'flex-start',
  },
  back: {
    paddingVertical: space.sm,
  },
  /** Ink settling, the same as everywhere else. */
  pressed: {
    opacity: 0.6,
  },
  middle: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /**
   * Held clear of the dial below it. The two are the only controls on the
   * screen and they do opposite things — one changes the sitting, the other
   * commits to it — so they should not read as a pair of buttons in a row.
   *
   * The chosen length is no longer printed above this button. It was a large
   * number saying exactly what the dial's own marker already says, and the
   * marker says it in the place you change it.
   */
  start: {
    alignSelf: 'center',
    marginBottom: space.xl,
    minWidth: 220,
  },
});
