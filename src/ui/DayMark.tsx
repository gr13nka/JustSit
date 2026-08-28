import Svg, { Path } from 'react-native-svg';

import { useColor } from '../theme/useColor';
import { EmptySlot, LOCATOR } from './Plant';

/**
 * One day of practice, as one mark.
 *
 * The garden draws sittings and this draws days, which are not the same thing —
 * two sittings on a Tuesday are two plants and one Tuesday. But the sentence
 * both are saying is the same one, so the marks are the garden's rather than a
 * second vocabulary invented for a second screen: an unsat day is the dot the
 * garden puts where nothing has grown, and a sat day is the tally stroke
 * `MiniField` uses when a plant is too small to draw, in the green that means
 * something grew.
 *
 * Two of the three states are therefore not drawn here at all. `EmptySlot` is
 * the empty day, ring and all — the garden's locator says "this is where the
 * garden carries on", and standing on a row of days it says "today is still
 * open" without a word of copy. Reusing the component rather than the idea is
 * what keeps a nudge to the ring's tilt from leaving this screen circling at
 * the old one.
 *
 * The stroke is the one thing that is drawn twice, and it is redrawn rather
 * than lifted. `MiniField`'s tick lives on a ten-by-fourteen page of its own,
 * and here it has to stand in a row beside actual `EmptySlot`s: two marks on
 * two canvases at one `size` come out two sizes. So it is struck on the dot's
 * own canvas instead, which is what makes a sat day and an empty one the same
 * mark with something different in it.
 *
 * There is no fleck. The thumbnail's fleck names the species that bloomed, and
 * a day is not a species — it is the one part of that mark this screen has
 * nothing to say with.
 */

/**
 * The tally, in two hands, standing centred on the dot's canvas.
 *
 * Centred rather than stood on a ground line, because what it shares a row with
 * is a blob whose ink *is* the middle of that canvas. The garden's own lesson
 * about a shared ground line does not transfer: there the two marks differ by
 * two thirds of a cell, here they differ by nothing.
 *
 * Two hands, alternated by position rather than seeded, for `MiniField`'s
 * reason — a week of identical ticks reads as a stamp, and two is enough to fix
 * it while three would be a font.
 */
const TICKS = [
  'M24,32.8 C22.9,27.2 25.1,21.4 24,15.4',
  'M23.8,32.6 C25.1,27 22.9,21.6 24.2,15.6',
] as const;

/**
 * The nib, in the units of that canvas.
 *
 * Set so that a mark drawn at a garden cell's width comes out at the weight the
 * garden's own plants are drawn at, which is what makes this read as the same
 * hand rather than as a heavier one. It is not `pen.ts`'s doodle weight
 * directly: that is quoted against the plant's forty-eight-unit page, and this
 * canvas is a tight twenty-eight.
 */
const TICK_WIDTH = 3;

export function DayMark({
  size,
  sat,
  today = false,
  index,
}: {
  /** The mark's width in points; it is square. */
  size: number;
  /** Whether anything was sat on this day. */
  sat: boolean;
  /**
   * Whether this day is today. Only ever drawn on a day not yet sat: the ring
   * says the day is still open, and a day already sat is closed.
   */
  today?: boolean;
  /** Where in its row this day falls, which decides which hand strikes it. */
  index: number;
}) {
  const color = useColor();

  if (!sat) return <EmptySlot size={size} next={today} />;

  return (
    <Svg width={size} height={size} viewBox={LOCATOR.canvas}>
      <Path
        d={TICKS[index % TICKS.length]}
        stroke={color.penGreen}
        strokeWidth={TICK_WIDTH}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}
