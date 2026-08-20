import { Session } from '../../store/types';
import {
  allPlots,
  ART_SHARE,
  currentPlot,
  nextDot,
  nextFreeSlot,
  PLOT_SIZE,
  plotAt,
  plotCount,
  SCATTER,
  slotOffset,
} from '../plots';

/** One session, grown at day `i` and placed in `slot`. */
function session(i: number, slot: number): Session {
  return {
    id: `s${i}`,
    startedAt: i * 86_400_000,
    durationMs: 600_000,
    completedAt: i * 86_400_000 + 600_000,
    stage: 1,
    plant: 'grass',
    slot,
  };
}

/**
 * Sessions completed one day apart, filling slots in order — the shape a garden
 * has when nobody ever picked a dot.
 */
function sessions(n: number): Session[] {
  return Array.from({ length: n }, (_, i) => session(i, i));
}

describe('plotCount', () => {
  it('always has one plot, even with nothing planted', () => {
    expect(plotCount([])).toBe(1);
  });

  it('stays on one plot until the 108th plant', () => {
    expect(plotCount(sessions(1))).toBe(1);
    expect(plotCount(sessions(PLOT_SIZE - 1))).toBe(1);
  });

  it('opens a second plot exactly at 108', () => {
    expect(plotCount(sessions(PLOT_SIZE))).toBe(2);
    expect(plotCount(sessions(PLOT_SIZE + 1))).toBe(2);
  });

  it('opens a third at 216', () => {
    expect(plotCount(sessions(PLOT_SIZE * 2))).toBe(3);
  });
});

describe('plotAt', () => {
  it('slices the right 108 sessions', () => {
    const all = sessions(PLOT_SIZE * 2);
    expect(plotAt(all, 0).sessions[0].id).toBe('s0');
    expect(plotAt(all, 0).sessions).toHaveLength(PLOT_SIZE);
    expect(plotAt(all, 1).sessions[0].id).toBe(`s${PLOT_SIZE}`);
  });

  it('is complete only at exactly 108 plants', () => {
    expect(plotAt(sessions(PLOT_SIZE - 1), 0).isComplete).toBe(false);
    expect(plotAt(sessions(PLOT_SIZE), 0).isComplete).toBe(true);
  });

  it('dates a plot from its first and last plant', () => {
    const full = plotAt(sessions(PLOT_SIZE), 0);
    expect(full.startedAt).toBe(600_000);
    expect(full.completedAt).toBe((PLOT_SIZE - 1) * 86_400_000 + 600_000);
  });

  it('leaves an unfinished plot undated at the end', () => {
    const partial = plotAt(sessions(5), 0);
    expect(partial.startedAt).toBe(600_000);
    expect(partial.completedAt).toBeNull();
  });

  it('leaves an empty plot undated at both ends', () => {
    const empty = plotAt([], 0);
    expect(empty.startedAt).toBeNull();
    expect(empty.completedAt).toBeNull();
  });
});

describe('currentPlot', () => {
  it('is the empty first plot before anything is planted', () => {
    const plot = currentPlot([]);
    expect(plot.index).toBe(0);
    expect(plot.sessions).toHaveLength(0);
  });

  it('rolls to a fresh empty plot the moment one fills', () => {
    const plot = currentPlot(sessions(PLOT_SIZE));
    expect(plot.index).toBe(1);
    expect(plot.sessions).toHaveLength(0);
    expect(plot.isComplete).toBe(false);
  });

  it('is the partially filled plot mid-way through', () => {
    const plot = currentPlot(sessions(PLOT_SIZE + 3));
    expect(plot.index).toBe(1);
    expect(plot.sessions).toHaveLength(3);
  });
});

describe('nextDot', () => {
  it('is the very first dot of an untouched garden', () => {
    expect(nextDot(currentPlot([]))).toBe(0);
  });

  it('is the first hole, not the dot after the last plant', () => {
    // The two readings agree in a garden that has only ever filled in order,
    // which is why this plants out of order deliberately: a test that planted
    // linearly would pass on either reading and prove nothing. Gardens like
    // this one exist — they were grown while the user still picked the dot —
    // and the marker has to carry on from the front of them.
    const grown = [session(0, 40), session(1, 7), session(2, 90), session(3, 12)];
    expect(nextDot(currentPlot(grown))).toBe(0);
    expect(nextDot(currentPlot([...grown, session(4, 0)]))).toBe(1);
  });

  it('has nothing to point at once a plot is full', () => {
    expect(nextDot(plotAt(sessions(PLOT_SIZE), 0))).toBeNull();
  });

  it('counts from the plot it is asked about, not from the garden', () => {
    // Slots are absolute, so the second plot's first dot is 108 and not 0 —
    // which is what lets the grid compare it against the slot it is drawing.
    expect(nextDot(currentPlot(sessions(PLOT_SIZE)))).toBe(PLOT_SIZE);
  });

  it('agrees with where a sitting would actually be planted', () => {
    // `nextFreeSlot` is the store's answer and `nextDot` is the grid's; a
    // marker that pointed anywhere else would be a promise the app breaks.
    const grown = [session(0, 5), session(1, 1), session(2, 0)];
    expect(nextDot(currentPlot(grown))).toBe(nextFreeSlot(grown));
  });
});

/**
 * A garden fills in order now, so these all describe gardens grown before it
 * did. They are not testing a feature any more; they are testing that a garden
 * someone has been keeping still draws the way they left it, which is the
 * reason `slot` is stored rather than derived from array order.
 */
describe('placing plants by slot', () => {
  it('draws a plant in the dot it was given, not the order it grew', () => {
    // Someone who tapped the middle of an empty plot, then the start of it.
    const garden = [session(0, 50), session(1, 3)];
    const { cells } = plotAt(garden, 0);

    expect(cells[50]!.id).toBe('s0');
    expect(cells[3]!.id).toBe('s1');
    expect(cells[0]).toBeNull();
    expect(cells[1]).toBeNull();
  });

  it('still dates a plot by when things grew, not by where they sit', () => {
    // s0 grew first but sits last; the plot began when s0 grew.
    const plot = plotAt([session(0, 90), session(1, 2)], 0);
    expect(plot.startedAt).toBe(600_000);
  });

  it('counts a scattered plot by how many plants it holds', () => {
    const plot = plotAt([session(0, 107), session(1, 0)], 0);
    expect(plot.sessions).toHaveLength(2);
    expect(plot.isComplete).toBe(false);
  });

  it('keeps plants in the plot their slot names', () => {
    const garden = [session(0, 5), session(1, PLOT_SIZE + 5)];
    expect(plotAt(garden, 0).sessions.map((s) => s.id)).toEqual(['s0']);
    expect(plotAt(garden, 1).sessions.map((s) => s.id)).toEqual(['s1']);
    expect(plotAt(garden, 1).cells[5]!.id).toBe('s1');
  });
});

describe('nextFreeSlot', () => {
  it('starts a new garden at the first dot', () => {
    expect(nextFreeSlot([])).toBe(0);
  });

  it('takes the first empty dot, not the one after the last plant', () => {
    // A garden left with a hole in it — dot 4 was picked before planting became
    // linear. New sittings fill the hole rather than appending past it.
    expect(nextFreeSlot([session(0, 4)])).toBe(0);
    expect(nextFreeSlot([session(0, 0), session(1, 4)])).toBe(1);
  });

  it('moves into the next plot once one is full', () => {
    expect(nextFreeSlot(sessions(PLOT_SIZE))).toBe(PLOT_SIZE);
  });

  it('is relative to the current plot, not the whole garden', () => {
    const garden = [...sessions(PLOT_SIZE), session(999, PLOT_SIZE + 7)];
    expect(nextFreeSlot(garden)).toBe(PLOT_SIZE);
  });
});

describe('slotOffset', () => {
  it('never lets a dot leave its own cell', () => {
    // Half the art plus a full displacement must come to no more than half a
    // cell, or plants start colliding and the plot loses its edges.
    expect(ART_SHARE / 2 + SCATTER).toBeLessThanOrEqual(0.5);

    for (let slot = 0; slot < PLOT_SIZE * 3; slot++) {
      const { dx, dy } = slotOffset(slot);
      expect(Math.abs(dx)).toBeLessThanOrEqual(SCATTER);
      expect(Math.abs(dy)).toBeLessThanOrEqual(SCATTER);
    }
  });

  it('gives the same dot the same nudge every time', () => {
    // Otherwise the garden would rearrange itself on every render.
    expect(slotOffset(57)).toEqual(slotOffset(57));
  });

  it('does not nudge every dot the same way', () => {
    const offsets = new Set(
      Array.from({ length: PLOT_SIZE }, (_, i) => JSON.stringify(slotOffset(i)))
    );
    // A scatter that repeats itself would just be a second, wonkier lattice.
    expect(offsets.size).toBeGreaterThan(PLOT_SIZE * 0.9);
  });

  it('moves both axes, not just one', () => {
    const some = Array.from({ length: 20 }, (_, i) => slotOffset(i));
    expect(some.some((o) => Math.abs(o.dx) > 0.01)).toBe(true);
    expect(some.some((o) => Math.abs(o.dy) > 0.01)).toBe(true);
  });
});

describe('allPlots', () => {
  it('returns every plot oldest first, including the empty current one', () => {
    const plots = allPlots(sessions(PLOT_SIZE));
    expect(plots.map((p) => p.index)).toEqual([0, 1]);
    expect(plots[0].isComplete).toBe(true);
    expect(plots[1].sessions).toHaveLength(0);
  });
});
