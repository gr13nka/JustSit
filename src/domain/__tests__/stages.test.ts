import { DURATION_OPTIONS_MS, FINAL_STAGE, stageAt, STAGES } from '../stages';

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
