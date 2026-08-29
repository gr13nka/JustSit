import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, LayoutChangeEvent, StyleSheet, View } from 'react-native';

import { Plot } from '../domain/plots';
import { COLUMNS, field, shapeFor, SWAY_REACH } from './field';
import { SPROUT_PEAK } from './motion';
import { PlantGrid } from './PlantGrid';

/**
 * The bed that just filled, drawn as the bed it is about to become.
 *
 * This is the app's one celebration, and the rule that keeps it one rather than
 * the first of several is that it celebrates the *event* and never the person.
 * Nothing here says you did well, nothing counts you, and there is no adjective
 * about you anywhere on the screen. What is drawn is a garden coming up out of
 * the ground and then more ground opening in it, which is a thing that
 * happened; the copy states it in four words and the motion is the whole of the
 * congratulation.
 *
 * It is the *real garden* — `PlantGrid`, the same component the garden tab
 * draws, at every rung and at any size. That is not merely reuse. The screen's
 * argument is "this is the garden you are about to have", and any drawing of
 * its own would be an artist's impression of one: a different pitch, a
 * different scatter, marks that are not the marks. There is no size at which an
 * abstraction of the garden would earn its place here — a mala is nine rows at
 * the garden's own pitch, which is a quarter of a phone. Drawing the thing
 * itself also means it cannot drift: a plant redrawn or a lattice retuned and
 * this screen has already changed with it.
 *
 * The offer is drawn rather than described, which is the other half of why the
 * screen exists. A fixed ladder took the old ask screen's choice of size away —
 * any other size would re-flow plants already in the ground — but it must not
 * take the knowing with it. "Grow it" says nothing about how much. So the bed
 * is laid out at `nextGardenSize` from the moment the screen opens, and because
 * a bed that has filled has no holes in it, *every* empty dot in that plot is
 * exactly the new room. Nothing has to be told which dots are the offer; the
 * plot already says, and `dotOpacity` is enough to draw them as ground that is
 * not yet had.
 *
 * No `onBegin` is passed, which drops the next-dot ring along with it — that is
 * `PlantGrid`'s own rule and it is the one wanted here. A ring on this screen
 * would read as a prize, and where you carry on is the garden, not this.
 */

/**
 * How inked the new ground is while it is still only an offer.
 *
 * The dots are `inkFaint`, which is the faintest the palette goes, so this can
 * only be an opacity on top of it. Two things have to be true at once and they
 * pull against each other: the offer has to be legible, because being able to
 * see how much ground there is is the whole reason it is drawn, and it has to
 * be plainly not ground yet, because pressing is what makes it that.
 *
 * Two thirds is where both hold, and the balance was measured rather than
 * judged by eye: at seven tenths the firming could not be found between two
 * screenshots taken either side of the press. Here the dot's ink runs from a
 * fifth of the paper's range to a third — half as much ink again, arriving
 * across a whole row at once, which the eye catches in motion far more
 * readily than a still comparison suggests.
 */
const GHOST = 0.65;

/**
 * When the ground opens, and how long it takes.
 *
 * The delay lets the bed finish being a bed first. The burst runs
 * `BURST_SPREAD_MS + SPROUT_MS` from the moment the screen arrives, and the
 * ground opens under the tail of it — late enough that the eye has taken in
 * what filled, early enough that the two read as one arrival rather than as a
 * screen that changed its mind.
 */
const OPEN_DELAY_MS = 800;
const OPEN_MS = 520;

/**
 * How long the agreed ground takes to firm, and so how long a caller must hold
 * the screen before leaving it.
 *
 * It crosses the boundary as a number because the decision on the other side of
 * it — leave now, leave later, wait for a second touch — is the screen's and
 * not the drawing's. What the drawing owes the screen is an honest answer to
 * "how long until this has finished happening".
 */
export const GROUND_FIRM_MS = 380;

/**
 * The two channels the opening runs on, and the one clock behind both.
 *
 * `shift` is where the bed *was*: 1 means "standing where it stood when it was
 * the whole of the ground", 0 means "in its place in the bigger bed". `ground`
 * is how inked the new dots are — 0 while there is nothing there, `GHOST` while
 * they are an offer, 1 once the offer is taken.
 *
 * Both are one-shot. Nothing here loops, and that is deliberate on a screen
 * that is already the loudest thing the app does: a celebration you can sit and
 * watch repeat is a screen asking to be stayed on.
 *
 * It lives here rather than in `motion.tsx` on `Ripple`'s precedent: that file
 * holds the vocabulary every screen draws from, and this is one bed on one
 * screen. An entrance that can only ever happen once in the app is not a word
 * the app speaks.
 *
 * Pressing before the opening has finished collapses it into the firm rather
 * than queueing behind it, which is why `shift` is retargeted here too even
 * though it is normally already home. Somebody who presses the button in the
 * first half second has answered the question, and holding them through an
 * animation about a question they have answered is the app talking over them.
 */
function useOpening(taken: boolean) {
  const shift = useRef(new Animated.Value(1)).current;
  const ground = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const duration = taken ? GROUND_FIRM_MS : OPEN_MS;
    const delay = taken ? 0 : OPEN_DELAY_MS;

    // Settling and inking, never bouncing: this is ground arriving. An
    // overshoot on a slab of earth would read as elastic, and an overshoot on
    // opacity is a flicker.
    const opening = Animated.parallel([
      Animated.timing(shift, {
        toValue: 0,
        duration,
        delay,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(ground, {
        toValue: taken ? 1 : GHOST,
        duration,
        delay,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]);

    opening.start();
    return () => opening.stop();
  }, [shift, ground, taken]);

  return { shift, ground };
}

export function GrowingBed({
  bed,
  taken,
}: {
  /**
   * The bed **as it will be**: the plot at `nextGardenSize`, which the screen
   * builds because reading the store is the screen's job and not a drawing's.
   * Its plants are the bed that filled and its empty dots are the whole of what
   * is being offered — see the note above on why that needs no second input.
   */
  bed: Plot;
  /**
   * Whether the offer has been accepted. It inks the new ground and nothing
   * else: the room was laid out when the screen opened, so agreeing to it moves
   * nothing and re-flows nothing.
   */
  taken: boolean;
}) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const { shift, ground } = useOpening(taken);

  const open = shapeFor(bed.size);
  const was = shapeFor(bed.plants.length);

  /**
   * Which way the bed grows.
   *
   * A bed still on one row grows *sideways*: the lattice is centred, so what is
   * already in it slides outward as the row widens, which is the bed moving
   * rather than the plants — the same way they move when a phone is turned. A
   * bed past one row has its width frozen at twelve and grows *downward*, a
   * whole row at a time.
   *
   * Both readings come out of `shapeFor` rather than being written down here,
   * because it is the same function that decides how either bed is actually
   * laid out. Anything else would be a second opinion about a shape.
   */
  const across = open.rows === was.rows;

  /**
   * The cell this bed wants, asked for by handing `field` the width at which it
   * comes out — the inverse of what that function normally answers.
   *
   * The pitch is measured against `COLUMNS` at every size, which is right for
   * the garden: it is what lets a bed of six be *seen* to be half a bed of
   * twelve. On this screen it would make the first two rungs postage stamps in
   * the middle of a phone, and the bed is the subject here rather than one
   * garden among several. So the room is spent instead: a six-wide bed is drawn
   * at the cell that fills the screen with six, which the grid reaches by being
   * handed a box wider than the screen. Only the empty margin hangs over, and
   * from twelve dots on the two widths are the same number.
   */
  const wanted = width / (open.cols + 2 * SWAY_REACH);
  const box = wanted * (COLUMNS + 2 * SWAY_REACH);
  const { cell } = field(box, SPROUT_PEAK, open.cols);

  /**
   * Where the bed stood when it was the whole of the ground: half the new room,
   * on whichever axis the new room is.
   *
   * The grid is one drawing and slides as one, which is what makes the two
   * growths one motion written once. What you watch is the plants leaving the
   * middle while the ground they are making way for inks in behind them — the
   * bed is not being added to at one end, it is being *re-centred* on a bigger
   * bed, which is exactly what a centred lattice does when it gains a column or
   * a row.
   */
  const offset = across
    ? ((open.cols - was.cols) * cell) / 2
    : ((open.rows - was.rows) * cell) / 2;

  const travel = shift.interpolate({ inputRange: [0, 1], outputRange: [0, offset] });

  return (
    <View style={styles.room} onLayout={onLayout}>
      {cell > 0 && (
        <Animated.View
          style={[
            { width: box },
            { transform: across ? [{ translateX: travel }] : [{ translateY: travel }] },
          ]}>
          {/*
            The bed grows in as it arrives, and is never asked again: this is a
            stack screen, so a mount really is an arrival — unlike the garden
            tab, which stays mounted behind the other one and has to say when it
            is being looked at. The token is therefore a constant.
          */}
          <PlantGrid plot={bed} burst={0} dotOpacity={ground} />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  room: {
    // Stretched rather than centred, because this is the view that is measured:
    // a column of centred children shrinks each of them to its content, and a
    // bed that is drawn to the width it was given would have measured nothing,
    // drawn nothing, and stayed nothing.
    alignSelf: 'stretch',
    alignItems: 'center',
    // The box is wider than the screen at the narrow sizes, and the bed slides
    // through part of its own width on the way home. Both are empty margin or
    // ground that has not inked in yet, and clipping keeps the page from
    // growing sideways to hold them.
    overflow: 'hidden',
  },
});
