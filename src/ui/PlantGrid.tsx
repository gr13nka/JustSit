import { useEffect, useState } from 'react';
import { Animated, LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';

import { hash32 } from '../domain/hash';
import { Grown, nextDot, Plot, slotOffset } from '../domain/plots';
import { field, shapeFor } from './field';
import {
  BURST_SPREAD_MS,
  Pulse,
  Sprout,
  SPROUT_PEAK,
  Sway,
  useBurst,
  useSway,
} from './motion';
import { EmptySlot, Plant } from './Plant';
import { Ripple } from './Ripple';

/**
 * A plot: what has grown, then the empty slots still ahead.
 *
 * Showing the unfilled dots is the point, not a placeholder — the garden is a
 * promise as much as a record, and a grid that only showed what you had already
 * done would lose half of what makes it worth opening.
 */
/**
 * Where in the burst one slot's plant starts growing.
 *
 * Seeded rather than random, for the same reason the dot's offset is: this
 * garden should scatter the same way every time it is shown. A field that
 * re-rolled its timings on every visit would be a different drawing each time,
 * and nothing in this app is generated at runtime.
 */
function burstDelay(slot: number): number {
  return hash32(`burst-${slot}`) % BURST_SPREAD_MS;
}

export function PlantGrid({
  plot,
  onBegin,
  hint,
  burst,
  sway,
  noted,
  onInspect,
  dotOpacity,
}: {
  plot: Plot;
  /**
   * Begin a sitting. Takes no dot, because there is no longer one to take: a
   * garden fills in order, so only the next dot answers a touch at all and
   * where the plant lands is settled when the sitting finishes.
   *
   * Absent when this plot is being *looked at* rather than carried on — an
   * older garden opened off the shelf. Nothing then answers a touch, and the
   * next-dot ring goes with it rather than being suppressed separately: the
   * ring marks where you would carry on, so a garden you cannot carry on has
   * nothing for it to mark.
   */
  onBegin?: () => void;
  /**
   * Whether the next dot should say what it is for, and not merely where it is.
   *
   * True on a garden nobody has ever sat in, where the drawn ring picks a dot
   * out of the lattice but nothing on the page says that touching it is how the
   * app is used. It buys the one animation in here that retires: `Ripple`
   * replaces the breath while it runs, because the dot already wears a ring and
   * already breathes, and a third motion on one mark is a mark shouting.
   *
   * The grid is told rather than asked to work it out. Whether a garden is
   * somebody's first is a fact about the sittings, and the grid does not read
   * the store — the same division that hands it `noted` already made.
   */
  hint?: boolean;
  /**
   * Whether the field grows in when it appears, and what asks it to do so
   * again. Only what has grown takes part: the empty dots are the ground the
   * garden is drawn on, and a hundred of them animating would be static rather
   * than a burst.
   *
   * Absent, the plot is simply drawn — a bed being *looked at* rather than
   * arrived at. Present, it bursts the moment it has cells to draw, and again
   * on every change of the number. A token rather than a clock, because the
   * clock cannot live out here; see where it is made below.
   */
  burst?: number;
  /**
   * Whether the field is being looked at, and so whether it leans in the wind.
   * Like the burst, only what has grown takes part — the empty dots are the
   * ground, and ground does not move in wind.
   *
   * Asked as a fact about the screen rather than handed a clock, and for the
   * same reason: the caller knows whether anyone is watching, and this knows
   * whether there is anything to blow on.
   */
  sway?: boolean;
  /**
   * The dots whose sitting left a note, and what to do when one is held.
   *
   * Two props for one idea, because they are needed at different moments: the
   * set is read while the field is being laid out, to decide which plants
   * answer a hold at all, and the callback only when one is. A plant with
   * nothing behind it is not merely inert — it has no press feedback either,
   * because a plant that lit up and then did nothing would be advertising a
   * thing that is not there.
   *
   * The grid does not know what a note is. It is told which dots are marked and
   * it hands back the plant that was held; the screen owns the lookup, as it
   * owns every other read of the store.
   */
  noted?: ReadonlySet<number>;
  onInspect?: (grown: Grown) => void;
  /**
   * How strongly the empty dots are drawn, where full strength is wrong.
   *
   * The garden never passes it. An unplanted dot there is a promise, it is
   * already the faintest ink in the app, and drawing it any weaker would make
   * the promise the hardest thing on the screen to see. It exists for the one
   * screen that has ground to draw which is *offered* rather than had — dots
   * that are on the page before they have been agreed to, and that are inked
   * the rest of the way at the moment they are.
   *
   * A number or an `Animated.Value`, so that inking can be watched rather than
   * switched. Only the empty cells take it: a plant is a record of something
   * that happened, and no caller gets to draw it a shade less true than it was.
   *
   * Leaving it off costs nothing at all, which is the point of its being
   * optional rather than defaulting to full: no wrapper is built, so the tab
   * that draws a hundred and eight empty dots and never wants this does not pay
   * a view apiece to carry a number nothing is reading.
   */
  dotOpacity?: number | Animated.Value;
}) {
  const [width, setWidth] = useState(0);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  // How wide the bed is cut. It is one row while it is small and twelve across
  // from there on, so a starter bed and a mala are different shapes at the same
  // pitch — and a bed only ever widens while every plant in it is in row 0.
  const { cols } = shapeFor(plot.size);

  // Sizes, the ground line, and what the overhang costs the grid in padding —
  // all of it derived in one pure place so a dot and a plant cannot end up
  // standing on different lines.
  const { cell, span, dot, plant, lift, drop, above, below } = field(
    width,
    SPROUT_PEAK,
    cols
  );

  /**
   * Whether there is a field to animate at all.
   *
   * The width arrives on a layout pass, so the first render of any grid draws
   * no cells whatever it was asked for. Both clocks below wait for this and
   * stop with it, which is what keeps each of them running only while the views
   * reading it are on the screen — see the note under them for why that is a
   * correctness rule rather than an economy.
   */
  const ready = cell > 0;

  /**
   * The two clocks, and they live here rather than in the screen that asked for
   * the motion. That is load-bearing.
   *
   * React Native ties an `Animated.Value`'s *native* node to the views reading
   * it. When the last one unmounts, `AnimatedValue.__detach` stops whatever
   * animation is running on the value and drops the node; the node is rebuilt
   * from the stale JavaScript value the next time anything attaches, and
   * nothing restarts the animation. A clock owned by a screen therefore
   * outlives the field it drives, and the garden replaces its whole field on
   * exactly the transition that also restarts the burst — the bed growing. The
   * burst was started, the old field came down, the animation was stopped
   * underneath it, and every plant was left pinned at the first frame of a
   * sprout, which is opacity 0: a garden of empty dots with the plants gone.
   *
   * Owned here, a clock cannot outlive its views. They are made together, they
   * are thrown away together, and no arrangement of screens above can part
   * them.
   */
  const { progress: burstClock, restart } = useBurst(burst !== undefined);

  /**
   * Whether this field is in the wind at all, and whether the wind is blowing.
   *
   * Two questions rather than one, because the first decides *structure* and
   * only the second decides whether a clock turns. Whether a caller takes part
   * in the wind is a fact about the caller and never changes under it; whether
   * anyone is looking changes twice on every visit to the tab.
   *
   * The wrapper is therefore rendered on the answer that does not move. A
   * `<Sway>` that came and went with the focus changes the element type at that
   * position, and React does not reconcile across a change of type — it tears
   * the whole subtree down and builds it again. That is six hundred native
   * views, a hundred and eight sampled loops and two hundred and sixteen
   * interpolation configs, twice per visit, which is most of the pause you feel
   * arriving at the garden. Rendered unconditionally it is the same element
   * throughout, nothing beneath it is touched, and all that stops is the clock.
   *
   * A bed that is only being looked at passes no `sway` at all and gets no
   * wrapper and no tables — the grow screen's, which has no wind to be in.
   */
  const windy = sway !== undefined;
  const swaying = ready && sway === true;
  const swayClock = useSway(swaying);

  /**
   * The entrance: played when the field first has something to draw, and again
   * whenever the caller asks. Both are the same event — the garden appearing —
   * and running it from an effect is what guarantees the plants are already
   * attached to the clock when it starts.
   */
  useEffect(() => {
    if (burst === undefined || !ready) return;
    restart();
  }, [burst, ready, restart]);

  // Which dot to circle. There is none to circle at all in a garden that is
  // only being looked at.
  const next = onBegin ? nextDot(plot) : null;

  // What moves a dot down onto the same ground line the plants stand on. Only
  // the drawing moves — the cell stays where the lattice put it, so what you tap
  // is still the square you are looking at. One object for the whole field,
  // since the drop is a property of the cell size and not of a slot.
  const dropped = { transform: [{ translateY: drop }] };

  // Measured on the wrapper rather than on the grid, so the width the grid is
  // given never feeds back into the width it is measured at.
  return (
    <View onLayout={onLayout}>
      <View
        style={[
          styles.grid,
          { width: span, paddingTop: above, paddingBottom: below },
        ]}>
        {cell > 0 &&
          Array.from({ length: plot.size }, (_, slot) => {
            const planted = plot.cells[slot];
            const { dx, dy } = slotOffset(slot);

            const style = [
              styles.cell,
              {
                width: cell,
                height: cell,
                transform: [{ translateX: dx * cell }, { translateY: dy * cell }],
              },
            ];

            // A plant is a record of something that happened, and a tap still
            // does nothing to it: the only dot that answers one is the next.
            // What a plant may answer is a *hold*, and only if the sitting that
            // grew it left a note — see `noted` above.
            if (planted) {
              // The scatter, the lift, the sway and the sprout all want
              // `transform`, so they get a view each: the cell holds its offset
              // and never animates, the lift is static and belongs to the
              // drawing, and neither animation has to carry any of it.
              const drawn = <Plant plant={planted.key} size={plant} />;

              const grown =
                burst === undefined ? (
                  drawn
                ) : (
                  <Sprout progress={burstClock} delayMs={burstDelay(slot)}>
                    {drawn}
                  </Sprout>
                );

              const standing = (
                <View style={{ transform: [{ translateY: -lift }] }}>
                  {/*
                    Outside the sprout, so a plant still growing leans by the
                    same angle and therefore a smaller distance. The other way
                    round its lean is unscaled and a squashed plant swings as
                    wide as a full one.
                  */}
                  {windy ? (
                    // Where in the bed the plant stands: the wind crosses the
                    // bed you are looking at, and a bed six wide has six columns
                    // for it to cross. This is also why the bed's width is
                    // frozen above one row — a re-flow would move a plant into
                    // a different cell and a different gust.
                    <Sway
                      progress={swayClock}
                      slot={slot}
                      col={slot % cols}
                      row={Math.floor(slot / cols)}>
                      {grown}
                    </Sway>
                  ) : (
                    grown
                  )}
                </View>
              );

              // A plant is still a record and there is still nothing to do to
              // it — a tap does nothing here, as it does everywhere else in the
              // field. Holding one is a different question: not "carry on", but
              // "what was I thinking", and only the plants that have an answer
              // are asked it.
              if (!onInspect || !noted?.has(slot)) {
                return (
                  <View key={slot} style={style}>
                    {standing}
                  </View>
                );
              }

              return (
                <Pressable
                  key={slot}
                  accessibilityRole="button"
                  accessibilityLabel="Read what you wrote here"
                  onLongPress={() => onInspect(planted)}
                  style={({ pressed }) => [style, pressed && styles.pressed]}>
                  {standing}
                </Pressable>
              );
            }

            // The dot itself. Where it stands is `dropped`; all it decides here
            // is whether it is the one the garden would carry on from.
            const drawn = <EmptySlot size={dot} next={slot === next} />;
            const mark =
              dotOpacity === undefined ? (
                drawn
              ) : (
                <Animated.View style={{ opacity: dotOpacity }}>{drawn}</Animated.View>
              );

            // The rest of the unplanted field is scenery. It used to be a
            // hundred buttons, one per dot, because a sitting grew wherever you
            // touched; a garden that fills in order has exactly one place to
            // carry on from, and offering the others would be offering a choice
            // that is not there.
            if (slot !== next || !onBegin) {
              return (
                <View key={slot} style={style}>
                  <View style={dropped}>{mark}</View>
                </View>
              );
            }

            return (
              <Pressable
                key={slot}
                accessibilityRole="button"
                accessibilityLabel="Begin a sitting"
                onPress={onBegin}
                // The mark is a third of an inch and it is now the only way into
                // a sitting, so the target is grown rather than the drawing:
                // `hitSlop` reaches past the cell without moving the lattice or
                // the ink, and neighbouring cells no longer compete for a touch.
                hitSlop={cell / 2}
                style={({ pressed }) => [style, styles.above, pressed && styles.pressed]}>
                {/*
                  Which of the two runs is the whole of the handoff. A garden
                  with nothing in it is being told what the dot is for; one with
                  a plant in it has been told, and gets the breath from then on.
                  Never both — the dot already wears a ring, and a third motion
                  on one mark is a mark shouting.

                  The drop stays outside them, which the ripple requires rather
                  than merely prefers: it lays its ring over its children
                  absolutely, and an absolute child is placed against the box a
                  transform on those children has already left.
                */}
                <View style={dropped}>
                  {hint ? <Ripple size={dot}>{mark}</Ripple> : <Pulse>{mark}</Pulse>}
                </View>
              </Pressable>
            );
          })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignSelf: 'center',
    // The top row's plants stand above the grid's own edge, for the same reason
    // the cells let theirs out.
    overflow: 'visible',
  },
  cell: {
    alignItems: 'center',
    justifyContent: 'center',
    // A plant is drawn larger than the cell it is centred in (`PLANT_ZOOM`), so
    // the cell has to say it will not cut it. Native leaves a view unclipped by
    // default and react-native-web does not, which is why this is written down
    // rather than assumed — without it every flower loses its head.
    overflow: 'visible',
  },
  /**
   * Dots draw over plants, which they did not have to before the two were put
   * on one ground line.
   *
   * A plant stands about a cell and a quarter tall from its root, so once its
   * root is on the same line as the dots, its head necessarily reaches past the
   * ground line of the row above — and its shapes are filled with paper, so it
   * paints over whatever is behind. That is right for a plant behind a plant
   * and wrong for a dot: a hole left in a planted field would have its dot,
   * and the ring marking where to sit next, quietly covered by the plant below.
   *
   * A dot showing over a leaf reads as ground behind the garden, which is what
   * it is. A target you cannot see does not read as anything.
   */
  above: {
    zIndex: 1,
  },
  /** Ink settling, the same as everywhere else — no scale, no shadow. */
  pressed: {
    opacity: 0.6,
  },
});
