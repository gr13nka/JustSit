import { isKnownPlant } from '../../domain/plants';
import { PLOT_SIZE } from '../../domain/plots';
import { stageAt } from '../../domain/stages';
import { Session } from '../types';
import {
  __replaceState,
  __reset,
  completeOnboarding,
  getState,
  markTipSeen,
  noteAdvanceOffered,
  recordCompletedSession,
  setStage,
  updateSettings,
} from '../index';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

const TEN_MIN = 600_000;

/** A plant already in the ground, for setting up a garden to sit into. */
function seeded(id: string, slot: number): Session {
  return {
    id,
    startedAt: 0,
    durationMs: TEN_MIN,
    completedAt: TEN_MIN,
    stage: 1,
    plant: 'grass',
    slot,
  };
}

beforeEach(() => {
  __reset();
});

describe('recordCompletedSession', () => {
  it('grows exactly one plant', () => {
    recordCompletedSession({ startedAt: Date.now(), durationMs: TEN_MIN });
    expect(getState().sessions).toHaveLength(1);
  });

  it('assigns a species we have art for, and stores it rather than deriving it', () => {
    const session = recordCompletedSession({
      startedAt: Date.now(),
      durationMs: TEN_MIN,
    });
    expect(isKnownPlant(session.plant)).toBe(true);
    expect(getState().sessions[0].plant).toBe(session.plant);
  });

  it('stamps the stage the user was actually on', () => {
    setStage(3);
    const session = recordCompletedSession({
      startedAt: Date.now(),
      durationMs: TEN_MIN,
    });
    expect(session.stage).toBe(3);
  });

  it('remembers the chosen duration for next time', () => {
    recordCompletedSession({ startedAt: Date.now(), durationMs: 30 * 60_000 });
    expect(getState().settings.lastDurationMs).toBe(30 * 60_000);
  });

  it('gives distinct ids to sittings started in the same millisecond', () => {
    const at = Date.now();
    const a = recordCompletedSession({ startedAt: at, durationMs: TEN_MIN });
    const b = recordCompletedSession({ startedAt: at, durationMs: TEN_MIN });
    expect(a.id).not.toBe(b.id);
  });

  it('appends, so the garden stays in the order things grew', () => {
    const first = recordCompletedSession({ startedAt: 1, durationMs: TEN_MIN });
    const second = recordCompletedSession({ startedAt: 2, durationMs: TEN_MIN });
    expect(getState().sessions.map((s) => s.id)).toEqual([first.id, second.id]);
  });
});

describe('the dot a plant grows in', () => {
  it('is the one the user tapped', () => {
    const session = recordCompletedSession({
      startedAt: Date.now(),
      durationMs: TEN_MIN,
      slot: 42,
    });
    expect(session.slot).toBe(42);
    expect(getState().sessions[0].slot).toBe(42);
  });

  it('is the first free dot when nobody picked one', () => {
    __replaceState({ sessions: [seeded('a', 0), seeded('b', 1)] });
    const session = recordCompletedSession({
      startedAt: Date.now(),
      durationMs: TEN_MIN,
    });
    expect(session.slot).toBe(2);
  });

  it('never lands on a plant that is already there', () => {
    // The slot rides a route param through a whole sitting; it can go stale.
    __replaceState({ sessions: [seeded('a', 7)] });
    const session = recordCompletedSession({
      startedAt: Date.now(),
      durationMs: TEN_MIN,
      slot: 7,
    });
    expect(session.slot).not.toBe(7);
    expect(getState().sessions).toHaveLength(2);
    expect(getState().sessions.filter((s) => s.slot === 7)).toHaveLength(1);
  });

  it('never lands in a plot that is already finished', () => {
    const full = Array.from({ length: PLOT_SIZE }, (_, i) => seeded(`s${i}`, i));
    __replaceState({ sessions: full });

    // A dot from the archived plot — free there, but that plot is closed.
    const session = recordCompletedSession({
      startedAt: Date.now(),
      durationMs: TEN_MIN,
      slot: 3,
    });
    expect(session.slot).toBe(PLOT_SIZE);
  });

  it('shrugs off a slot that is not a usable number', () => {
    // `Number(params.slot)` yields NaN when the param never arrived.
    const session = recordCompletedSession({
      startedAt: Date.now(),
      durationMs: TEN_MIN,
      slot: Number.NaN,
    });
    expect(session.slot).toBe(0);
  });
});

describe('an abandoned sitting', () => {
  it('leaves the garden untouched', () => {
    // Quitting early simply never reaches recordCompletedSession — the garden
    // has no concept of a partial session, which is what keeps it honest.
    expect(getState().sessions).toHaveLength(0);
    expect(getState().settings.lastDurationMs).toBeNull();
  });
});

describe('setStage', () => {
  it('restarts the stage clock', () => {
    const before = Date.now();
    setStage(2);
    expect(getState().progress.stage).toBe(2);
    expect(getState().progress.stageStartedAt).toBeGreaterThanOrEqual(before);
  });

  it('clears a previous decline, so the new stage is judged fresh', () => {
    noteAdvanceOffered();
    expect(getState().progress.lastOfferedAt).not.toBeNull();
    setStage(2);
    expect(getState().progress.lastOfferedAt).toBeNull();
  });

  it('drops the remembered duration so the new stage’s suggestion is heard', () => {
    updateSettings({ lastDurationMs: 5 * 60_000 });
    setStage(4);
    expect(getState().settings.lastDurationMs).toBeNull();
    // Which means the dial now opens on what stage four proposes.
    expect(stageAt(4).suggestedMs).toBe(15 * 60_000);
  });

  it('keeps tips already seen, so revisiting a stage does not replay them', () => {
    markTipSeen('s1-01');
    setStage(2);
    setStage(1);
    expect(getState().progress.seenTipIds).toContain('s1-01');
  });
});

describe('markTipSeen', () => {
  it('records a tip once', () => {
    markTipSeen('s1-01');
    markTipSeen('s1-01');
    expect(getState().progress.seenTipIds).toEqual(['s1-01']);
  });
});

describe('completeOnboarding', () => {
  it('starts the stage clock at that moment, not at install', () => {
    expect(getState().progress.stageStartedAt).toBe(0);
    completeOnboarding();
    expect(getState().settings.onboardedAt).not.toBeNull();
    expect(getState().progress.stageStartedAt).toBeGreaterThan(0);
  });
});

describe('__reset', () => {
  it('returns a fresh install', () => {
    recordCompletedSession({ startedAt: Date.now(), durationMs: TEN_MIN });
    setStage(5);
    __reset();
    expect(getState().sessions).toHaveLength(0);
    expect(getState().progress.stage).toBe(1);
    expect(getState().settings.onboardedAt).toBeNull();
  });
});

describe('__replaceState', () => {
  it('can seed a garden without going through the session flow', () => {
    __replaceState({ sessions: [seeded('seed', 0)] });
    expect(getState().sessions).toHaveLength(1);
  });
});
