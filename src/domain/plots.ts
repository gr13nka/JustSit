import { Session } from '../store/types';
import { hash32 } from './hash';

/**
 * The garden is one bed, and it grows.
 *
 * `progress.gardenSize` is how many dots it holds today, and a slot is simply a
 * position in it — the first dot is 0 and there is nothing before it. There is
 * no sequence of gardens and no archive: what used to be a shelf of finished
 * beds is the same drawing, further along.
 *
 * The bed only ever grows, and only by `nextGardenSize`. That is what keeps
 * every plant exactly where it was put; the constraint that shapes the ladder
 * is written down beside it.
 */

/**
 * A mala's bead count: nine rows of twelve, which is the shape `field.ts` is
 * tuned to and the largest bed that still fits a phone without scrolling.
 *
 * It is a milestone on the way rather than the top of the ladder — past it the
 * bed carries on a row at a time, like everywhere else above twelve. It keeps a
 * name because arriving at one is worth something, and because the dev panel
 * wants a button that seeds one.
 */
export const MALA = 108;

/**
 * What a new user starts with, before they have been asked anything.
 *
 * Three sittings is small enough to finish, which is the point: the first
 * garden's job is to be finished, not to be a year's commitment on day one.
 */
export const STARTER_GARDEN = 3;

/**
 * The widths the bed passes through, in order, up to the one it keeps.
 *
 * Three, then six, then twelve — and twelve for ever after, because past the
 * last rung the bed stops widening and starts adding rows. That the step above
 * the table is the table's own last entry is not a coincidence to be tidied
 * away: once the bed is a full row wide, growing it by a rung *is* giving it
 * another row.
 *
 * Twelve is `COLUMNS` in `src/ui/field.ts`, which cannot be imported here —
 * that module reads this one, so the dependency already runs the other way.
 * `field.test.ts` is where the two are pinned together.
 */
const LADDER: readonly number[] = [3, 6, 12];

/**
 * The next size up from `size`. The only answer, because the bed's shape is not
 * a menu — and that is the whole of the width-freeze rule.
 *
 * `PlantGrid` reads a plant's column and row, and so the wind it leans in, off
 * `slot % cols`. A bed whose *width* changed would therefore re-flow every
 * plant already in the ground into a different cell and a different gust, which
 * is the one thing this app promises never to do. So the width may change only
 * while the bed is a single row, where the row is always 0 and the column is
 * always the slot, and `cols` does not enter the mapping at all.
 *
 * The ladder is built around that. It widens at three, six and twelve while the
 * bed is one row, and every widening happens on a bed that is *full* — so every
 * planted slot is in row 0 at the old width and at the new one. From twelve up
 * the width is frozen and only rows are added.
 *
 * A size that is not on the ladder takes the next rung above it the same way,
 * which above twelve is a row more of the width it already has. Nothing writes
 * one today; this answers rather than refuses, because a bed with no next size
 * is a sitting with nowhere to go.
 */
export function nextGardenSize(size: number): number {
  return LADDER.find((rung) => rung > size) ?? size + LADDER[LADDER.length - 1];
}

/** One plant standing in one dot, and the sitting that grew it. */
export type Grown = {
  /** The species key, resolved when the plant was chosen and then permanent. */
  key: string;
  /** The dot it stands in, counted from the first dot of the bed. */
  slot: number;
  /** The sitting it came from. One sitting may have grown two or three. */
  session: Session;
};

export type Plot = {
  /** How many dots the bed holds today — what the ladder has grown it to. */
  size: number;
  /** The plants in it, in the order they grew. */
  plants: Grown[];
  /**
   * The same plants laid out the way the grid draws them: one entry per dot,
   * null wherever nothing has grown yet.
   *
   * A bed fills in order, so this is a run of plants followed by a run of
   * nulls. It is still built as an array over every dot rather than as a count,
   * because the grid draws the empty ones too — the unplanted field is what the
   * garden is a promise of.
   */
  cells: (Grown | null)[];
  isComplete: boolean;
  /** When the first plant here grew. Null while the bed is empty. */
  startedAt: number | null;
  /** When the last dot was filled. Null until then. */
  completedAt: number | null;
};

/**
 * The bed as it stands: everything that has grown in it, laid out the way the
 * grid draws it.
 *
 * It stays full once it is full rather than quietly opening more ground. What
 * happens next is a question — grow it — and the user is the one who answers.
 *
 * Plants outside the bed are skipped rather than trusted. The bed only ever
 * grows, so nothing the app writes can land past its edge; this is here for the
 * blob that arrives saying otherwise, where drawing into a cell that does not
 * exist would take the garden down.
 */
export function currentPlot(sessions: readonly Session[], size: number): Plot {
  const dots = Math.max(0, Math.floor(size));

  const cells: (Grown | null)[] = Array(dots).fill(null);
  const plants: Grown[] = [];

  // Sessions are appended in the order they finished and a session's own plants
  // are written in the order they were chosen, so one pass in reading order
  // gives `plants` in growing order without sorting anything.
  for (const session of sessions) {
    for (const planted of session.plants) {
      if (planted.slot < 0 || planted.slot >= dots) continue;
      const grown: Grown = { key: planted.key, slot: planted.slot, session };
      cells[planted.slot] = grown;
      plants.push(grown);
    }
  }

  const isComplete = dots > 0 && plants.length >= dots;

  return {
    size: dots,
    plants,
    cells,
    isComplete,
    startedAt: plants.length > 0 ? plants[0].session.completedAt : null,
    completedAt: isComplete ? plants[plants.length - 1].session.completedAt : null,
  };
}

/**
 * The dot a sitting would fill next: the first empty one, or null once there
 * are none left. It is the only dot in the field that answers a touch, so this
 * decides where a sitting can be started as well as where the plant will land.
 *
 * The *first* empty one rather than the one after the last plant. A bed that
 * fills in order has those in the same place, and this is the reading that
 * cannot put a plant on top of one already there whatever else is in the
 * ground — which is also what makes it agree with `nextFreeSlot` by
 * construction rather than by two functions being kept in step.
 */
export function nextDot(plot: Plot): number | null {
  const cell = plot.cells.indexOf(null);
  return cell === -1 ? null : cell;
}

/**
 * The next `count` empty dots, in the order a bundle should take them. Fewer
 * than `count` — or none at all — when the bed runs out, which is the caller's
 * cue that it is finished.
 *
 * A bed fills in order, so this is simply the front of the queue: the first
 * plant of a sitting takes the first free dot and the rest of a bundle take the
 * ones after it. Nobody names a dot — the garden decides where a sitting lands,
 * at the moment it finishes.
 */
export function freeSlots(
  sessions: readonly Session[],
  size: number,
  count: number
): number[] {
  const plot = currentPlot(sessions, size);

  const holes: number[] = [];
  for (let cell = 0; cell < plot.cells.length; cell++) {
    if (plot.cells[cell] === null) holes.push(cell);
  }

  return holes.slice(0, Math.max(0, count));
}

/**
 * Where a plant goes: the first empty dot, or null once the bed is full.
 *
 * Null is not a failure. A full bed is a finished one, and what happens next is
 * a question the user answers.
 */
export function nextFreeSlot(
  sessions: readonly Session[],
  size: number
): number | null {
  return freeSlots(sessions, size, 1)[0] ?? null;
}

/** The most a dot may wander from the centre of its cell, as a fraction of it. */
export const SCATTER = 0.08;

/**
 * The share of a cell the art may occupy, given how far a dot may wander: half
 * the art plus a full displacement comes to exactly half a cell. So a dot can
 * reach the edge of its own cell and never cross it, and the plot keeps its
 * edges however the hash falls. Derived rather than chosen, so that guarantee
 * cannot quietly stop being true.
 */
export const ART_SHARE = 1 - 2 * SCATTER;

/**
 * How far a dot sits from the centre of its cell, as a fraction of the cell.
 *
 * A garden planted on an exact lattice reads as a spreadsheet. Nudging each dot
 * off-centre is the difference between a grid and something drawn by hand — and
 * it has to be the *same* nudge every time, or the garden would rearrange itself
 * on every render.
 *
 * Keyed on the slot rather than the session: the dot must not jump at the moment
 * a plant grows in it.
 */
export function slotOffset(slot: number): { dx: number; dy: number } {
  const h = hash32(`slot-${slot}`);

  // Two independent bytes out of the same hash, each mapped to -1..1.
  const x = ((h & 0xff) / 255) * 2 - 1;
  const y = (((h >>> 8) & 0xff) / 255) * 2 - 1;

  return { dx: x * SCATTER, dy: y * SCATTER };
}
