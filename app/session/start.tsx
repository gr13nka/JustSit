import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';

import { stageAt } from '../../src/domain/stages';
import { space } from '../../src/theme/tokens';
import { useColor } from '../../src/theme/useColor';
import { useProgress, useSettings } from '../../src/store';
import { Button } from '../../src/ui/Button';
import { Clock } from '../../src/ui/Clock';
import { DurationDial } from '../../src/ui/DurationDial';
import { ArrowLeft } from '../../src/ui/icons';
import { usePressSettle } from '../../src/ui/motion';
import { Screen } from '../../src/ui/Screen';
import { TimerRing } from '../../src/ui/TimerRing';

/** The ring's plant before a sitting. The one that grows is chosen at the end. */
const PREVIEW_PLANT = 'grass';

/**
 * Opened by touching an empty dot in the garden, which is why it is a screen
 * rather than a tab: a sitting starts from the place it will show up, and there
 * is no timer to visit for its own sake.
 *
 * `slot` is the dot that was touched. It travels with the sitting and is only
 * spent if the sitting finishes.
 */
export default function StartScreen() {
  const params = useLocalSearchParams<{ slot: string }>();
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

      <View style={styles.middle}>
        <TimerRing plant={PREVIEW_PLANT} />
        <View style={styles.clock}>
          <Clock ms={durationMs} />
        </View>
        {/*
          The app's only wobbly button. This is the one place a hand commits to
          something — every other action is a consequence of this one — and the
          variant stops meaning anything if a second screen borrows it.
        */}
        <Button
          label="Start"
          variant="wobbly"
          onPress={() =>
            router.push({
              pathname: '/session/tip',
              params: { durationMs: String(durationMs), slot: params.slot },
            })
          }
          style={styles.start}
        />
      </View>

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
    gap: space.md,
  },
  clock: {
    marginTop: space.lg,
  },
  /**
   * Held well clear of the dial below it. The two are the only controls on the
   * screen and they do opposite things — one changes the sitting, the other
   * commits to it — so they should not read as a pair of buttons in a row.
   */
  start: {
    marginTop: space.lg,
    marginBottom: space.xl,
    minWidth: 220,
  },
});
