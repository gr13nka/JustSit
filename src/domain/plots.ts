import { Session } from '../store/types';
import { hash32 } from './hash';

/**
 * A plot holds 108 slots — the mala bead count, so the number carries some
 * weight rather than being arbitrary. Fill one and it is finished and archived;
 * a fresh plot opens. The empty slots ahead of you are the point: the garden is
 * a promise as much as a record.
 */
export const PLOT_SIZE = 108;

export type Plot = {
  /** 0-based. Plot 0 is the first garden the user ever grew. */
  index: number;
  /** The plants here, in the order they grew. */
  sessions: Session[];
  /**
   * The same plants laid out the way the grid draws them: one entry per slot,
   * null wherever nothing has grown yet. Growing order and drawing order are
   * two different things now that the user picks the dot.
   */
  cells: (Session | null)[];
  isComplete: boolean;
  /** When the first plant in this plot grew. Null while the plot is empty. */
  startedAt: number | null;
  /** When the 108th plant grew. Null until then. */
  completedAt: number | null;
};

/** Which plot a slot falls in. Slots are absolute across the whole garden. */
export function plotIndexOfSlot(slot: number): number {
  return Math.floor(slot / PLOT_SIZE);
}

/** Where in its own plot a slot sits: 0..107. */
function cellOfSlot(slot: number): number {
  return slot % PLOT_SIZE;
}

/**
 * Plots are derived from the session list, never stored — one less thing that
 * can drift out of agreement with reality. Only a session's own slot is stored.
 *
 * There is always at least one plot: with no sessions, plot 0 is the empty
 * garden waiting to be filled.
 */
export function plotCount(sessions: readonly Session[]): number {
  if (sessions.length === 0) return 1;

  const highest = sessions.reduce(
    (max, s) => Math.max(max, plotIndexOfSlot(s.slot)),
    0
  );
  const inHighest = sessions.filter(
    (s) => plotIndexOfSlot(s.slot) === highest
  ).length;

  // A finished plot is archived and a fresh one opens behind it.
  return inHighest === PLOT_SIZE ? highest + 2 : highest + 1;
}

export function plotAt(sessions: readonly Session[], index: number): Plot {
  const inPlot = sessions.filter((s) => plotIndexOfSlot(s.slot) === index);
  const isComplete = inPlot.length === PLOT_SIZE;

  const cells: (Session | null)[] = Array(PLOT_SIZE).fill(null);
  for (const session of inPlot) cells[cellOfSlot(session.slot)] = session;

  return {
    index,
    sessions: inPlot,
    cells,
    isComplete,
    // `filter` preserves the session list's append order, so these are the
    // first and last plants to *grow* here — not the lowest and highest slots.
    startedAt: inPlot.length > 0 ? inPlot[0].completedAt : null,
    completedAt: isComplete ? inPlot[inPlot.length - 1].completedAt : null,
  };
}

/** The plot currently being filled — what the Garden tab shows. */
export function currentPlot(sessions: readonly Session[]): Plot {
  return plotAt(sessions, plotCount(sessions) - 1);
}

/** Every plot, oldest first. Used by the archive in the You tab. */
export function allPlots(sessions: readonly Session[]): Plot[] {
  return Array.from({ length: plotCount(sessions) }, (_, i) => plotAt(sessions, i));
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

/** True if nothing has grown in this slot. */
export function isSlotFree(sessions: readonly Session[], slot: number): boolean {
  return !sessions.some((s) => s.slot === slot);
}

/**
 * Where a plant goes when the user did not pick a dot — the first empty one in
 * the plot being filled, which reproduces how the garden filled before dots
 * were tappable.
 */
export function nextFreeSlot(sessions: readonly Session[]): number {
  const plot = currentPlot(sessions);
  const cell = plot.cells.indexOf(null);

  // A complete plot is never the current one, but if it somehow were, the plant
  // belongs in the plot after it rather than nowhere.
  return plot.index * PLOT_SIZE + (cell === -1 ? PLOT_SIZE : cell);
}
