import {
  mergePersisted,
  migrate,
  PersistedState,
  STORAGE_VERSION,
} from '../persistence';
import { Progress, Session, Settings } from '../types';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

const defaults: PersistedState = {
  sessions: [],
  progress: {
    stage: 1,
    stageStartedAt: 0,
    lastOfferedAt: null,
    seenTipIds: [],
  },
  settings: {
    onboardedAt: null,
    reminderAt: null,
    lastDurationMs: null,
    hideSeconds: true,
  },
};

const session: Session = {
  id: 'seed',
  startedAt: 0,
  durationMs: 600_000,
  completedAt: 600_000,
  stage: 1,
  plant: 'grass',
  slot: 0,
};

/** A v1 session: everything a plant had before dots were addressable. */
function v1Session(id: string, completedAt: number) {
  return {
    id,
    startedAt: completedAt - 600_000,
    durationMs: 600_000,
    completedAt,
    stage: 1,
    plant: 'grass',
  };
}

/**
 * These guard the one failure in this codebase that cannot be undone: a real
 * garden on a real phone, lost on launch because the stored blob predates a
 * field the app now assumes.
 */
describe('migrate', () => {
  it('gives every v1 plant the dot its array position used to mean', () => {
    // Before v2 a plant's position *was* its index, so replaying that order is
    // what makes an existing garden come back looking untouched.
    const v1 = {
      sessions: [v1Session('a', 1), v1Session('b', 2), v1Session('c', 3)],
      progress: defaults.progress,
      settings: defaults.settings,
    };

    const migrated = migrate(v1, 1) as PersistedState;

    expect(migrated.sessions.map((s) => s.slot)).toEqual([0, 1, 2]);
    expect(migrated.sessions.map((s) => s.id)).toEqual(['a', 'b', 'c']);
  });

  it('keeps everything else about a plant exactly as it was', () => {
    const migrated = migrate(
      { sessions: [v1Session('a', 1_700_000_000_000)] },
      1
    ) as PersistedState;

    expect(migrated.sessions[0]).toMatchObject({
      id: 'a',
      plant: 'grass',
      stage: 1,
      completedAt: 1_700_000_000_000,
      durationMs: 600_000,
    });
  });

  it('leaves a current blob alone', () => {
    const current = { sessions: [{ ...v1Session('a', 1), slot: 40 }] };
    const migrated = migrate(current, STORAGE_VERSION) as PersistedState;
    expect(migrated.sessions[0].slot).toBe(40);
  });

  it('does not throw on a blob it cannot read', () => {
    expect(() => migrate(null, 1)).not.toThrow();
    expect(() => migrate('nonsense', 1)).not.toThrow();
    expect(() => migrate({ sessions: 'not an array' }, 1)).not.toThrow();
  });
});

describe('mergePersisted', () => {
  it('keeps a stored garden', () => {
    const merged = mergePersisted({ ...defaults, sessions: [session] }, defaults);
    expect(merged.sessions).toHaveLength(1);
    expect(merged.sessions[0].id).toBe('seed');
  });

  it('fills a settings field the stored blob has never heard of', () => {
    // Exactly the shape written by a build from before `hideSeconds` existed.
    const old = {
      sessions: [session],
      progress: defaults.progress,
      settings: {
        onboardedAt: 1_700_000_000_000,
        reminderAt: '07:30',
        lastDurationMs: 600_000,
      } as unknown as Settings,
    };

    const merged = mergePersisted(old, defaults);

    expect(merged.settings.hideSeconds).toBe(true);
    expect(merged.settings.reminderAt).toBe('07:30');
    expect(merged.settings.onboardedAt).toBe(1_700_000_000_000);
    expect(merged.sessions).toHaveLength(1);
  });

  it('fills a progress field the stored blob has never heard of', () => {
    const old = {
      progress: { stage: 4, stageStartedAt: 123 } as unknown as Progress,
    };

    const merged = mergePersisted(old, defaults);

    expect(merged.progress.stage).toBe(4);
    expect(merged.progress.seenTipIds).toEqual([]);
    expect(merged.progress.lastOfferedAt).toBeNull();
  });

  it('lets a stored value win over its default', () => {
    const merged = mergePersisted(
      { settings: { ...defaults.settings, hideSeconds: false } },
      defaults
    );
    expect(merged.settings.hideSeconds).toBe(false);
  });

  it('survives an empty or unreadable blob rather than throwing', () => {
    // A corrupt read should leave a usable empty garden, not a permanent splash.
    expect(mergePersisted(undefined, defaults)).toEqual(defaults);
    expect(mergePersisted(null, defaults)).toEqual(defaults);
    expect(mergePersisted({}, defaults)).toEqual(defaults);
  });
});
