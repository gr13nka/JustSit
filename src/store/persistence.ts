import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage } from 'zustand/middleware';

import { Progress, Session, Settings } from './types';

/**
 * The one place that knows how state reaches the disk.
 *
 * AsyncStorage holds the whole state as a single JSON blob. At two sessions a
 * day that is roughly 150KB after five years, comfortably inside its limits —
 * this is an adequate choice, not a shortcut. If it ever stops being adequate,
 * `expo-sqlite` slots in here and nothing outside src/store/ changes.
 */
export const STORAGE_KEY = 'justsit/v1';

export const storage = createJSONStorage(() => AsyncStorage);

/** Exactly what reaches the disk. `hydrated` is about this launch, not the user. */
export type PersistedState = {
  sessions: Session[];
  progress: Progress;
  settings: Settings;
};

/**
 * Zustand's default merge is shallow, so a stored `settings` would replace the
 * defaults wholesale and any field added later would arrive `undefined` for
 * every existing install — a bug invisible until someone with an old blob opens
 * the app. Merging each object over its defaults closes that off once: a new
 * field then needs a default and nothing else.
 *
 * `sessions` is replaced rather than merged. It is a list of facts, and the
 * disk is the authority on it.
 */
export function mergePersisted<T extends PersistedState>(
  persisted: unknown,
  current: T
): T {
  const stored = (persisted ?? {}) as Partial<PersistedState>;

  return {
    ...current,
    sessions: stored.sessions ?? current.sessions,
    progress: { ...current.progress, ...stored.progress },
    settings: { ...current.settings, ...stored.settings },
  };
}

/**
 * Bump when a shape change would break an existing install, and add the
 * corresponding branch to `migrate`. Users have real gardens on their phones;
 * a bad migration loses them permanently.
 */
export const STORAGE_VERSION = 2;

type Migration = (state: Record<string, unknown>) => Record<string, unknown>;

/**
 * `steps[n]` upgrades a version-n blob to n+1. They run in sequence from
 * whatever is on disk, so someone who skipped a release still lands on today's
 * shape without a special case.
 *
 * Only real shape changes belong here. A field that merely needs a default is
 * already handled by `mergePersisted`, which runs on every launch.
 *
 * Never return a fresh state from a step. Losing a garden is not recoverable.
 */
const steps: Record<number, Migration> = {
  /**
   * v2 gave every session the slot it grew in. Before it, position *was* array
   * order, so replaying array order reproduces each existing garden exactly as
   * its owner last saw it.
   */
  1: (state) => {
    const sessions = state.sessions;
    if (!Array.isArray(sessions)) return state;

    return {
      ...state,
      sessions: sessions.map((session, i) => ({ ...session, slot: i })),
    };
  },
};

export function migrate(persisted: unknown, version: number): unknown {
  if (persisted === null || typeof persisted !== 'object') return persisted;

  let state = persisted as Record<string, unknown>;
  for (let v = version; v < STORAGE_VERSION; v++) {
    const step = steps[v];
    if (step) state = step(state);
  }
  return state;
}
