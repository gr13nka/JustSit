/**
 * Launching on a garden written by an older version, end to end.
 *
 * `persistence.test.ts` covers `migrate` and `mergePersisted` as pieces. This
 * covers the composition — read → migrate → merge → store — because that is
 * where a garden is actually lost.
 *
 * At version 4 losing it is the *intended* outcome for anything older, which is
 * why these read the way they do. The wipe is a one-time licence taken before
 * the app had users: the ladder has nowhere to put a bed that is the sum of a
 * sequence of old ones, and nobody is holding such a garden. What still has to
 * be true is that the wipe is complete and leaves a usable app — a blob half
 * carried forward would be worse than either outcome — and that a version-4
 * garden comes back untouched.
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

/** Version 2, mid-plot: a mala and a half of real sittings. */
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

/** A sitting as it is stored: a list of plants, each in its own dot. */
function session(id: string, startedAt: number, slot: number, plant: string) {
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
 * Version 3: a sequence of gardens, and a notebook.
 *
 * The only shape anybody has actually run, and the one version 4 throws away.
 * Its `gardens` array is exactly what has nowhere to go on a ladder of one
 * growing bed.
 */
const V3_BLOB = JSON.stringify({
  state: {
    sessions: [session('a', 1_000, 0, 'poppy'), session('b', 700_000, 1, 'fern')],
    notes: [
      { id: 'n1', body: 'call the dentist', createdAt: 1_500, sittingStartedAt: 1_000 },
      { id: 'n2', body: 'rain on the window', createdAt: 900_000 },
    ],
    progress: { stage: 2, stageStartedAt: 500, lastOfferedAt: null, seenTipIds: [], gardens: [3, 9] },
    settings: { onboardedAt: 700, reminderAt: null, lastDurationMs: 600_000, hideSeconds: true, theme: 'ink' },
  },
  version: 3,
});

/** Today's shape: one bed, one number for how big it is. */
const V4_BLOB = JSON.stringify({
  state: {
    sessions: [session('a', 1_000, 0, 'poppy'), session('b', 700_000, 1, 'fern')],
    notes: [
      { id: 'n1', body: 'call the dentist', createdAt: 1_500, sittingStartedAt: 1_000 },
      { id: 'n2', body: 'rain on the window', createdAt: 900_000 },
    ],
    progress: { stage: 2, stageStartedAt: 500, lastOfferedAt: null, seenTipIds: ['s2-01'], gardenSize: 12 },
    settings: { onboardedAt: 700, reminderAt: '07:30', lastDurationMs: 600_000, hideSeconds: true, theme: 'butter' },
  },
  version: 4,
});

/**
 * A version 4 blob with no `notes` key at all.
 *
 * No build has written one — the notebook predates the version — so this is a
 * shape nothing on a real phone should have. It is here because
 * `mergePersisted` defaults it anyway, and a default nothing exercises is a
 * default nobody knows still works: a write cut in half would arrive exactly
 * like this, and the notebook has to survive it.
 */
const V4_BLOB_WITHOUT_NOTES = JSON.stringify({
  state: {
    sessions: [session('a', 1_000, 0, 'poppy')],
    progress: { stage: 1, stageStartedAt: 500, lastOfferedAt: null, seenTipIds: [], gardenSize: 6 },
    settings: { onboardedAt: 700, reminderAt: null, lastDurationMs: 600_000, hideSeconds: true, theme: 'ink' },
  },
  version: 4,
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

describe.each([
  ['version 1', V1_BLOB],
  ['version 2', V2_BLOB],
  ['version 3', V3_BLOB],
])('a cold launch on a %s garden', (_version, blob) => {
  it('comes back with nothing in the ground', async () => {
    const store = await launchWith(blob);
    expect(store.getState().sessions).toEqual([]);
    expect(store.getState().notes).toEqual([]);
  });

  it('opens on the starter bed rather than on whatever it used to hold', async () => {
    const store = await launchWith(blob);
    expect(store.getState().progress.gardenSize).toBe(STARTER_GARDEN);
    expect(nextFreeSlot(store.getState().sessions, STARTER_GARDEN)).toBe(0);
  });

  it('lands on onboarding, because there is no user left to be returning', async () => {
    // The redirect keys off `onboardedAt` being null. A wipe that kept it would
    // drop somebody into an empty garden with no explanation of it.
    const store = await launchWith(blob);
    expect(store.getState().settings.onboardedAt).toBeNull();
    expect(store.getState().progress.stageStartedAt).toBe(0);
  });

  it('leaves nothing of the old shape behind, in any field', async () => {
    // A half-carried blob is worse than either outcome: the stage, the tips and
    // the settings all go with the garden.
    const store = await launchWith(blob);
    const { progress, settings } = store.getState();

    expect(progress.stage).toBe(1);
    expect(progress.seenTipIds).toEqual([]);
    expect(settings.reminderAt).toBeNull();
    expect(settings.lastDurationMs).toBeNull();
    expect(settings.theme).toBe('ink');
    expect(settings.devMode).toBe(false);
    expect((progress as Record<string, unknown>).gardens).toBeUndefined();
  });
});

describe('a cold launch on a version 4 garden', () => {
  it('brings every plant back in the dot it was planted in', async () => {
    const store = await launchWith(V4_BLOB);
    const { sessions } = store.getState();

    expect(sessions.map((s: Stored) => s.id)).toEqual(['a', 'b']);
    expect(sessions.map((s: Stored) => s.plants[0].key)).toEqual(['poppy', 'fern']);
    expect(sessions.map((s: Stored) => s.plants[0].slot)).toEqual([0, 1]);
  });

  it('comes back in the bed it was grown to', async () => {
    const store = await launchWith(V4_BLOB);
    expect(store.getState().progress.gardenSize).toBe(12);
  });

  it('carries on planting where the bed actually left off', async () => {
    const store = await launchWith(V4_BLOB);
    const { sessions, progress } = store.getState();
    expect(nextFreeSlot(sessions, progress.gardenSize)).toBe(2);
  });

  it('keeps the rest of the user untouched', async () => {
    const store = await launchWith(V4_BLOB);
    const { progress, settings } = store.getState();

    expect(progress.stage).toBe(2);
    expect(progress.seenTipIds).toEqual(['s2-01']);
    expect(settings.theme).toBe('ink');
    expect(settings.reminderAt).toBe('07:30');
  });

  it('does not send a returning user back through onboarding', async () => {
    const store = await launchWith(V4_BLOB);
    expect(store.getState().settings.onboardedAt).not.toBeNull();
  });

  it('round-trips a notebook that has something in it', async () => {
    const store = await launchWith(V4_BLOB);
    const { notes, sessions } = store.getState();

    expect(notes.map((n: { id: string }) => n.id)).toEqual(['n1', 'n2']);
    expect(notes[0].body).toBe('call the dentist');
    // The link is by when the sitting began, and it has to survive the disk.
    expect(notes[0].sittingStartedAt).toBe(sessions[0].startedAt);
    // A note written outside a sitting keeps pointing at nothing.
    expect(notes[1].sittingStartedAt).toBeUndefined();
  });

  it('comes back with an empty notebook if the blob somehow has none', async () => {
    // Not a shape any build wrote — the point is that the default holds even
    // so, and that the garden in the same blob still comes back.
    const store = await launchWith(V4_BLOB_WITHOUT_NOTES);
    expect(store.getState().notes).toEqual([]);
    expect(store.getState().sessions).toHaveLength(1);
    expect(store.getState().progress.gardenSize).toBe(6);
  });
});

describe('a cold launch with nothing to read', () => {
  it('is an empty garden that has not been onboarded', async () => {
    const store = await launchWith(null);

    expect(store.getState().sessions).toHaveLength(0);
    expect(store.getState().notes).toEqual([]);
    expect(store.getState().settings.onboardedAt).toBeNull();
    expect(store.getState().settings.hideSeconds).toBe(true);
  });

  it('opens on the starter bed', async () => {
    const store = await launchWith(null);
    expect(store.getState().progress.gardenSize).toBe(STARTER_GARDEN);
  });

  it('leaves a usable app rather than a permanent splash when the blob is corrupt', async () => {
    const store = await launchWith('{ this is not json');

    expect(store.getState().hydrated).toBe(true);
    expect(store.getState().sessions).toHaveLength(0);
    expect(store.getState().progress.gardenSize).toBe(STARTER_GARDEN);
  });
});
