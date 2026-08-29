import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';

import { nextFreeSlot } from '../../src/domain/plots';
import { shouldOfferAdvance } from '../../src/domain/progression';
import { space } from '../../src/theme/tokens';
import { useProgress, useSessions } from '../../src/store';
import { Button } from '../../src/ui/Button';
import { offerRow } from '../../src/ui/offerRow';
import { inkOf, Plant } from '../../src/ui/Plant';
import { Screen } from '../../src/ui/Screen';
import { Text } from '../../src/ui/Text';

/**
 * The plant reveal.
 *
 * Nothing is measured back at the user here — no elapsed time, no streak, no
 * "well done". Something grew, and the app simply shows what it was. Nothing on
 * this screen is labelled rare, or scarce, or a bonus, because a plant that has
 * to be told it is good is not one.
 */
export default function CompleteScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const sessions = useSessions();
  const progress = useProgress();

  const session = sessions.find((s) => s.id === sessionId);

  // Measured rather than assumed: one grown bundle may still be three plants,
  // and `offerRow` already solves that shape. Taken from the block it sits in,
  // so the screen's own margins are already off the number.
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const grown = session?.plants ?? [];
  const row = offerRow(
    grown.length > 0 ? [{ count: grown.length, ink: inkOf(grown[0].key) }] : [],
    width
  );

  /**
   * Where a finished sitting goes.
   *
   * A bed that has just filled asks its question first. It is the immediate
   * consequence of the plant that was put in the ground on this screen, and a
   * stage offer stacked on top of it would be two questions on one Done — so a
   * due offer simply waits: nothing records that it was skipped, so
   * `shouldOfferAdvance` is still true after the next sitting.
   */
  const done = () => {
    if (nextFreeSlot(sessions, progress.gardenSize) === null) {
      router.replace('/garden/grow');
    } else if (shouldOfferAdvance(progress, sessions)) {
      router.replace('/session/advance');
    } else {
      router.replace('/(tabs)');
    }
  };

  return (
    <Screen center edges={['top', 'bottom']}>
      <View style={styles.middle} onLayout={onLayout}>
        <Text variant="title">Something grew.</Text>

        {row.offers[0] && grown.length > 0 && (
          <View
            accessibilityLabel="What grew"
            style={[
              styles.reveal,
              { width: row.offers[0].width, height: row.offers[0].height },
            ]}>
            {row.offers[0].marks.map((mark, i) => (
              <View key={i} style={[styles.mark, { left: mark.x, top: mark.y }]}>
                <Plant plant={grown[i].key} size={mark.size} />
              </View>
            ))}
          </View>
        )}
      </View>

      {/*
        Drawn, like Meditate and like onboarding's Begin. The pen goes on a
        control when the control commits to something. This one leaves the
        reveal and returns to the garden. Meditate and Done are never on one
        screen, which is what keeps two drawn buttons from ever being on the
        paper together.
      */}
      <Button label="Done" variant="wobbly" onPress={done} style={styles.done} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  middle: {
    flex: 1,
    // Stretched across the screen's body rather than shrunk to its content, so
    // the width `onLayout` reports is the room the row actually has.
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xl,
  },
  reveal: {
    position: 'relative',
  },
  mark: {
    position: 'absolute',
  },
  done: {
    alignSelf: 'stretch',
    marginBottom: space.lg,
  },
});
