import Svg, { G, Path } from 'react-native-svg';

import { Grown } from '../domain/plots';
import { useColor } from '../theme/useColor';
import { bloomOf } from './Plant';
import { MARK_PAGE, miniGrid } from './tally';

/**
 * A garden at a glance: one small mark per dot, on the shape that garden is
 * cut to.
 *
 * These are **tallies, not plants**. A plant is a drawing and costs an SVG with
 * a dozen béziers in it, and a bed can be a mala, so drawing them properly is a
 * hundred and eight of those on something the size of a card. What survives at
 * a fifth of an inch is exactly three things — that a sitting happened, that it
 * grew (green), and whether the species blooms (a fleck of its own pen) — so
 * those three are what is drawn, and the rest of the plant is left in the
 * garden where it can be seen.
 *
 * The whole thing is **one** `<Svg>` with a transform per mark, rather than one
 * `<Svg>` per mark. A hundred and eight native views is the cost the tally was
 * introduced to avoid, and paying it in the wrapper instead of in the drawing
 * would have missed the point.
 */

/**
 * The tally: one stroke standing on the page's ground line, in two hands so a
 * row does not read as a stamp. Alternated by slot rather than seeded — a
 * garden of a hundred identical ticks is the failure, and two is enough to fix
 * it.
 */
const TICKS = [
  'M5,13 C4.4,10 5.6,7 5,3.6',
  'M5,13 C5.6,10 4.4,7 5.2,4',
] as const;

/** The bloom, as a fleck across the top of the stroke rather than a flower. */
const FLECK = 'M3.2,3.4 C3.9,2 6.1,2 6.8,3.4';

/**
 * An unplanted dot, at the foot of the same page — the garden's own empty slot
 * drawn small. Filled rather than stroked, exactly as `EmptySlot` is.
 */
const BLOB =
  'M5,8.1 C5.8,8.2 6.4,8.8 6.3,9.6 C6.2,10.4 5.5,10.9 4.7,10.8 C4,10.7 3.5,10 3.6,9.2 C3.7,8.5 4.3,8 5,8.1';

/** The stroke weights the marks are drawn at, on the ten-unit page. */
const TICK_WIDTH = 1.8;
const FLECK_WIDTH = 1.6;

/**
 * How far a tally wanders off its row, as a share of the mark.
 *
 * The garden scatters its dots for the same reason and by the same argument: a
 * lattice drawn exactly is a spreadsheet. It runs off the slot rather than off
 * a hash because at this size only three positions are distinguishable anyway,
 * and three in rotation is cheaper than a hash and just as unreadable as a
 * pattern.
 */
function lift(slot: number, mark: number): number {
  return (((slot * 5) % 3) - 1) * (mark / 10);
}

export function MiniField({
  size,
  cells,
  mark,
}: {
  /** How many dots this garden holds. */
  size: number;
  /**
   * What has grown, one entry per dot, null where nothing has. Absent draws the
   * bed empty — the shape a size would lay out, before anything is in it.
   */
  cells?: readonly (Grown | null)[];
  /** One mark's width in points. */
  mark: number;
}) {
  const color = useColor();
  const grid = miniGrid(size, mark);

  if (grid.mark <= 0) return null;

  // The marks are drawn on their own ten-unit page and placed by transform, so
  // the page's own numbers stay readable above and nothing here is a magic
  // fraction of a point.
  const scale = mark / MARK_PAGE.width;

  return (
    <Svg width={grid.width} height={grid.height}>
      {Array.from({ length: size }, (_, slot) => {
        const grown = cells?.[slot] ?? null;
        const col = slot % grid.cols;
        const row = Math.floor(slot / grid.cols);

        const x = col * (grid.mark + grid.gapX);
        const y =
          row * (grid.markHeight + grid.gapY) + (grown ? lift(slot, grid.mark) : 0);

        const bloom = grown ? bloomOf(grown.key) : null;

        return (
          <G key={slot} transform={`translate(${x} ${y}) scale(${scale})`}>
            {grown ? (
              <>
                <Path
                  d={TICKS[slot % TICKS.length]}
                  stroke={color.penGreen}
                  strokeWidth={TICK_WIDTH}
                  strokeLinecap="round"
                  fill="none"
                />
                {bloom && (
                  <Path
                    d={FLECK}
                    stroke={color[bloom]}
                    strokeWidth={FLECK_WIDTH}
                    strokeLinecap="round"
                    fill="none"
                  />
                )}
              </>
            ) : (
              <Path d={BLOB} fill={color.inkFaint} />
            )}
          </G>
        );
      })}
    </Svg>
  );
}
