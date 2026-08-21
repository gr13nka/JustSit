import { Note, Session } from '../../store/types';
import {
  appendThought,
  noteForSession,
  noteForSitting,
  notedSlots,
  notesNewestFirst,
  sessionForNote,
} from '../notes';

const TEN_MIN = 600_000;

function sitting(id: string, startedAt: number, slots: number[] = [0]): Session {
  return {
    id,
    startedAt,
    durationMs: TEN_MIN,
    completedAt: startedAt + TEN_MIN,
    stage: 1,
    plants: slots.map((slot) => ({ key: 'grass', slot })),
  };
}

function note(id: string, createdAt: number, sittingStartedAt?: number): Note {
  return {
    id,
    body: `note ${id}`,
    createdAt,
    ...(sittingStartedAt === undefined ? {} : { sittingStartedAt }),
  };
}

/** What `Plot.plants` hands the grid: a plant, its dot, and the sitting behind it. */
function grown(session: Session) {
  return session.plants.map((plant) => ({ ...plant, session }));
}

describe('noteForSession', () => {
  it('finds the note caught during that sitting', () => {
    const session = sitting('a', 1_000);
    const notes = [note('n1', 900, 500), note('n2', 1_400, 1_000)];

    expect(noteForSession(notes, session)?.id).toBe('n2');
  });

  it('is undefined for a sitting nobody wrote in', () => {
    expect(noteForSession([note('n1', 900, 500)], sitting('a', 1_000))).toBeUndefined();
  });

  it('matches on when the sitting began, not on when the note was written', () => {
    // The whole point of the link: the note exists before the session does, so
    // its own timestamp says nothing about which sitting it belongs to.
    const session = sitting('a', 1_000);
    const caught = note('n1', 1_000 + TEN_MIN / 2, 1_000);

    expect(noteForSession([caught], session)?.id).toBe('n1');
  });
});

describe('noteForSitting', () => {
  it('finds the note by when the sitting began, before there is a session', () => {
    // Which is the whole reason it takes an instant: the screen that writes a
    // note asks this in the middle of a sitting.
    const notes = [note('n1', 900, 500), note('n2', 1_400, 1_000)];
    expect(noteForSitting(notes, 1_000)?.id).toBe('n2');
  });

  it('is undefined for a sitting nothing has been written in yet', () => {
    expect(noteForSitting([note('n1', 900, 500)], 1_000)).toBeUndefined();
  });
});

describe('appendThought', () => {
  it('makes two thoughts caught in one sitting one note of two lines', () => {
    // The rule the notebook is built on: one sitting, one card. Raising the
    // card twice adds a line rather than starting a second note.
    expect(appendThought('call the dentist', 'and the roof')).toBe(
      'call the dentist\nand the roof'
    );
    expect(appendThought('call the dentist', 'and the roof').split('\n')).toHaveLength(2);
  });

  it('keeps adding lines, one per thought', () => {
    const twice = appendThought('one', 'two');
    expect(appendThought(twice, 'three').split('\n')).toEqual(['one', 'two', 'three']);
  });

  it('is just the thought when there was nothing there', () => {
    expect(appendThought('', 'first thing')).toBe('first thing');
  });

  it('is unchanged by a thought that is nothing', () => {
    // The card can be raised and lowered without writing anything, and doing so
    // must not leave a blank line on the note underneath.
    expect(appendThought('already here', '   ')).toBe('already here');
  });

  it('trims both, so a note is never padded by the keyboard', () => {
    expect(appendThought('  first  ', '\n second \n')).toBe('first\nsecond');
  });
});

describe('sessionForNote', () => {
  it('finds the sitting a note was caught in', () => {
    const sessions = [sitting('a', 1_000), sitting('b', 5_000)];
    expect(sessionForNote(sessions, note('n1', 5_100, 5_000))?.id).toBe('b');
  });

  it('is undefined for a note written outside a sitting', () => {
    expect(sessionForNote([sitting('a', 1_000)], note('n1', 1_100))).toBeUndefined();
  });

  it('is undefined when the sitting was abandoned', () => {
    // Nothing was recorded, so there is nothing to point at — and the note is
    // still the user's. This is the case the link is allowed to fail on.
    expect(sessionForNote([sitting('a', 1_000)], note('n1', 4_000, 3_000))).toBeUndefined();
  });
});

describe('notedSlots', () => {
  it('marks the dots grown by a sitting that left a note', () => {
    const plants = [...grown(sitting('a', 1_000, [0])), ...grown(sitting('b', 2_000, [1]))];
    expect(notedSlots([note('n1', 1_100, 1_000)], plants)).toEqual(new Set([0]));
  });

  it('marks every dot of a sitting that grew more than one', () => {
    // A bundle is one sitting, so one note stands behind all of its plants.
    const plants = grown(sitting('a', 1_000, [4, 5, 6]));
    expect(notedSlots([note('n1', 1_100, 1_000)], plants)).toEqual(new Set([4, 5, 6]));
  });

  it('is empty when nothing was written', () => {
    expect(notedSlots([], grown(sitting('a', 1_000)))).toEqual(new Set());
  });

  it('ignores notes written outside a sitting', () => {
    const plants = grown(sitting('a', 1_000));
    expect(notedSlots([note('n1', 1_100)], plants)).toEqual(new Set());
  });
});

describe('notesNewestFirst', () => {
  it('reads the notebook from the back', () => {
    const notes = [note('a', 1_000), note('b', 3_000), note('c', 2_000)];
    expect(notesNewestFirst(notes).map((n) => n.id)).toEqual(['b', 'c', 'a']);
  });

  it('leaves what it was given alone', () => {
    const notes = [note('a', 1_000), note('b', 3_000)];
    notesNewestFirst(notes);
    expect(notes.map((n) => n.id)).toEqual(['a', 'b']);
  });
});
