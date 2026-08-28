import { Session } from '../../store/types';
import {
  ART_SHARE,
  currentPlot,
  freeSlots,
  MALA,
  nextDot,
  nextFreeSlot,
  nextGardenSize,
  SCATTER,
  slotOffset,
  STARTER_GARDEN,
} from '../plots';

/** One sitting, grown at day `i`, holding whatever plants it was given. */
function session(i: number, slots: number[]): Session {
  return {
    id: `s${i}`,
    startedAt: i * 86_400_000,
    durationMs: 600_000,
    completedAt: i * 86_400_000 + 600_000,
    stage: 1,
    plants: slots.map((slot) => ({ key: 'grass', slot })),
  };
}

/** The common case: one sitting, one plant, one dot. */
function one(i: number, slot: number): Session {
  return session(i, [slot]);
}

/**
 * Sittings completed one day apart, filling dots in order — the shape a bed has
 * when it has only ever been planted the way the app plants it.
 */
function sessions(n: number): Session[] {
  return Array.from({ length: n }, (_, i) => one(i, i));
}

describe('nextGardenSize', () => {
  it('widens the bed while it is still one row', () => {
    // Three, six, twelve: the whole of the small table, and the whole of the
    // range in which a width may change at all.
    expect(nextGardenSize(STARTER_GARDEN)).toBe(6);
    expect(nextGardenSize(6)).toBe(12);
  });

  it('adds a row at a time from twelve up, for ever', () => {
    let size = 12;
    for (const rung of [24, 36, 48, 60, 72, 84, 96, 108, 120]) {
      size = nextGardenSize(size);
      expect(size).toBe(rung);
    }
  });

  it('puts a mala on the ladder rather than at the end of it', () => {
    // It is the shape `field.ts` is tuned to and worth arriving at, but the bed
    // carries on past it exactly as it did before.
    let size: number = STARTER_GARDEN;
    const rungs: number[] = [];
    while (size < MALA) {
      size = nextGardenSize(size);
      rungs.push(size);
    }
    expect(rungs).toContain(MALA);
    expect(nextGardenSize(MALA)).toBe(120);
  });

  it('always answers with something larger, whatever it is given', () => {
    // A bed with no next size is a finished sitting with nowhere to go, which
    // is the one outcome the store cannot survive.
    for (const size of [0, 1, 2, 4, 5, 7, 11, 13, 40, 100, 107, 216]) {
      expect(nextGardenSize(size)).toBeGreaterThan(size);
    }
  });

  it('takes a size off the ladder up to the next rung the same way', () => {
    // Nothing writes one today. Below the fold it lands back on the table; above
    // it, a row more of the width it already has.
    expect(nextGardenSize(4)).toBe(6);
    expect(nextGardenSize(11)).toBe(12);
    expect(nextGardenSize(100)).toBe(112);
  });
});

describe('currentPlot', () => {
  it('is the empty starter bed before anything is planted', () => {
    const plot = currentPlot([], STARTER_GARDEN);
    expect(plot.size).toBe(STARTER_GARDEN);
    expect(plot.plants).toHaveLength(0);
    expect(plot.cells).toHaveLength(STARTER_GARDEN);
  });

  it('is complete only once every dot is filled', () => {
    expect(currentPlot(sessions(2), 3).isComplete).toBe(false);
    expect(currentPlot(sessions(3), 3).isComplete).toBe(true);
  });

  it('counts plants rather than sittings', () => {
    // One sitting, three plants — a bundle. The bed fills by plants.
    const bundle = [session(0, [0, 1, 2])];
    expect(currentPlot(bundle, 3).plants).toHaveLength(3);
    expect(currentPlot(bundle, 3).isComplete).toBe(true);
  });

  it('stays full when it is full — growing is an ask', () => {
    // The bed used to roll over into a fresh one, because there was nothing to
    // ask. Now the next size is the user's to confirm.
    const plot = currentPlot(sessions(3), 3);
    expect(plot.size).toBe(3);
    expect(plot.isComplete).toBe(true);
  });

  it('keeps everything a bed that grew already held', () => {
    // The whole claim of a single growing bed: a plant put down when the bed
    // was three is in the same dot when it is twelve.
    const grown = sessions(3);
    const before = currentPlot(grown, 3);
    const after = currentPlot(grown, 12);

    expect(after.plants.map((p) => p.slot)).toEqual(before.plants.map((p) => p.slot));
    expect(after.cells.slice(0, 3)).toEqual(before.cells);
    expect(after.isComplete).toBe(false);
  });

  it('draws a plant in the dot it was planted in', () => {
    const plot = currentPlot([one(0, 14)], 24);
    expect(plot.cells[14]!.slot).toBe(14);
    expect(plot.cells[0]).toBeNull();
  });

  it('dates a bed from the sittings that opened and closed it', () => {
    const full = currentPlot(sessions(3), 3);
    expect(full.startedAt).toBe(600_000);
    expect(full.completedAt).toBe(2 * 86_400_000 + 600_000);
  });

  it('leaves an unfinished bed undated at the end', () => {
    const partial = currentPlot(sessions(2), 3);
    expect(partial.startedAt).toBe(600_000);
    expect(partial.completedAt).toBeNull();
  });

  it('leaves an empty bed undated at both ends', () => {
    const empty = currentPlot([], 3);
    expect(empty.startedAt).toBeNull();
    expect(empty.completedAt).toBeNull();
  });

  it('keeps plants in growing order, whatever dots they landed in', () => {
    const garden = [one(0, 2), one(1, 0)];
    expect(currentPlot(garden, 3).plants.map((p) => p.slot)).toEqual([2, 0]);
  });

  it('skips a plant that falls outside the bed rather than drawing past it', () => {
    // The bed only grows, so nothing the app writes can land here. A blob that
    // says otherwise draws short instead of taking the garden down.
    const plot = currentPlot([one(0, 0), one(1, 99)], 3);
    expect(plot.plants.map((p) => p.slot)).toEqual([0]);
    expect(plot.cells).toHaveLength(3);
  });
});

describe('nextDot', () => {
  it('is the very first dot of an untouched bed', () => {
    expect(nextDot(currentPlot([], 3))).toBe(0);
  });

  it('is the first hole, not the dot after the last plant', () => {
    // The two readings agree in a bed that has only ever filled in order, which
    // is why this plants out of order deliberately: a test that planted
    // linearly would pass on either reading and prove nothing. This is the
    // reading that cannot put a plant on top of one already there.
    const grown = [one(0, 40), one(1, 7), one(2, 90), one(3, 12)];
    expect(nextDot(currentPlot(grown, MALA))).toBe(0);
    expect(nextDot(currentPlot([...grown, one(4, 0)], MALA))).toBe(1);
  });

  it('has nothing to point at once the bed is full', () => {
    expect(nextDot(currentPlot(sessions(3), 3))).toBeNull();
  });

  it('points into the new ground the moment the bed grows', () => {
    expect(nextDot(currentPlot(sessions(3), 6))).toBe(3);
  });

  it('agrees with where a sitting would actually be planted', () => {
    // `nextFreeSlot` is the store's answer and `nextDot` is the grid's; a
    // marker that pointed anywhere else would be a promise the app breaks.
    const grown = [one(0, 5), one(1, 1), one(2, 0)];
    expect(nextDot(currentPlot(grown, MALA))).toBe(nextFreeSlot(grown, MALA));
  });
});

describe('nextFreeSlot', () => {
  it('starts an empty bed at the first dot', () => {
    expect(nextFreeSlot([], 3)).toBe(0);
  });

  it('takes the first empty dot, not the one after the last plant', () => {
    expect(nextFreeSlot([one(0, 4)], MALA)).toBe(0);
    expect(nextFreeSlot([one(0, 0), one(1, 4)], MALA)).toBe(1);
  });

  it('is null once the bed is full, rather than running past its edge', () => {
    // A full bed is a finished one. What happens next is a question only the
    // user can answer, so this stops rather than planting into nothing.
    expect(nextFreeSlot(sessions(3), 3)).toBeNull();
  });

  it('carries on into the ground a grown bed added', () => {
    expect(nextFreeSlot(sessions(3), 6)).toBe(3);
  });
});

describe('freeSlots', () => {
  it('hands a bundle consecutive dots', () => {
    expect(freeSlots(sessions(2), 12, 3)).toEqual([2, 3, 4]);
  });

  it('stops at the edge of the bed rather than spilling past it', () => {
    // A bundle of three into a bed with one dot left. The offer was capped
    // against this before it was ever shown, so trimming here is the backstop.
    expect(freeSlots(sessions(2), 3, 3)).toEqual([2]);
  });

  it('has nothing to give once the bed is full', () => {
    expect(freeSlots(sessions(3), 3, 3)).toEqual([]);
  });

  it('takes the holes from the front, not the dots after the newest plant', () => {
    const grown = [one(0, 0), one(1, 3), one(2, 4)];
    expect(freeSlots(grown, 12, 3)).toEqual([1, 2, 5]);
  });
});

describe('slotOffset', () => {
  it('never lets a dot leave its own cell', () => {
    // Half the art plus a full displacement must come to no more than half a
    // cell, or plants start colliding and the plot loses its edges.
    expect(ART_SHARE / 2 + SCATTER).toBeLessThanOrEqual(0.5);

    for (let slot = 0; slot < MALA * 3; slot++) {
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
      Array.from({ length: MALA }, (_, i) => JSON.stringify(slotOffset(i)))
    );
    // A scatter that repeats itself would just be a second, wonkier lattice.
    expect(offsets.size).toBeGreaterThan(MALA * 0.9);
  });

  it('moves both axes, not just one', () => {
    const some = Array.from({ length: 20 }, (_, i) => slotOffset(i));
    expect(some.some((o) => Math.abs(o.dx) > 0.01)).toBe(true);
    expect(some.some((o) => Math.abs(o.dy) > 0.01)).toBe(true);
  });
});
