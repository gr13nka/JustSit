import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { currentPlot, nextGardenSize } from '../../src/domain/plots';
import { space } from '../../src/theme/tokens';
import { growGarden, useProgress, useSessions } from '../../src/store';
import { BackHeader } from '../../src/ui/BackHeader';
import { Button } from '../../src/ui/Button';
import { GrowingBed, GROUND_FIRM_MS } from '../../src/ui/GrowingBed';
import { Screen } from '../../src/ui/Screen';
import { Text } from '../../src/ui/Text';

/**
 * The question a full bed asks: carry on into a bigger one.
 *
 * A commitment, not a quest. Nothing is promised for having finished — no
 * badge, no title, no "well done" — and there is nothing to choose either: the
 * bed grows by one rung of the ladder, because any other size would re-flow the
 * plants already in it. What is on the screen is the bed that just filled, the
 * ground it would gain, and agreeing to keep going.
 *
 * It is also the one place in the app that celebrates, and the licence is spent
 * on the *event*: the bed comes up out of the ground and more ground opens
 * beside it. `GrowingBed` is where that happens and where the rules it is kept
 * to are written down; what is drawn there is the garden itself, at the size it
 * is about to be, rather than a picture of one.
 */
export default function GrowScreen() {
  const sessions = useSessions();
  const { gardenSize } = useProgress();

  /**
   * The bed at the size it is about to be, which is what this screen draws.
   *
   * Laid out one rung up from the start, so the room being offered is on the
   * page before it is agreed to. Because the bed that filled has no holes in
   * it, every empty dot in this plot is exactly the new ground — the offer
   * needs no second number and nothing has to be told which dots it is.
   */
  const bed = currentPlot(sessions, nextGardenSize(gardenSize));

  /** Whether the offer has been taken. It cannot be untaken. */
  const [taken, setTaken] = useState(false);

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

  /**
   * Agreeing to the ground, and then going.
   *
   * The press holds the screen for exactly as long as the ghosts take to firm,
   * and it holds it for that and nothing else. There is nothing left to watch:
   * the extension is the *offer*, so it has already played, and what the press
   * adds is the ghosts becoming ground. Leaving on the tap would make that
   * invisible, which would turn the ghosts into a promise the app does not
   * keep; holding any longer would leave somebody on a screen whose one
   * question they have answered. A second touch was the other candidate and is
   * wrong for a reason that is not about pacing: the drawn button is what
   * commits, there is only ever one of it on a screen, and a screen that asked
   * you to agree and then asked you to leave would be two commitments.
   *
   * The store is written here rather than at the tap so that nothing this
   * screen shows can be contradicted while it is showing it. The bed above is
   * derived from `gardenSize`, so growing it mid-screen would step the ladder
   * a second time under the finger that pressed it — the bed is what it is
   * until you are gone. Backing out inside that third of a second cancels the growth, which
   * is the same answer as backing out before pressing, and the bed is still
   * full and the question still there the next time the garden's caption is
   * touched.
   */
  useEffect(() => {
    if (!taken) return;

    const going = setTimeout(() => {
      growGarden();
      leave();
    }, GROUND_FIRM_MS);

    return () => clearTimeout(going);
  }, [taken]);

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
        <View style={styles.middle}>
          <GrowingBed bed={bed} taken={taken} />

          {/*
            What happened, and nothing about who it happened to. The bed being
            full is the whole of the news; how much ground it would gain is said
            by the ghost dots above, which is a better place to say it than a
            number nobody can check against the drawing.

            It sits close under the bed rather than centred in its own half of
            the screen, because it is a caption to the picture and not a second
            thing on the page. The bed is the subject.
          */}
          <View style={styles.said}>
            <Text variant="title">The bed is full.</Text>
          </View>
        </View>
      </ScrollView>

      {/*
        Drawn, like Meditate and like onboarding's Begin: the pen goes on a
        control that commits to something, and agreeing to fill more bed is the
        largest thing this app ever asks anybody to agree to.

        Pressing twice is inert without a guard of its own — the second press
        sets a flag that is already set, so the effect above does not run again.
      */}
      <Button label="Grow it" variant="wobbly" onPress={() => setTaken(true)} style={styles.begin} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  /**
   * The bed sits near the top rather than in the middle of the page.
   *
   * Centred, it floated: a band of garden with paper above it and paper below
   * it, adrift between a back arrow and a button and reading as the smallest
   * thing on a screen it is supposed to be the subject of. Put high, with its
   * caption under it, the picture is what the screen opens with and all the
   * paper collects in one place — which is where this app usually keeps it.
   */
  scroll: {
    flexGrow: 1,
  },
  middle: {
    alignItems: 'center',
    // Air enough that the bed reads as placed on the page rather than stuck
    // under the arrow. The grid reserves a little of its own above the top row,
    // for the sprout, so what shows is a shade more than this.
    paddingTop: space.xxl,
    paddingBottom: space.lg,
    gap: space.md,
  },
  said: {
    alignItems: 'center',
    gap: space.xs,
  },
  begin: {
    alignSelf: 'stretch',
    marginBottom: space.lg,
  },
});
