import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage } from 'zustand/middleware';

import { DEFAULT_THEME, isKnownTheme } from '../theme/themes';
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

  // Belt and braces beside the migration. `gardenSize` is the shape of the
  // garden itself rather than a preference, so a blob that arrives without one
  // — or with something that is not a bed — takes the default rather than
  // handing the grid a lattice of `undefined` cells to draw.
  if (typeof progress.gardenSize !== 'number' || !(progress.gardenSize >= 1)) {
    progress.gardenSize = current.progress.gardenSize;
  }

  // Belt and braces again. Every blob the app has ever written carries a
  // `notes` key; the default is here for the one that reaches this line without
  // it anyway — a write cut in half — because a list the app maps over must be
  // a list.
  const notes = Array.isArray(stored.notes) ? stored.notes : current.notes;

  // The third of the same guard, and the one with teeth. `currentPlot` walks
  // `plants` for every session on every render, so a session that got here
  // without one takes the garden down rather than drawing short.
  const sessions = (
    Array.isArray(stored.sessions) ? stored.sessions : current.sessions
  ).map((session) =>
    Array.isArray(session.plants) ? session : { ...session, plants: [] }
  );

  const settings = { ...current.settings, ...stored.settings };
  if (!isKnownTheme(String(settings.theme))) {
    settings.theme = DEFAULT_THEME;
  }

  return {
    ...current,
    sessions,
    notes,
    progress,
    settings,
  };
}

/**
 * Bump when a shape change would break an existing install. Users have real
 * gardens on their phones; getting this wrong loses them permanently.
 */
export const STORAGE_VERSION = 4;

/**
 * Reads a stored blob forward to today's shape. Anything older than version 4
 * is discarded, and the app opens on an empty starter bed.
 *
 * **This is a wipe, and it is deliberate.** The rule this file carried until now
 * was that a migration may never return a fresh state, because losing a garden
 * is the one failure here that cannot be undone. Version 4 is the exception,
 * taken knowingly and once.
 *
 * What forces it is that the ladder no longer has anywhere to put an old
 * garden. A sequence of beds flattened into one bed is the sum of their sizes —
 * two malas come to 216, which is not a rung — so preserving such a blob would
 * mean teaching `nextGardenSize` about arbitrary sizes, and teaching the shape
 * rules about beds nobody could ever have grown, for the sake of installs that
 * do not exist. The app has not shipped. Nobody is holding a garden this
 * throws away, and Reset is already the answer for anyone who changes their
 * mind about the one they have.
 *
 * That licence expires with this version. The next shape change goes back to
 * migrating: it will be a real phone's real garden by then, and there is no
 * second one of these.
 */
export function migrate(persisted: unknown, version: number): unknown {
  if (persisted === null || typeof persisted !== 'object') return persisted;

  // An empty object rather than a built state: `mergePersisted` runs next and
  // lays every default down over it, so the fresh install is described in one
  // place instead of two that could disagree. A blob from a *newer* version —
  // a downgrade — is passed through untouched, which is what the merge's own
  // guards are for.
  return version < STORAGE_VERSION ? {} : persisted;
}
