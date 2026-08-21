import { CARD_LINES, masonry, noteWeight } from '../masonry';

describe('noteWeight', () => {
  it('gives a one-line note the smallest card', () => {
    expect(noteWeight('rain')).toBeLessThan(noteWeight('rain on the window was the object'));
  });

  it('grows with the note until the card stops growing', () => {
    const long = 'x'.repeat(400);
    const longer = 'x'.repeat(4000);

    // The card clamps, so the estimate has to: one very long thought would
    // otherwise push every card after it into the other column.
    expect(noteWeight(long)).toBe(noteWeight(longer));
    expect(noteWeight(longer)).toBeLessThan(CARD_LINES + 2);
  });

  it('never gives a card less than a line', () => {
    expect(noteWeight('')).toBeGreaterThan(1);
    expect(noteWeight('   ')).toBe(noteWeight('a'));
  });
});

describe('masonry', () => {
  it('alternates cards of the same height', () => {
    const even = [2, 2, 2, 2];
    expect(masonry(even, 2)).toEqual([
      [0, 2],
      [1, 3],
    ]);
  });

  it('puts the next card wherever there is least', () => {
    // A tall first card keeps taking the shorter column until it has caught up,
    // which is the whole rule and the reason nothing has to be measured.
    expect(masonry([8, 1, 1, 1], 2)).toEqual([
      [0],
      [1, 2, 3],
    ]);
  });

  it('starts on the left', () => {
    expect(masonry([1], 2)).toEqual([[0], []]);
  });

  it('keeps every card exactly once, in reading order down each column', () => {
    const weights = [3, 1, 5, 2, 4, 1, 6, 2];
    const columns = masonry(weights, 2);

    expect(columns.flat().sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    for (const column of columns) {
      expect(column).toEqual([...column].sort((a, b) => a - b));
    }
  });

  it('leaves the two columns close to level', () => {
    const weights = [3, 1, 5, 2, 4, 1, 6, 2];
    const [left, right] = masonry(weights, 2);
    const total = (column: number[]) => column.reduce((sum, i) => sum + weights[i], 0);

    // The greedy rule can only ever be out by the last card it placed.
    expect(Math.abs(total(left) - total(right))).toBeLessThanOrEqual(Math.max(...weights));
  });

  it('handles an empty screen and a single column', () => {
    expect(masonry([], 2)).toEqual([[], []]);
    expect(masonry([1, 2, 3], 1)).toEqual([[0, 1, 2]]);
  });
});
