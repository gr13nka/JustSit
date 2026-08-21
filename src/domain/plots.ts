import { Session } from '../store/types';
import { hash32 } from './hash';

/**
 * The garden is a *sequence* of gardens, each one a size the user chose.
 *
 * `progress.gardens` holds those sizes in order. The last entry is the one
 * being filled and the only one that may still change; everything before it is
 * closed forever, so a garden someone finished a year ago cannot be resized out
 * from under its plants. Sizes are counts of dots — a garden is finished when it
 * is full, and how long that took is nobody's business.
 *
 * Slots stay absolute across the whole sequence, exactly as they were when
 * every garden was 108. Which garden a slot falls in is found by walking the
 * sizes rather than by dividing, which is the only part of this that changed.
 */

/**
 * A mala's bead count. It is the largest garden on offer and the shape every
 * garden had before sizes were a choice, which is why the migration rebuilds
 * old blobs out of it.
 */
export const PLOT_SIZE = 108;

/**
 * What a new user starts with, before they have been asked anything.
 *
 * Three sittings is small enough to finish, which is the point: the first
 * garden's job is to be finished, not to be a year's commitment on day one.
 */
export const STARTER_GARDEN = 3;

/**
 * The sizes a garden may be asked for: fractions of a mala, and the mala.
 *
 * A ladder rather than a dial, because the question is how much you are willing
 * to commit to and four answers is already more than most people want to weigh.
 * They are fractions of 108 rather than round numbers so that a garden is
 * always some part of the same object — a twelfth, a quarter, a half, the whole
 * of it — which is what makes the shelf legible without a single percentage on
 * it.
 *
 * The starter bed is deliberately not on here. Three is what the app gives you
 * before it has asked anything; it is not something anybody would choose.
 */
export const GARDEN_LADDER: readonly number[] = [9, 27, 54, 108];

/**
 * The rung the ask opens on, given the garden that just filled.
 *
 * One step up, and no further. The app proposes and the user confirms — the
 * same arrangement as a stage — so this has to be a reasonable suggestion
 * rather than an ambitious one: somebody who has just finished nine sittings
 * has shown they can finish nine, and 27 is the smallest thing the ladder can
 * say next. A default of 108 would be the app talking somebody into a year.
 *
 * A garden already at or past a mala stays there; there is nothing above it.
 */
export function proposedGarden(lastSize: number): number {
  return GARDEN_LADDER.find((size) => size > lastSize) ?? GARDEN_LADDER[GARDEN_LADDER.length - 1];
}

/**
 * How big the garden being filled becomes when it is grown by one rung.
 *
 * A rung means two different things on the two paths through the same ask, and
 * this is the one that is easy to get wrong: opening a garden, a rung is the
 * whole of the new bed; growing one, it is how much is *added* to a bed that
 * already has plants in it. Read as a total there, "9" would ask a garden of 54
 * to become a garden of 9.
 *
 * It is arithmetic and it is one line, and it is here rather than in the screen
 * for that reason — a screen is where the mistake would be invisible.
 * `withResizedGarden` still has the last word: it will not close a garden below
 * what has already grown in it.
 */
export function grownSize(plot: Plot, step: number): number {
  return plot.size + step;
}

/** One plant standing in one dot, and the sitting that grew it. */
export type Grown = {
  /** The species key, resolved when the plant was chosen and then permanent. */
  key: string;
  /** The dot it stands in, counted across the whole sequence of gardens. */
  slot: number;
  /** The sitting it came from. One sitting may have grown two or three. */
  session: Session;
};

export type Plot = {
  /** 0-based, and the position in `gardens`. Plot 0 is the starter bed. */
  index: number;
  /** How many dots this garden holds — what its owner asked for. */
  size: number;
  /** The absolute slot of this garden's first dot. */
  start: number;
  /** The plants here, in the order they grew. */
  plants: Grown[];
  /**
   * The same plants laid out the way the grid draws them: one entry per slot,
   * null wherever nothing has grown yet.
   *
   * A garden fills in order, so this is normally a run of plants followed by a
   * run of nulls, and growing order and drawing order agree. It stays a sparse
   * array all the same, because gardens grown while the user still picked dots
   * have holes anywhere in them, and those gardens are on people's phones.
   */
  cells: (Grown | null)[];
  isComplete: boolean;
  /** When the first plant here grew. Null while the garden is empty. */
  startedAt: number | null;
  /** When the last dot was filled. Null until then. */
  completedAt: number | null;
};

/**
 * There is always at least one garden. A blob written before sizes were a
 * choice has no `gardens` at all, and `mergePersisted` supplies one — this is
 * the second line of the same defence, so nothing downstream has to ask.
 */
function sizes(gardens: readonly number[]): readonly number[] {
  return gardens.length > 0 ? gardens : [STARTER_GARDEN];
}

/** The absolute slot of a garden's first dot: everything before it, summed. */
function startOf(gardens: readonly number[], index: number): number {
  let start = 0;
  for (let i = 0; i < index && i < gardens.length; i++) start += gardens[i];
  return start;
}

/**
 * A garden holds a whole number of plants, at least one.
 *
 * This throws rather than clamping because every caller passes a size off a
 * menu the app itself wrote; anything else arriving here is a bug, and a bug
 * that silently plants a garden of 0.5 dots is worse than one that stops.
 */
function validSize(size: number): number {
  if (!Number.isInteger(size) || size < 1) {
    throw new Error(`A garden holds a whole number of dots, at least one — not ${size}`);
  }
  return size;
}

/** How many gardens there are, finished and unfinished. */
export function plotCount(gardens: readonly number[]): number {
  return sizes(gardens).length;
}

export function plotAt(
  sessions: readonly Session[],
  gardens: readonly number[],
  index: number
): Plot {
  const list = sizes(gardens);
  const size = list[index] ?? 0;
  const start = startOf(list, index);
  const end = start + size;

  const cells: (Grown | null)[] = Array(size).fill(null);
  const plants: Grown[] = [];

  // Sessions are appended in the order they finished and a session's own plants
  // are written in the order they were chosen, so one pass in reading order
  // gives `plants` in growing order without sorting anything.
  for (const session of sessions) {
    for (const planted of session.plants) {
      if (planted.slot < start || planted.slot >= end) continue;
      const grown: Grown = { key: planted.key, slot: planted.slot, session };
      cells[planted.slot - start] = grown;
      plants.push(grown);
    }
  }

  const isComplete = size > 0 && plants.length >= size;

  return {
    index,
    size,
    start,
    plants,
    cells,
    isComplete,
    startedAt: plants.length > 0 ? plants[0].session.completedAt : null,
    completedAt: isComplete ? plants[plants.length - 1].session.completedAt : null,
  };
}

/**
 * The garden currently being filled — what the Garden tab shows.
 *
 * It stays the current one when it is full. A finished garden used to roll
 * straight into a fresh 108, because there was nothing to ask; now the next
 * garden's size is the user's to choose, so the app waits on the ask rather
 * than opening a bed nobody ordered.
 */
export function currentPlot(
  sessions: readonly Session[],
  gardens: readonly number[]
): Plot {
  return plotAt(sessions, gardens, plotCount(gardens) - 1);
}

/** Every garden, oldest first. Used by the archive in the You tab. */
export function allPlots(
  sessions: readonly Session[],
  gardens: readonly number[]
): Plot[] {
  return Array.from({ length: plotCount(gardens) }, (_, i) =>
    plotAt(sessions, gardens, i)
  );
}

/**
 * The dot a sitting would fill next: the first empty one in the garden, or null
 * once there are none left. It is the only dot in the field that answers a
 * touch, so this decides where a sitting can be started as well as where the
 * plant will land.
 *
 * The *first* empty one, not the one after the last plant. Those are the same
 * dot in a garden that has only ever filled in order — but a garden grown while
 * the user picked dots has holes behind its newest plant, and filling those in
 * is both tidier and the only reading that cannot land a plant on one already
 * there.
 */
export function nextDot(plot: Plot): number | null {
  const cell = plot.cells.indexOf(null);
  return cell === -1 ? null : plot.start + cell;
}

/**
 * The next `count` empty dots in the garden being filled, in the order a bundle
 * should take them. Fewer than `count` — or none at all — when the garden runs
 * out, which is the caller's cue that the garden is finished.
 *
 * A garden fills in order, so this is simply the front of the queue: the first
 * plant of a sitting takes the first free dot and the rest of a bundle take the
 * ones after it. Nobody names a dot — the garden decides where a sitting lands,
 * at the moment it finishes.
 *
 * The holes are gathered rather than counted from the last plant, because a
 * garden grown while the user still picked dots has holes anywhere in it and
 * those gardens are on people's phones. In one that has only ever filled in
 * order the two readings are the same dot.
 */
export function freeSlots(
  sessions: readonly Session[],
  gardens: readonly number[],
  count: number
): number[] {
  const plot = currentPlot(sessions, gardens);

  const holes: number[] = [];
  for (let cell = 0; cell < plot.cells.length; cell++) {
    if (plot.cells[cell] === null) holes.push(plot.start + cell);
  }

  return holes.slice(0, Math.max(0, count));
}

/**
 * Where a plant goes: the first empty dot in the garden being filled, or null
 * once that garden is full.
 *
 * Null is not a failure. A full garden is a finished one, and what happens next
 * is a question — how big is the next garden — that only the user can answer.
 */
export function nextFreeSlot(
  sessions: readonly Session[],
  gardens: readonly number[]
): number | null {
  return freeSlots(sessions, gardens, 1)[0] ?? null;
}

/**
 * Opens the next garden at the size the user chose.
 *
 * Legal only when the last garden is full — a second open garden would give
 * `nextFreeSlot` two answers. Nothing here can check that, since the sessions
 * are not in scope; the store is where that guard lives.
 */
export function withNextGarden(gardens: readonly number[], size: number): number[] {
  return [...sizes(gardens), validSize(size)];
}

/**
 * Changes the size of the garden being filled. Earlier gardens are closed and
 * this cannot touch them.
 *
 * Shrinking stops at what has already grown: asking for a garden smaller than
 * its own plants closes it exactly where it stands rather than pushing plants
 * out of it, since a plant that fell outside every garden would simply stop
 * being drawn. Growing a garden that was full reopens it, which is what makes
 * "one more" a smaller decision than "one more garden".
 */
export function withResizedGarden(
  gardens: readonly number[],
  sessions: readonly Session[],
  newSize: number
): number[] {
  const list = [...sizes(gardens)];
  const index = list.length - 1;
  const grown = plotAt(sessions, list, index).plants.length;

  list[index] = Math.max(validSize(newSize), grown);
  return list;
}

/**
 * The sequence of gardens a pre-sizes blob must have had, given the highest
 * slot it used. Everything was 108 back then, so this is the shape that brings
 * an existing garden back looking untouched — including the open one, which
 * stays a 108 rather than being retrofitted to a size nobody chose.
 */
export function gardensFromSlots(maxSlotUsed: number): number[] {
  const count = Math.floor(Math.max(0, maxSlotUsed) / PLOT_SIZE) + 1;
  return Array(count).fill(PLOT_SIZE);
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
