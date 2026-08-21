import { Note, Session } from '../store/types';
import { Grown } from './plots';

/**
 * The join between a thought and the sitting it was caught in.
 *
 * It is a join and not a field because of *when* a note is written: in the
 * middle of a sitting, before there is a session to hang it on. A session's id
 * is minted at completion, so the only handle a note can take at the moment it
 * exists is the instant the sitting started — and that instant is permanent,
 * unlike everything else about a sitting still in progress.
 *
 * The consequence worth stating: the link is a *lookup that may fail*, not a
 * reference. A sitting left early records no session at all, so its note points
 * at nothing forever. That is the correct outcome rather than a dangling one —
 * the garden only ever shows sittings that finished, and a note is not a
 * record of a sitting. It is a thought the user had.
 *
 * Every function here is pure and takes the lists it needs, which is what keeps
 * the rule in one place: two sittings can start in the same millisecond only if
 * a phone can be sat in twice at once.
 */

/**
 * The note caught during the sitting that began at `sittingStartedAt`, if one
 * was.
 *
 * Named by the instant rather than by a session, because the screen that writes
 * notes asks this in the middle of a sitting — there is no session to name yet.
 * There is at most one answer: a sitting leaves one note however many times the
 * card is raised during it, which is what `appendThought` keeps true.
 */
export function noteForSitting(
  notes: readonly Note[],
  sittingStartedAt: number
): Note | undefined {
  return notes.find((note) => note.sittingStartedAt === sittingStartedAt);
}

/** The note caught during a sitting, if one was. */
export function noteForSession(
  notes: readonly Note[],
  session: Session
): Note | undefined {
  return noteForSitting(notes, session.startedAt);
}

/**
 * A second thought caught in the same sitting, put down under the first.
 *
 * One sitting leaves one note, and this is what lets that hold while the card
 * can be raised as often as you like: what is caught the second time becomes a
 * new line of the note the sitting already has. Minting another instead would
 * make a twenty-minute sitting with three thoughts in it look like three
 * sittings in the notebook, and would leave `sittingStartedAt` — which every
 * screen reads as a lookup answering with one note — quietly ambiguous.
 *
 * A line break and nothing else. No separator, no time: this is a page
 * somebody scribbled on twice, not a log of when they scribbled.
 */
export function appendThought(body: string, thought: string): string {
  const kept = body.trim();
  const added = thought.trim();

  if (kept === '') return added;
  if (added === '') return kept;

  return `${kept}\n${added}`;
}

/** The sitting a note was caught in, if it was caught in one that finished. */
export function sessionForNote(
  sessions: readonly Session[],
  note: Note
): Session | undefined {
  if (note.sittingStartedAt === undefined) return undefined;
  return sessions.find((session) => session.startedAt === note.sittingStartedAt);
}

/**
 * Which dots in a garden grew out of a sitting that left a note.
 *
 * Answered for a whole plot at once rather than one plant at a time, because
 * the caller is a grid of a hundred and eight and the question is asked of
 * every cell before anything is touched. A sitting can grow two or three
 * plants, and all of them carry the same note.
 */
export function notedSlots(
  notes: readonly Note[],
  plants: readonly Grown[]
): Set<number> {
  const sittings = new Set(
    notes
      .map((note) => note.sittingStartedAt)
      .filter((startedAt): startedAt is number => startedAt !== undefined)
  );

  return new Set(
    plants
      .filter((plant) => sittings.has(plant.session.startedAt))
      .map((plant) => plant.slot)
  );
}

/**
 * Newest first — the order a notebook is read in, and the opposite of the order
 * it is written in.
 *
 * Sorted rather than stored reversed: the store appends, as it does for
 * sessions, and which end a screen reads from is the screen's business.
 */
export function notesNewestFirst(notes: readonly Note[]): Note[] {
  return [...notes].sort((a, b) => b.createdAt - a.createdAt);
}
