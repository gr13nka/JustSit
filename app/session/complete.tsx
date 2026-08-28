import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';

import { offersForSession, PlantKey } from '../../src/domain/plants';
import { nextFreeSlot } from '../../src/domain/plots';
import { shouldOfferAdvance } from '../../src/domain/progression';
import { space } from '../../src/theme/tokens';
import { chooseOffer, Session, useProgress, useSessions } from '../../src/store';
import { Button } from '../../src/ui/Button';
import { OfferMark } from '../../src/ui/OfferMark';
import { offerRow } from '../../src/ui/offerRow';
import { inkOf } from '../../src/ui/Plant';
import { Screen } from '../../src/ui/Screen';
import { Text } from '../../src/ui/Text';

/**
 * The plant reveal, and the one choice the app asks anybody to make.
 *
 * Nothing is measured back at the user here — no elapsed time, no streak, no
 * "well done". Something grew, and what it grew into is up to you; that is the
 * whole message. Nothing on this screen is labelled rare, or scarce, or a
 * bonus, because a plant that has to be told it is good is not one.
 *
 * The offers are *re-derived* rather than stored. `offersForSession` answers
 * from the session and the sittings before it, so the three things on this
 * screen survive the app being killed underneath it — and so there is one
 * answer to "what was this sitting worth" rather than a stored one and a
 * computed one that have to be kept in step.
 *
 * Which offer is chosen is read out of the ground rather than held in state
 * here. The store materialises the first one the moment a sitting is recorded,
 * so there is always something planted to read; a tap swaps it. That is what
 * keeps the marker from ever pointing at something the garden does not hold —
 * including when `chooseOffer` refuses, which it does silently once this is no
 * longer the newest sitting.
 */
export default function CompleteScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const sessions = useSessions();
  const progress = useProgress();

  const session = sessions.find((s) => s.id === sessionId);

  // Measured rather than assumed: three offers, one of which may be three
  // plants, have to fit a phone's width, and `offerRow` solves the size that
  // does it. Taken from the block the row sits in, so the screen's own margins
  // are already off the number.
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const offers = session ? offersForSession(sessions, session, progress.gardenSize) : [];

  // How many plants, and how far the species reaches — the two things the
  // layout depends on. A bundle is always one species, so one reading of the
  // drawing covers the whole offer.
  const row = offerRow(
    offers.map((offer) => ({ count: offer.plants.length, ink: inkOf(offer.plants[0]) })),
    width
  );

  const chosen = session ? chosenOffer(session, offers) : -1;

  /**
   * A bundle is the only thing the line below explains, so it is only said when
   * one is on offer. After a short sitting all three offers are single plants,
   * and "the first" would be pointing at a second and a third that are not
   * there.
   */
  const bundled = offers.some((offer) => offer.plants.length > 1);

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

        {/*
          Three offers on bare paper, no boxes — the duration dial's language,
          and for the dial's reason: things with air between them already read
          as a row of choices, and a container would be the heaviest mark on a
          screen that has just asked somebody to sit still for twenty minutes.

          It is not the `Slider`, though it borrows the look. That contract is a
          fixed item width, which is exactly what keeps one marker travelling on
          the native driver; these three are different widths because one, two
          and three plants are different widths. So the marker is per offer and
          arrives in place rather than sliding.
        */}
        {row.offers.length > 0 && (
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel="What grew"
            style={[styles.offers, { gap: row.gap }]}>
            {row.offers.map((layout, i) => (
              <OfferMark
                key={i}
                plants={offers[i].plants}
                layout={layout}
                chosen={i === chosen}
                onPress={() => session && chooseOffer(session.id, i)}
              />
            ))}
          </View>
        )}

        {bundled && (
          <Text variant="body" color="inkSoft" style={styles.note}>
            The first takes the dot you chose.
          </Text>
        )}
      </View>

      {/*
        Drawn, like Meditate and like onboarding's Begin. The pen goes on a
        control when the control commits to something, and this one puts a plant
        in the ground for good — leaving locks the choice. Meditate and Done are
        never on one screen, which is what keeps two drawn buttons from ever
        being on the paper together.
      */}
      <Button label="Done" variant="wobbly" onPress={done} style={styles.done} />
    </Screen>
  );
}

/**
 * Which of the three is in the ground, by what is planted rather than by what
 * was tapped.
 *
 * The trio never repeats a species, so the first plant's key names the offer on
 * its own; the count is checked as well because a garden with one dot left caps
 * every offer to a single plant, and agreeing on both is cheaper than reasoning
 * about when it cannot matter.
 *
 * A session that matches nothing gets no marker rather than a marker on the
 * first offer. That can only happen if what is planted is not one of these
 * three — a species renamed under an old garden, say — and pointing at an offer
 * the ground does not hold would be the screen telling a lie about it.
 */
function chosenOffer(
  session: Session,
  offers: readonly { plants: PlantKey[] }[]
): number {
  return offers.findIndex(
    (offer) =>
      offer.plants.length === session.plants.length &&
      offer.plants[0] === session.plants[0]?.key
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
  offers: {
    flexDirection: 'row',
    justifyContent: 'center',
    // Each box is drawn to its own ink and ends exactly its padding below the
    // roots, so sitting them on one bottom edge is what puts every plant in the
    // row on one ground line.
    alignItems: 'flex-end',
  },
  note: {
    textAlign: 'center',
  },
  done: {
    alignSelf: 'stretch',
    marginBottom: space.lg,
  },
});
