import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import {
  allPlots,
  currentPlot,
  GARDEN_LADDER,
  Grown,
  grownSize,
  Plot,
  proposedGarden,
  STARTER_GARDEN,
} from '../../src/domain/plots';
import { space } from '../../src/theme/tokens';
import {
  chooseGardenSize,
  resizeGarden,
  useProgress,
  useSessions,
} from '../../src/store';
import { BackHeader } from '../../src/ui/BackHeader';
import { Button } from '../../src/ui/Button';
import { GardenCard } from '../../src/ui/GardenCard';
import { MiniField } from '../../src/ui/MiniField';
import { Plant } from '../../src/ui/Plant';
import { Screen } from '../../src/ui/Screen';
import { markToFit, SHAPE_PAGE, shelfMark } from '../../src/ui/shelf';
import { Slider } from '../../src/ui/Slider';
import { Text } from '../../src/ui/Text';

/**
 * The question a full garden asks: how big is the next one.
 *
 * A commitment, not a quest. Nothing is promised for having finished — no
 * badge, no title, no "well done" — and nothing is promised for choosing big.
 * The only thing on offer is the size of the bed you are agreeing to fill, and
 * the app's answer to "how big is 54" is a picture of 54 rather than a number
 * of days, because a sitting can grow two or three plants and a garden's length
 * in time was never true of anything.
 *
 * The same screen in `grow` mode asks the smaller version of the question —
 * make this garden bigger rather than start another — which is reached from the
 * garden's own page. One surface, because they are one decision measured in the
 * same rungs, and a second screen would have had to explain the ladder twice.
 */

/** The largest a plant in the finished bed is drawn. */
const BED_PLANT = 62;

/** How much of their ink two plants in the bed share, so a bed reads as a bed. */
const BED_OVERLAP = 0.16;

/**
 * Past this, the bed is drawn as the shelf's tally rather than as plants.
 *
 * A garden that just filled is the only warm thing on a screen otherwise made
 * of grids, so it is worth real drawings while there are few enough of them to
 * read. A mala's worth is a hundred and eight SVGs above a row of previews and
 * a shelf, which is neither affordable nor legible.
 */
const BED_PLANTS_MAX = 6;

/** The bed, when it is drawn as tally marks instead. */
const BED_MARK_MAX = 9;
const BED_HEIGHT = 76;

/** The room each rung's shape preview is drawn in. */
const PREVIEW_HEIGHT = 46;
const PREVIEW_MARK_MAX = 5;

/** The glance-sized shelf under the ladder. */
const MINI_MARK_MAX = 7;
const MINI_CARD_WIDTH = 110;
const MINI_HEIGHT = 70;
const MINI_PAD = space.sm;

export default function AskScreen() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const growing = mode === 'grow';

  const sessions = useSessions();
  const { gardens } = useProgress();
  const plots = allPlots(sessions, gardens);
  const plot = currentPlot(sessions, gardens);

  /**
   * The rung the screen opens on. One step up from the garden that just filled,
   * because the app proposes and the user confirms — and the smallest rung when
   * growing, since "one more" is meant to be the smaller decision of the two.
   */
  const [chosen, setChosen] = useState(() =>
    growing ? GARDEN_LADDER[0] : proposedGarden(plot.size)
  );

  const shelfScroll = useRef<ScrollView>(null);

  // Measured rather than assumed: four rungs and a shelf both have to fit a
  // phone, and neither can be sized until the phone has said how wide it is.
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  /**
   * Leaving. A stage offer that came due on this sitting is not shown here and
   * is not lost either — `shouldOfferAdvance` stays true, so it arrives after
   * the next sitting rather than stacking two questions onto one Done.
   */
  const leave = () => (growing ? router.back() : router.replace('/(tabs)'));

  const begin = () => {
    if (growing) resizeGarden(grownSize(plot, chosen));
    else chooseGardenSize(chosen);
    leave();
  };

  /** The second path: the same rungs spent on the garden already open. */
  const growInstead = () => {
    resizeGarden(grownSize(plot, chosen));
    leave();
  };

  const ladderMark = shelfMark(
    GARDEN_LADDER.map((size) => ({
      size,
      room: { width: itemWidth(width) - space.xs, height: PREVIEW_HEIGHT },
    })),
    PREVIEW_MARK_MAX,
    SHAPE_PAGE
  );

  /**
   * The shelf as it would be. Growing redraws the open garden at its new size
   * with everything already in it still in it; starting another adds the
   * candidate as a card not yet drawn.
   */
  const shelf: {
    size: number;
    cells?: readonly (Grown | null)[];
    start?: number;
    ghost?: boolean;
  }[] = plots.map((p, i) => ({
    size: growing && i === plots.length - 1 ? p.size + chosen : p.size,
    cells: p.cells,
    start: p.start,
  }));
  if (!growing) shelf.push({ size: chosen, ghost: true });

  const miniMark = shelfMark(
    shelf.map(({ size }) => ({
      size,
      room: { width: MINI_CARD_WIDTH - 2 * MINI_PAD, height: MINI_HEIGHT },
    })),
    MINI_MARK_MAX
  );

  return (
    <Screen edges={['top', 'bottom']}>
      {/*
        A way back out, and no more than that. There is nothing to undo here —
        the garden is full whether or not you answer — so this is an escape
        rather than a second action competing with the drawn button.

        No title: this screen says what it is in the copy under the bed, and a
        heading over it would be the same sentence twice. Whether there is a
        screen behind us is read when it is pressed rather than while drawing,
        because a mark that appears and disappears with the navigation history
        is the app fidgeting — and a garden reached by a deep link would have
        no way out at all.
      */}
      <BackHeader
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}>
        <View style={styles.middle} onLayout={onLayout}>
          <Bed plot={plot} width={width} />

          <View style={styles.said}>
            <Text variant="title">
              {growing
                ? `Garden ${plot.index + 1}`
                : plot.size <= STARTER_GARDEN
                  ? 'The bed is full.'
                  : 'The garden is full.'}
            </Text>
            <Text variant="body" color="inkSoft">
              {growing ? 'How much bigger?' : 'How big is the next garden?'}
            </Text>
          </View>

          {/*
            The duration dial's language, and for the dial's reason: a size is a
            choice made inside a screen, so the marker is the quiet paper-deep
            one and the number darkens rather than lighting up. Nothing fades —
            every rung is available at every size, and four greyed-out numbers
            would say otherwise.
          */}
          {width > 0 && (
            <Slider
              count={GARDEN_LADDER.length}
              index={Math.max(0, GARDEN_LADDER.indexOf(chosen))}
              onSelect={(i) => setChosen(GARDEN_LADDER[i])}
              itemWidth={itemWidth(width)}
              itemHeight={PREVIEW_HEIGHT + space.xl}
              gap={space.sm}
              role="radio"
              tone="quiet"
              labelFor={(i) => `${GARDEN_LADDER[i]} dots`}
              renderItem={(i, active) => (
                <View style={styles.rung}>
                  {/*
                    The shapes stand on one line with the tallest rising, so a
                    size reads as how much bed it is rather than as how many
                    dots it holds.
                  */}
                  <View style={styles.rungShape}>
                    <MiniField
                      size={GARDEN_LADDER[i]}
                      mark={ladderMark}
                      page={SHAPE_PAGE}
                    />
                  </View>
                  <Text variant="title" color={active ? 'ink' : 'inkSoft'}>
                    {GARDEN_LADDER[i]}
                  </Text>
                </View>
              )}
            />
          )}

          {/*
            The user's own shelf at a glance, so the size is chosen against what
            is already there rather than against a number. It scrolls because a
            shelf is as long as somebody's practice.
          */}
          {miniMark > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              ref={shelfScroll}
              /*
                Anchored to the newest end rather than the oldest. The card the
                question is about is the last one — the garden that would open,
                or the one that would grow — and a shelf that opened on a bed
                somebody filled last winter would put it off the screen.
              */
              onContentSizeChange={() =>
                shelfScroll.current?.scrollToEnd({ animated: false })
              }
              style={styles.shelfScroll}
              contentContainerStyle={styles.shelf}>
              {shelf.map((garden, i) => (
                <GardenCard
                  key={i}
                  size={garden.size}
                  cells={garden.cells}
                  start={garden.start}
                  mark={miniMark}
                  pad={MINI_PAD}
                  ghost={garden.ghost}
                  cornerSeed={i}
                />
              ))}
            </ScrollView>
          )}

          {/*
            The run screen's End: quiet type marked by nothing, so it cannot
            compete with the one drawn button. Only the garden being filled can
            be grown, and growing one that is full simply reopens it — nothing
            already planted ever moves.
          */}
          {!growing && (
            <Pressable
              accessibilityRole="button"
              onPress={growInstead}
              style={({ pressed }) => pressed && styles.faded}>
              <Text variant="caption" color="inkSoft">
                or grow this garden instead
              </Text>
            </Pressable>
          )}
        </View>
      </ScrollView>

      {/*
        Drawn, like Meditate and like onboarding's Begin: the pen goes on a
        control that commits to something, and agreeing to fill a bed is the
        largest thing this app ever asks anybody to agree to.
      */}
      <Button
        label={growing ? 'Grow it' : 'Begin it'}
        variant="wobbly"
        onPress={begin}
        style={styles.begin}
      />
    </Screen>
  );
}

/** Four rungs and the air between them, fitted to the phone. */
function itemWidth(width: number): number {
  return Math.max(0, (width - space.sm * (GARDEN_LADDER.length - 1)) / GARDEN_LADDER.length);
}

/**
 * The garden this screen is about, at the top of it.
 *
 * Drawn as plants while there are few enough to read — a bed that just filled
 * is the only warm thing on a screen otherwise made of grids, and the first
 * time anybody sees this screen it is holding three. Past that it falls back to
 * the shelf's tally, which is the same mark the cards below use.
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
      start={plot.start}
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
  rung: {
    alignItems: 'center',
    gap: space.sm,
  },
  rungShape: {
    height: PREVIEW_HEIGHT,
    justifyContent: 'flex-end',
  },
  shelfScroll: {
    alignSelf: 'stretch',
  },
  shelf: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.sm,
  },
  begin: {
    alignSelf: 'stretch',
    marginBottom: space.lg,
  },
  /** Ink settling, the same as everywhere else. */
  faded: {
    opacity: 0.6,
  },
});
