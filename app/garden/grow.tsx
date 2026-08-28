import { router } from 'expo-router';
import { useState } from 'react';
import { LayoutChangeEvent, ScrollView, StyleSheet, View } from 'react-native';

import { currentPlot, Plot } from '../../src/domain/plots';
import { space } from '../../src/theme/tokens';
import { growGarden, useProgress, useSessions } from '../../src/store';
import { BackHeader } from '../../src/ui/BackHeader';
import { Button } from '../../src/ui/Button';
import { MiniField } from '../../src/ui/MiniField';
import { Plant } from '../../src/ui/Plant';
import { Screen } from '../../src/ui/Screen';
import { markToFit } from '../../src/ui/tally';
import { Text } from '../../src/ui/Text';

/**
 * The question a full bed asks: carry on into a bigger one.
 *
 * A commitment, not a quest. Nothing is promised for having finished — no
 * badge, no title, no "well done" — and there is nothing to choose either: the
 * bed grows by one rung of the ladder, because any other size would re-flow the
 * plants already in it. What is on the screen is the bed that just filled, and
 * agreeing to keep going.
 */

/** The largest a plant in the finished bed is drawn. */
const BED_PLANT = 62;

/** How much of their ink two plants in the bed share, so a bed reads as a bed. */
const BED_OVERLAP = 0.16;

/**
 * Past this, the bed is drawn as tally marks rather than as plants.
 *
 * A bed that just filled is the only warm thing on this screen, so it is worth
 * real drawings while there are few enough of them to read. A mala's worth is a
 * hundred and eight SVGs, which is neither affordable nor legible.
 */
const BED_PLANTS_MAX = 6;

/** The bed, when it is drawn as tally marks instead. */
const BED_MARK_MAX = 9;
const BED_HEIGHT = 76;

export default function GrowScreen() {
  const sessions = useSessions();
  const { gardenSize } = useProgress();
  const plot = currentPlot(sessions, gardenSize);

  // Measured rather than assumed: the bed is drawn to the room the phone gives
  // it, and it cannot be sized until the phone has said how wide that is.
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  /**
   * The one way off this screen, whether the answer was yes or nothing.
   *
   * Whether there is a screen behind us is read when it is pressed rather than
   * while drawing: this is reached both by finishing a sitting and by touching
   * the caption on the garden tab, and a mark that appeared and disappeared
   * with the navigation history would be the app fidgeting.
   *
   * A stage offer that came due on the sitting that filled the bed is not shown
   * here and is not lost either — `shouldOfferAdvance` stays true, so it
   * arrives after the next sitting rather than stacking two questions onto one
   * Done.
   */
  const leave = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));

  const grow = () => {
    growGarden();
    leave();
  };

  return (
    <Screen edges={['top', 'bottom']}>
      {/*
        A way back out, and no more than that. There is nothing to undo here —
        the bed is full whether or not you answer — so this is an escape rather
        than a second action competing with the drawn button.

        No title: this screen says what it is in the copy under the bed, and a
        heading over it would be the same sentence twice.
      */}
      <BackHeader onBack={leave} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}>
        <View style={styles.middle} onLayout={onLayout}>
          <Bed plot={plot} width={width} />

          <View style={styles.said}>
            <Text variant="title">The bed is full.</Text>
          </View>
        </View>
      </ScrollView>

      {/*
        Drawn, like Meditate and like onboarding's Begin: the pen goes on a
        control that commits to something, and agreeing to fill more bed is the
        largest thing this app ever asks anybody to agree to.
      */}
      <Button label="Grow it" variant="wobbly" onPress={grow} style={styles.begin} />
    </Screen>
  );
}

/**
 * The bed this screen is about, at the top of it.
 *
 * Drawn as plants while there are few enough to read — a bed that just filled
 * is the only warm thing on the screen, and the first time anybody sees this it
 * is holding three. Past that it falls back to the tally, which is the same
 * mark at a size a mala can be drawn at.
 */
function Bed({ plot, width }: { plot: Plot; width: number }) {
  if (width <= 0) return null;

  const grown = plot.plants;
  if (grown.length > 0 && grown.length <= BED_PLANTS_MAX) {
    // Every plant the same size, so `alignItems: flex-end` puts every root on
    // one line: a root is the same fraction down every canvas.
    const span = grown.length - BED_OVERLAP * (grown.length - 1);
    const size = Math.min(BED_PLANT, width / span);

    return (
      <View style={styles.bed}>
        {grown.map((planted, i) => (
          <View key={i} style={i > 0 && { marginLeft: -size * BED_OVERLAP }}>
            <Plant plant={planted.key} size={size} />
          </View>
        ))}
      </View>
    );
  }

  return (
    <MiniField
      size={plot.size}
      cells={plot.cells}
      mark={markToFit(plot.size, { width, height: BED_HEIGHT }, BED_MARK_MAX)}
    />
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  middle: {
    alignItems: 'center',
    paddingVertical: space.lg,
    gap: space.lg,
  },
  said: {
    alignItems: 'center',
    gap: space.xs,
  },
  bed: {
    flexDirection: 'row',
    // One bottom edge, and so one ground line — every canvas is the same size
    // and a root is the same fraction down each of them.
    alignItems: 'flex-end',
  },
  begin: {
    alignSelf: 'stretch',
    marginBottom: space.lg,
  },
});
