import { STARTER_GARDEN } from '../../domain/plots';
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
    gardenSize: STARTER_GARDEN,
  },
  settings: {
    onboardedAt: null,
    lastGreetedAt: null,
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
 * Version 4 is the one migration in this codebase that throws a garden away,
 * and these pin that it really does — a half-migration that left an old shape
 * standing would be worse than either outcome.
 *
 * `migrate` is only half of the story: it hands back an empty blob and
 * `mergePersisted` lays the defaults down over it. `hydration.test.ts` is where
 * the two are watched doing it together, from a real cold launch.
 */
describe('migrate', () => {
  it('throws away a v1 blob rather than trying to read it forward', () => {
    // The ladder has nowhere to put an old garden: a sequence of beds flattened
    // into one is the sum of their sizes, and that is not a rung. Nothing has
    // shipped, so there is no phone holding the garden this discards.
    const v1 = {
      sessions: [v1Session('a', 1), v1Session('b', 2), v1Session('c', 3)],
      progress: { ...defaults.progress, stage: 4 },
      settings: { ...defaults.settings, onboardedAt: 700 },
    };

    expect(migrate(v1, 1)).toEqual({});
  });

  it('throws away a v2 blob the same way', () => {
    const v2 = { sessions: [v2Session('a', 0, 'poppy'), v2Session('b', 1, 'fern')] };
    expect(migrate(v2, 2)).toEqual({});
  });

  it('throws away a v3 blob, gardens, notebook and all', () => {
    // The version this one replaces, and the only one anybody has actually run.
    const v3 = {
      sessions: [{ ...session, plants: [{ key: 'poppy', slot: 40 }] }],
      notes: [caught],
      progress: { ...defaults.progress, stage: 4 },
      settings: { ...defaults.settings, onboardedAt: 700 },
    };

    expect(migrate(v3, 3)).toEqual({});
  });

  it('leaves a current blob exactly as it is', () => {
    const current = { sessions: [{ ...session, plants: [{ key: 'poppy', slot: 40 }] }] };
    const migrated = migrate(current, STORAGE_VERSION) as PersistedState;
    expect(migrated.sessions[0].plants).toEqual([{ key: 'poppy', slot: 40 }]);
  });

  it('passes a blob from a future version through untouched', () => {
    // A downgrade. There is nothing sensible to do to it here, and the merge's
    // own guards are what keep the app standing on whatever it holds.
    const ahead = { sessions: [session] };
    expect(migrate(ahead, STORAGE_VERSION + 1)).toBe(ahead);
  });

  it('does not throw on a blob it cannot read', () => {
    expect(() => migrate(null, 1)).not.toThrow();
    expect(() => migrate('nonsense', 1)).not.toThrow();
    expect(() => migrate({ sessions: 'not an array' }, 3)).not.toThrow();
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

  it('has never greeted a garden grown before the welcome screen existed', () => {
    // The field it needs is a timestamp, so `undefined` is not harmlessly
    // falsy here the way a missing boolean would be: `shouldGreet` asks whether
    // the stored day is today's, and a day derived from nothing is not a day.
    // Null is the sentinel that means never, and it is what the merge must lay
    // down — so an existing install meets the screen once, on its next open,
    // rather than never or every time.
    const old = {
      settings: {
        onboardedAt: 1_700_000_000_000,
        reminderAt: null,
        lastDurationMs: null,
        hideSeconds: true,
        theme: 'ink',
        devMode: false,
      } as unknown as Settings,
    };

    const merged = mergePersisted(old, defaults);

    expect(merged.settings.lastGreetedAt).toBeNull();
    expect(merged.settings.onboardedAt).toBe(1_700_000_000_000);
  });

  it('fills a progress field the stored blob has never heard of', () => {
    const old = {
      progress: { stage: 4, stageStartedAt: 123 } as unknown as Progress,
    };

    const merged = mergePersisted(old, defaults);

    expect(merged.progress.stage).toBe(4);
    expect(merged.progress.seenTipIds).toEqual([]);
    expect(merged.progress.lastOfferedAt).toBeNull();
    // A garden is the one thing here that must never come back as nothing.
    expect(merged.progress.gardenSize).toBe(STARTER_GARDEN);
  });

  it('gives a blob with no bed, or an unreadable one, the default', () => {
    // Belt and braces beside the migration: the grid lays out one cell per dot,
    // and there is no sensible field to draw for a size that is not a size.
    for (const gardenSize of [undefined, 0, -12, 'nonsense', null, NaN]) {
      const merged = mergePersisted(
        { progress: { ...defaults.progress, gardenSize } as unknown as Progress },
        defaults
      );
      expect(merged.progress.gardenSize).toBe(STARTER_GARDEN);
    }
  });

  it('lets a stored bed win over the default', () => {
    const merged = mergePersisted(
      { progress: { ...defaults.progress, gardenSize: 36 } },
      defaults
    );
    expect(merged.progress.gardenSize).toBe(36);
  });

  it('lets a stored value win over its default', () => {
    const merged = mergePersisted(
      { settings: { ...defaults.settings, hideSeconds: false } },
      defaults
    );
    expect(merged.settings.hideSeconds).toBe(false);
  });

  it('returns removed themes to ink', () => {
    const merged = mergePersisted(
      { settings: { ...defaults.settings, theme: 'butter' } as unknown as Settings },
      defaults
    );
    expect(merged.settings.theme).toBe('ink');
  });

  /**
   * Every blob the app has ever written carries a notebook, so this shape
   * should not reach the store. The default is here for the one that arrives
   * without the key anyway — a write cut in half — because zustand's shallow
   * merge would otherwise hand the store an `undefined` the notes screen would
   * map over.
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
   * The same default applied to `plants`, and the one with teeth:
   * `currentPlot` walks that list for every session on every render, so a
   * session that reached the store without one would take the garden down
   * rather than draw it short.
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
