import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage } from 'zustand/middleware';

import { gardensFromSlots, STARTER_GARDEN } from '../domain/plots';
import { Note, Progress, Session, Settings } from './types';

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
  notes: Note[];
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
 * `sessions` and `notes` are replaced rather than merged. Each is a list of
 * facts, and the disk is the authority on it — the only thing done to them
 * here is to insist that they are lists.
 */
export function mergePersisted<T extends PersistedState>(
  persisted: unknown,
  current: T
): T {
  const stored = (persisted ?? {}) as Partial<PersistedState>;

  const progress = { ...current.progress, ...stored.progress };

  // Belt and braces beside the migration. `gardens` is the shape of the garden
  // itself rather than a preference, so a blob that arrives without one — or
  // with an empty or unreadable one — takes the default rather than leaving
  // every plot arithmetic to divide by nothing.
  if (!Array.isArray(progress.gardens) || progress.gardens.length === 0) {
    progress.gardens = current.progress.gardens;
  }

  // Belt and braces again, and not history: the notebook and version 3 are the
  // same change, so every blob that has ever carried a 3 has a `notes` key. The
  // default is here for the blob that reaches this line without one anyway — a
  // migration that did not run, a write cut in half — because a list the app
  // maps over must be a list.
  const notes = Array.isArray(stored.notes) ? stored.notes : current.notes;

  // The third of the same guard, and the one with teeth. `plants` arrived with
  // version 3 too, and `plotAt` walks it for every session on every render, so
  // a session that got here without one takes the garden down rather than
  // drawing short.
  const sessions = (
    Array.isArray(stored.sessions) ? stored.sessions : current.sessions
  ).map((session) =>
    Array.isArray(session.plants) ? session : { ...session, plants: [] }
  );

  return {
    ...current,
    sessions,
    notes,
    progress,
    settings: { ...current.settings, ...stored.settings },
  };
}

/**
 * Bump when a shape change would break an existing install, and add the
 * corresponding branch to `migrate`. Users have real gardens on their phones;
 * a bad migration loses them permanently.
 */
export const STORAGE_VERSION = 3;

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

  /**
   * v3 made a sitting worth a *choice* of plants rather than one hashed plant,
   * and made a garden a size the user picks rather than always 108.
   *
   * Both halves are a straight re-reading of what is already there. A stored
   * `plant` and `slot` become the one-plant list they always were; the sizes
   * are rebuilt from the highest slot in use, so every finished garden keeps
   * its 108 and the open one stays a 108 rather than being retrofitted to a
   * size its owner never chose.
   */
  2: (state) => {
    const sessions = state.sessions;
    if (!Array.isArray(sessions)) return state;

    let maxSlot = -1;
    const grown = sessions.map((session, i) => {
      const old = session as Record<string, unknown>;

      // Defaulted rather than trusted. A plant that arrived here malformed is
      // still someone's sitting, and dropping it is the one unrecoverable
      // outcome; array order is what its slot meant before v2 anyway.
      const slot = typeof old.slot === 'number' ? old.slot : i;
      const key = typeof old.plant === 'string' ? old.plant : 'grass';
      if (slot > maxSlot) maxSlot = slot;

      const next: Record<string, unknown> = { ...old, plants: [{ key, slot }] };
      delete next.plant;
      delete next.slot;
      return next;
    });

    const progress = (state.progress ?? {}) as Record<string, unknown>;

    return {
      ...state,
      sessions: grown,
      progress: {
        ...progress,
        gardens: maxSlot >= 0 ? gardensFromSlots(maxSlot) : [STARTER_GARDEN],
      },
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
