/**
 * Which column each note card lands in.
 *
 * Two columns of cards of different heights is a masonry, and the usual way to
 * lay one out is to render everything, measure it, and then move it — which
 * costs a frame in which the cards are in the wrong places. This estimates
 * instead: a card's height is very nearly how many lines of body it shows, and
 * a screen of notes only has to look evenly packed, not be provably optimal.
 *
 * Pure, and tested without a renderer, on the `field.ts` precedent — the
 * guarantee it makes is about arrangement rather than about pixels, and that is
 * exactly the kind of thing that stops being true silently.
 */

/**
 * How many lines of body a card shows before it stops.
 *
 * A note is a thought, not an essay, and a card is a way back into one rather
 * than the place to read it. Long ones are opened; this is what the pile looks
 * like. Shared with `NoteCard` rather than written down in both, because the
 * estimate below is only honest if it clamps where the drawing does.
 */
export const CARD_LINES = 6;

/**
 * How many characters of a note's own face fit across a full line of a
 * half-width card.
 *
 * A rough number is the right kind of number here — it decides which of two
 * columns a card starts in and nothing else — but it is measured rather than
 * guessed, because the clamp above is only honest if the estimate fills a card
 * where the drawing does. `Math.ceil` is what accounts for the ragged last
 * line, so what this wants is a *full* line, word breaks and all.
 *
 * Shantell at 18px wraps at about 10.7 characters to the line in an iPhone SE's
 * column, 12.2 in an iPhone 15's and 12.9 in the phone this app is judged on —
 * text widths of 123.5, 132.5 and 141.5pt once `Screen`'s margin, the gutter
 * between the columns and the card's own padding are taken off 375, 393 and
 * 411. Twelve is the middle of those, and low is the safer side of the three to
 * land on: an estimate that fills a card slightly early deals it to the shorter
 * column, while one that runs past the clamp counts a long note short and puts
 * every card after it on the wrong side.
 *
 * It was 22 while the pile was set in the body face, which was the same
 * arithmetic without the word breaks and against a column a little too wide.
 */
const LINE_CHARS = 12;

/** What the meta line under the body is worth, in lines of body. */
const META = 1.4;

/**
 * How tall one card is likely to be, in lines.
 *
 * The clamp is the part that matters. Without it a note ten times the length of
 * its card would be counted ten times as tall, and one long thought would push
 * every card after it into the other column.
 */
export function noteWeight(body: string): number {
  const lines = Math.ceil(body.trim().length / LINE_CHARS);
  return Math.min(CARD_LINES, Math.max(1, lines)) + META;
}

/**
 * Deals cards into columns, each one going wherever there is least.
 *
 * Reading order is left to right along a row of columns, so a run of short
 * notes alternates and a long one is followed on the other side — which is what
 * makes the two columns end level without anything having been measured.
 *
 * Returns indices rather than the cards themselves, so this file never learns
 * what a note is. Ties go to the leftmost column, which keeps the first card of
 * an empty screen where the eye starts.
 */
export function masonry(weights: readonly number[], columns: number): number[][] {
  const count = Math.max(1, Math.floor(columns));
  const filled = Array.from({ length: count }, () => 0);
  const out: number[][] = Array.from({ length: count }, () => []);

  weights.forEach((weight, i) => {
    let shortest = 0;
    for (let c = 1; c < count; c++) {
      if (filled[c] < filled[shortest]) shortest = c;
    }
    out[shortest].push(i);
    filled[shortest] += weight;
  });

  return out;
}
