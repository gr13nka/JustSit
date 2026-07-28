/**
 * Launching on a garden written by an older version, end to end.
 *
 * `persistence.test.ts` covers `migrate` and `mergePersisted` as pieces. This
 * covers the composition — read → migrate → merge → store — because that is
 * where a garden is actually lost, and losing one is not recoverable.
 */

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

describe('a cold launch on a version 1 garden', () => {
  it('brings every plant back, in the dots array order used to mean', async () => {
    const store = await launchWith(V1_BLOB);
    const { sessions } = store.getState();

    expect(sessions.map((s: { id: string }) => s.id)).toEqual(['a', 'b', 'c']);
    expect(sessions.map((s: { slot: number }) => s.slot)).toEqual([0, 1, 2]);
  });

  it('keeps the rest of the user and defaults only what did not exist yet', async () => {
    const store = await launchWith(V1_BLOB);
    const { progress, settings } = store.getState();

    expect(progress.stage).toBe(2);
    expect(progress.seenTipIds).toEqual(['s1-01']);
    expect(settings.onboardedAt).toBe(700);
    expect(settings.reminderAt).toBe('07:30');
    expect(settings.lastDurationMs).toBe(600_000);
    // The one field version 1 had never heard of.
    expect(settings.hideSeconds).toBe(true);
  });

  it('does not send a returning user back through onboarding', async () => {
    // The redirect keys off this being null. Getting it wrong would look, to
    // someone with a two-year garden, exactly like the app forgetting them.
    const store = await launchWith(V1_BLOB);
    expect(store.getState().settings.onboardedAt).not.toBeNull();
  });
});

describe('a cold launch with nothing to read', () => {
  it('is an empty garden that has not been onboarded', async () => {
    const store = await launchWith(null);

    expect(store.getState().sessions).toHaveLength(0);
    expect(store.getState().settings.onboardedAt).toBeNull();
    expect(store.getState().settings.hideSeconds).toBe(true);
  });

  it('leaves a usable app rather than a permanent splash when the blob is corrupt', async () => {
    const store = await launchWith('{ this is not json');

    expect(store.getState().hydrated).toBe(true);
    expect(store.getState().sessions).toHaveLength(0);
  });
});
