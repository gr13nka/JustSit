import { SESSIONS_TO_OFFER } from '../progression';
import {
  DURATION_OPTIONS_MS,
  DURATION_UNLOCKS,
  FINAL_STAGE,
  stageAt,
  STAGES,
  unlockedDurations,
} from '../stages';

const MIN = 60_000;
const rungs = (...minutes: number[]) => minutes.map((m) => m * MIN);

describe('STAGES', () => {
  it('has all ten of Wallace’s stages, numbered in order', () => {
    expect(STAGES).toHaveLength(10);
    expect(STAGES.map((s) => s.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(FINAL_STAGE).toBe(10);
  });

  it('gives every tip a globally unique id', () => {
    // seenTipIds is a flat list across all stages — a duplicate id would mean
    // seeing a tip in one stage silently skips another.
    const ids = STAGES.flatMap((s) => s.tips.map((t) => t.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('carries full tip sets for the early stages a beginner actually lives in', () => {
    for (const n of [1, 2, 3, 4]) {
      expect(stageAt(n).tips.length).toBeGreaterThanOrEqual(15);
    }
  });

  it('carries at least a few tips for every later stage', () => {
    for (const n of [5, 6, 7, 8, 9, 10]) {
      expect(stageAt(n).tips.length).toBeGreaterThanOrEqual(5);
    }
  });

  it('suggests a duration that is actually on the dial', () => {
    for (const stage of STAGES) {
      expect(DURATION_OPTIONS_MS).toContain(stage.suggestedMs);
    }
  });

  it('never suggests more than 10 minutes at stage one', () => {
    // Wallace is explicit that beginners fail by sitting too long too early.
    expect(stageAt(1).suggestedMs).toBeLessThanOrEqual(10 * 60_000);
  });

  it('never suggests a shorter sitting than the stage before', () => {
    for (let i = 1; i < STAGES.length; i++) {
      expect(STAGES[i].suggestedMs).toBeGreaterThanOrEqual(STAGES[i - 1].suggestedMs);
    }
  });

  it('describes what every stage feels like, for the advancement card', () => {
    for (const stage of STAGES) {
      expect(stage.felt.length).toBeGreaterThan(30);
      expect(stage.practice.length).toBeGreaterThan(0);
    }
  });

  it('throws rather than silently returning nothing for an unknown stage', () => {
    expect(() => stageAt(0)).toThrow();
    expect(() => stageAt(11)).toThrow();
  });
});

describe('the duration ladder', () => {
  it('keeps the rungs in one place, so the two lists cannot drift', () => {
    expect(DURATION_OPTIONS_MS).toEqual(DURATION_UNLOCKS.map((rung) => rung.ms));
    expect(DURATION_OPTIONS_MS).toEqual(rungs(2, 3, 5, 10, 15, 24));
  });

  it('opens with two lengths and nothing else', () => {
    expect(unlockedDurations(0)).toEqual(rungs(2, 3));
  });

  it('adds five at three sittings, ten at seven, fifteen at twelve, the ghatika at twenty', () => {
    expect(unlockedDurations(2)).toEqual(rungs(2, 3));
    expect(unlockedDurations(3)).toEqual(rungs(2, 3, 5));
    expect(unlockedDurations(6)).toEqual(rungs(2, 3, 5));
    expect(unlockedDurations(7)).toEqual(rungs(2, 3, 5, 10));
    expect(unlockedDurations(11)).toEqual(rungs(2, 3, 5, 10));
    expect(unlockedDurations(12)).toEqual(rungs(2, 3, 5, 10, 15));
    expect(unlockedDurations(19)).toEqual(rungs(2, 3, 5, 10, 15));
    expect(unlockedDurations(20)).toEqual(rungs(2, 3, 5, 10, 15, 24));
  });

  it('opens every rung on the sitting it names, and not the one before', () => {
    for (const rung of DURATION_UNLOCKS) {
      if (rung.after === 0) continue;
      expect(unlockedDurations(rung.after - 1)).not.toContain(rung.ms);
      expect(unlockedDurations(rung.after)).toContain(rung.ms);
    }
  });

  it('reaches the whole dial and stays there', () => {
    expect(unlockedDurations(100)).toEqual(DURATION_OPTIONS_MS);
  });

  it('never suggests a length that is not yet unlocked', () => {
    /*
      The load-bearing one. Stage one is where the first sitting happens, so its
      suggestion has to be on a dial that has had nothing sat on it. Every later
      stage costs at least SESSIONS_TO_OFFER sittings at the stage before it,
      and the ladder is fully resolved by then — which is what makes the unlocks
      a tutorial that retires itself rather than a gate the app can walk into.
    */
    expect(unlockedDurations(0)).toContain(stageAt(1).suggestedMs);

    const resolved = unlockedDurations(SESSIONS_TO_OFFER);
    for (const stage of STAGES.filter((s) => s.number > 1)) {
      expect(resolved).toContain(stage.suggestedMs);
    }
  });
});
