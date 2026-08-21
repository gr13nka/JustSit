import { PLOT_SIZE, STARTER_GARDEN } from '../../domain/plots';
import {
  mergePersisted,
  migrate,
  PersistedState,
  STORAGE_VERSION,
} from '../persistence';
import { Note, Progress, Session, Settings } from '../types';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

const defaults: PersistedState = {
  sessions: [],
  notes: [],
  progress: {
    stage: 1,
    stageStartedAt: 0,
    lastOfferedAt: null,
    seenTipIds: [],
    gardens: [STARTER_GARDEN],
  },
  settings: {
    onboardedAt: null,
    reminderAt: null,
    lastDurationMs: null,
    hideSeconds: true,
    theme: 'ink',
    devMode: false,
  },
};

const session: Session = {
  id: 'seed',
  startedAt: 0,
  durationMs: 600_000,
  completedAt: 600_000,
  stage: 1,
  plants: [{ key: 'grass', slot: 0 }],
};

const caught: Note = {
  id: 'n1',
  body: 'the shoulders again',
  createdAt: 300_000,
  sittingStartedAt: 0,
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

/** A v2 session: one hashed plant, in the dot it was given. */
function v2Session(id: string, slot: number, plant = 'grass') {
  return { ...v1Session(id, slot * 1_000 + 1), plant, slot };
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

    expect(migrated.sessions.map((s) => s.plants[0].slot)).toEqual([0, 1, 2]);
    expect(migrated.sessions.map((s) => s.id)).toEqual(['a', 'b', 'c']);
  });

  it('keeps everything else about a plant exactly as it was', () => {
    const migrated = migrate(
      { sessions: [v1Session('a', 1_700_000_000_000)] },
      1
    ) as PersistedState;

    expect(migrated.sessions[0]).toMatchObject({
      id: 'a',
      stage: 1,
      completedAt: 1_700_000_000_000,
      durationMs: 600_000,
    });
    expect(migrated.sessions[0].plants).toEqual([{ key: 'grass', slot: 0 }]);
  });

  it('leaves a current blob alone', () => {
    const current = { sessions: [{ ...session, plants: [{ key: 'poppy', slot: 40 }] }] };
    const migrated = migrate(current, STORAGE_VERSION) as PersistedState;
    expect(migrated.sessions[0].plants).toEqual([{ key: 'poppy', slot: 40 }]);
  });

  /**
   * v3 made a sitting worth a choice of plants and a garden a size the user
   * picks. Both halves are a re-reading of what was already stored, so nothing
   * a v2 blob holds may come out of it changed.
   */
  it('wraps every v2 plant into the one-plant list it always was', () => {
    const v2 = {
      sessions: [v2Session('a', 0, 'poppy'), v2Session('b', 1, 'fern')],
      progress: { ...defaults.progress, stage: 4 },
    };

    const migrated = migrate(v2, 2) as PersistedState;

    expect(migrated.sessions.map((s) => s.plants)).toEqual([
      [{ key: 'poppy', slot: 0 }],
      [{ key: 'fern', slot: 1 }],
    ]);
    expect(migrated.progress.stage).toBe(4);
  });

  it('leaves nothing of the old shape behind', () => {
    const migrated = migrate({ sessions: [v2Session('a', 5)] }, 2) as PersistedState;
    const stored = migrated.sessions[0] as unknown as Record<string, unknown>;

    expect(stored.plant).toBeUndefined();
    expect(stored.slot).toBeUndefined();
  });

  it('rebuilds the gardens a v2 blob was grown in, all of them 108', () => {
    // Every garden was a mala back then. The open one stays a 108 rather than
    // being retrofitted to a size nobody chose.
    const one = migrate({ sessions: [v2Session('a', 7)] }, 2) as PersistedState;
    expect(one.progress.gardens).toEqual([PLOT_SIZE]);

    const three = migrate(
      { sessions: [v2Session('a', 0), v2Session('b', PLOT_SIZE * 2 + 4)] },
      2
    ) as PersistedState;
    expect(three.progress.gardens).toEqual([PLOT_SIZE, PLOT_SIZE, PLOT_SIZE]);
  });

  it('gives a garden nobody has sat in the starter bed', () => {
    const migrated = migrate({ sessions: [] }, 2) as PersistedState;
    expect(migrated.progress.gardens).toEqual([STARTER_GARDEN]);
  });

  it("runs the whole chain, so a v1 blob lands on today's shape", () => {
    const v1 = { sessions: [v1Session('a', 1), v1Session('b', 2)] };
    const migrated = migrate(v1, 1) as PersistedState;

    expect(migrated.sessions.map((s) => s.plants)).toEqual([
      [{ key: 'grass', slot: 0 }],
      [{ key: 'grass', slot: 1 }],
    ]);
    expect(migrated.progress.gardens).toEqual([PLOT_SIZE]);
  });

  it("keeps a malformed plant rather than dropping someone's sitting", () => {
    const broken = { sessions: [{ id: 'a', completedAt: 1 }, { id: 'b', plant: 7 }] };
    const migrated = migrate(broken, 2) as PersistedState;

    expect(migrated.sessions).toHaveLength(2);
    expect(migrated.sessions.map((s) => s.plants[0].slot)).toEqual([0, 1]);
    expect(migrated.sessions.every((s) => typeof s.plants[0].key === 'string')).toBe(true);
  });

  it('does not throw on a blob it cannot read', () => {
    expect(() => migrate(null, 1)).not.toThrow();
    expect(() => migrate('nonsense', 1)).not.toThrow();
    expect(() => migrate({ sessions: 'not an array' }, 1)).not.toThrow();
    expect(() => migrate({ sessions: 'not an array' }, 2)).not.toThrow();
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
    // A garden grown before there were themes comes back wearing the default
    // one rather than `undefined`, which would resolve to no palette at all.
    expect(merged.settings.theme).toBe('ink');
    // And the developer switch arrives off rather than `undefined`, which is
    // falsy today and would still be the wrong thing to store.
    expect(merged.settings.devMode).toBe(false);
  });

  it('fills a progress field the stored blob has never heard of', () => {
    const old = {
      progress: { stage: 4, stageStartedAt: 123 } as unknown as Progress,
    };

    const merged = mergePersisted(old, defaults);

    expect(merged.progress.stage).toBe(4);
    expect(merged.progress.seenTipIds).toEqual([]);
    expect(merged.progress.lastOfferedAt).toBeNull();
    // A garden is the one thing here that must never come back empty.
    expect(merged.progress.gardens).toEqual([STARTER_GARDEN]);
  });

  it('gives a blob with no gardens, or an unreadable one, the default', () => {
    // Belt and braces beside the migration: every plot arithmetic in the app
    // divides by these, and there is no sensible answer for none of them.
    for (const gardens of [undefined, [], 'nonsense', null]) {
      const merged = mergePersisted(
        { progress: { ...defaults.progress, gardens } as unknown as Progress },
        defaults
      );
      expect(merged.progress.gardens).toEqual([STARTER_GARDEN]);
    }
  });

  it('lets a stored sequence of gardens win over the default', () => {
    const merged = mergePersisted(
      { progress: { ...defaults.progress, gardens: [3, 9, 27] } },
      defaults
    );
    expect(merged.progress.gardens).toEqual([3, 9, 27]);
  });

  it('lets a stored value win over its default', () => {
    const merged = mergePersisted(
      { settings: { ...defaults.settings, hideSeconds: false } },
      defaults
    );
    expect(merged.settings.hideSeconds).toBe(false);
  });

  /**
   * The notebook and version 3 are one change, so no phone carries a blob that
   * predates it. The default is here for the blob that arrives without the key
   * anyway — a migration that did not run, a write cut in half — because
   * zustand's shallow merge would otherwise hand the store an `undefined` the
   * notes screen would map over.
   */
  it('gives a blob with no notebook in it an empty one', () => {
    const old = {
      sessions: [session],
      progress: defaults.progress,
      settings: defaults.settings,
    };

    expect(mergePersisted(old, defaults).notes).toEqual([]);
  });

  it('keeps a stored notebook', () => {
    const merged = mergePersisted({ ...defaults, notes: [caught] }, defaults);
    expect(merged.notes).toEqual([caught]);
  });

  it('defaults an unreadable notebook rather than passing it on', () => {
    for (const notes of [undefined, null, 'nonsense', 7]) {
      const merged = mergePersisted(
        { ...defaults, notes } as unknown as PersistedState,
        defaults
      );
      expect(merged.notes).toEqual([]);
    }
  });

  /**
   * The same default applied to `plants`, and the one with teeth: `plotAt`
   * walks that list for every session on every render, so a session that
   * reached the store without one would take the garden down rather than draw
   * it short.
   */
  it('gives a session with no plants an empty list', () => {
    const broken = { ...session, plants: undefined } as unknown as Session;
    const merged = mergePersisted({ ...defaults, sessions: [broken] }, defaults);

    expect(merged.sessions[0].plants).toEqual([]);
    expect(merged.sessions[0].id).toBe('seed');
  });

  it('leaves a session that has its plants exactly as it was', () => {
    const merged = mergePersisted({ ...defaults, sessions: [session] }, defaults);
    expect(merged.sessions[0]).toBe(session);
  });

  it('defaults an unreadable session list rather than mapping over it', () => {
    for (const sessions of [undefined, null, 'nonsense', 7]) {
      const merged = mergePersisted(
        { ...defaults, sessions } as unknown as PersistedState,
        defaults
      );
      expect(merged.sessions).toEqual([]);
    }
  });

  it('survives an empty or unreadable blob rather than throwing', () => {
    // A corrupt read should leave a usable empty garden, not a permanent splash.
    expect(mergePersisted(undefined, defaults)).toEqual(defaults);
    expect(mergePersisted(null, defaults)).toEqual(defaults);
    expect(mergePersisted({}, defaults)).toEqual(defaults);
  });
});
