import { Session } from '../../store/types';
import {
  allPlots,
  ART_SHARE,
  currentPlot,
  freeSlots,
  GARDEN_LADDER,
  gardensFromSlots,
  grownSize,
  nextDot,
  nextFreeSlot,
  PLOT_SIZE,
  plotAt,
  plotCount,
  proposedGarden,
  SCATTER,
  slotOffset,
  STARTER_GARDEN,
  withNextGarden,
  withResizedGarden,
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
 * Sittings completed one day apart, filling slots in order — the shape a garden
 * has when nobody ever picked a dot.
 */
function sessions(n: number): Session[] {
  return Array.from({ length: n }, (_, i) => one(i, i));
}

/** A sequence of 108s, which is what every garden was before sizes existed. */
function malas(n: number): number[] {
  return Array(n).fill(PLOT_SIZE);
}

describe('plotCount', () => {
  it('is however many gardens have been opened', () => {
    expect(plotCount([3])).toBe(1);
    expect(plotCount([3, 9, 27])).toBe(3);
  });

  it('is one for a blob that predates gardens having sizes', () => {
    // `mergePersisted` fills this in, so it should never be seen. Dividing by a
    // garden that isn't there is not a failure worth passing downstream.
    expect(plotCount([])).toBe(1);
  });
});

describe('walking the garden boundaries', () => {
  const gardens = [3, 9, 27];

  it('puts each slot in the garden the sizes say, not the one division says', () => {
    const grown = [one(0, 0), one(1, 3), one(2, 11), one(3, 12), one(4, 38)];

    expect(plotAt(grown, gardens, 0).plants.map((p) => p.slot)).toEqual([0]);
    expect(plotAt(grown, gardens, 1).plants.map((p) => p.slot)).toEqual([3, 11]);
    expect(plotAt(grown, gardens, 2).plants.map((p) => p.slot)).toEqual([12, 38]);
  });

  it('starts each garden where the one before it ended', () => {
    expect(plotAt([], gardens, 0).start).toBe(0);
    expect(plotAt([], gardens, 1).start).toBe(3);
    expect(plotAt([], gardens, 2).start).toBe(12);
  });

  it('sizes the cells to what the user asked for', () => {
    expect(plotAt([], gardens, 0).cells).toHaveLength(3);
    expect(plotAt([], gardens, 1).cells).toHaveLength(9);
    expect(plotAt([], gardens, 2).cells).toHaveLength(27);
  });

  it('draws a plant at its own offset within its garden', () => {
    const plot = plotAt([one(0, 14)], gardens, 2);
    // Slot 14 in a garden that starts at 12 is the third cell, not the fifteenth.
    expect(plot.cells[2]!.slot).toBe(14);
    expect(plot.cells[0]).toBeNull();
  });
});

describe('plotAt', () => {
  it('is complete only once every dot is filled', () => {
    expect(plotAt(sessions(2), [3], 0).isComplete).toBe(false);
    expect(plotAt(sessions(3), [3], 0).isComplete).toBe(true);
  });

  it('counts plants rather than sittings', () => {
    // One sitting, three plants — a bundle. The garden fills by plants.
    const bundle = [session(0, [0, 1, 2])];
    expect(plotAt(bundle, [3], 0).plants).toHaveLength(3);
    expect(plotAt(bundle, [3], 0).isComplete).toBe(true);
  });

  it('dates a garden from the sittings that opened and closed it', () => {
    const full = plotAt(sessions(3), [3], 0);
    expect(full.startedAt).toBe(600_000);
    expect(full.completedAt).toBe(2 * 86_400_000 + 600_000);
  });

  it('leaves an unfinished garden undated at the end', () => {
    const partial = plotAt(sessions(2), [3], 0);
    expect(partial.startedAt).toBe(600_000);
    expect(partial.completedAt).toBeNull();
  });

  it('leaves an empty garden undated at both ends', () => {
    const empty = plotAt([], [3], 0);
    expect(empty.startedAt).toBeNull();
    expect(empty.completedAt).toBeNull();
  });

  it('keeps plants in growing order, whatever dots they landed in', () => {
    const garden = [one(0, 2), one(1, 0)];
    expect(plotAt(garden, [3], 0).plants.map((p) => p.slot)).toEqual([2, 0]);
  });
});

describe('currentPlot', () => {
  it('is the empty starter bed before anything is planted', () => {
    const plot = currentPlot([], [STARTER_GARDEN]);
    expect(plot.index).toBe(0);
    expect(plot.size).toBe(STARTER_GARDEN);
    expect(plot.plants).toHaveLength(0);
  });

  it('is the last garden in the sequence, whatever its size', () => {
    const plot = currentPlot(sessions(3), [3, 9]);
    expect(plot.index).toBe(1);
    expect(plot.size).toBe(9);
    expect(plot.plants).toHaveLength(0);
  });

  it('stays the current one when it is full — the next size is an ask', () => {
    // Gardens used to roll over on their own, because there was nothing to ask.
    const plot = currentPlot(sessions(3), [3]);
    expect(plot.index).toBe(0);
    expect(plot.isComplete).toBe(true);
  });
});

describe('nextDot', () => {
  it('is the very first dot of an untouched garden', () => {
    expect(nextDot(currentPlot([], [3]))).toBe(0);
  });

  it('is the first hole, not the dot after the last plant', () => {
    // The two readings agree in a garden that has only ever filled in order,
    // which is why this plants out of order deliberately: a test that planted
    // linearly would pass on either reading and prove nothing. Gardens like
    // this one exist — they were grown while the user still picked the dot.
    const grown = [one(0, 40), one(1, 7), one(2, 90), one(3, 12)];
    expect(nextDot(currentPlot(grown, malas(1)))).toBe(0);
    expect(nextDot(currentPlot([...grown, one(4, 0)], malas(1)))).toBe(1);
  });

  it('has nothing to point at once a garden is full', () => {
    expect(nextDot(currentPlot(sessions(3), [3]))).toBeNull();
  });

  it('counts absolutely, so a later garden does not start again at zero', () => {
    // Which is what lets the grid compare it against the slot it is drawing.
    expect(nextDot(currentPlot(sessions(3), [3, 9]))).toBe(3);
  });

  it('agrees with where a sitting would actually be planted', () => {
    // `nextFreeSlot` is the store's answer and `nextDot` is the grid's; a
    // marker that pointed anywhere else would be a promise the app breaks.
    const grown = [one(0, 5), one(1, 1), one(2, 0)];
    expect(nextDot(currentPlot(grown, malas(1)))).toBe(nextFreeSlot(grown, malas(1)));
  });
});

describe('nextFreeSlot', () => {
  it('starts a new garden at the first dot', () => {
    expect(nextFreeSlot([], [3])).toBe(0);
  });

  it('takes the first empty dot, not the one after the last plant', () => {
    // A garden left with a hole in it — dot 4 was picked before planting became
    // linear. New sittings fill the hole rather than appending past it.
    expect(nextFreeSlot([one(0, 4)], malas(1))).toBe(0);
    expect(nextFreeSlot([one(0, 0), one(1, 4)], malas(1))).toBe(1);
  });

  it('is null once the garden is full, rather than running into the next one', () => {
    // A full garden is a finished one. What happens next is a question only the
    // user can answer, so this stops rather than guessing at a size.
    expect(nextFreeSlot(sessions(3), [3])).toBeNull();
  });

  it('carries on in the newest garden once one has been opened', () => {
    expect(nextFreeSlot(sessions(3), [3, 9])).toBe(3);
  });

  it('is relative to the garden being filled, not the whole sequence', () => {
    // The first garden is full and closed; its holes are not on offer, and a
    // hole in the current one is.
    const garden = [...sessions(3), one(99, 5)];
    expect(nextFreeSlot(garden, [3, 9])).toBe(3);
  });
});

describe('freeSlots', () => {
  it('hands a bundle consecutive dots', () => {
    expect(freeSlots(sessions(2), [9], 3)).toEqual([2, 3, 4]);
  });

  it('stops at the edge of the garden rather than spilling past it', () => {
    // A bundle of three into a garden with one dot left. The offer was capped
    // against this before it was ever shown, so trimming here is the backstop.
    expect(freeSlots(sessions(2), [3], 3)).toEqual([2]);
  });

  it('has nothing to give once the garden is full', () => {
    expect(freeSlots(sessions(3), [3], 3)).toEqual([]);
  });

  it('takes the holes from the front, not the dots after the newest plant', () => {
    // A garden grown while the user still picked dots has holes anywhere in it,
    // and those gardens are on people's phones.
    const grown = [one(0, 0), one(1, 3), one(2, 4)];
    expect(freeSlots(grown, [9], 3)).toEqual([1, 2, 5]);
  });
});

describe('choosing the next garden', () => {
  it('appends the size that was chosen', () => {
    expect(withNextGarden([3], 27)).toEqual([3, 27]);
  });

  it('leaves the gardens it was given alone', () => {
    const before = [3, 9];
    withNextGarden(before, 27);
    expect(before).toEqual([3, 9]);
  });

  it('refuses a size that is not a whole number of dots', () => {
    expect(() => withNextGarden([3], 0)).toThrow();
    expect(() => withNextGarden([3], -9)).toThrow();
    expect(() => withNextGarden([3], 4.5)).toThrow();
    expect(() => withNextGarden([3], NaN)).toThrow();
  });
});

describe('resizing the garden being filled', () => {
  it('changes the last garden and nothing else', () => {
    expect(withResizedGarden([3, 9], [], 27)).toEqual([3, 27]);
  });

  it('cannot touch a garden that is already closed', () => {
    // The whole point of the last entry being the only mutable one: a garden
    // somebody finished a year ago must not be resized out from under it.
    const finished = [...sessions(3), one(99, 3)];
    expect(withResizedGarden([3, 9], finished, 1)).toEqual([3, 1]);
    expect(withResizedGarden([3, 9], finished, 108)[0]).toBe(3);
  });

  it('closes a garden at what has grown rather than shrinking below it', () => {
    // Five plants in the ground and the user asks for a garden of two: it
    // finishes at five. Pushing three plants outside every garden would stop
    // them being drawn at all.
    const grown = sessions(5);
    expect(withResizedGarden([9], grown, 2)).toEqual([5]);
  });

  it('counts plants, not sittings, when it works out the floor', () => {
    const bundle = [session(0, [0, 1, 2])];
    expect(withResizedGarden([9], bundle, 1)).toEqual([3]);
  });

  it('reopens a finished garden when it is grown', () => {
    const grown = sessions(3);
    const gardens = withResizedGarden([3], grown, 9);
    expect(gardens).toEqual([9]);
    expect(currentPlot(grown, gardens).isComplete).toBe(false);
    expect(nextFreeSlot(grown, gardens)).toBe(3);
  });

  it('refuses a size that is not a whole number of dots', () => {
    expect(() => withResizedGarden([3], [], 0)).toThrow();
    expect(() => withResizedGarden([3], [], 2.5)).toThrow();
  });
});

describe('gardensFromSlots', () => {
  it('rebuilds one mala for a garden that never filled one', () => {
    expect(gardensFromSlots(0)).toEqual([PLOT_SIZE]);
    expect(gardensFromSlots(PLOT_SIZE - 1)).toEqual([PLOT_SIZE]);
  });

  it('opens the next mala exactly at the boundary', () => {
    expect(gardensFromSlots(PLOT_SIZE)).toEqual([PLOT_SIZE, PLOT_SIZE]);
    expect(gardensFromSlots(PLOT_SIZE * 2 + 5)).toHaveLength(3);
  });

  it('covers the highest slot it was given, which is the whole job', () => {
    for (const highest of [0, 7, 107, 108, 400]) {
      const total = gardensFromSlots(highest).reduce((a, b) => a + b, 0);
      expect(total).toBeGreaterThan(highest);
    }
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
  it('returns every garden oldest first, including the empty current one', () => {
    const plots = allPlots(sessions(3), [3, 9]);
    expect(plots.map((p) => p.index)).toEqual([0, 1]);
    expect(plots.map((p) => p.size)).toEqual([3, 9]);
    expect(plots[0].isComplete).toBe(true);
    expect(plots[1].plants).toHaveLength(0);
  });

  it('accounts for every plant across gardens of different sizes', () => {
    const gardens = [3, 9, 27];
    const grown = sessions(20);
    const counted = allPlots(grown, gardens).reduce((n, p) => n + p.plants.length, 0);
    expect(counted).toBe(20);
  });
});

describe('grownSize', () => {
  it('adds the rung to the garden rather than replacing it with one', () => {
    // Growing spends a rung on the bed that is already there. A garden of 54
    // grown by 9 is 63, not 9.
    expect(grownSize(plotAt(sessions(2), [54], 0), 9)).toBe(63);
  });
});

describe('proposedGarden', () => {
  it('proposes one rung up from the garden that just filled', () => {
    // The app proposes and the user confirms, the same as a stage. Somebody who
    // has just finished nine sittings has shown they can finish nine; a default
    // of a whole mala would be the app talking them into a year.
    expect(proposedGarden(3)).toBe(9);
    expect(proposedGarden(9)).toBe(27);
    expect(proposedGarden(27)).toBe(54);
    expect(proposedGarden(54)).toBe(108);
  });

  it('stays at a mala once there is nothing above it', () => {
    expect(proposedGarden(108)).toBe(108);
    expect(proposedGarden(216)).toBe(108);
  });

  it('only ever proposes a rung of the ladder', () => {
    for (const size of [1, 3, 4, 12, 40, 53, 99, 108, 200]) {
      expect(GARDEN_LADDER).toContain(proposedGarden(size));
    }
  });

  it('offers sizes that are all fractions of a mala', () => {
    // What makes the shelf legible without a percentage on it: every garden is
    // some part of the same object.
    for (const size of GARDEN_LADDER) expect(PLOT_SIZE % size).toBe(0);
  });
});
