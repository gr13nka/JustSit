/**
 * Launching on a garden written by an older version, end to end.
 *
 * `persistence.test.ts` covers `migrate` and `mergePersisted` as pieces. This
 * covers the composition — read → migrate → merge → store — because that is
 * where a garden is actually lost, and losing one is not recoverable.
 */

import { nextFreeSlot, STARTER_GARDEN } from '../../domain/plots';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

const STORAGE_KEY = 'justsit/v1';

/** A plant as it was stored before dots became addressable. Note: no `slot`. */
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

/** Byte-for-byte what zustand's persist middleware left on disk at version 1. */
const V1_BLOB = JSON.stringify({
  state: {
    sessions: [v1Session('a', 1_000), v1Session('b', 2_000), v1Session('c', 3_000)],
    progress: { stage: 2, stageStartedAt: 500, lastOfferedAt: null, seenTipIds: ['s1-01'] },
    settings: { onboardedAt: 700, reminderAt: '07:30', lastDurationMs: 600_000 },
  },
  version: 1,
});

/** A plant as it was stored at version 2: one hashed species, in one dot. */
function v2Session(id: string, slot: number, plant: string) {
  return { ...v1Session(id, slot * 1_000 + 1_000), plant, slot };
}

/**
 * Version 2, mid-plot: a mala and a half of real sittings, so the reconstructed
 * gardens have to cover a finished 108 as well as the one being filled.
 */
const V2_BLOB = JSON.stringify({
  state: {
    sessions: [
      v2Session('a', 0, 'poppy'),
      v2Session('b', 1, 'fern'),
      v2Session('c', 107, 'grass'),
      v2Session('d', 108, 'berry'),
      v2Session('e', 109, 'clover'),
    ],
    progress: { stage: 3, stageStartedAt: 500, lastOfferedAt: null, seenTipIds: ['s2-01'] },
    settings: { onboardedAt: 700, reminderAt: '07:30', lastDurationMs: 600_000, theme: 'butter' },
  },
  version: 2,
});

/** A sitting as it is stored today: a list of plants, each in its own dot. */
function v3Session(id: string, startedAt: number, slot: number, plant: string) {
  return {
    id,
    startedAt,
    durationMs: 600_000,
    completedAt: startedAt + 600_000,
    stage: 1,
    plants: [{ key: plant, slot }],
  };
}

/**
 * Today's shape, with a notebook in it.
 *
 * The notebook and version 3 are one change, so this is what every phone
 * carrying a 3 has: a `notes` key, whether or not anything is in it.
 */
const V3_BLOB = JSON.stringify({
  state: {
    sessions: [v3Session('a', 1_000, 0, 'poppy'), v3Session('b', 700_000, 1, 'fern')],
    notes: [
      { id: 'n1', body: 'call the dentist', createdAt: 1_500, sittingStartedAt: 1_000 },
      { id: 'n2', body: 'rain on the window', createdAt: 900_000 },
    ],
    progress: { stage: 2, stageStartedAt: 500, lastOfferedAt: null, seenTipIds: [], gardens: [9] },
    settings: { onboardedAt: 700, reminderAt: null, lastDurationMs: 600_000, hideSeconds: true, theme: 'ink' },
  },
  version: 3,
});

/**
 * A version 3 blob with no `notes` key at all.
 *
 * No build has written one — the notebook shipped with the version — so this is
 * the shape nothing on a real phone should have. It is here because
 * `mergePersisted` defaults it anyway, and a default nothing exercises is a
 * default nobody knows still works: a blob half-written or a migration that did
 * not run would arrive exactly like this, and the notebook has to survive it.
 */
const V3_BLOB_WITHOUT_NOTES = JSON.stringify({
  state: {
    sessions: [v3Session('a', 1_000, 0, 'poppy')],
    progress: { stage: 1, stageStartedAt: 500, lastOfferedAt: null, seenTipIds: [], gardens: [9] },
    settings: { onboardedAt: 700, reminderAt: null, lastDurationMs: 600_000, hideSeconds: true, theme: 'ink' },
  },
  version: 3,
});

/**
 * A cold launch: the module graph is evaluated once, exactly as it is on a real
 * start, against whatever is already on disk.
 */
async function launchWith(blob: string | null) {
  jest.resetModules();

  // The jest mock is a plain CJS export; a real build hands back `.default`.
  const mod = require('@react-native-async-storage/async-storage');
  const AsyncStorage = mod.default ?? mod;

  await AsyncStorage.clear();
  if (blob !== null) await AsyncStorage.setItem(STORAGE_KEY, blob);

  const store = require('../index');

  for (let i = 0; i < 100 && !store.getState().hydrated; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  if (!store.getState().hydrated) throw new Error('the store never finished hydrating');

  return store;
}

type Stored = {
  id: string;
  plants: { key: string; slot: number }[];
};

describe('a cold launch on a version 1 garden', () => {
  it('brings every plant back, in the dots array order used to mean', async () => {
    // The whole chain, v1 → v2 → v3, on the blob a real install left behind.
    const store = await launchWith(V1_BLOB);
    const { sessions } = store.getState();

    expect(sessions.map((s: Stored) => s.id)).toEqual(['a', 'b', 'c']);
    expect(sessions.map((s: Stored) => s.plants[0].slot)).toEqual([0, 1, 2]);
    expect(sessions.every((s: Stored) => s.plants.length === 1)).toBe(true);
  });

  it('comes back in a garden big enough to hold it', async () => {
    const store = await launchWith(V1_BLOB);
    expect(store.getState().progress.gardens).toEqual([108]);
  });

  it('keeps the rest of the user and defaults only what did not exist yet', async () => {
    const store = await launchWith(V1_BLOB);
    const { progress, settings } = store.getState();

    expect(progress.stage).toBe(2);
    expect(progress.seenTipIds).toEqual(['s1-01']);
    expect(settings.onboardedAt).toBe(700);
    expect(settings.reminderAt).toBe('07:30');
    expect(settings.lastDurationMs).toBe(600_000);
    // The fields version 1 had never heard of.
    expect(settings.hideSeconds).toBe(true);
    expect(settings.devMode).toBe(false);
  });

  it('does not send a returning user back through onboarding', async () => {
    // The redirect keys off this being null. Getting it wrong would look, to
    // someone with a two-year garden, exactly like the app forgetting them.
    const store = await launchWith(V1_BLOB);
    expect(store.getState().settings.onboardedAt).not.toBeNull();
  });
});

describe('a cold launch on a version 2 garden', () => {
  it('wraps every plant into the list a sitting now holds', async () => {
    const store = await launchWith(V2_BLOB);
    const { sessions } = store.getState();

    expect(sessions.map((s: Stored) => s.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(sessions.map((s: Stored) => s.plants[0].key)).toEqual([
      'poppy',
      'fern',
      'grass',
      'berry',
      'clover',
    ]);
    expect(sessions.map((s: Stored) => s.plants[0].slot)).toEqual([0, 1, 107, 108, 109]);
  });

  it('rebuilds the gardens it was grown in, the finished one and the open one', async () => {
    // Every garden was a mala before sizes were a choice, and the one being
    // filled stays a mala rather than being retrofitted to a size nobody chose.
    const store = await launchWith(V2_BLOB);
    expect(store.getState().progress.gardens).toEqual([108, 108]);
  });

  it('carries on planting where the garden actually left off', async () => {
    const store = await launchWith(V2_BLOB);
    const { sessions, progress } = store.getState();
    expect(nextFreeSlot(sessions, progress.gardens)).toBe(110);
  });

  it('keeps the rest of the user untouched', async () => {
    const store = await launchWith(V2_BLOB);
    const { progress, settings } = store.getState();

    expect(progress.stage).toBe(3);
    expect(progress.seenTipIds).toEqual(['s2-01']);
    expect(settings.theme).toBe('butter');
    expect(settings.onboardedAt).toBe(700);
  });
});

describe('a cold launch with nothing to read', () => {
  it('is an empty garden that has not been onboarded', async () => {
    const store = await launchWith(null);

    expect(store.getState().sessions).toHaveLength(0);
    expect(store.getState().settings.onboardedAt).toBeNull();
    expect(store.getState().settings.hideSeconds).toBe(true);
  });

  it('opens on the starter bed rather than a mala', async () => {
    const store = await launchWith(null);
    expect(store.getState().progress.gardens).toEqual([STARTER_GARDEN]);
  });

  it('leaves a usable app rather than a permanent splash when the blob is corrupt', async () => {
    const store = await launchWith('{ this is not json');

    expect(store.getState().hydrated).toBe(true);
    expect(store.getState().sessions).toHaveLength(0);
    expect(store.getState().progress.gardens).toEqual([STARTER_GARDEN]);
  });
});

describe('the notebook, across every version ever written', () => {
  it('comes back empty on a version 1 garden', async () => {
    const store = await launchWith(V1_BLOB);
    expect(store.getState().notes).toEqual([]);
  });

  it('comes back empty on a version 2 garden', async () => {
    const store = await launchWith(V2_BLOB);
    expect(store.getState().notes).toEqual([]);
  });

  it('comes back empty on a version 3 blob that somehow has no notebook', async () => {
    // Not a shape any build wrote — the point is that the default holds even
    // so, and that the garden in the same blob still comes back.
    const store = await launchWith(V3_BLOB_WITHOUT_NOTES);
    expect(store.getState().notes).toEqual([]);
    expect(store.getState().sessions).toHaveLength(1);
  });

  it('comes back empty on a fresh install', async () => {
    const store = await launchWith(null);
    expect(store.getState().notes).toEqual([]);
  });

  it('round-trips a notebook that has something in it', async () => {
    const store = await launchWith(V3_BLOB);
    const { notes, sessions } = store.getState();

    expect(notes.map((n: { id: string }) => n.id)).toEqual(['n1', 'n2']);
    expect(notes[0].body).toBe('call the dentist');
    // The link is by when the sitting began, and it has to survive the disk.
    expect(notes[0].sittingStartedAt).toBe(sessions[0].startedAt);
    // A note written outside a sitting keeps pointing at nothing.
    expect(notes[1].sittingStartedAt).toBeUndefined();
  });
});
