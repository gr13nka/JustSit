import { Session } from '../../store/types';
import {
  activePractice,
  isPracticeIntroduction,
  practicePathComplete,
  practicePathForStage,
  sessionsAtStage,
  STAGE_ONE_PATH,
} from '../practices';
import { STAGES } from '../stages';

const MINUTE = 60_000;

function sessions(count: number, stage = 1): Session[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `s-${stage}-${i}`,
    startedAt: i,
    durationMs: 2 * MINUTE,
    completedAt: i + 1,
    stage,
    plants: [{ key: 'grass', slot: i }],
  }));
}

describe('stage-one practice path', () => {
  it('keeps practice IDs distinct from the stage tip IDs', () => {
    const tipIds = STAGES.flatMap((stage) => stage.tips.map((tip) => tip.id));
    const practiceIds = STAGE_ONE_PATH.steps.map((step) => step.id);
    expect(new Set([...tipIds, ...practiceIds]).size).toBe(tipIds.length + practiceIds.length);
  });

  it('introduces the ten practices at the planned sitting boundaries', () => {
    expect(STAGE_ONE_PATH.steps.map((step) => step.startsAfter)).toEqual([
      0, 1, 3, 5, 7, 9, 11, 13, 15, 17,
    ]);
    expect(STAGE_ONE_PATH.steps.map((step) => step.durationMs)).toEqual([
      2, 3, 4, 5, 6, 8, 10, 12, 15, 20,
    ].map((minutes) => minutes * MINUTE));
  });

  it('keeps the final practice through the foundation boundary', () => {
    expect(activePractice(STAGE_ONE_PATH, 0).id).toBe('s1-practice-01');
    expect(activePractice(STAGE_ONE_PATH, 1).id).toBe('s1-practice-02');
    expect(activePractice(STAGE_ONE_PATH, 3).id).toBe('s1-practice-03');
    expect(activePractice(STAGE_ONE_PATH, 17).id).toBe('s1-practice-10');
    expect(activePractice(STAGE_ONE_PATH, 20).id).toBe('s1-practice-10');
  });

  it('unlocks free practice exactly after twenty completed sittings', () => {
    expect(practicePathComplete(STAGE_ONE_PATH, 19)).toBe(false);
    expect(practicePathComplete(STAGE_ONE_PATH, 20)).toBe(true);
  });

  it('recognises a newly introduced practice only before it is read', () => {
    const step = STAGE_ONE_PATH.steps[1];
    expect(isPracticeIntroduction(step, 1, [])).toBe(true);
    expect(isPracticeIntroduction(step, 1, [step.id])).toBe(false);
    expect(isPracticeIntroduction(step, 2, [])).toBe(false);
  });

  it('counts only sittings at the requested stage', () => {
    expect(sessionsAtStage([...sessions(3, 1), ...sessions(4, 2)], 1)).toBe(3);
  });

  it('only exposes the pilot path for stage one', () => {
    expect(practicePathForStage(1)).toBe(STAGE_ONE_PATH);
    expect(practicePathForStage(2)).toBeNull();
  });
});
