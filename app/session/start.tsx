import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { stageAt } from '../../src/domain/stages';
import { space } from '../../src/theme/tokens';
import { useProgress, useSettings } from '../../src/store';
import { Button } from '../../src/ui/Button';
import { Clock } from '../../src/ui/Clock';
import { DurationDial } from '../../src/ui/DurationDial';
import { Screen } from '../../src/ui/Screen';
import { Text } from '../../src/ui/Text';
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
        <Button label="Back" variant="quiet" onPress={() => router.back()} />
      </View>

      <View style={styles.middle}>
        <TimerRing plant={PREVIEW_PLANT} />
        <View style={styles.clock}>
          <Clock ms={durationMs} />
        </View>
        <Text variant="caption" style={styles.motto}>
          Stay. Breathe. Be.
        </Text>
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

const styles = StyleSheet.create({
  header: {
    alignItems: 'flex-start',
    // Cancels the button's own padding so the word lines up with the screen's
    // content edge, while the tap target stays the full size.
    marginLeft: -space.xl,
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
   * A touch of air, but less than the mono face wanted: rounded letters at this
   * size come apart at anything wider.
   */
  motto: {
    letterSpacing: 0.5,
  },
  start: {
    marginTop: space.md,
    minWidth: 220,
  },
});
