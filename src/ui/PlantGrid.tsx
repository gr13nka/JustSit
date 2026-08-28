import { useState } from 'react';
import { Animated, LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';

import { hash32 } from '../domain/hash';
import { Grown, nextDot, Plot, slotOffset } from '../domain/plots';
import { field, shapeFor } from './field';
import { BURST_SPREAD_MS, Pulse, Sprout, SPROUT_PEAK, Sway } from './motion';
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
   * The shared 0..1 clock from `useBurst`, if this plot should sprout when it
   * is shown. Only what has grown takes part: the empty dots are the ground the
   * garden is drawn on, and a hundred of them animating would be static rather
   * than a burst.
   */
  burst?: Animated.Value;
  /**
   * The shared 0..1 clock from `useSway`, if this plot should sway while it is
   * shown. Like the burst, only what has grown takes part — the empty dots are
   * the ground, and ground does not move in wind.
   */
  sway?: Animated.Value;
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
}) {
  const [width, setWidth] = useState(0);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  // How wide this garden is cut. Gardens are sizes their owners chose, so a bed
  // of three and a mala are different shapes at the same pitch.
  const { cols } = shapeFor(plot.size);

  // Sizes, the ground line, and what the overhang costs the grid in padding —
  // all of it derived in one pure place so a dot and a plant cannot end up
  // standing on different lines.
  const { cell, span, dot, plant, lift, drop, above, below } = field(
    width,
    SPROUT_PEAK,
    cols
  );

  // Which dot to circle. Slots are absolute, so this compares against the same
  // number the grid is laying out — and there is none to circle at all in a
  // garden that is only being looked at.
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
          Array.from({ length: plot.size }, (_, i) => {
            // The garden knows where its own first dot is. Slots stay absolute
            // across every garden, but the gardens are no longer all one size,
            // so this can no longer be worked out by multiplying.
            const slot = plot.start + i;
            const planted = plot.cells[i];
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

              const grown = burst ? (
                <Sprout progress={burst} delayMs={burstDelay(slot)}>
                  {drawn}
                </Sprout>
              ) : (
                drawn
              );

              const standing = (
                <View style={{ transform: [{ translateY: -lift }] }}>
                  {/*
                    Outside the sprout, so a plant still growing leans by the
                    same angle and therefore a smaller distance. The other way
                    round its lean is unscaled and a squashed plant swings as
                    wide as a full one.
                  */}
                  {sway ? (
                    // Where in *this* garden the plant stands, not where in the
                    // sequence: the wind crosses the bed you are looking at,
                    // and a bed nine wide has nine columns for it to cross.
                    <Sway
                      progress={sway}
                      slot={slot}
                      col={i % cols}
                      row={Math.floor(i / cols)}>
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
                  <View key={i} style={style}>
                    {standing}
                  </View>
                );
              }

              return (
                <Pressable
                  key={i}
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
            const mark = <EmptySlot size={dot} next={slot === next} />;

            // The rest of the unplanted field is scenery. It used to be a
            // hundred buttons, one per dot, because a sitting grew wherever you
            // touched; a garden that fills in order has exactly one place to
            // carry on from, and offering the others would be offering a choice
            // that is not there.
            if (slot !== next || !onBegin) {
              return (
                <View key={i} style={style}>
                  <View style={dropped}>{mark}</View>
                </View>
              );
            }

            return (
              <Pressable
                key={i}
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
